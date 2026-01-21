# Multi-Agent Demo

**多智能体前端开发系统**：通过 Planner Agent 分析 Figma 设计稿，自动识别组件并制定开发计划；然后由多个 Worker Agent 在独立的 Git Worktree 中并行生成 React/TypeScript 组件代码。支持 Anthropic API 和 Claude CLI 两种运行模式。

## 架构

```
                    Figma Design
                         │
                         ▼ (MCP)
              ┌─────────────────────┐
              │   Planner Agent     │
              │   分析设计 → 制定计划 │
              └──────────┬──────────┘
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Worker 1   │   │  Worker 2   │   │  Worker 3   │
│  (worktree) │   │  (worktree) │   │  (worktree) │
│   Button    │   │    Card     │   │   Header    │
└─────────────┘   └─────────────┘   └─────────────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ▼
              ┌─────────────────────┐
              │   合并所有分支        │
              │   完整前端组件库      │
              └─────────────────────┘
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Figma API Key

编辑 `.claude/settings.local.json`，替换 `YOUR_FIGMA_API_KEY_HERE`:

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": [
        "figma-developer-mcp",
        "--figma-api-key=figd_xxxxxxxxxxxx"
      ]
    }
  }
}
```

获取 API Key: Figma → Settings → Personal access tokens

### 3. 初始化 Git（如果还没有）

```bash
git init
git add -A
git commit -m "Initial commit"
```

### 4. 运行演示

```bash
# 演示模式（使用模拟数据，无需 Figma API）
npm run demo

# 或者使用真实 Figma URL
npm run build -- https://www.figma.com/file/YOUR_FILE_KEY/design-name
```

## 使用方法

### 方式一：在 Claude Code 中交互使用

```
你: 分析这个 Figma 设计稿并生成组件: https://www.figma.com/file/ABC123/my-design

Claude: [分析设计稿，识别组件，创建开发计划...]
```

### 方式二：命令行运行

```bash
# 基本使用
node src/index.js https://www.figma.com/file/ABC123/design

# 演示模式
node src/index.js demo

# 使用脚本（更多选项）
node scripts/build-from-figma.js <figma-url> [options]

选项:
  --worktree-base <dir>  Worktree 目录 (默认: ../worktrees)
  --max-parallel <n>     最大并行数 (默认: 3)
  --cleanup              清理所有 worktrees
```

## Git Worktree 管理

每个组件在独立的 git worktree 中开发，避免冲突。

```bash
# 手动设置 worktrees
npm run setup-worktrees

# 查看所有 worktrees
git worktree list

# 清理 worktrees
npm run clean-worktrees
```

### Worktree 结构

```
project/
├── .git/
├── src/
└── ...

../worktrees/          # Worktree 目录
├── button/            # feature/button 分支
├── card/              # feature/card 分支
├── header/            # feature/header 分支
└── ...
```

## 项目结构

```
.
├── src/
│   ├── index.js                  # 主入口
│   ├── agents/
│   │   ├── base.js               # 基础 Agent 类
│   │   ├── planner.js            # Planner 智能体
│   │   ├── worker.js             # Worker 智能体
│   │   └── orchestrator.js       # 协调器
│   ├── components/               # 生成的组件（输出）
│   └── styles/
│       └── tokens.ts             # 设计 tokens（输出）
├── scripts/
│   ├── demo.js                   # 演示脚本
│   ├── build-from-figma.js       # 构建脚本
│   ├── setup-worktrees.sh        # Worktree 设置
│   └── clean-worktrees.sh        # Worktree 清理
├── .claude/
│   └── settings.local.json       # MCP 配置
└── package.json
```

## Agent 职责

### Planner Agent

- 分析 Figma 文件结构
- 识别需要开发的组件
- 提取设计 tokens（颜色、字体、间距）
- 分析组件依赖关系
- 制定开发优先级

### Worker Agent

- 在独立 worktree 中工作
- 根据设计信息生成 React 组件
- 创建 TypeScript 类型定义
- 编写基础测试
- 提交代码到对应分支

### Orchestrator

- 协调 Planner 和 Workers
- 管理 git worktrees
- 控制并行度
- 汇总开发结果

## 生成的组件示例

```typescript
// src/components/Button/index.tsx
import { FC } from 'react';
import { ButtonProps } from './Button.types';

export const Button: FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
}) => {
  return (
    <button
      className={`
        inline-flex items-center justify-center
        rounded-md font-medium
        transition-colors
        ${variant === 'primary' ? 'bg-primary text-white' : 'bg-surface text-text-primary'}
        ${size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}
      `}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

## 合并分支

开发完成后，合并所有组件分支：

```bash
# 切换到主分支
git checkout main

# 逐个合并
git merge feature/button --no-edit
git merge feature/card --no-edit
git merge feature/header --no-edit
# ...

# 或创建汇总分支
git checkout -b feature/all-components
git merge feature/button feature/card feature/header --no-edit
git push -u origin feature/all-components
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ANTHROPIC_API_KEY` | Anthropic API Key | 必需 |
| `VERBOSE` | 详细日志 | false |

## 注意事项

1. **API Key 安全**: 不要将 Figma API Key 提交到版本控制
2. **Token 消耗**: 每个 Agent 调用会消耗 API tokens
3. **并行限制**: 建议 `maxParallel` 不超过 4
4. **分支冲突**: 如果多个组件修改同一文件，合并时可能冲突

## License

MIT
