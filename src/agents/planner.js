/**
 * Planner Agent
 *
 * 通过 Figma MCP 获取真实设计数据，输出 JSON 格式的开发计划
 */

import { BaseAgent } from './base.js';

const PLANNER_SYSTEM_PROMPT = `你是一个资深前端架构师，负责分析 Figma 设计稿并规划组件开发任务。

## 重要：你可以使用 Figma MCP 工具

你可以调用以下 MCP 工具来获取真实的 Figma 设计数据：
- mcp__figma__get_file: 获取 Figma 文件结构
- mcp__figma__get_file_styles: 获取设计样式（颜色、字体等）
- mcp__figma__get_file_components: 获取组件列表

## 你的职责

1. 使用 MCP 工具获取 Figma 设计数据
2. 分析设计结构，识别所有 UI 组件
3. 提取设计 tokens（颜色、字体、间距）
4. 分析组件依赖关系，制定开发优先级
5. 输出结构化的 JSON 开发计划

## 组件分类原则

- **priority 1** (原子组件): Button, Input, Icon, Badge - 无依赖，最先开发
- **priority 2** (分子组件): Card, ListItem, FormField - 依赖原子组件
- **priority 3** (有机体): Header, Sidebar, Modal - 依赖分子组件
- **priority 4** (页面): Dashboard, Settings - 依赖有机体组件

## 输出格式要求

必须输出有效的 JSON，包含：
- components: 组件数组，每个包含 name, description, priority, dependencies, complexity, props, figmaNodeId
- designTokens: 包含 colors, spacing, typography, borderRadius, shadows
- figmaMetadata: 包含 fileKey, fileName, lastModified
- summary: 计划摘要`;

export class PlannerAgent extends BaseAgent {
  constructor() {
    super('Planner', PLANNER_SYSTEM_PROMPT);
  }

  /**
   * 分析设计稿并生成开发计划
   */
  async analyzeDesign(figmaUrl) {
    const fileKey = this.extractFileKey(figmaUrl);
    this.log(`分析 Figma 设计稿: ${fileKey}`);

    // 如果是 demo 模式，返回模拟数据
    if (figmaUrl === 'demo' || !figmaUrl) {
      this.log('使用演示数据');
      return this.getMockPlan();
    }

    const task = `
请分析以下 Figma 设计稿并生成开发计划：

Figma URL: ${figmaUrl}
File Key: ${fileKey}

## 步骤

1. 首先，使用 MCP 工具获取 Figma 文件数据：
   - 调用 mcp__figma__get_file 获取文件结构 (fileKey: "${fileKey}")
   - 调用 mcp__figma__get_file_styles 获取样式定义 (fileKey: "${fileKey}")

2. 分析获取到的数据：
   - 识别所有可复用的 UI 组件
   - 提取颜色、字体、间距等设计 tokens
   - 分析组件之间的依赖关系

3. 输出 JSON 格式的开发计划：

{
  "components": [
    {
      "name": "组件名（小写，如 button）",
      "description": "组件描述",
      "priority": 1-4,
      "complexity": "low/medium/high",
      "dependencies": ["依赖的组件名"],
      "props": ["组件属性列表"],
      "figmaNodeId": "Figma 节点 ID（如果有）"
    }
  ],
  "designTokens": {
    "colors": { "primary": "#xxx", ... },
    "spacing": { "sm": "8px", ... },
    "typography": { "fontFamily": "...", ... },
    "borderRadius": { "sm": "4px", ... },
    "shadows": { ... }
  },
  "figmaMetadata": {
    "fileKey": "${fileKey}",
    "fileName": "文件名",
    "lastModified": "最后修改时间"
  },
  "summary": "计划摘要，包含组件数量和预估工作量"
}

只输出 JSON，不要其他内容。`;

    try {
      const result = await this.execute(task, {
        allowedTools: ['Read', 'WebFetch', 'mcp__figma__get_file', 'mcp__figma__get_file_styles', 'mcp__figma__get_file_components'],
        jsonOutput: true
      });

      if (result.components && result.components.length > 0) {
        // 按优先级排序
        result.components.sort((a, b) => a.priority - b.priority);
        this.log(`✅ 从 Figma 识别到 ${result.components.length} 个组件`, 'success');

        // 标记为真实数据
        result._source = 'figma-mcp';
        return result;
      }

      // 如果解析失败，返回模拟数据
      this.log('⚠️ 无法从 Figma 解析组件，使用默认数据', 'warn');
      return this.getMockPlan();

    } catch (error) {
      this.log(`❌ Figma 分析失败: ${error.message}`, 'error');
      this.log('回退到模拟数据', 'warn');
      return this.getMockPlan();
    }
  }

  /**
   * 从 URL 提取 file key
   */
  extractFileKey(url) {
    if (!url || url === 'demo') return 'demo';
    const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    return match ? match[1] : url;
  }

  /**
   * 模拟开发计划（演示用）
   */
  getMockPlan() {
    return {
      _source: 'mock',
      components: [
        {
          name: 'button',
          description: '通用按钮组件，支持多种变体和尺寸',
          priority: 1,
          complexity: 'low',
          dependencies: [],
          props: ['variant', 'size', 'disabled', 'loading', 'onClick', 'children']
        },
        {
          name: 'input',
          description: '文本输入框组件',
          priority: 1,
          complexity: 'low',
          dependencies: [],
          props: ['type', 'placeholder', 'value', 'onChange', 'error', 'disabled']
        },
        {
          name: 'card',
          description: '卡片容器组件',
          priority: 2,
          complexity: 'medium',
          dependencies: ['button'],
          props: ['title', 'children', 'footer', 'hoverable']
        },
        {
          name: 'header',
          description: '页面顶部导航栏',
          priority: 3,
          complexity: 'medium',
          dependencies: ['button'],
          props: ['logo', 'navItems', 'user', 'onLogout']
        }
      ],
      designTokens: {
        colors: {
          'primary': '#3B82F6',
          'primary-dark': '#2563EB',
          'secondary': '#10B981',
          'background': '#FFFFFF',
          'surface': '#F3F4F6',
          'text-primary': '#111827',
          'text-secondary': '#6B7280',
          'border': '#E5E7EB',
          'error': '#EF4444',
          'success': '#10B981'
        },
        spacing: {
          'xs': '4px',
          'sm': '8px',
          'md': '16px',
          'lg': '24px',
          'xl': '32px'
        },
        typography: {
          'font-family': 'Inter, system-ui, sans-serif',
          'font-size-sm': '14px',
          'font-size-base': '16px',
          'font-size-lg': '18px',
          'font-size-xl': '20px'
        },
        borderRadius: {
          'sm': '4px',
          'md': '8px',
          'lg': '12px',
          'full': '9999px'
        },
        shadows: {
          'sm': '0 1px 2px rgba(0,0,0,0.05)',
          'md': '0 4px 6px rgba(0,0,0,0.1)',
          'lg': '0 10px 15px rgba(0,0,0,0.1)'
        }
      },
      figmaMetadata: {
        fileKey: 'mock',
        fileName: 'Demo Design',
        lastModified: new Date().toISOString()
      },
      summary: '演示计划：4个组件（2个原子组件、1个分子组件、1个有机体组件）'
    };
  }
}
