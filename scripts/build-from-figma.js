#!/usr/bin/env node

/**
 * Build from Figma Script
 *
 * 从命令行启动多智能体构建流程
 */

import { Orchestrator } from '../src/agents/orchestrator.js';
import { resolve } from 'path';

async function main() {
  const args = process.argv.slice(2);

  // 解析参数
  const options = {
    figmaUrl: null,
    worktreeBase: '../worktrees',
    maxParallel: 3,
    projectRoot: process.cwd(),
    cleanup: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--worktree-base') {
      options.worktreeBase = args[++i];
      continue;
    }

    if (arg === '--max-parallel') {
      options.maxParallel = parseInt(args[++i], 10);
      continue;
    }

    if (arg === '--project-root') {
      options.projectRoot = resolve(args[++i]);
      continue;
    }

    if (arg === '--cleanup') {
      options.cleanup = true;
      continue;
    }

    // 假设是 Figma URL
    if (!options.figmaUrl) {
      options.figmaUrl = arg;
    }
  }

  // 如果是清理模式
  if (options.cleanup) {
    const orchestrator = new Orchestrator(options);
    await orchestrator.cleanupWorktrees();
    process.exit(0);
  }

  // 检查必需参数
  if (!options.figmaUrl) {
    console.error('❌ 错误: 缺少 Figma URL');
    console.error('');
    printHelp();
    process.exit(1);
  }

  // 运行
  console.log('配置:');
  console.log(`  Figma URL: ${options.figmaUrl}`);
  console.log(`  Worktree Base: ${options.worktreeBase}`);
  console.log(`  Max Parallel: ${options.maxParallel}`);
  console.log(`  Project Root: ${options.projectRoot}`);
  console.log('');

  const orchestrator = new Orchestrator({
    worktreeBase: options.worktreeBase,
    maxParallelWorkers: options.maxParallel,
    projectRoot: options.projectRoot
  });

  try {
    await orchestrator.processDesign(options.figmaUrl);
    process.exit(0);
  } catch (error) {
    console.error('❌ 构建失败:', error.message);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
使用方法:
  node scripts/build-from-figma.js <figma-url> [options]

参数:
  figma-url              Figma 文件 URL 或 file key

选项:
  --worktree-base <dir>  Worktree 基础目录 (默认: ../worktrees)
  --max-parallel <n>     最大并行 Worker 数量 (默认: 3)
  --project-root <dir>   项目根目录 (默认: 当前目录)
  --cleanup              清理所有 worktrees
  --help, -h             显示帮助

示例:
  # 从 Figma 构建
  node scripts/build-from-figma.js https://www.figma.com/file/ABC123/design

  # 使用演示模式
  node scripts/build-from-figma.js demo

  # 指定并行数
  node scripts/build-from-figma.js demo --max-parallel 4

  # 清理 worktrees
  node scripts/build-from-figma.js --cleanup
`);
}

main();
