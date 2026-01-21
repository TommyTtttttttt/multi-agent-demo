# 多智能体前端开发系统：Figma MCP + Git Worktree

## 概述

本指南介绍如何构建一个多智能体系统，从 Figma 设计稿自动提取信息并并行开发前端组件。

```
┌─────────────────────────────────────────────────────────────────┐
│                        Figma 设计稿                              │
└─────────────────────────────────┬───────────────────────────────┘
                                  │ MCP (Model Context Protocol)
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Planner Agent                               │
│  • 分析设计稿结构                                                │
│  • 拆分组件任务                                                  │
│  • 分配给 Workers                                                │
└──────────────┬─────────────────┬─────────────────┬──────────────┘
               │                 │                 │
               ▼                 ▼                 ▼
        ┌──────────┐      ┌──────────┐      ┌──────────┐
        │ Worker 1 │      │ Worker 2 │      │ Worker 3 │
        │ Header   │      │ Sidebar  │      │ Card     │
        │ worktree │      │ worktree │      │ worktree │
        └──────────┘      └──────────┘      └──────────┘
               │                 │                 │
               └─────────────────┼─────────────────┘
                                 ▼
                    ┌─────────────────────┐
                    │   合并所有分支        │
                    │   完整前端系统        │
                    └─────────────────────┘
```

---

## 一、环境准备

### 1.1 安装 Figma MCP Server

Figma MCP 让 Claude 能够直接访问你的 Figma 设计稿。

```bash
# 方式一：使用 npx（推荐）
npx figma-developer-mcp --figma-api-key=YOUR_FIGMA_API_KEY

# 方式二：全局安装
npm install -g figma-developer-mcp
figma-developer-mcp --figma-api-key=YOUR_FIGMA_API_KEY
```

### 1.2 配置 Claude Code MCP

在你的项目或全局配置中添加 Figma MCP：

**~/.claude/settings.json** (全局配置):
```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["figma-developer-mcp", "--figma-api-key=YOUR_FIGMA_API_KEY"],
      "env": {}
    }
  }
}
```

或者 **项目级配置** `.claude/settings.local.json`:
```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["figma-developer-mcp", "--figma-api-key=YOUR_FIGMA_API_KEY"]
    }
  }
}
```

### 1.3 获取 Figma API Key

1. 登录 Figma
2. 点击头像 → Settings → Personal access tokens
3. 生成新的 token
4. 复制 token 到配置中

### 1.4 验证 MCP 连接

启动 Claude Code 后，MCP 工具应该可用：
```
# 在 Claude Code 中测试
> 使用 Figma MCP 获取这个文件的信息: [Figma URL]
```

---

## 二、Git Worktree 设置

Git worktree 允许多个 agent 在不同分支上并行工作，互不干扰。

### 2.1 基本概念

```
main-repo/                    # 主仓库
├── .git/                     # Git 数据
├── src/
└── ...

../worktrees/                 # Worktree 目录（建议放在仓库外）
├── feature-header/           # Worker 1 的工作目录
│   ├── src/
│   └── ...
├── feature-sidebar/          # Worker 2 的工作目录
│   ├── src/
│   └── ...
└── feature-card/             # Worker 3 的工作目录
    ├── src/
    └── ...
```

### 2.2 创建 Worktree 脚本

创建一个辅助脚本来管理 worktrees：

```bash
#!/bin/bash
# scripts/setup-worktrees.sh

# 配置
WORKTREE_BASE="../worktrees"
COMPONENTS=("header" "sidebar" "card" "footer" "modal")

# 创建 worktree 目录
mkdir -p "$WORKTREE_BASE"

for component in "${COMPONENTS[@]}"; do
    branch_name="feature/$component"
    worktree_path="$WORKTREE_BASE/$component"

    # 创建分支（如果不存在）
    git branch "$branch_name" 2>/dev/null || true

    # 创建 worktree
    if [ ! -d "$worktree_path" ]; then
        git worktree add "$worktree_path" "$branch_name"
        echo "✅ Created worktree: $worktree_path on branch $branch_name"
    else
        echo "⏭️  Worktree already exists: $worktree_path"
    fi
done

echo ""
echo "📁 Worktrees created:"
git worktree list
```

