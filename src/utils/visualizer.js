/**
 * Multi-Agent 流程可视化模块
 *
 * 使用终端动画展示 Agent 工作状态
 */

// ANSI 颜色码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgMagenta: '\x1b[45m'
};

// Agent 图标和动画帧
const agentIcons = {
  orchestrator: {
    icon: '🎯',
    frames: ['🎯', '🎪', '🎯', '🎭'],
    color: colors.magenta
  },
  planner: {
    icon: '🧠',
    frames: ['🧠', '💭', '💡', '📋'],
    color: colors.cyan
  },
  worker: {
    icon: '👷',
    frames: ['👷', '🔨', '⚡', '✨'],
    color: colors.yellow
  },
  figma: {
    icon: '🎨',
    frames: ['🎨', '🖌️', '🎨', '✏️'],
    color: colors.magenta
  },
  git: {
    icon: '📁',
    frames: ['📁', '📂', '📁', '📂'],
    color: colors.blue
  },
  success: {
    icon: '✅',
    frames: ['✅'],
    color: colors.green
  },
  error: {
    icon: '❌',
    frames: ['❌'],
    color: colors.red
  },
  waiting: {
    icon: '⏳',
    frames: ['⏳', '⌛', '⏳', '⌛'],
    color: colors.dim
  }
};

// 进度条动画帧
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const progressBarChars = { filled: '█', empty: '░' };

class AgentVisualizer {
  constructor(options = {}) {
    this.options = {
      width: options.width || 60,
      animated: options.animated !== false,
      updateInterval: options.updateInterval || 100,
      ...options
    };

    this.agents = new Map();
    this.frameIndex = 0;
    this.intervalId = null;
    this.startTime = Date.now();
  }

  /**
   * 启动可视化
   */
  start() {
    this.startTime = Date.now();
    this.printHeader();

    if (this.options.animated) {
      this.intervalId = setInterval(() => {
        this.frameIndex = (this.frameIndex + 1) % 10;
        this.render();
      }, this.options.updateInterval);
    }
  }

  /**
   * 停止可视化
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.render(); // 最终渲染
  }

  /**
   * 打印标题
   */
  printHeader() {
    const header = `
${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════════╗
║     🤖 Multi-Agent Frontend Development System 🤖            ║
╠══════════════════════════════════════════════════════════════╣
║  ${agentIcons.orchestrator.icon} Orchestrator  →  ${agentIcons.planner.icon} Planner  →  ${agentIcons.worker.icon} Workers (×N)   ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`;
    console.log(header);
  }

  /**
   * 注册一个 Agent
   */
  registerAgent(id, type, name) {
    this.agents.set(id, {
      type,
      name,
      status: 'waiting',
      task: '',
      progress: 0,
      startTime: null,
      endTime: null
    });
  }

  /**
   * 更新 Agent 状态
   */
  updateAgent(id, updates) {
    const agent = this.agents.get(id);
    if (agent) {
      Object.assign(agent, updates);
      if (updates.status === 'running' && !agent.startTime) {
        agent.startTime = Date.now();
      }
      if (updates.status === 'success' || updates.status === 'error') {
        agent.endTime = Date.now();
      }
      if (!this.options.animated) {
        this.render();
      }
    }
  }

  /**
   * 渲染当前状态
   */
  render() {
    // 清除之前的输出（向上移动光标）
    const linesToClear = this.agents.size + 3;
    process.stdout.write(`\x1b[${linesToClear}A`);

    // 渲染分隔线
    console.log(colors.dim + '─'.repeat(this.options.width) + colors.reset);

    // 渲染每个 Agent
    for (const [id, agent] of this.agents) {
      this.renderAgent(id, agent);
    }

    // 渲染底部状态栏
    this.renderStatusBar();
  }

  /**
   * 渲染单个 Agent
   */
  renderAgent(id, agent) {
    const iconConfig = agentIcons[agent.type] || agentIcons.worker;
    const icon = agent.status === 'running'
      ? iconConfig.frames[this.frameIndex % iconConfig.frames.length]
      : (agent.status === 'success' ? '✅' : agent.status === 'error' ? '❌' : iconConfig.icon);

    const statusIcon = this.getStatusIcon(agent.status);
    const color = this.getStatusColor(agent.status);

    // 进度条
    const progressBar = this.renderProgressBar(agent.progress, 15);

    // 耗时
    const duration = agent.startTime
      ? ((agent.endTime || Date.now()) - agent.startTime) / 1000
      : 0;
    const durationStr = duration > 0 ? `${duration.toFixed(1)}s` : '';

    // 任务描述（截断）
    const maxTaskLen = 25;
    const task = agent.task.length > maxTaskLen
      ? agent.task.substring(0, maxTaskLen - 2) + '..'
      : agent.task.padEnd(maxTaskLen);

    const line = `${color}${icon} ${agent.name.padEnd(12)}${colors.reset} ${progressBar} ${task} ${colors.dim}${durationStr.padStart(6)}${colors.reset}`;
    console.log(line);
  }

