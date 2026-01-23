#!/usr/bin/env node

/**
 * Demo Script
 *
 * 运行完整的多智能体演示（使用模拟数据）
 */

import { Orchestrator } from '../src/agents/orchestrator.js';

// 启动横幅由 Orchestrator 内部的 visualizer 显示

async function runDemo() {
  // 确保在项目根目录运行
  const orchestrator = new Orchestrator({
    worktreeBase: '../worktrees',
    maxParallelWorkers: 2,
    projectRoot: process.cwd()
  });

  try {
    // 使用 demo 作为 URL 会触发模拟数据
    const result = await orchestrator.processDesign('demo');

    console.log('\n' + '='.repeat(60));
    console.log('🎉 演示完成！');
    console.log('='.repeat(60));

    console.log(`
下一步操作:

1. 查看生成的组件:
   ls -la src/components/

2. 查看设计 tokens:
   cat src/styles/tokens.ts

3. 查看 worktrees:
   git worktree list

4. 合并所有分支:
   git checkout main
   git merge feature/button --no-edit
   git merge feature/card --no-edit
   ...

5. 清理 worktrees:
   npm run clean-worktrees
`);

  } catch (error) {
    console.error('\n❌ 演示失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runDemo();
