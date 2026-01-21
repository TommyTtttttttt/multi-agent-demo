/**
 * Base Agent Class
 *
 * 所有智能体的基类，封装了与 Claude API 交互的核心逻辑
 * 支持两种模式：API 模式（使用 SDK）和 CLI 模式（使用 claude 命令 + 临时文件）
 */

import Anthropic from '@anthropic-ai/sdk';
import { spawnSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Check if API key is available, otherwise use CLI mode
const USE_CLI_MODE = !process.env.ANTHROPIC_API_KEY;

// Temp directory for agent communication
const AGENT_TEMP_DIR = join(tmpdir(), 'multi-agent-demo');

// Claude CLI path (found via Cursor extension)
const CLAUDE_CLI_PATH = process.env.CLAUDE_CLI_PATH ||
  '/Users/tt/.cursor/extensions/anthropic.claude-code-2.1.11-darwin-arm64/resources/native-binary/claude';

export class BaseAgent {
  constructor(name, systemPrompt, tools = []) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.tools = tools;
    this.useCliMode = USE_CLI_MODE;
    this.client = this.useCliMode ? null : new Anthropic();
    this.conversationHistory = [];
    this.verbose = process.env.VERBOSE === 'true';

    // Setup temp directory for this agent
    this.agentTempDir = join(AGENT_TEMP_DIR, this.name.replace(/[^a-zA-Z0-9-_]/g, '_'));
    if (this.useCliMode) {
      this.ensureTempDir();
      this.log('🖥️  CLI 模式（使用 claude 命令 + 临时文件）');
    }
  }

  /**
   * 确保临时目录存在
   */
  ensureTempDir() {
    if (!existsSync(this.agentTempDir)) {
      mkdirSync(this.agentTempDir, { recursive: true });
    }
  }

  /**
   * 运行智能体，处理用户消息并执行工具调用循环
   */
  async run(userMessage, maxIterations = 15) {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      this.log(`迭代 ${iterations}/${maxIterations}`);

      try {
        // Use CLI or API based on mode
        const response = this.useCliMode
          ? await this.callClaudeCli()
          : await this.client.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 8096,
              system: this.systemPrompt,
              tools: this.tools,
              messages: this.conversationHistory
            });

        // 添加助手响应到历史
        this.conversationHistory.push({
          role: 'assistant',
          content: response.content
        });

        // 提取文本响应
        const textContent = response.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');

        if (textContent && this.verbose) {
          this.log(`响应: ${textContent.substring(0, 200)}...`);
        }

        // 检查是否有工具调用
        const toolUseBlocks = response.content.filter(
          block => block.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0) {
          // 没有工具调用，智能体完成
          this.log('完成（无更多工具调用）');
          return {
            success: true,
            response: textContent,
            iterations
          };
        }

        // 处理工具调用
        const toolResults = await this.processToolCalls(toolUseBlocks);
        this.conversationHistory.push({
          role: 'user',
          content: toolResults
        });

        // 检查停止条件
        if (response.stop_reason === 'end_turn' && toolUseBlocks.length === 0) {
          return {
            success: true,
            response: textContent,
            iterations
          };
        }
      } catch (error) {
        this.log(`错误: ${error.message}`, 'error');
        throw error;
      }
    }

    return {
      success: false,
      error: '达到最大迭代次数',
      iterations
    };
  }

  /**
   * 使用 Claude CLI 调用（通过临时文件）
   */
  async callClaudeCli() {
    // Build the full prompt with context
    const promptContent = this.buildCliPrompt();

    // Write prompt to temp file
    const promptFile = join(this.agentTempDir, `prompt_${Date.now()}.md`);
    const responseFile = join(this.agentTempDir, `response_${Date.now()}.txt`);

    writeFileSync(promptFile, promptContent, 'utf-8');

    try {
      // Call claude CLI with the prompt file
      // Using cat to pipe the file content to claude
      const result = spawnSync('sh', [
        '-c',
        `cat "${promptFile}" | "${CLAUDE_CLI_PATH}" -p --output-format text`
      ], {
        encoding: 'utf-8',
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        timeout: 300000, // 5 minute timeout
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (result.error) {
        throw new Error(`CLI spawn error: ${result.error.message}`);
      }

      if (result.status !== 0) {
        const stderr = result.stderr || '';
        throw new Error(`CLI exited with code ${result.status}: ${stderr}`);
      }

      const output = result.stdout || '';

      // Save response for debugging
      writeFileSync(responseFile, output, 'utf-8');

      // Parse the response
      const response = this.parseCliResponse(output.trim());

      // Cleanup old temp files (keep last 5)
      this.cleanupTempFiles();

      return response;
    } catch (error) {
      // Save error for debugging
      writeFileSync(responseFile, `ERROR: ${error.message}`, 'utf-8');
      throw error;
    }
  }

  /**
   * 构建 CLI 提示词
   */
  buildCliPrompt() {
    const toolsDescription = this.tools.length > 0
      ? `
## 🔧 工具使用规则 (CRITICAL)

你是一个自动化智能体。你**必须**通过调用工具来完成任务。

### 可用工具:
${this.tools.map(t => `- **${t.name}**: ${t.description}
  参数: ${JSON.stringify(t.input_schema.properties, null, 2)}`).join('\n\n')}

### 工具调用格式 (必须严格遵守):
当你需要执行操作时，**只能**返回以下 JSON 格式，不要包含任何其他文字:

\`\`\`json
{"tool_calls": [{"name": "工具名", "input": {"参数名": "值"}}]}
\`\`\`

### 规则:
1. 如果任务需要你执行操作 → 必须返回 JSON 工具调用
2. 只有当任务完全完成，不需要任何操作时 → 才可以用普通文字回复
3. 永远不要解释你要做什么，直接调用工具
`
      : '';

    const historySection = this.conversationHistory.length > 0
      ? `\n## 对话历史\n\n${this.formatHistory()}`
      : '';

    const lastUserMessage = this.conversationHistory
      .filter(m => m.role === 'user')
      .pop();

    const currentTask = lastUserMessage
      ? (typeof lastUserMessage.content === 'string'
          ? lastUserMessage.content
          : JSON.stringify(lastUserMessage.content))
      : '继续执行任务';

    return `# 智能体系统指令

${this.systemPrompt}
${toolsDescription}
${historySection}

---

## 当前任务

${currentTask}

---

**立即执行**: 分析上述任务，如果需要执行任何操作，返回 JSON 工具调用。`;
  }

  /**
   * 格式化对话历史
   */
  formatHistory() {
    return this.conversationHistory.map((msg, i) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      let content = '';

      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (Array.isArray(msg.content)) {
        content = msg.content.map(block => {
          if (block.type === 'text') return block.text;
          if (block.type === 'tool_use') return `[Tool Call: ${block.name}]`;
          if (block.type === 'tool_result') return `[Tool Result: ${block.content?.substring(0, 100)}...]`;
          return JSON.stringify(block);
        }).join('\n');
      } else {
        content = JSON.stringify(msg.content);
      }

      return `### ${role} (${i + 1})\n${content}`;
    }).join('\n\n');
  }

  /**
   * 解析 CLI 响应为标准格式
   */
  parseCliResponse(text) {
    // Try to extract JSON tool calls from the response
    // Look for ```json blocks or raw JSON
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
                      text.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        const json = JSON.parse(jsonStr);

        if (json.tool_calls && Array.isArray(json.tool_calls)) {
          return {
            content: json.tool_calls.map((tc, i) => ({
              type: 'tool_use',
              id: `cli-tool-${Date.now()}-${i}`,
              name: tc.name,
              input: tc.input || {}
            })),
            stop_reason: 'tool_use'
          };
        }
      } catch (e) {
        // JSON parsing failed, treat as text
        if (this.verbose) {
          this.log(`JSON parse failed: ${e.message}`, 'warn');
        }
      }
    }

    // Return as text response
    return {
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn'
    };
  }

  /**
   * 清理旧的临时文件
   */
  cleanupTempFiles() {
    try {
      const files = readdirSync(this.agentTempDir)
        .filter(f => f.startsWith('prompt_') || f.startsWith('response_'))
        .sort()
        .reverse();

      // Keep only last 10 files (5 prompt + 5 response pairs)
      const toDelete = files.slice(10);
      for (const file of toDelete) {
        try {
          unlinkSync(join(this.agentTempDir, file));
        } catch (e) {
          // Ignore deletion errors
        }
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }

  /**
   * 处理多个工具调用
   */
  async processToolCalls(toolUseBlocks) {
    const results = [];

    for (const toolUse of toolUseBlocks) {
      this.log(`调用工具: ${toolUse.name}`);

      try {
        const result = await this.executeTool(toolUse.name, toolUse.input);
        results.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: typeof result === 'string' ? result : JSON.stringify(result)
        });
      } catch (error) {
        results.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify({ error: error.message }),
          is_error: true
        });
      }
    }

    return results;
  }

  /**
   * 执行单个工具 - 子类必须重写此方法
   */
  async executeTool(name, input) {
    throw new Error(`工具 "${name}" 未实现。请在子类中重写 executeTool 方法。`);
  }

  /**
   * 清除对话历史
   */
  clearHistory() {
    this.conversationHistory = [];
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