  /**
   * 渲染进度条
   */
  renderProgressBar(progress, width) {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    const bar = progressBarChars.filled.repeat(filled) + progressBarChars.empty.repeat(empty);

    let color = colors.dim;
    if (progress >= 100) color = colors.green;
    else if (progress > 0) color = colors.cyan;

    return `${color}[${bar}]${colors.reset}`;
  }

  /**
   * 渲染状态栏
   */
  renderStatusBar() {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const running = Array.from(this.agents.values()).filter(a => a.status === 'running').length;
    const completed = Array.from(this.agents.values()).filter(a => a.status === 'success').length;
    const failed = Array.from(this.agents.values()).filter(a => a.status === 'error').length;
    const total = this.agents.size;

    const spinner = spinnerFrames[this.frameIndex % spinnerFrames.length];

    console.log(colors.dim + '─'.repeat(this.options.width) + colors.reset);
    console.log(
      `${colors.dim}${spinner}${colors.reset} ` +
      `${colors.cyan}运行中: ${running}${colors.reset} | ` +
      `${colors.green}完成: ${completed}${colors.reset} | ` +
      `${colors.red}失败: ${failed}${colors.reset} | ` +
      `总计: ${total} | ` +
      `${colors.dim}⏱️ ${elapsed}s${colors.reset}`
    );
  }

  /**
   * 获取状态图标
   */
  getStatusIcon(status) {
    const icons = {
      waiting: '⏳',
      running: spinnerFrames[this.frameIndex % spinnerFrames.length],
      success: '✅',
      error: '❌'
    };
    return icons[status] || '⏳';
  }

  /**
   * 获取状态颜色
   */
  getStatusColor(status) {
    const statusColors = {
      waiting: colors.dim,
      running: colors.cyan,
      success: colors.green,
      error: colors.red
    };
    return statusColors[status] || colors.reset;
  }

  /**
   * 打印流程图
   */
  static printFlowDiagram(phase = 'all') {
    const diagrams = {
      overview: `
${colors.bright}${colors.white}
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Agent 工作流程                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌──────────┐      ┌──────────┐      ┌──────────────────┐    │
│    │  Figma   │─────▶│ Planner  │─────▶│     Workers      │    │
│    │   🎨     │      │   🧠     │      │  👷 👷 👷 👷    │    │
│    └──────────┘      └──────────┘      └──────────────────┘    │
│         │                 │                     │               │
│         ▼                 ▼                     ▼               │
│    设计数据           开发计划            React 组件           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
${colors.reset}`,

      planning: `
${colors.cyan}
┌─────────────────────────────────────────────────────────────────┐
│  🧠 Phase 1: Planning                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌──────────┐      ┌──────────┐      ┌──────────────────┐    │
│    │  Figma   │─────▶│ Planner  │─────▶│   JSON Plan      │    │
│    │  MCP 🎨  │      │  Agent   │      │   📋            │    │
│    └──────────┘      └──────────┘      └──────────────────┘    │
│                            │                                    │
│                            ▼                                    │
│                    ┌──────────────┐                             │
│                    │ Components[] │                             │
│                    │ DesignTokens │                             │
│                    │ Dependencies │                             │
│                    └──────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
${colors.reset}`,

      workers: `
${colors.yellow}
┌─────────────────────────────────────────────────────────────────┐
│  👷 Phase 3: Component Generation                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐  │
│    │   Worker 1   │     │   Worker 2   │     │   Worker 3   │  │
│    │   Button 🔘  │     │   Input 📝   │     │   Card 🃏    │  │
│    │   ⚡ 生成中  │     │   ✅ 完成    │     │   ⏳ 等待    │  │
│    └──────────────┘     └──────────────┘     └──────────────┘  │
│           │                   │                    │            │
│           ▼                   ▼                    ▼            │
│    ┌──────────────┐     ┌──────────────┐     ┌──────────────┐  │
│    │  index.tsx   │     │  index.tsx   │     │  index.tsx   │  │
│    │  types.ts    │     │  types.ts    │     │  types.ts    │  │
│    │  test.tsx    │     │  test.tsx    │     │  test.tsx    │  │
│    └──────────────┘     └──────────────┘     └──────────────┘  │
│                                                                 │
│    Git Worktrees: feature/button, feature/input, feature/card   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
${colors.reset}`
    };

    if (phase === 'all') {
      Object.values(diagrams).forEach(d => console.log(d));
    } else {
      console.log(diagrams[phase] || diagrams.overview);
    }
  }

