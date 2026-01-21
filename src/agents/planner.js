/**
 * Planner Agent
 *
 * 负责分析 Figma 设计稿，识别组件，制定开发计划
 */

import { BaseAgent } from './base.js';

const PLANNER_SYSTEM_PROMPT = `你是一个资深前端架构师 Agent，负责分析 Figma 设计稿并规划组件开发任务。

## 你的职责

1. 分析 Figma 设计稿结构
2. 识别所有需要开发的 UI 组件
3. 提取设计 tokens（颜色、字体、间距）
4. 分析组件依赖关系
5. 制定合理的开发计划

## 组件识别原则

1. **原子组件** (priority: 1)
   - Button, Input, Icon, Badge, Avatar
   - 无依赖，最先开发

2. **分子组件** (priority: 2)
   - Card, ListItem, MenuItem, FormField
   - 依赖原子组件

3. **有机体组件** (priority: 3)
   - Header, Sidebar, Footer, Modal, Form
   - 依赖分子组件

4. **模板/页面组件** (priority: 4)
   - Dashboard, Profile, Settings
   - 依赖有机体组件

## 输出要求

- 组件命名使用 kebab-case (如 user-card, nav-header)
- 每个组件必须包含: name, description, priority, dependencies
- 必须提取 designTokens（颜色、间距、字体）`;

const PLANNER_TOOLS = [
  {
    name: 'analyze_figma_structure',
    description: '分析 Figma 文件结构，获取所有页面和帧',
    input_schema: {
      type: 'object',
      properties: {
        file_key: {
          type: 'string',
          description: 'Figma 文件的 key'
        }
      },
      required: ['file_key']
    }
  },
  {
    name: 'get_figma_node_details',
    description: '获取特定 Figma 节点的详细信息（样式、子节点、属性）',
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
    name: 'get_figma_styles',
    description: '获取 Figma 文件中定义的样式（颜色、文本、效果）',
    input_schema: {
      type: 'object',
      properties: {
        file_key: { type: 'string' }
      },
      required: ['file_key']
    }
  },
  {
    name: 'create_development_plan',
    description: '创建最终的组件开发计划',
    input_schema: {
      type: 'object',
      properties: {
        components: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: '组件名称 (kebab-case)' },
              nodeId: { type: 'string', description: 'Figma 节点 ID' },
              description: { type: 'string', description: '组件描述' },
              priority: { type: 'number', description: '开发优先级 1-4' },
              dependencies: {
                type: 'array',
                items: { type: 'string' },
                description: '依赖的其他组件'
              },
              complexity: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
                description: '复杂度评估'
              },
              props: {
                type: 'array',
                items: { type: 'string' },
                description: '预期的组件 props'
              }
            },
            required: ['name', 'description', 'priority']
          }
        },
        designTokens: {
          type: 'object',
          properties: {
            colors: { type: 'object' },
            spacing: { type: 'object' },
            typography: { type: 'object' },
            shadows: { type: 'object' },
            borderRadius: { type: 'object' }
          },
          description: '提取的设计 tokens'
        },
        summary: {
          type: 'string',
          description: '计划摘要'
        }
      },
      required: ['components', 'designTokens', 'summary']
    }
  }
];

export class PlannerAgent extends BaseAgent {
  constructor(orchestrator) {
    super('Planner', PLANNER_SYSTEM_PROMPT, PLANNER_TOOLS);
    this.orchestrator = orchestrator;
    this.developmentPlan = null;
  }

  /**
   * 分析 Figma 设计稿并生成开发计划
   */
  async analyzeDesign(figmaUrl) {
    const fileKey = this.extractFileKey(figmaUrl);

    this.log(`开始分析 Figma 设计稿: ${fileKey}`);

    const result = await this.run(`
请分析这个 Figma 设计稿并创建完整的前端组件开发计划。

## Figma 信息
- File Key: ${fileKey}
- URL: ${figmaUrl}

## 任务步骤

1. **分析结构**: 使用 analyze_figma_structure 获取文件整体结构
2. **获取样式**: 使用 get_figma_styles 提取设计 tokens
3. **识别组件**: 根据设计稿识别所有需要开发的组件
4. **分析依赖**: 确定组件之间的依赖关系
5. **制定计划**: 使用 create_development_plan 输出最终计划

## 注意事项

- 优先识别可复用的基础组件
- 提取所有颜色、间距、字体作为 design tokens
- 考虑组件的变体（hover, active, disabled 等状态）
- 给出合理的 props 建议
    `);

    return this.developmentPlan;
  }

