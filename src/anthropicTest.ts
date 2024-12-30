import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 加载环境变量
dotenv.config();

// 设置代理 URL
const proxyUrl = 'http://127.0.0.1:7897';

// 创建代理 agent
const proxyAgent = new HttpsProxyAgent(proxyUrl);

// 打印 API key 的前几个字符（用于调试）
console.log('API Key 前缀:', process.env.ANTHROPIC_API_KEY?.substring(0, 10) + '...');

// 初始化 Anthropic 客户端
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'https://api.anthropic.com',
  httpAgent: proxyAgent
});

async function testAnthropicAPI() {
  try {
    console.log('开始调用 API...');
    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: '你好，请简单介绍一下你自己。'
      }],
      temperature: 0.7
    });

    console.log('\nAPI 响应:');
    console.log('----------------------------------------');
    if (Array.isArray(message.content)) {
      message.content.forEach(content => {
        if (content.type === 'text') {
          console.log(content.text);
        }
      });
    } else {
      console.log(message.content);
    }
    console.log('----------------------------------------\n');
  } catch (error: any) {
    console.error('调用 API 时发生错误:', error);
    if (error.error?.message) {
      console.error('错误信息:', error.error.message);
    }
  }
}

// 运行测试
testAnthropicAPI(); 