  /**
   * 打印最终报告（带动画）
   */
  static async printAnimatedSummary(metrics, results) {
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    console.log('\n');

    // 动画显示标题
    const title = '📊 执行报告';
    for (let i = 0; i <= title.length; i++) {
      process.stdout.write(`\r${colors.bright}${colors.cyan}${'═'.repeat(30)} ${title.substring(0, i)}${colors.reset}`);
      await delay(30);
    }
    console.log(` ${'═'.repeat(30)}`);

    await delay(200);

    // 流程图
    console.log(`
${colors.dim}┌─────────────────────────────────────────────────────┐
│  Figma Design  →  Planner Agent  →  Worker Agents  │
│      🎨              🧠                 👷×N        │
└─────────────────────────────────────────────────────┘${colors.reset}
`);

    await delay(300);

    // 逐行显示统计
    const stats = [
      ['总耗时', `${((metrics.endTime - metrics.startTime) / 1000).toFixed(1)}s`],
      ['组件数', results.length.toString()],
      ['成功', `${results.filter(r => r.status === 'success').length} ✅`],
      ['失败', `${results.filter(r => r.status === 'error').length} ❌`],
      ['数据源', metrics.dataSource === 'figma-mcp' ? 'Figma MCP ✅' : 'Mock']
    ];

    for (const [label, value] of stats) {
      console.log(`   ${colors.dim}${label.padEnd(8)}${colors.reset} ${colors.bright}${value}${colors.reset}`);
      await delay(100);
    }

    console.log('\n' + colors.cyan + '═'.repeat(60) + colors.reset);
  }
}

// 简化的进度显示（不需要清屏）
class SimpleVisualizer {
  constructor() {
    this.startTime = Date.now();
    this.components = new Map();
  }

  printPhaseStart(phase, description) {
    const icons = {
      1: '📋',
      2: '📁',
      3: '🚀'
    };
    console.log(`\n${colors.bright}${colors.cyan}${'━'.repeat(60)}${colors.reset}`);
    console.log(`${icons[phase] || '▶️'} ${colors.bright}Phase ${phase}: ${description}${colors.reset}`);
    console.log(`${colors.cyan}${'━'.repeat(60)}${colors.reset}\n`);
  }

  printAgentStart(type, name, task) {
    const icons = {
      planner: '🧠',
      worker: '👷',
      orchestrator: '🎯'
    };
    const icon = icons[type] || '⚡';
    console.log(`   ${icon} ${colors.cyan}${name}${colors.reset} 开始: ${task}`);
    this.components.set(name, { startTime: Date.now(), status: 'running' });
  }

  printAgentProgress(name, progress, detail = '') {
    const bar = this.makeProgressBar(progress, 20);
    process.stdout.write(`\r   ⚡ ${name.padEnd(12)} ${bar} ${progress}% ${detail.substring(0, 20)}`);
  }

  printAgentComplete(name, status, summary = '') {
    const component = this.components.get(name);
    const duration = component ? ((Date.now() - component.startTime) / 1000).toFixed(1) : '?';
    const icon = status === 'success' ? '✅' : '❌';
    console.log(`\r   ${icon} ${colors.bright}${name.padEnd(12)}${colors.reset} ${colors.dim}${duration}s${colors.reset} ${summary}`);
    if (component) {
      component.status = status;
      component.endTime = Date.now();
    }
  }

  makeProgressBar(percent, width) {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    return `${colors.cyan}[${'█'.repeat(filled)}${'░'.repeat(empty)}]${colors.reset}`;
  }

  printSummary(results, metrics) {
    const totalTime = ((metrics.endTime - metrics.startTime) / 1000).toFixed(1);
    const success = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error' || r.status === 'failed').length;

    console.log(`
${colors.bright}${colors.cyan}
╔══════════════════════════════════════════════════════════════╗
║                        📊 执行报告                            ║
╠══════════════════════════════════════════════════════════════╣${colors.reset}
${colors.dim}
   🔄 流程图:
   ┌─────────────────────────────────────────────────────┐
   │  Figma Design  →  Planner Agent  →  Worker Agents  │
   │      🎨              🧠                 👷×N        │
   └─────────────────────────────────────────────────────┘
${colors.reset}
   ⏱️  各阶段耗时:
      Phase 1 (规划):     ${(metrics.phases.planning.duration / 1000).toFixed(1)}s
      Phase 2 (Worktree): ${(metrics.phases.worktreeSetup.duration / 1000).toFixed(1)}s
      Phase 3 (生成):     ${(metrics.phases.componentGeneration.duration / 1000).toFixed(1)}s
      ${'─'.repeat(25)}
      ${colors.bright}总计:               ${totalTime}s${colors.reset}

   📈 效率指标:
      组件总数:        ${results.length}
      ${colors.green}成功:            ${success} ✅${colors.reset}
      ${colors.red}失败:            ${failed} ❌${colors.reset}
      成功率:          ${((success / results.length) * 100).toFixed(1)}%
      数据来源:        ${metrics.dataSource === 'figma-mcp' ? `${colors.green}Figma MCP ✅${colors.reset}` : 'Mock Data'}

${colors.cyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}
`);

    // 组件详情
    console.log('   📦 组件详情:');
    for (const r of results) {
      const metric = metrics.components.find(c => c.name === r.component);
      const duration = metric ? `${(metric.duration / 1000).toFixed(1)}s` : '-';
      const icon = r.status === 'success' ? '✅' : '❌';
      console.log(`      ${icon} ${r.component.padEnd(15)} ${duration.padStart(6)}  ${r.summary || ''}`);
    }
    console.log('');
  }
}

export { AgentVisualizer, SimpleVisualizer, agentIcons, colors };
