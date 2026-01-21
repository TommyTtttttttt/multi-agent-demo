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
      maxParallelWorkers: config.maxParallelWorkers || 2,
      projectRoot: config.projectRoot || process.cwd(),
      ...config
    };

    this.planner = new PlannerAgent();
    this.results = [];

    this.progress = {
      total: 0,
      completed: 0,
      failed: 0
    };
  }

  /**
   * 主入口：从 Figma URL 开始整个流程
   */
  async processDesign(figmaUrl) {
    console.log('\n' + '='.repeat(60));
    console.log('🎨 Multi-Agent 前端开发系统');
    console.log('='.repeat(60) + '\n');

    const startTime = Date.now();

    try {
      // Step 1: Planner 分析设计稿
      console.log('📋 Step 1: 分析设计稿...\n');
      const plan = await this.planner.analyzeDesign(figmaUrl);

      if (!plan?.components?.length) {
        throw new Error('Planner 未能生成有效的开发计划');
      }

      console.log(`\n✅ 识别到 ${plan.components.length} 个组件:`);
      plan.components.forEach((c, i) => {
        console.log(`   ${i + 1}. ${c.name} (优先级: ${c.priority})`);
      });

      // 保存 design tokens
      await this.saveDesignTokens(plan.designTokens);

      // Step 2: 创建 worktrees
      console.log('\n📁 Step 2: 创建 Git Worktrees...\n');
      await this.setupWorktrees(plan.components);

      // Step 3: 并行启动 Workers
      console.log('\n🚀 Step 3: 启动 Worker 智能体...\n');
      this.progress.total = plan.components.length;
      const results = await this.executeWorkers(plan.components, plan.designTokens);

      // Step 4: 汇总结果
      console.log('\n📊 Step 4: 汇总结果\n');
      this.printSummary(results, startTime);

      return { success: true, plan, results };

    } catch (error) {
      console.error('\n❌ 处理失败:', error.message);
      throw error;
    }
  }

  /**
   * 保存 design tokens
   */
  async saveDesignTokens(tokens) {
    if (!tokens) return;

    const tokensDir = join(this.config.projectRoot, 'src/styles');
    if (!existsSync(tokensDir)) {
      mkdirSync(tokensDir, { recursive: true });
    }

    const content = `/**
 * Design Tokens
 * 自动生成于 ${new Date().toISOString()}
 */

export const colors = ${JSON.stringify(tokens.colors || {}, null, 2)} as const;

export const spacing = ${JSON.stringify(tokens.spacing || {}, null, 2)} as const;

export const typography = ${JSON.stringify(tokens.typography || {}, null, 2)} as const;

export const borderRadius = ${JSON.stringify(tokens.borderRadius || {}, null, 2)} as const;

export const shadows = ${JSON.stringify(tokens.shadows || {}, null, 2)} as const;
`;

    writeFileSync(join(tokensDir, 'tokens.ts'), content, 'utf-8');
    console.log('   ✅ Design Tokens 已保存');
  }

  /**
   * 创建 git worktrees
   */
  async setupWorktrees(components) {
    const worktreeBase = join(this.config.projectRoot, this.config.worktreeBase);

    if (!existsSync(worktreeBase)) {
      mkdirSync(worktreeBase, { recursive: true });
    }

    for (const component of components) {
      const branchName = `feature/${component.name}`;
      const worktreePath = join(worktreeBase, component.name);

      try {
        if (existsSync(worktreePath)) {
          console.log(`   ⏭️  ${component.name}: 已存在`);
          continue;
        }

        // 创建分支和 worktree
        await execAsync(`git branch "${branchName}" 2>/dev/null || true`, {
          cwd: this.config.projectRoot
        });

        await execAsync(`git worktree add "${worktreePath}" "${branchName}"`, {
          cwd: this.config.projectRoot
        });

        console.log(`   ✅ ${component.name}`);

      } catch (error) {
        if (error.message.includes('already checked out')) {
          console.log(`   ⚠️  ${component.name}: 分支已检出`);
        } else {
          console.log(`   ❌ ${component.name}: ${error.message}`);
        }
      }
    }
  }

  /**
   * 执行 Workers
   */
  async executeWorkers(components, designTokens) {
    const results = [];
    const worktreeBase = join(this.config.projectRoot, this.config.worktreeBase);

    // 按优先级分组
    const groups = this.groupByPriority(components);

    for (const [priority, group] of Object.entries(groups)) {
      console.log(`\n--- 优先级 ${priority} (${group.length} 个组件) ---\n`);

      // 分批并行执行
      const chunks = this.chunk(group, this.config.maxParallelWorkers);

      for (const chunk of chunks) {
        const promises = chunk.map(async (component) => {
          const worktreePath = join(worktreeBase, component.name);
          const workingDir = existsSync(worktreePath)
            ? worktreePath
            : this.config.projectRoot;

          const worker = new WorkerAgent(component.name);

          const result = await worker.buildComponent({
            component,
            workingDir,
            designTokens
          });

          if (result.status === 'success') {
            this.progress.completed++;
          } else {
            this.progress.failed++;
          }

          return result;
        });

        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
      }
    }

    return results;
  }

  /**
   * 按优先级分组
   */
  groupByPriority(components) {
    return components.reduce((groups, c) => {
      const p = c.priority || 1;
      groups[p] = groups[p] || [];
      groups[p].push(c);
      return groups;
    }, {});
  }

  /**
   * 分块
   */
  chunk(array, size) {
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
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;

    console.log('='.repeat(60));
    console.log(`   总计: ${results.length} | ✅ 成功: ${success} | ❌ 失败: ${failed}`);
    console.log(`   耗时: ${duration}s`);
    console.log('='.repeat(60));

    results.forEach(r => {
      const icon = r.status === 'success' ? '✅' : '❌';
      console.log(`   ${icon} ${r.component}: ${r.summary}`);
    });
  }
}