### 2.3 Worktree 管理命令

```bash
# 列出所有 worktrees
git worktree list

# 添加新 worktree
git worktree add ../worktrees/new-feature feature/new-feature

# 删除 worktree
git worktree remove ../worktrees/old-feature

# 清理已删除分支的 worktree
git worktree prune
```

---

## 三、多智能体架构

### 3.1 系统架构

```javascript
// src/agents/orchestrator.js
import Anthropic from '@anthropic-ai/sdk';
import { PlannerAgent } from './planner.js';
import { WorkerAgent } from './worker.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class FigmaFrontendOrchestrator {
  constructor(config) {
    this.client = new Anthropic();
    this.config = config;
    this.planner = new PlannerAgent(this);
    this.workers = new Map();
    this.worktreeBase = config.worktreeBase || '../worktrees';
  }

  /**
   * 主入口：从 Figma URL 开始整个流程
   */
  async processDesign(figmaUrl) {
    console.log('🎨 开始处理 Figma 设计稿...\n');

    // Step 1: Planner 分析设计稿
    const plan = await this.planner.analyzeDesign(figmaUrl);
    console.log('📋 组件计划:', plan);

    // Step 2: 为每个组件创建 worktree
    await this.setupWorktrees(plan.components);

    // Step 3: 并行启动 Workers
    const results = await this.executeParallel(plan.components);

    // Step 4: 合并所有分支
    await this.mergeAll(plan.components);

    return results;
  }

  /**
   * 创建 git worktrees
   */
  async setupWorktrees(components) {
    console.log('\n📁 设置 Git Worktrees...');

    for (const component of components) {
      const branchName = `feature/${component.name}`;
      const worktreePath = `${this.worktreeBase}/${component.name}`;

      try {
        // 创建分支
        await execAsync(`git branch ${branchName} 2>/dev/null || true`);

        // 创建 worktree
        await execAsync(`git worktree add ${worktreePath} ${branchName} 2>/dev/null || true`);

        console.log(`   ✅ ${component.name}: ${worktreePath}`);
      } catch (error) {
        console.log(`   ⏭️  ${component.name}: worktree already exists`);
      }
    }
  }

  /**
   * 并行执行所有 Worker
   */
  async executeParallel(components) {
    console.log('\n🚀 并行启动 Workers...\n');

    const promises = components.map(async (component) => {
      const worker = new WorkerAgent(component.name, this);
      this.workers.set(component.name, worker);

      const worktreePath = `${this.worktreeBase}/${component.name}`;

      return worker.buildComponent({
        component,
        workingDir: worktreePath,
        figmaNodeId: component.nodeId
      });
    });

    return Promise.all(promises);
  }

  /**
   * 合并所有分支
   */
  async mergeAll(components) {
    console.log('\n🔀 合并所有分支...');

    for (const component of components) {
      const branchName = `feature/${component.name}`;
      try {
        await execAsync(`git merge ${branchName} --no-edit`);
        console.log(`   ✅ Merged: ${branchName}`);
      } catch (error) {
        console.log(`   ⚠️  Merge conflict in ${branchName}, needs manual resolution`);
      }
    }
  }
}
```

### 3.2 Planner Agent

```javascript
// src/agents/planner.js
import { BaseAgent } from './base.js';

const PLANNER_SYSTEM_PROMPT = `你是一个前端架构师 Agent，负责分析 Figma 设计稿并规划组件开发任务。

你的职责：
1. 使用 Figma MCP 工具获取设计稿信息
2. 识别所有需要开发的组件
3. 分析组件之间的依赖关系
4. 制定开发顺序和任务分配

