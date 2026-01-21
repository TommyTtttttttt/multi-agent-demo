#!/usr/bin/env node

/**
 * 简单测试脚本 - 验证 CLI 模式是否正常工作
 */

import { BaseAgent } from '../src/agents/base.js';

class TestAgent extends BaseAgent {
  constructor() {
    super('TestAgent', `你是一个测试助手。当用户请求时，使用 respond 工具回复。`, [
      {
        name: 'respond',
        description: '回复用户的消息',
        input_schema: {
          type: 'object',
          properties: {
            message: { type: 'string', description: '回复内容' }
          },
          required: ['message']
        }
      }
    ]);
    this.response = null;
  }

  async executeTool(name, input) {
    if (name === 'respond') {
      this.response = input.message;
      console.log(`[Tool Response] ${input.message}`);
      return { success: true };
    }
    throw new Error(`Unknown tool: ${name}`);
  }
}

async function test() {
  console.log('='.repeat(50));
  console.log('🧪 测试 CLI 模式');
  console.log('='.repeat(50));
  console.log(`\n📍 CLI 模式: ${!process.env.ANTHROPIC_API_KEY ? '是' : '否'}\n`);

  const agent = new TestAgent();

  console.log('📤 发送测试消息...\n');

  try {
    const result = await agent.run('请使用 respond 工具说 "CLI模式测试成功!"', 3);

    console.log('\n' + '='.repeat(50));
    console.log('📊 测试结果');
    console.log('='.repeat(50));
    console.log(`成功: ${result.success}`);
    console.log(`迭代次数: ${result.iterations}`);
    console.log(`响应: ${agent.response || result.response}`);

    if (result.success) {
      console.log('\n✅ CLI 模式测试通过！\n');
    } else {
      console.log('\n❌ 测试失败\n');
    }
  } catch (error) {
    console.error('\n❌ 测试出错:', error.message);
    console.error(error.stack);
  }
}

test();
