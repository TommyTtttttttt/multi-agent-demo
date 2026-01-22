# Multi-Agent 前端开发系统 - 可复制流程文档

## 概述

本系统使用多智能体协作，从 Figma 设计稿自动生成 React/TypeScript 组件代码。

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Figma     │────▶│   Planner    │────▶│   Workers    │────▶│   React      │
│   Design     │     │    Agent     │     │   (并行)     │     │  Components  │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼
   Figma MCP           JSON Plan           Git Worktrees         .tsx/.ts 文件
```

## 系统架构

### 智能体角色

| 智能体 | 职责 | 输入 | 输出 |
|--------|------|------|------|
| **Orchestrator** | 协调整体流程 | Figma URL | 执行报告 |
| **Planner Agent** | 分析设计稿，规划任务 | Figma 设计数据 | JSON 开发计划 |
| **Worker Agent** | 生成组件代码 | 组件规格 + Design Tokens | React 组件文件 |

### 技术栈

- **运行环境**: Node.js + Claude CLI
- **设计数据**: Figma MCP (Model Context Protocol)
- **版本控制**: Git Worktrees (并行隔离开发)
- **输出格式**: React + TypeScript + Tailwind CSS

## 前置条件

### 1. 环境准备

```bash
# 安装 Node.js (v18+)
# macOS
brew install node

# 验证安装
node --version
npm --version
```

### 2. 安装 Claude CLI

Claude CLI 通常随 Cursor IDE 安装，路径如：
```
/Users/<username>/.cursor/extensions/anthropic.claude-code-*/resources/native-binary/claude
```

或单独安装：
```bash
# 参考 Anthropic 官方文档
```

### 3. 配置 Figma MCP

创建 `.claude/settings.local.json`:
```json
{
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Bash(npm *)",
      "Bash(node *)",
      "Write(src/**)",
      "Write(scripts/**)",
      "Read(**)"
    ]
  },
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": [
        "figma-developer-mcp",
        "--figma-api-key=YOUR_FIGMA_API_KEY"
      ]
    }
  }
}
```

获取 Figma API Key:
1. 登录 Figma
2. 进入 Account Settings → Personal Access Tokens
3. 生成新 Token

## 执行流程

### Step 1: 克隆项目

```bash
git clone https://github.com/TommyTtttttttt/multi-agent-demo.git
cd multi-agent-demo
npm install
```

### Step 2: 配置环境

```bash
# 复制配置模板
cp .claude/settings.local.json.example .claude/settings.local.json

# 编辑配置，填入你的 Figma API Key
```

### Step 3: 运行系统

```bash
# 使用真实 Figma URL
node scripts/run-demo.js "https://figma.com/design/YOUR_FILE_KEY/Design-Name"

# 或使用 demo 模式 (mock 数据)
node scripts/run-demo.js
```

### Step 4: 查看输出

```bash
# 查看生成的组件
ls -la ../worktrees/

# 查看某个组件
cat ../worktrees/button/src/components/Button/index.tsx

# 查看执行报告
ls reports/
cat reports/report-*.md
```

## 输出结构

```
worktrees/
├── button/
│   └── src/components/Button/
│       ├── index.tsx          # 组件主文件
│       ├── Button.types.ts    # TypeScript 类型定义
│       └── Button.test.tsx    # 单元测试
├── input/
│   └── src/components/Input/
│       ├── index.tsx
│       ├── Input.types.ts
│       └── Input.test.tsx
├── card/
│   └── ...
└── header/
    └── ...

reports/
├── report-2024-01-22T10-30-00-000Z.json  # JSON 格式报告
└── report-2024-01-22T10-30-00-000Z.md    # Markdown 格式报告
```

## 效率指标

### 典型性能数据

| 指标 | 数值 | 说明 |
|------|------|------|
| 规划阶段 | ~30s | Planner 分析 Figma 设计 |
| Worktree 设置 | ~5s | 创建 Git 分支和工作树 |
| 组件生成 | ~200s/组件 | Worker 生成代码（并行） |
| 总耗时 (4组件) | ~15min | 端到端完整流程 |

### 并行度配置

```javascript
// orchestrator.js
new Orchestrator({
  maxParallelWorkers: 2  // 同时运行的 Worker 数量
});
```

## 自定义扩展

### 添加新的组件模板

编辑 `src/agents/worker.js` 中的 WORKER_SYSTEM_PROMPT:

```javascript
const WORKER_SYSTEM_PROMPT = `
## 组件规范
- 使用函数式组件
- 使用 TypeScript
- 使用 Tailwind CSS
- 添加你的自定义规范...
`;
```

### 修改设计 Token 映射

编辑 `src/agents/planner.js` 中的 designTokens 结构。

### 集成到 CI/CD

```yaml
# .github/workflows/generate-components.yml
name: Generate Components from Figma

on:
  workflow_dispatch:
    inputs:
      figma_url:
        description: 'Figma Design URL'
        required: true

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: node scripts/run-demo.js "${{ github.event.inputs.figma_url }}"
        env:
          FIGMA_API_KEY: ${{ secrets.FIGMA_API_KEY }}
```

## 常见问题

### Q: Claude CLI 找不到

检查 CLAUDE_CLI_PATH 环境变量或在 `src/agents/base.js` 中修改路径。

### Q: Figma MCP 连接失败

1. 检查 API Key 是否正确
2. 确认 Figma 文件有访问权限
3. 查看 MCP 服务是否正常运行

### Q: 组件生成失败

查看 `reports/` 目录下的报告，检查具体错误信息。

## 流程图详解

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                     Orchestrator                         │
                    └─────────────────────────────────────────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
         ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
         │   Phase 1        │   │   Phase 2        │   │   Phase 3        │
         │   规划分析       │──▶│   Worktree 设置  │──▶│   组件生成       │
         │   (Planner)      │   │   (Git)          │   │   (Workers)      │
         └──────────────────┘   └──────────────────┘   └──────────────────┘
                │                                              │
                ▼                                              ▼
    ┌───────────────────────┐                    ┌─────────────────────────┐
    │ Figma MCP             │                    │ Worker 1  │ Worker 2   │
    │ - get_file            │                    │ (button)  │ (input)    │
    │ - get_file_styles     │                    ├───────────┼────────────┤
    │ - get_file_components │                    │ Worker 3  │ Worker 4   │
    └───────────────────────┘                    │ (card)    │ (header)   │
                                                 └─────────────────────────┘
```

## 联系方式

- GitHub: https://github.com/TommyTtttttttt/multi-agent-demo
- Issues: 提交问题或建议

---

*文档最后更新: 2024-01-22*