输出格式要求：
- 每个组件需要包含: name, nodeId, dependencies, priority
- 组件命名使用 kebab-case (如 user-card, nav-header)
- priority: 1 表示基础组件，2 表示依赖其他组件的组件`;

const PLANNER_TOOLS = [
  {
    name: 'figma_get_file',
    description: '获取 Figma 文件的完整结构信息',
    input_schema: {
      type: 'object',
      properties: {
        file_key: { type: 'string', description: 'Figma 文件的 key（URL 中的部分）' }
      },
      required: ['file_key']
    }
  },
  {
    name: 'figma_get_node',
    description: '获取 Figma 中特定节点的详细信息',
    input_schema: {
      type: 'object',
      properties: {
        file_key: { type: 'string' },
        node_id: { type: 'string', description: '节点 ID' }
      },
      required: ['file_key', 'node_id']
    }
  },
  {
    name: 'figma_get_styles',
    description: '获取 Figma 文件中的样式（颜色、字体等）',
    input_schema: {
      type: 'object',
      properties: {
        file_key: { type: 'string' }
      },
      required: ['file_key']
    }
  },
  {
    name: 'create_component_plan',
    description: '创建组件开发计划',
    input_schema: {
      type: 'object',
      properties: {
        components: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              nodeId: { type: 'string' },
              description: { type: 'string' },
              dependencies: { type: 'array', items: { type: 'string' } },
              priority: { type: 'number' },
              estimatedComplexity: { type: 'string', enum: ['low', 'medium', 'high'] }
            }
          }
        },
        designTokens: {
          type: 'object',
          description: '提取的设计 tokens（颜色、间距、字体等）'
        }
      },
      required: ['components']
    }
  }
];

export class PlannerAgent extends BaseAgent {
  constructor(orchestrator) {
    super('Planner', PLANNER_SYSTEM_PROMPT, PLANNER_TOOLS);
    this.orchestrator = orchestrator;
  }

  async analyzeDesign(figmaUrl) {
    // 从 URL 提取 file key
    const fileKey = this.extractFileKey(figmaUrl);

    const result = await this.run(`
      分析这个 Figma 设计稿并创建组件开发计划。

      Figma File Key: ${fileKey}
      Figma URL: ${figmaUrl}

      请：
      1. 使用 figma_get_file 获取文件结构
      2. 使用 figma_get_styles 获取设计样式
      3. 识别所有需要开发的 UI 组件
      4. 分析组件依赖关系
      5. 使用 create_component_plan 输出最终计划

      注意：
      - 优先识别可复用的基础组件（Button, Input, Card 等）
      - 识别页面级组件（Header, Sidebar, Footer 等）
      - 提取设计 tokens（颜色变量、间距、字体）
    `);

    return this.lastPlan;
  }

  extractFileKey(url) {
    // https://www.figma.com/file/ABC123/design-name
    // https://www.figma.com/design/ABC123/design-name
    const match = url.match(/figma\.com\/(?:file|design)\/([^\/]+)/);
    return match ? match[1] : url;
  }

  async executeTool(name, input) {
    switch (name) {
      case 'figma_get_file':
      case 'figma_get_node':
      case 'figma_get_styles':
        // 这些工具会通过 MCP 自动处理
        // 在实际使用中，Claude Code 会自动调用 MCP server
        return await this.orchestrator.callMcpTool(name, input);

      case 'create_component_plan':
        this.lastPlan = input;
        return { success: true, componentsCount: input.components.length };

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}
```

### 3.3 Worker Agent

```javascript
// src/agents/worker.js
import { BaseAgent } from './base.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const WORKER_SYSTEM_PROMPT = `你是一个前端开发 Agent，负责根据 Figma 设计实现 React 组件。

你的职责：
1. 根据 Figma 节点信息创建 React 组件
2. 实现组件的样式（使用 Tailwind CSS 或 CSS Modules）
3. 添加必要的 TypeScript 类型
4. 编写基础的单元测试

