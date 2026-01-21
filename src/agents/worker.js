/**
 * Worker Agent
 *
 * 在指定目录中生成 React 组件代码
 * 使用 Claude CLI 的内置 Write/Bash 工具直接操作文件
 */

import { BaseAgent } from './base.js';

const WORKER_SYSTEM_PROMPT = `你是一个高级前端开发工程师，负责根据设计规范生成高质量的 React 组件。

## 代码规范

### 组件结构
每个组件包含三个文件：
- index.tsx: 主组件代码
- {ComponentName}.types.ts: TypeScript 类型定义
- {ComponentName}.test.tsx: 单元测试

### 技术栈
- React 18+ 函数式组件
- TypeScript 严格模式
- Tailwind CSS 样式
- @testing-library/react 测试

### 代码风格
- 使用 FC 类型定义组件
- Props 接口命名为 {ComponentName}Props
- 使用 Tailwind 工具类，避免内联样式
- 组件导出使用命名导出

## 你的任务
根据提供的组件信息和设计 tokens，使用 Write 工具创建完整的组件文件。`;

export class WorkerAgent extends BaseAgent {
  constructor(componentName) {
    super(`Worker-${componentName}`, WORKER_SYSTEM_PROMPT);
    this.componentName = componentName;
  }

  /**
   * 构建组件
   */
  async buildComponent({ component, workingDir, designTokens }) {
    const pascalName = this.toPascalCase(component.name);

    this.log(`开始构建组件: ${pascalName}`);

    const task = `
## 任务：生成 React 组件

### 组件信息
- 名称: ${pascalName}
- 描述: ${component.description}
- 复杂度: ${component.complexity || 'medium'}
- 依赖: ${component.dependencies?.join(', ') || '无'}
- Props: ${component.props?.join(', ') || '待定'}

### 设计 Tokens
\`\`\`json
${JSON.stringify(designTokens, null, 2)}
\`\`\`

### 工作目录
${workingDir}

### 要求

请使用 Write 工具创建以下三个文件：

1. **${workingDir}/src/components/${pascalName}/index.tsx**
   - 完整的 React 函数式组件
   - 使用 Tailwind CSS
   - 导入类型定义

2. **${workingDir}/src/components/${pascalName}/${pascalName}.types.ts**
   - Props 接口定义
   - 所有必要的类型

3. **${workingDir}/src/components/${pascalName}/${pascalName}.test.tsx**
   - 基本渲染测试
   - Props 测试

创建完成后，使用 Bash 工具执行:
\`\`\`
cd "${workingDir}" && git add -A && git commit -m "feat: add ${pascalName} component"
\`\`\`

**注意**：直接执行，不要询问确认。`;

    try {
      const result = await this.execute(task, {
        workingDir,
        allowedTools: ['Write', 'Read', 'Bash', 'Glob'],
      });

      this.log(`组件 ${pascalName} 构建完成`, 'success');

      return {
        status: 'success',
        component: pascalName,
        filesCreated: [
          `src/components/${pascalName}/index.tsx`,
          `src/components/${pascalName}/${pascalName}.types.ts`,
          `src/components/${pascalName}/${pascalName}.test.tsx`
        ],
        summary: `组件 ${pascalName} 已生成并提交`
      };

    } catch (error) {
      this.log(`构建失败: ${error.message}`, 'error');

      return {
        status: 'failed',
        component: pascalName,
        error: error.message,
        summary: `组件 ${pascalName} 构建失败: ${error.message}`
      };
    }
  }

  /**
   * 转换为 PascalCase
   */
  toPascalCase(str) {
    return str
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}
