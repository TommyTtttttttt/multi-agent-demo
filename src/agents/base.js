/**
 * Base Agent Class (CLI Mode)
 *
 * 使用 Claude CLI 作为后端，直接利用其内置工具（Write, Bash, Read 等）
 * 不再需要自定义工具循环，Claude CLI 会自动处理工具调用
 */

import { spawnSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Claude CLI path
const CLAUDE_CLI_PATH = process.env.CLAUDE_CLI_PATH ||
  '/Users/tt/.cursor/extensions/anthropic.claude-code-2.1.11-darwin-arm64/resources/native-binary/claude';

// Temp directory for prompts
const AGENT_TEMP_DIR = join(tmpdir(), 'multi-agent-demo');

export class BaseAgent {
  constructor(name, systemPrompt) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.verbose = process.env.VERBOSE === 'true';

    // Setup temp directory
    this.agentTempDir = join(AGENT_TEMP_DIR, this.name.replace(/[^a-zA-Z0-9-_]/g, '_'));
    if (!existsSync(this.agentTempDir)) {
      mkdirSync(this.agentTempDir, { recursive: true });
    }
  }

  /**
   * 执行任务 - 调用 Claude CLI 并让它自动使用内置工具完成任务
   * @param {string} task - 任务描述
   * @param {object} options - 选项
   * @param {string} options.workingDir - 工作目录（Claude CLI 会在此目录中操作文件）
   * @param {string[]} options.allowedTools - 允许使用的工具列表
   * @param {boolean} options.jsonOutput - 是否期望 JSON 输出
   */
  async execute(task, options = {}) {
    const {
      workingDir = process.cwd(),
      allowedTools = ['Write', 'Read', 'Bash', 'Glob', 'Grep'],
      jsonOutput = false
    } = options;

    const promptFile = join(this.agentTempDir, `prompt_${Date.now()}.md`);
    const responseFile = join(this.agentTempDir, `response_${Date.now()}.txt`);

    // Build prompt
    const prompt = `# System Instructions

${this.systemPrompt}

---

# Task

${task}

---

${jsonOutput ? '**IMPORTANT**: Your final response must be valid JSON only, no markdown or explanation.' : ''}
Please complete the task above.`;

    writeFileSync(promptFile, prompt, 'utf-8');

    this.log(`执行任务...`);
    if (this.verbose) {
      this.log(`工作目录: ${workingDir}`);
      this.log(`允许工具: ${allowedTools.join(', ')}`);
    }

    try {
      // Build CLI command with options
      const toolsArg = allowedTools.length > 0
        ? `--allowedTools "${allowedTools.join(' ')}"`
        : '';

      const outputFormat = jsonOutput ? '--output-format json' : '--output-format text';

      const cmd = `cat "${promptFile}" | "${CLAUDE_CLI_PATH}" -p ${outputFormat} ${toolsArg} --dangerously-skip-permissions`;

      const result = spawnSync('sh', ['-c', cmd], {
        cwd: workingDir,
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: 600000, // 10 minute timeout
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (result.error) {
        throw new Error(`CLI spawn error: ${result.error.message}`);
      }

      const output = result.stdout || '';
      const stderr = result.stderr || '';

      // Save response for debugging
      writeFileSync(responseFile, output, 'utf-8');

      if (result.status !== 0) {
        this.log(`CLI 警告 (exit ${result.status}): ${stderr.substring(0, 200)}`, 'warn');
      }

      this.log(`任务完成`, 'success');

      // Parse JSON if requested
      if (jsonOutput) {
        try {
          // Try to extract JSON from output
          const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) ||
                           output.match(/(\{[\s\S]*\})/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[1] || jsonMatch[0]);
          }
          return JSON.parse(output);
        } catch (e) {
          this.log(`JSON 解析失败，返回原始文本`, 'warn');
          return { raw: output };
        }
      }

      return output.trim();

    } catch (error) {
      this.log(`错误: ${error.message}`, 'error');
      writeFileSync(responseFile, `ERROR: ${error.message}`, 'utf-8');
      throw error;
    }
  }

  /**
   * 简单提问 - 不使用任何工具，只获取文本回复
   */
  async ask(question) {
    const promptFile = join(this.agentTempDir, `ask_${Date.now()}.md`);

    const prompt = `${this.systemPrompt}\n\n---\n\n${question}`;
    writeFileSync(promptFile, prompt, 'utf-8');

    const result = spawnSync('sh', [
      '-c',
      `cat "${promptFile}" | "${CLAUDE_CLI_PATH}" -p --output-format text --tools ""`
    ], {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000
    });

    if (result.error) {
      throw new Error(`Ask error: ${result.error.message}`);
    }

    return (result.stdout || '').trim();
  }

  /**
   * 日志输出
   */
  log(message, level = 'info') {
    const prefix = {
      info: '📝',
      warn: '⚠️',
      error: '❌',
      success: '✅'
    }[level] || '📝';

    console.log(`[${this.name}] ${prefix} ${message}`);
  }
}