代码规范：
- 使用函数式组件 + Hooks
- Props 使用 TypeScript interface 定义
- 样式优先使用 Tailwind CSS
- 文件命名使用 PascalCase
- 导出使用 named export

文件结构：
components/
  ComponentName/
    index.tsx        # 主组件
    ComponentName.types.ts  # 类型定义
    ComponentName.test.tsx  # 测试文件`;

const WORKER_TOOLS = [
  {
    name: 'figma_get_node',
    description: '获取 Figma 节点详细信息（样式、布局、子节点）',
    input_schema: {
      type: 'object',
      properties: {
        file_key: { type: 'string' },
        node_id: { type: 'string' }
      },
      required: ['file_key', 'node_id']
    }
  },
  {
    name: 'figma_get_images',
    description: '导出 Figma 节点为图片（用于图标、插图等）',
    input_schema: {
      type: 'object',
      properties: {
        file_key: { type: 'string' },
        node_ids: { type: 'array', items: { type: 'string' } },
        format: { type: 'string', enum: ['png', 'svg', 'jpg'] }
      },
      required: ['file_key', 'node_ids']
    }
  },
  {
    name: 'write_file',
    description: '在当前 worktree 中创建/修改文件',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '相对于项目根目录的文件路径' },
        content: { type: 'string', description: '文件内容' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'git_commit',
    description: '提交当前更改',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '提交信息' },
        files: { type: 'array', items: { type: 'string' }, description: '要提交的文件列表' }
      },
      required: ['message']
    }
  },
  {
    name: 'report_progress',
    description: '报告开发进度',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['in_progress', 'completed', 'blocked'] },
        filesCreated: { type: 'array', items: { type: 'string' } },
        message: { type: 'string' }
      },
      required: ['status', 'message']
    }
  }
];

export class WorkerAgent extends BaseAgent {
  constructor(componentName, orchestrator) {
    super(`Worker-${componentName}`, WORKER_SYSTEM_PROMPT, WORKER_TOOLS);
    this.componentName = componentName;
    this.orchestrator = orchestrator;
    this.workingDir = null;
  }

  async buildComponent({ component, workingDir, figmaNodeId }) {
    this.workingDir = workingDir;

    console.log(`[${this.componentName}] 🔨 开始构建组件...`);

    const result = await this.run(`
      构建 React 组件: ${component.name}

      组件信息:
      - 名称: ${component.name}
      - Figma Node ID: ${figmaNodeId}
      - 描述: ${component.description || '无'}
      - 依赖: ${component.dependencies?.join(', ') || '无'}
      - 复杂度: ${component.estimatedComplexity || 'medium'}

      工作目录: ${workingDir}

      请：
      1. 使用 figma_get_node 获取组件的详细设计信息
      2. 分析布局、样式、交互状态
      3. 使用 write_file 创建组件文件:
         - src/components/${this.toPascalCase(component.name)}/index.tsx
         - src/components/${this.toPascalCase(component.name)}/${this.toPascalCase(component.name)}.types.ts
         - src/components/${this.toPascalCase(component.name)}/${this.toPascalCase(component.name)}.test.tsx
      4. 使用 git_commit 提交代码
      5. 使用 report_progress 报告完成状态
    `);

    console.log(`[${this.componentName}] ✅ 组件构建完成`);
    return result;
  }

