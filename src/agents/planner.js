/**
 * Planner Agent
 *
 * 分析 Figma 设计稿，输出 JSON 格式的开发计划
 * 使用 Claude CLI 的内置能力（无需自定义工具）
 */

import { BaseAgent } from './base.js';

const PLANNER_SYSTEM_PROMPT = `你是一个资深前端架构师，负责分析 Figma 设计稿并规划组件开发任务。

## 你的职责

1. 分析设计稿结构，识别所有 UI 组件
2. 提取设计 tokens（颜色、字体、间距）
3. 分析组件依赖关系，制定开发优先级
4. 输出结构化的 JSON 开发计划

## 组件分类原则

- **priority 1** (原子组件): Button, Input, Icon, Badge - 无依赖，最先开发
- **priority 2** (分子组件): Card, ListItem, FormField - 依赖原子组件
- **priority 3** (有机体): Header, Sidebar, Modal - 依赖分子组件
- **priority 4** (页面): Dashboard, Settings - 依赖有机体组件

## 输出格式要求

必须输出有效的 JSON，包含：
- components: 组件数组，每个包含 name, description, priority, dependencies, complexity, props
- designTokens: 包含 colors, spacing, typography, borderRadius, shadows
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
分析以下 Figma 设计稿并生成开发计划：

Figma URL: ${figmaUrl}
File Key: ${fileKey}

请：
1. 识别设计稿中的所有可复用组件
2. 提取设计 tokens（颜色、间距、字体等）
3. 分析组件依赖关系
4. 按优先级排序组件

输出 JSON 格式的开发计划，结构如下：
{
  "components": [
    {
      "name": "button",
      "description": "主按钮组件",
      "priority": 1,
      "complexity": "low",
      "dependencies": [],
      "props": ["variant", "size", "disabled", "onClick"]
    }
  ],
  "designTokens": {
    "colors": { "primary": "#3B82F6", ... },
    "spacing": { "sm": "8px", ... },
    "typography": { ... },
    "borderRadius": { ... },
    "shadows": { ... }
  },
  "summary": "计划摘要"
}`;

    try {
      const result = await this.execute(task, {
        allowedTools: ['Read', 'WebFetch'],
        jsonOutput: true
      });

      if (result.components && result.designTokens) {
        // 按优先级排序
        result.components.sort((a, b) => a.priority - b.priority);
        this.log(`识别到 ${result.components.length} 个组件`, 'success');
        return result;
      }

      // 如果解析失败，返回模拟数据
      this.log('无法解析计划，使用默认数据', 'warn');
      return this.getMockPlan();

    } catch (error) {
      this.log(`分析失败: ${error.message}`, 'error');
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
      summary: '演示计划：4个组件（2个原子组件、1个分子组件、1个有机体组件）'
    };
  }
}
