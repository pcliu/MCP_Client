import OpenAI from 'openai';
import dotenv from 'dotenv';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 加载环境变量
dotenv.config();

// 设置代理 URL
const proxyUrl = 'http://127.0.0.1:7897';

// 创建代理 agent
const proxyAgent = new HttpsProxyAgent(proxyUrl);

// 打印 API key 的前几个字符（用于调试）
console.log('API Key 前缀:', process.env.OPENROUTER_API_KEY?.substring(0, 10) + '...');

// 初始化 OpenAI 客户端
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'http://localhost:3000', // 你的应用域名
    'X-Title': 'MCP Client Test', // 你的应用名称
  },
  //httpAgent: proxyAgent
});

async function testOpenRouterAPI() {
  try {
    console.log('开始调用 API...');
    
    const completion = await openai.chat.completions.create({
      model: 'anthropic/claude-3.5-sonnet', // 使用 Claude 3.5 Sonnet 模型
      messages: [{
        role: 'user',
        content: '你好，请简单介绍一下你自己。'
      }],
      temperature: 0.7
    });

    console.log('\nAPI 响应:');
    console.log('----------------------------------------');
    console.log(completion.choices[0]?.message?.content || '无响应内容');
    console.log('----------------------------------------\n');

  } catch (error: any) {
    console.error('调用 API 时发生错误:', error);
    if (error.response) {
      console.error('错误详情:', await error.response.text());
    }
  }
}

// 运行测试
testOpenRouterAPI(); 