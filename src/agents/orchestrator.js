/**
 * Orchestrator
 *
 * 协调 Planner 和 Worker 智能体，管理整个开发流程
 */

import { PlannerAgent } from './planner.js';
import { WorkerAgent } from './worker.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

export class Orchestrator {
  constructor(config = {}) {
    this.config = {
      worktreeBase: config.worktreeBase || '../worktrees',
      maxParallelWorkers: config.maxParallelWorkers || 4,
      projectRoot: config.projectRoot || process.cwd(),
      ...config
    };

    this.planner = new PlannerAgent(this);
    this.workers = new Map();
    this.results = [];
    this.mcpClient = null; // 如果有 MCP 连接
    this.currentFileKey = null;

    // 进度跟踪
    this.progress = {
      total: 0,
      completed: 0,
      failed: 0,
      inProgress: []
    };
  }

  /**
   * 主入口：从 Figma URL 开始整个流程
   */
  async processDesign(figmaUrl) {
    console.log('\n' + '='.repeat(60));
    console.log('🎨 Figma 多智能体前端开发系统');
    console.log('='.repeat(60) + '\n');

    const startTime = Date.now();

    try {
      // 提取 file key
      this.currentFileKey = this.extractFileKey(figmaUrl);

      // Step 1: Planner 分析设计稿
      console.log('📋 Step 1: 分析 Figma 设计稿...\n');
      const plan = await this.planner.analyzeDesign(figmaUrl);

      if (!plan || !plan.components || plan.components.length === 0) {
        throw new Error('Planner 未能生成有效的开发计划');
      }

      console.log(`\n✅ 识别到 ${plan.components.length} 个组件:`);
      plan.components.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.name} (优先级: ${c.priority}, 复杂度: ${c.complexity || 'medium'})`);
      });

      // 保存设计 tokens
      await this.saveDesignTokens(plan.designTokens);

      // Step 2: 创建 git worktrees
      console.log('\n📁 Step 2: 创建 Git Worktrees...\n');
      await this.setupWorktrees(plan.components);

      // Step 3: 并行启动 Workers
      console.log('\n🚀 Step 3: 启动 Worker 智能体并行开发...\n');
      this.progress.total = plan.components.length;
      const results = await this.executeWorkers(plan.components, plan.designTokens);

      // Step 4: 汇总结果
      console.log('\n📊 Step 4: 汇总开发结果...\n');
      this.printSummary(results, startTime);

      // Step 5: 合并分支（可选）
      console.log('\n🔀 Step 5: 合并建议\n');
      this.printMergeInstructions(plan.components);

      return {
        success: true,
        plan,
        results,
        duration: Date.now() - startTime
      };

    } catch (error) {
      console.error('\n❌ 处理失败:', error.message);
      throw error;
    }
  }

  /**
   * 从 URL 提取 Figma file key
   */
  extractFileKey(url) {
    const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    return match ? match[1] : url;
  }

  /**
   * 保存设计 tokens 到项目
   */
  async saveDesignTokens(tokens) {
    if (!tokens) return;

    const tokensDir = join(this.config.projectRoot, 'src/styles');
    if (!existsSync(tokensDir)) {
      mkdirSync(tokensDir, { recursive: true });
    }

    // 生成 TypeScript tokens 文件
    const tokensContent = `/**
 * Design Tokens
 * 自动从 Figma 提取生成
 * 生成时间: ${new Date().toISOString()}
 */

export const colors = ${JSON.stringify(tokens.colors || {}, null, 2)} as const;

export const spacing = ${JSON.stringify(tokens.spacing || {}, null, 2)} as const;

export const typography = ${JSON.stringify(tokens.typography || {}, null, 2)} as const;

export const borderRadius = ${JSON.stringify(tokens.borderRadius || {}, null, 2)} as const;

export const shadows = ${JSON.stringify(tokens.shadows || {}, null, 2)} as const;

// Tailwind 配置扩展
export const tailwindExtend = {
  colors: ${JSON.stringify(tokens.colors || {}, null, 2)},
  spacing: ${JSON.stringify(tokens.spacing || {}, null, 2)},
  borderRadius: ${JSON.stringify(tokens.borderRadius || {}, null, 2)},
  boxShadow: ${JSON.stringify(tokens.shadows || {}, null, 2)},
};
`;

    const tokensPath = join(tokensDir, 'tokens.ts');
    writeFileSync(tokensPath, tokensContent, 'utf-8');
    console.log(`   ✅ 设计 Tokens 已保存: src/styles/tokens.ts`);
  }

  /**
   * 创建 git worktrees
   */
  async setupWorktrees(components) {
    const worktreeBase = join(this.config.projectRoot, this.config.worktreeBase);

    // 确保 worktree 基础目录存在
    if (!existsSync(worktreeBase)) {
      mkdirSync(worktreeBase, { recursive: true });
    }

    for (const component of components) {
      const branchName = `feature/${component.name}`;
      const worktreePath = join(worktreeBase, component.name);

      try {
        // 创建分支（如果不存在）
        await execAsync(`git branch "${branchName}" 2>/dev/null || true`, {
          cwd: this.config.projectRoot
        });

        // 检查 worktree 是否已存在
        if (existsSync(worktreePath)) {
          console.log(`   ⏭️  ${component.name}: worktree 已存在`);
          continue;
        }

        // 创建 worktree
        await execAsync(`git worktree add "${worktreePath}" "${branchName}"`, {
          cwd: this.config.projectRoot
        });

        console.log(`   ✅ ${component.name}: ${worktreePath}`);

      } catch (error) {
        // 如果分支已在另一个 worktree 中
        if (error.message.includes('already checked out')) {
          console.log(`   ⚠️  ${component.name}: 分支已被检出，跳过`);
        } else {
          console.log(`   ❌ ${component.name}: ${error.message}`);
        }
      }
    }
  }

  /**
   * 并行执行 Worker 智能体
   */
  async executeWorkers(components, designTokens) {
    const results = [];
    const worktreeBase = join(this.config.projectRoot, this.config.worktreeBase);

    // 按优先级分组
    const priorityGroups = this.groupByPriority(components);

    for (const [priority, group] of Object.entries(priorityGroups)) {
      console.log(`\n--- 优先级 ${priority} (${group.length} 个组件) ---\n`);

      // 限制并行数量
      const chunks = this.chunkArray(group, this.config.maxParallelWorkers);

      for (const chunk of chunks) {
        const promises = chunk.map(async (component) => {
          const worktreePath = join(worktreeBase, component.name);

          // 检查 worktree 是否存在
          if (!existsSync(worktreePath)) {
            console.log(`[${component.name}] ⚠️ Worktree 不存在，使用主项目目录`);
            return this.buildInMainProject(component, designTokens);
          }

          const worker = new WorkerAgent(component.name, this);
          this.workers.set(component.name, worker);
          this.progress.inProgress.push(component.name);

          try {
            const result = await worker.buildComponent({
              component,
              workingDir: worktreePath,
              designTokens
            });

            this.progress.completed++;
            this.progress.inProgress = this.progress.inProgress.filter(
              n => n !== component.name
            );

            return {
              component: component.name,
              ...result
            };

          } catch (error) {
            this.progress.failed++;
            this.progress.inProgress = this.progress.inProgress.filter(
              n => n !== component.name
            );

            return {
              component: component.name,
              status: 'failed',
              error: error.message
            };
          }
        });

        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
      }
    }

    return results;
  }

  /**
   * 在主项目中构建（fallback）
   */
  async buildInMainProject(component, designTokens) {
    const worker = new WorkerAgent(component.name, this);

    return worker.buildComponent({
      component,
      workingDir: this.config.projectRoot,
      designTokens
    });
  }

  /**
   * Worker 完成回调
   */
  onWorkerComplete(componentName, report) {
    this.results.push({
      component: componentName,
      ...report
    });

    const progress = `[${this.progress.completed + 1}/${this.progress.total}]`;
    console.log(`\n${progress} ${componentName} 开发完成`);
  }

  /**
   * 按优先级分组
   */
  groupByPriority(components) {
    return components.reduce((groups, component) => {
      const priority = component.priority || 1;
      if (!groups[priority]) {
        groups[priority] = [];
      }
      groups[priority].push(component);
      return groups;
    }, {});
  }

  /**
   * 分割数组
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 打印汇总
   */
  printSummary(results, startTime) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const partial = results.filter(r => r.status === 'partial').length;

    console.log('='.repeat(60));
    console.log('📊 开发汇总');
    console.log('='.repeat(60));
    console.log(`   总组件数: ${results.length}`);
    console.log(`   ✅ 成功: ${successful}`);
    console.log(`   ⚠️  部分完成: ${partial}`);
    console.log(`   ❌ 失败: ${failed}`);
    console.log(`   ⏱️  总耗时: ${duration}s`);
    console.log('='.repeat(60));

    // 详细结果
    console.log('\n详细结果:');
    results.forEach(r => {
      const emoji = { success: '✅', partial: '⚠️', failed: '❌' }[r.status] || '📝';
      console.log(`   ${emoji} ${r.component}: ${r.summary || r.error || '完成'}`);
      if (r.filesCreated && r.filesCreated.length > 0) {
        r.filesCreated.forEach(f => console.log(`      - ${f}`));
      }
    });
  }

  /**
   * 打印合并说明
   */
  printMergeInstructions(components) {
    console.log('手动合并分支到 main:');
    console.log('```bash');
    console.log('# 切换到主分支');
    console.log('git checkout main');
    console.log('');
    components.forEach(c => {
      console.log(`# 合并 ${c.name}`);
      console.log(`git merge feature/${c.name} --no-edit`);
    });
    console.log('```');
    console.log('');
    console.log('或者创建一个汇总 PR:');
    console.log('```bash');
    console.log('# 创建汇总分支');
    console.log('git checkout -b feature/all-components');
    components.forEach(c => {
      console.log(`git merge feature/${c.name} --no-edit`);
    });
    console.log('git push -u origin feature/all-components');
    console.log('```');
  }

  /**
   * 调用 MCP（如果可用）
   */
  async callMcp(method, params) {
    if (!this.mcpClient) {
      throw new Error('MCP client not connected');
    }
    return await this.mcpClient.call(method, params);
  }

  /**
   * 清理所有 worktrees
   */
  async cleanupWorktrees() {
    const worktreeBase = join(this.config.projectRoot, this.config.worktreeBase);

    try {
      const { stdout } = await execAsync('git worktree list', {
        cwd: this.config.projectRoot
      });

      const worktrees = stdout.split('\n')
        .filter(line => line.includes(this.config.worktreeBase))
        .map(line => line.split(' ')[0]);

      for (const worktree of worktrees) {
        await execAsync(`git worktree remove "${worktree}" --force`, {
          cwd: this.config.projectRoot
        });
        console.log(`   🗑️  移除: ${worktree}`);
      }

      await execAsync('git worktree prune', {
        cwd: this.config.projectRoot
      });

      console.log('✅ Worktrees 清理完成');

    } catch (error) {
      console.error('清理失败:', error.message);
    }
  }
}