  /**
   * 从 Figma URL 提取 file key
   */
  extractFileKey(url) {
    // 支持多种 Figma URL 格式
    // https://www.figma.com/file/ABC123/name
    // https://www.figma.com/design/ABC123/name
    // https://figma.com/file/ABC123/name
    const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
    if (match) {
      return match[1];
    }
    // 如果不是 URL，假设直接是 file key
    return url;
  }

  /**
   * 执行工具
   */
  async executeTool(name, input) {
    switch (name) {
      case 'analyze_figma_structure':
        return await this.analyzeFigmaStructure(input);

      case 'get_figma_node_details':
        return await this.getFigmaNodeDetails(input);

      case 'get_figma_styles':
        return await this.getFigmaStyles(input);

      case 'create_development_plan':
        return this.createDevelopmentPlan(input);

      default:
        throw new Error(`未知工具: ${name}`);
    }
  }

  /**
   * 分析 Figma 结构 - 通过 MCP 或模拟
   */
  async analyzeFigmaStructure({ file_key }) {
    // 如果有 MCP 连接，使用 MCP
    if (this.orchestrator.mcpClient) {
      return await this.orchestrator.callMcp('figma_get_file', { file_key });
    }

    // 否则返回模拟数据（用于演示）
    this.log('使用模拟数据（未连接 Figma MCP）');
    return {
      name: 'Demo Design System',
      lastModified: new Date().toISOString(),
      pages: [
        {
          id: 'page-1',
          name: 'Components',
          frames: [
            { id: '1:2', name: 'Button', type: 'COMPONENT' },
            { id: '1:10', name: 'Input', type: 'COMPONENT' },
            { id: '1:20', name: 'Card', type: 'COMPONENT' },
            { id: '1:30', name: 'Header', type: 'COMPONENT' },
            { id: '1:40', name: 'Sidebar', type: 'COMPONENT' },
            { id: '1:50', name: 'Modal', type: 'COMPONENT' }
          ]
        },
        {
          id: 'page-2',
          name: 'Pages',
          frames: [
            { id: '2:1', name: 'Dashboard', type: 'FRAME' },
            { id: '2:2', name: 'Settings', type: 'FRAME' }
          ]
        }
      ]
    };
  }

  /**
   * 获取节点详情
   */
  async getFigmaNodeDetails({ file_key, node_id }) {
    if (this.orchestrator.mcpClient) {
      return await this.orchestrator.callMcp('figma_get_node', { file_key, node_id });
    }

    // 模拟数据
    return {
      id: node_id,
      name: 'Component',
      type: 'COMPONENT',
      children: [],
      styles: {
        fill: '#3B82F6',
        stroke: 'none'
      }
    };
  }

  /**
   * 获取 Figma 样式
   */
  async getFigmaStyles({ file_key }) {
    if (this.orchestrator.mcpClient) {
      return await this.orchestrator.callMcp('figma_get_styles', { file_key });
    }

    // 模拟设计 tokens
    return {
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
        'warning': '#F59E0B',
        'success': '#10B981'
      },
      typography: {
        'heading-1': { fontSize: '32px', fontWeight: '700', lineHeight: '1.2' },
        'heading-2': { fontSize: '24px', fontWeight: '600', lineHeight: '1.3' },
        'heading-3': { fontSize: '20px', fontWeight: '600', lineHeight: '1.4' },
        'body': { fontSize: '16px', fontWeight: '400', lineHeight: '1.5' },
        'body-small': { fontSize: '14px', fontWeight: '400', lineHeight: '1.5' },
        'caption': { fontSize: '12px', fontWeight: '400', lineHeight: '1.4' }
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px'
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
    };
  }

  /**
   * 创建开发计划
   */
  createDevelopmentPlan(plan) {
    this.developmentPlan = plan;
    this.log(`开发计划已创建: ${plan.components.length} 个组件`, 'success');

    // 按优先级排序
    plan.components.sort((a, b) => a.priority - b.priority);

    return {
      success: true,
      componentsCount: plan.components.length,
      summary: plan.summary
    };
  }
}
