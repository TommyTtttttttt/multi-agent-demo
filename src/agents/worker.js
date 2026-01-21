/**
 * Worker Agent
 *
 * 负责在独立的 git worktree 中开发单个组件
 */

import { BaseAgent } from './base.js';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const WORKER_SYSTEM_PROMPT = `你是一个高级前端开发 Agent，负责根据 Figma 设计实现 React 组件。

## 你的职责

1. 根据设计信息创建 React TypeScript 组件
2. 使用 Tailwind CSS 实现样式
3. 定义清晰的 TypeScript 类型
4. 编写基础单元测试
5. 提交代码到 git

## 代码规范

### 组件结构
\`\`\`
components/
  ComponentName/
    index.tsx              # 主组件 + 导出
    ComponentName.types.ts # TypeScript 类型
    ComponentName.test.tsx # 测试文件
\`\`\`

### 组件模板
\`\`\`tsx
import { FC } from 'react';
import { ComponentNameProps } from './ComponentName.types';

export const ComponentName: FC<ComponentNameProps> = ({
  // props
}) => {
  return (
    <div className="...">
      {/* content */}
    </div>
  );
};
\`\`\`

### 类型定义模板
\`\`\`ts
export interface ComponentNameProps {
  // props
}
\`\`\`

## 样式规范

- 优先使用 Tailwind CSS
- 使用设计 tokens 中的颜色和间距
- 支持响应式设计
- 考虑暗色模式

## 测试规范

- 使用 @testing-library/react
- 测试组件渲染
- 测试用户交互
- 测试不同 props 的表现`;

const WORKER_TOOLS = [
  {
    name: 'get_component_design',
    description: '获取组件的 Figma 设计详情',
    input_schema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: '组件的 Figma 节点 ID' }
      },
      required: ['node_id']
    }
  },
  {
    name: 'write_file',
    description: '在 worktree 中创建或修改文件',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '相对于 src 目录的文件路径' },
        content: { type: 'string', description: '文件内容' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'read_existing_file',
    description: '读取 worktree 中已存在的文件',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' }
      },
      required: ['path']
    }
  },
  {
    name: 'git_add_commit',
    description: '将更改添加到 git 并提交',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '提交信息' },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: '要添加的文件（可选，默认添加所有）'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'report_completion',
    description: '报告组件开发完成',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['success', 'partial', 'failed'],
          description: '完成状态'
        },
        filesCreated: {
          type: 'array',
          items: { type: 'string' },
          description: '创建的文件列表'
        },
        summary: { type: 'string', description: '完成摘要' }
      },
      required: ['status', 'filesCreated', 'summary']
    }
  }
];

export class WorkerAgent extends BaseAgent {
  constructor(componentName, orchestrator) {
    super(`Worker-${componentName}`, WORKER_SYSTEM_PROMPT, WORKER_TOOLS);
    this.componentName = componentName;
    this.orchestrator = orchestrator;
    this.workingDir = null;
    this.filesCreated = [];
    this.completionReport = null;
  }

  /**
   * 构建组件
   */
  async buildComponent({ component, workingDir, designTokens }) {
    this.workingDir = workingDir;
    this.filesCreated = [];

    const pascalName = this.toPascalCase(component.name);

    this.log(`开始构建组件: ${pascalName}`);

    const result = await this.run(`
## 任务：构建 React 组件

### 组件信息
- 名称: ${component.name}
- PascalCase 名称: ${pascalName}
- 描述: ${component.description}
- 复杂度: ${component.complexity || 'medium'}
- 依赖组件: ${component.dependencies?.join(', ') || '无'}
- 建议 Props: ${component.props?.join(', ') || '待定'}

### Figma 节点
- Node ID: ${component.nodeId || 'N/A'}

### 设计 Tokens
\`\`\`json
${JSON.stringify(designTokens, null, 2)}
\`\`\`

### 工作目录
${workingDir}

### 任务步骤

1. 如果有 nodeId，使用 get_component_design 获取设计详情
2. 使用 write_file 创建以下文件:
   - src/components/${pascalName}/index.tsx (主组件)
   - src/components/${pascalName}/${pascalName}.types.ts (类型定义)
   - src/components/${pascalName}/${pascalName}.test.tsx (测试文件)
3. 使用 git_add_commit 提交代码
4. 使用 report_completion 报告完成状态

### 要求
- 组件必须是函数式组件
- 使用 Tailwind CSS 实现样式
- 类型定义要完整
- 测试要覆盖基本渲染
    `);

    if (this.completionReport) {
      return this.completionReport;
    }

    return {
      status: 'success',
      filesCreated: this.filesCreated,
      summary: `组件 ${pascalName} 构建完成`
    };
  }

