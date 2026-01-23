/**
 * Orchestrator
 *
 * 协调 Planner 和 Worker 智能体，管理整个开发流程
 * 包含：效率统计、流程可视化、报告生成
 */

import { PlannerAgent } from './planner.js';
import { WorkerAgent } from './worker.js';
import { SimpleVisualizer } from '../utils/visualizer.js';
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
      outputReport: config.outputReport !== false,
      ...config
    };

    this.planner = new PlannerAgent();
    this.results = [];

    // 可视化器
    this.visualizer = config.visualizer || new SimpleVisualizer();

    // 效率统计指标
    this.metrics = {
      startTime: null,
      endTime: null,
      phases: {
        planning: { start: null, end: null, duration: 0 },
        worktreeSetup: { start: null, end: null, duration: 0 },
        componentGeneration: { start: null, end: null, duration: 0 }
      },
      components: [],
      dataSource: 'unknown', // 'figma-mcp' or 'mock'
      totalTokensUsed: 0
    };

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
    this.printHeader();
    this.metrics.startTime = Date.now();

    try {
      // Phase 1: Planner 分析设计稿
      const plan = await this.runPlanningPhase(figmaUrl);

      // Phase 2: 创建 worktrees
      await this.runWorktreeSetupPhase(plan.components);

      // Phase 3: 并行启动 Workers
      const results = await this.runComponentGenerationPhase(plan.components, plan.designTokens);

      // Phase 4: 汇总结果
      this.metrics.endTime = Date.now();
      this.printSummary(results);

      // 生成报告
      if (this.config.outputReport) {
        await this.generateReport(plan, results);
      }

      return { success: true, plan, results, metrics: this.metrics };

    } catch (error) {
      console.error('\n❌ 处理失败:', error.message);
      this.metrics.endTime = Date.now();
      throw error;
    }
  }

  /**
   * Phase 1: 规划阶段
   */
  async runPlanningPhase(figmaUrl) {
    this.visualizer.printPhaseStart(1, '分析设计稿');

    this.metrics.phases.planning.start = Date.now();

    this.visualizer.printAgentStart('planner', 'Planner', '分析 Figma 设计稿...');
    const plan = await this.planner.analyzeDesign(figmaUrl);

    this.metrics.phases.planning.end = Date.now();
    this.metrics.phases.planning.duration = this.metrics.phases.planning.end - this.metrics.phases.planning.start;
    this.metrics.dataSource = plan._source || 'unknown';

    if (!plan?.components?.length) {
      this.visualizer.printAgentComplete('Planner', 'error', '未能生成有效计划');
      throw new Error('Planner 未能生成有效的开发计划');
    }

    this.visualizer.printAgentComplete('Planner', 'success', `识别到 ${plan.components.length} 个组件`);

    console.log(`\n   📋 组件列表:`);
    plan.components.forEach((c, i) => {
      console.log(`      ${i + 1}. ${c.name} (优先级: ${c.priority}, 复杂度: ${c.complexity})`);
    });
    console.log(`\n   ⏱️  规划耗时: ${(this.metrics.phases.planning.duration / 1000).toFixed(1)}s`);
    console.log(`   📊 数据来源: ${this.metrics.dataSource === 'figma-mcp' ? 'Figma MCP (真实数据)' : 'Mock (演示数据)'}`);

    // 保存 design tokens
    await this.saveDesignTokens(plan.designTokens);

    return plan;
  }

  /**
   * Phase 2: Worktree 设置阶段
   */
  async runWorktreeSetupPhase(components) {
    this.visualizer.printPhaseStart(2, '创建 Git Worktrees');

    this.metrics.phases.worktreeSetup.start = Date.now();

    this.visualizer.printAgentStart('git', 'Git', `创建 ${components.length} 个 worktrees...`);
    await this.setupWorktrees(components);
    this.visualizer.printAgentComplete('Git', 'success', `${components.length} 个 worktrees 已就绪`);

    this.metrics.phases.worktreeSetup.end = Date.now();
    this.metrics.phases.worktreeSetup.duration = this.metrics.phases.worktreeSetup.end - this.metrics.phases.worktreeSetup.start;

    console.log(`\n   ⏱️  Worktree 设置耗时: ${(this.metrics.phases.worktreeSetup.duration / 1000).toFixed(1)}s`);
  }

  /**
   * Phase 3: 组件生成阶段
   */
  async runComponentGenerationPhase(components, designTokens) {
    this.visualizer.printPhaseStart(3, '启动 Worker 智能体');

    this.metrics.phases.componentGeneration.start = Date.now();
    this.progress.total = components.length;

    const results = await this.executeWorkers(components, designTokens);

    this.metrics.phases.componentGeneration.end = Date.now();
    this.metrics.phases.componentGeneration.duration = this.metrics.phases.componentGeneration.end - this.metrics.phases.componentGeneration.start;

    return results;
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
      console.log(`\n   📦 优先级 ${priority} (${group.length} 个组件)\n`);

      // 分批并行执行
      const chunks = this.chunk(group, this.config.maxParallelWorkers);

      for (const chunk of chunks) {
        const promises = chunk.map(async (component) => {
          const componentStartTime = Date.now();
          const worktreePath = join(worktreeBase, component.name);
          const workingDir = existsSync(worktreePath)
            ? worktreePath
            : this.config.projectRoot;

          // 显示 Worker 启动
          this.visualizer.printAgentStart('worker', component.name, `生成 ${component.name} 组件...`);

          const worker = new WorkerAgent(component.name);

          const result = await worker.buildComponent({
            component,
            workingDir,
            designTokens
          });

          // 记录组件级别的指标
          const componentEndTime = Date.now();
          const componentMetric = {
            name: component.name,
            priority: component.priority,
            complexity: component.complexity,
            status: result.status,
            duration: componentEndTime - componentStartTime,
            filesGenerated: result.files?.length || 0
          };
          this.metrics.components.push(componentMetric);

          if (result.status === 'success') {
            this.progress.completed++;
          } else {
            this.progress.failed++;
          }

          // 显示 Worker 完成
          this.visualizer.printAgentComplete(
            component.name,
            result.status,
            result.summary || (result.status === 'success' ? '组件已生成' : '生成失败')
          );

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
   * 打印标题
   */
  printHeader() {
    console.log(`
\x1b[1m\x1b[36m╔══════════════════════════════════════════════════════════════╗
║     🤖 Multi-Agent Frontend Development System 🤖            ║
╠══════════════════════════════════════════════════════════════╣
║  🎯 Orchestrator  →  🧠 Planner  →  👷 Workers (×N)         ║
╚══════════════════════════════════════════════════════════════╝\x1b[0m
`);
    console.log(`   📅 启动时间: ${new Date().toLocaleString()}`);
    console.log(`   ⚡ 并行度: ${this.config.maxParallelWorkers} workers`);
    console.log('');
  }

  /**
   * 打印汇总
   */
  printSummary(results) {
    this.visualizer.printSummary(results, this.metrics);
  }

  /**
   * 生成报告文件
   */
  async generateReport(plan, results) {
    const reportDir = join(this.config.projectRoot, 'reports');
    if (!existsSync(reportDir)) {
      mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const totalDuration = (this.metrics.endTime - this.metrics.startTime) / 1000;

    // JSON 报告
    const jsonReport = {
      timestamp: new Date().toISOString(),
      config: this.config,
      metrics: this.metrics,
      plan: {
        componentCount: plan.components.length,
        dataSource: plan._source,
        components: plan.components.map(c => ({
          name: c.name,
          priority: c.priority,
          complexity: c.complexity
        }))
      },
      results: results.map(r => ({
        component: r.component,
        status: r.status,
        summary: r.summary,
        files: r.files
      })),
      summary: {
        totalDuration,
        successCount: results.filter(r => r.status === 'success').length,
        failedCount: results.filter(r => r.status === 'failed').length,
        successRate: (results.filter(r => r.status === 'success').length / results.length * 100).toFixed(1) + '%'
      }
    };

    writeFileSync(
      join(reportDir, `report-${timestamp}.json`),
      JSON.stringify(jsonReport, null, 2),
      'utf-8'
    );

    // Markdown 报告
    const mdReport = this.generateMarkdownReport(plan, results, totalDuration);
    writeFileSync(
      join(reportDir, `report-${timestamp}.md`),
      mdReport,
      'utf-8'
    );

    console.log(`📄 报告已生成: reports/report-${timestamp}.md`);
  }

  /**
   * 生成 Markdown 报告
   */
  generateMarkdownReport(plan, results, totalDuration) {
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return `# Multi-Agent 前端开发报告

> 生成时间: ${new Date().toLocaleString()}

## 📊 执行概览

| 指标 | 值 |
|------|-----|
| 总耗时 | ${totalDuration.toFixed(1)}s |
| 组件总数 | ${results.length} |
| 成功 | ${success} ✅ |
| 失败 | ${failed} ❌ |
| 成功率 | ${((success / results.length) * 100).toFixed(1)}% |
| 数据来源 | ${this.metrics.dataSource === 'figma-mcp' ? 'Figma MCP (真实数据)' : 'Mock (演示数据)'} |

## 🔄 流程图

\`\`\`
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Figma     │────▶│   Planner    │────▶│   Workers    │
│   Design     │     │    Agent     │     │   (并行)     │
└──────────────┘     └──────────────┘     └──────────────┘
      │                    │                    │
      ▼                    ▼                    ▼
  设计稿 URL          开发计划 JSON        React 组件代码
\`\`\`

## ⏱️ 各阶段耗时

| 阶段 | 耗时 | 占比 |
|------|------|------|
| Phase 1: 规划分析 | ${(this.metrics.phases.planning.duration / 1000).toFixed(1)}s | ${((this.metrics.phases.planning.duration / (this.metrics.endTime - this.metrics.startTime)) * 100).toFixed(1)}% |
| Phase 2: Worktree 设置 | ${(this.metrics.phases.worktreeSetup.duration / 1000).toFixed(1)}s | ${((this.metrics.phases.worktreeSetup.duration / (this.metrics.endTime - this.metrics.startTime)) * 100).toFixed(1)}% |
| Phase 3: 组件生成 | ${(this.metrics.phases.componentGeneration.duration / 1000).toFixed(1)}s | ${((this.metrics.phases.componentGeneration.duration / (this.metrics.endTime - this.metrics.startTime)) * 100).toFixed(1)}% |

## 📦 组件详情

| 组件 | 优先级 | 复杂度 | 状态 | 耗时 |
|------|--------|--------|------|------|
${this.metrics.components.map(c =>
  `| ${c.name} | ${c.priority} | ${c.complexity} | ${c.status === 'success' ? '✅' : '❌'} | ${(c.duration / 1000).toFixed(1)}s |`
).join('\n')}

## 🔧 可复制流程

### 前置条件
1. 安装 Claude CLI
2. 配置 Figma MCP (API Key)
3. 初始化 Git 仓库

### 执行步骤
\`\`\`bash
# 1. 克隆项目
git clone <repo-url>
cd multi-agent-demo

# 2. 安装依赖
npm install

# 3. 配置 Figma API Key
# 编辑 .claude/settings.local.json

# 4. 运行 (使用真实 Figma URL)
node scripts/run-demo.js "https://figma.com/design/YOUR_FILE_KEY"

# 或使用 demo 模式
node scripts/run-demo.js
\`\`\`

### 输出结构
\`\`\`
worktrees/
├── button/src/components/Button/
│   ├── index.tsx
│   ├── Button.types.ts
│   └── Button.test.tsx
├── input/...
└── card/...
\`\`\`

---
*由 Multi-Agent 前端开发系统自动生成*
`;
  }
}