  async executeTool(name, input) {
    switch (name) {
      case 'figma_get_node':
      case 'figma_get_images':
        return await this.orchestrator.callMcpTool(name, input);

      case 'write_file':
        return this.writeFile(input);

      case 'git_commit':
        return await this.gitCommit(input);

      case 'report_progress':
        return this.reportProgress(input);

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  writeFile({ path, content }) {
    const fullPath = join(this.workingDir, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');

    console.log(`   [${this.componentName}] 📄 Created: ${path}`);
    return { success: true, path: fullPath };
  }

  async gitCommit({ message, files }) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    const cwd = this.workingDir;

    try {
      // Add files
      if (files && files.length > 0) {
        await execAsync(`git add ${files.join(' ')}`, { cwd });
      } else {
        await execAsync('git add -A', { cwd });
      }

      // Commit
      await execAsync(`git commit -m "${message}"`, { cwd });

      console.log(`   [${this.componentName}] 📝 Committed: ${message}`);
      return { success: true, message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  reportProgress({ status, filesCreated, message }) {
    this.orchestrator.updateProgress(this.componentName, {
      status,
      filesCreated,
      message
    });
    return { acknowledged: true };
  }

  toPascalCase(str) {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}
```

---

## 四、实际使用流程

### 4.1 项目初始化

```bash
# 1. 创建项目
npx create-next-app@latest my-frontend --typescript --tailwind
cd my-frontend

# 2. 初始化 git
git init
git add -A
git commit -m "Initial commit"

# 3. 创建 worktree 目录结构
mkdir -p ../worktrees

# 4. 安装依赖
npm install @anthropic-ai/sdk
```

### 4.2 配置 Claude Code

**.claude/settings.local.json**:
```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["figma-developer-mcp", "--figma-api-key=YOUR_API_KEY"]
    }
  },
  "permissions": {
    "allow": [
      "Bash(git *)",
      "Write(src/**)",
      "Read(src/**)"
    ]
  }
}
```

### 4.3 运行多智能体系统

**方式一：通过 Claude Code 直接使用**

在 Claude Code 中，你可以这样指示：

```
我有一个 Figma 设计稿: https://www.figma.com/file/ABC123/my-design

请帮我：
1. 分析这个设计稿中的所有组件
2. 为每个组件创建一个 git worktree 分支
3. 并行开发所有组件
4. 完成后合并所有分支

使用 Figma MCP 获取设计信息，每个组件应该包含：
- React 组件代码 (TypeScript)
- Tailwind CSS 样式
- 基础测试文件
```

**方式二：通过脚本自动化**

```javascript
// scripts/build-from-figma.js
import { FigmaFrontendOrchestrator } from '../src/agents/orchestrator.js';

const figmaUrl = process.argv[2];

if (!figmaUrl) {
  console.error('Usage: node scripts/build-from-figma.js <figma-url>');
  process.exit(1);
}

const orchestrator = new FigmaFrontendOrchestrator({
  worktreeBase: '../worktrees'
});

orchestrator.processDesign(figmaUrl)
  .then(results => {
    console.log('\n✨ 所有组件构建完成！');
    console.log(JSON.stringify(results, null, 2));
  })
  .catch(console.error);
```

---

## 五、Claude Code 中的实际操作示例

### 5.1 Step-by-Step 使用

```
你: @figma 获取这个设计稿的信息: https://www.figma.com/file/ABC123/dashboard

Claude: [使用 Figma MCP 获取文件结构]

我已分析这个设计稿，识别出以下组件：
1. Header (node: 1:23)
2. Sidebar (node: 1:45)
3. StatCard (node: 1:67)
4. DataTable (node: 1:89)
5. Chart (node: 1:111)

需要我为这些组件创建 worktrees 并开始并行开发吗？
```

```
你: 是的，请为每个组件创建 worktree 分支并开始开发

Claude: 好的，我将：

1. 创建 worktrees:
   - git worktree add ../worktrees/header feature/header
   - git worktree add ../worktrees/sidebar feature/sidebar
   - ...

2. 启动并行开发任务...

[Worker-header] 🔨 开始构建 Header 组件
[Worker-sidebar] 🔨 开始构建 Sidebar 组件
[Worker-stat-card] 🔨 开始构建 StatCard 组件
...

[Worker-header] 📄 Created: src/components/Header/index.tsx
[Worker-header] 📄 Created: src/components/Header/Header.types.ts
[Worker-header] 📝 Committed: feat(header): implement Header component
[Worker-header] ✅ 组件构建完成

...

3. 合并所有分支到 main...

✨ 所有组件构建完成！
```

### 5.2 查看各 Worktree 状态

```bash
# 列出所有 worktrees
git worktree list

# 查看特定组件的工作进度
cd ../worktrees/header
git log --oneline

# 查看所有分支
git branch -a
```

### 5.3 手动合并（如有冲突）

```bash
# 回到主仓库
cd /path/to/main-repo

# 合并特定分支
git merge feature/header --no-edit
git merge feature/sidebar --no-edit

# 如有冲突
git status
# 解决冲突后
git add .
git commit -m "Merge all feature branches"
```

---

## 六、最佳实践

### 6.1 Worktree 命名约定

```
feature/{component-name}     # 组件开发分支
fix/{component-name}-{issue} # Bug 修复分支
refactor/{component-name}    # 重构分支
```

### 6.2 组件文件结构

```
src/components/
├── Button/
│   ├── index.tsx           # 主组件 + 导出
│   ├── Button.types.ts     # TypeScript 类型
│   ├── Button.test.tsx     # 单元测试
│   └── Button.stories.tsx  # Storybook (可选)
├── Card/
│   └── ...
└── index.ts                # 统一导出
```

### 6.3 设计 Token 提取

让 Planner Agent 提取 Figma 中的设计 tokens：

```javascript
// src/styles/tokens.ts (自动生成)
export const colors = {
  primary: '#3B82F6',
  secondary: '#10B981',
  background: '#FFFFFF',
  text: '#1F2937',
  // ...
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
};

export const typography = {
  h1: { fontSize: '32px', fontWeight: 700, lineHeight: 1.2 },
  h2: { fontSize: '24px', fontWeight: 600, lineHeight: 1.3 },
  body: { fontSize: '16px', fontWeight: 400, lineHeight: 1.5 },
  // ...
};
```

### 6.4 清理 Worktrees

```bash
# 开发完成后清理
git worktree remove ../worktrees/header
git worktree remove ../worktrees/sidebar
# ...

# 或批量清理
git worktree list | grep worktrees | awk '{print $1}' | xargs -I {} git worktree remove {}
git worktree prune
```

---

## 七、常见问题

### Q1: Figma MCP 无法连接？

```bash
# 检查 MCP server 是否运行
ps aux | grep figma-developer-mcp

# 手动测试
npx figma-developer-mcp --figma-api-key=YOUR_KEY

# 检查 API key 是否有效
curl -H "X-Figma-Token: YOUR_KEY" "https://api.figma.com/v1/me"
```

### Q2: Worktree 创建失败？

```bash
# 检查分支是否已存在
git branch -a

# 强制清理后重试
git worktree prune
git worktree add ../worktrees/component feature/component
```

### Q3: 合并冲突如何处理？

并行开发时，如果多个组件修改了同一个文件（如 `src/components/index.ts`），可能产生冲突：

```bash
# 合并时指定策略
git merge feature/header -X theirs  # 使用 theirs 的版本

# 或者手动解决
git merge feature/header
# 编辑冲突文件
git add .
git commit
```

### Q4: 如何限制并行 Worker 数量？

```javascript
// 使用 p-limit 限制并发
import pLimit from 'p-limit';

const limit = pLimit(3); // 最多 3 个并行

const results = await Promise.all(
  components.map(component =>
    limit(() => worker.buildComponent(component))
  )
);
```

---

## 八、总结

这套多智能体系统的核心优势：

1. **并行开发**: 多个 Worker 在独立 worktree 中同时工作
2. **Figma 直连**: 通过 MCP 实时获取设计信息，保持代码与设计同步
3. **Git 隔离**: 每个组件在独立分支，避免冲突
4. **自动化**: 从设计到代码的完整自动化流程

适合场景：
- 新项目快速搭建 UI 组件库
- 设计稿更新后批量更新组件
- 大型重构任务的并行执行
