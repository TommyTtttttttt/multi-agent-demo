/**
 * Figma Multi-Agent Frontend System
 *
 * 主入口文件
 */

import { Orchestrator } from './agents/orchestrator.js';

async function main() {
  const figmaUrl = process.argv[2];

  if (!figmaUrl) {
    console.log(`
使用方法:
  node src/index.js <figma-url>

示例:
  node src/index.js https://www.figma.com/file/ABC123/my-design

演示模式（使用模拟数据）:
  node src/index.js demo
    `);
    process.exit(1);
  }

  const orchestrator = new Orchestrator({
    worktreeBase: '../worktrees',
    maxParallelWorkers: 3,
    projectRoot: process.cwd()
  });

  try {
    const result = await orchestrator.processDesign(figmaUrl);

    console.log('\n✨ 所有任务完成！\n');

    if (result.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ 执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