  /**
   * 执行工具
   */
  async executeTool(name, input) {
    switch (name) {
      case 'get_component_design':
        return await this.getComponentDesign(input);

      case 'write_file':
        return this.writeFile(input);

      case 'read_existing_file':
        return this.readExistingFile(input);

      case 'git_add_commit':
        return await this.gitAddCommit(input);

      case 'report_completion':
        return this.reportCompletion(input);

      default:
        throw new Error(`未知工具: ${name}`);
    }
  }

  /**
   * 获取组件设计详情
   */
  async getComponentDesign({ node_id }) {
    if (this.orchestrator.mcpClient && node_id) {
      return await this.orchestrator.callMcp('figma_get_node', {
        file_key: this.orchestrator.currentFileKey,
        node_id
      });
    }

    // 返回模拟设计数据
    return {
      id: node_id,
      name: this.componentName,
      type: 'COMPONENT',
      layout: {
        mode: 'VERTICAL',
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
        gap: 8
      },
      styles: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        shadow: '0 4px 6px rgba(0,0,0,0.1)'
      }
    };
  }

  /**
   * 写入文件
   */
  writeFile({ path, content }) {
    const fullPath = join(this.workingDir, path);

    // 确保目录存在
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(fullPath, content, 'utf-8');
    this.filesCreated.push(path);

    this.log(`创建文件: ${path}`, 'success');

    return {
      success: true,
      path: fullPath
    };
  }

  /**
   * 读取已存在的文件
   */
  readExistingFile({ path }) {
    const fullPath = join(this.workingDir, path);

    if (!existsSync(fullPath)) {
      return { error: '文件不存在', path };
    }

    const content = readFileSync(fullPath, 'utf-8');

    return {
      success: true,
      path,
      content
    };
  }

  /**
   * Git 添加并提交
   */
  async gitAddCommit({ message, files }) {
    const cwd = this.workingDir;

    try {
      // 添加文件
      if (files && files.length > 0) {
        await execAsync(`git add ${files.map(f => `"${f}"`).join(' ')}`, { cwd });
      } else {
        await execAsync('git add -A', { cwd });
      }

      // 检查是否有更改
      const { stdout: status } = await execAsync('git status --porcelain', { cwd });

      if (!status.trim()) {
        this.log('没有更改需要提交', 'warn');
        return { success: true, message: '没有更改需要提交' };
      }

      // 提交
      await execAsync(`git commit -m "${message}"`, { cwd });

      this.log(`已提交: ${message}`, 'success');

      return {
        success: true,
        message,
        filesCommitted: this.filesCreated.length
      };
    } catch (error) {
      this.log(`Git 提交失败: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 报告完成状态
   */
  reportCompletion({ status, filesCreated, summary }) {
    this.completionReport = {
      status,
      filesCreated: filesCreated || this.filesCreated,
      summary,
      component: this.componentName
    };

    const emoji = {
      success: '✅',
      partial: '⚠️',
      failed: '❌'
    }[status] || '📝';

    this.log(`${emoji} ${summary}`, status === 'success' ? 'success' : 'warn');

    // 通知协调器
    if (this.orchestrator.onWorkerComplete) {
      this.orchestrator.onWorkerComplete(this.componentName, this.completionReport);
    }

    return { acknowledged: true };
  }

  /**
   * 转换为 PascalCase
   */
  toPascalCase(str) {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}
