import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ClientCapabilities, Tool } from "@modelcontextprotocol/sdk/types.js";
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import * as dotenv from 'dotenv';
import * as readline from 'readline';
import { HttpsProxyAgent } from 'https-proxy-agent';

// 加载环境变量
dotenv.config();

// 设置代理 URL
const proxyUrl = 'http://127.0.0.1:7897';

// 创建代理 agent
const proxyAgent = new HttpsProxyAgent(proxyUrl);

export class MCPClient {
    private session: Client | null = null;
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
            defaultHeaders: {
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'MCP Client',
            },
            //httpAgent: proxyAgent
        });
    }

    async connectToServer(cliServerPath?: string): Promise<void> {
        dotenv.config();
    
        const serverPath = process.env.SQLITE_SERVER_PATH || "parent_of_servers_repo/servers/src/sqlite";
        if (!serverPath) {
            throw new Error("Server path not provided in SQLITE_SERVER_PATH environment variable");
        }
    
        const dbPath = process.env.SQLITE_DB_PATH || "~/test.db";

        const transport = new StdioClientTransport({
            command: "uv",
            args: [
                "--directory",
                serverPath,
                "run",
                "mcp-server-sqlite",
                "--db-path",
                dbPath
            ],
        });

        const capabilities: ClientCapabilities = {
            prompts: true,
            tools: true,
            resources: { subscribe: true },
            roots: { listChanged: true },
            logging: true
        };

        const client = new Client(
            {
                name: "mcp-client",
                version: "1.0.0"
            },
            { capabilities }
        );

        await client.connect(transport);
        this.session = client;

        // List available tools
        const response = await client.listTools();
        console.log("\nConnected to server with tools:", response.tools.map(tool => tool.name));
    }

    async processQuery(query: string): Promise<string> {
        if (!this.session) {
            throw new Error("Not connected to server");
        }
    
        console.log('\n🤔 收到查询:', query);
        
        const messages: ChatCompletionMessageParam[] = [
            { role: "user", content: query }
        ];
        let lastResult = '';  // 用于存储最后的结果
        let isTaskComplete = false;
        let stepCount = 0;
    
        // 获取可用工具列表
        const response = await this.session.listTools();
        const availableTools = response.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema
        }));
    
        try {
            while (!isTaskComplete) {
                stepCount++;
                console.log(`\n📝 步骤 ${stepCount}`);
                
                //console.log(messages);

                const openaiResponse = await this.openai.chat.completions.create({
                    model: 'anthropic/claude-3-sonnet',
                    messages: [
                        {
                            role: 'system',
                            content: `你是一个数据库助手。请基于用户的要求和之前的结果，决定下一步需要执行什么操作。
                            
                            如果需要执行工具，请先用一句话说明你要做什么，然后再使用工具。
                            如果不需要执行工具，每次响应都必须包含 JSON 格式的状态信息：
                            {
                                "status": "continue" | "complete",
                                "reason": "说明原因..."
                                "result": "返回结果..."
                            }
                            
                            示例：
                            1. 执行工具：先说明意图，再使用工具
                            2. 不执行工具：返回 {"status": "complete", "reason": "所有查询已完成","result": "结果为..."}`
                        },
                        ...messages
                    ],
                    temperature: 0.7,
                    tools: availableTools.map(tool => ({
                        type: 'function',
                        function: {
                            name: tool.name,
                            description: tool.description,
                            parameters: tool.input_schema
                        }
                    }))
                });

                const assistantMessage = openaiResponse.choices[0]?.message;
                if (!assistantMessage) {
                    throw new Error("No content in AI's response");
                }

                let statusChecked = false;


                // 优先处理工具调用
                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    for (const toolCall of assistantMessage.tool_calls) {
                        try {

                            // 处理思考过程
                            if (assistantMessage.content) {
                                if (!assistantMessage.content.startsWith('{')) {
                                    console.log('\n💭 AI 助手:', assistantMessage.content);
                                    lastResult = `思考: ${assistantMessage.content}`;
                                }
                            }
                            
                            console.log(`\n🔧 执行工具: ${toolCall.function.name}`);
                            
                            // 解析和处理参数
                            let toolArguments: Record<string, unknown> = {};
                            if (toolCall.function.arguments) {
                                try {
                                    toolArguments = toolCall.function.arguments.trim() === '' 
                                        ? {} 
                                        : JSON.parse(toolCall.function.arguments);
                                } catch (parseError) {
                                    console.warn('参数解析失败，使用空对象:', parseError);
                                    toolArguments = {};
                                }
                            }
                            
                            console.log('📥 参数:', JSON.stringify(toolArguments, null, 2));
                            
                            // 执行工具调用
                            const result = await this.session.callTool({
                                name: toolCall.function.name,
                                arguments: toolArguments
                            });
                            
                            // 打印结果
                            console.log('📤 结果:', result.content);
                            lastResult = result.content ? JSON.stringify(result.content) : '无结果';
    
                            messages.push({
                                role: "assistant",
                                content: null,
                                tool_calls: [toolCall]
                            });
                            messages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: JSON.stringify(result.content)
                            });
                        } catch (toolError: unknown) {
                            const errorMessage = toolError instanceof Error ? toolError.message : 'Unknown error';
                            console.error(`❌ 执行工具 ${toolCall.function.name} 时出错:`, errorMessage);
                            lastResult = `执行 ${toolCall.function.name} 失败: ${errorMessage}`;
                            
                            messages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: `执行失败: ${errorMessage}`
                            });
                        }
                    }
                    statusChecked = true;
                }
                // 处理状态响应
                else if (assistantMessage.content) {
                    try {
                        // 尝试解析状态 JSON
                        const statusJson = JSON.parse(assistantMessage.content);
                        if (statusJson.status === 'complete') {
                            console.log('\n✅ 完成:', statusJson.result);
                            console.log('您还有哪些需求？');
                            lastResult = statusJson.result;
                            isTaskComplete = true;
                            statusChecked = true;
                            // 如果完成了，直接返回结果
                            return lastResult;
                        } else if (statusJson.status === 'continue') {
                            console.log('\n⏳ 继续:', statusJson.reason);
                            statusChecked = true;
                        }
                    } catch (e) {
                        // 如果不是 JSON，当作普通响应处理
                        if (assistantMessage.content.trim()) {
                            console.log('💭 AI 说:', assistantMessage.content);
                            lastResult = assistantMessage.content;
                        }
                    }
                    
                    if (assistantMessage.content.trim()) {
                        messages.push({
                            role: "assistant",
                            content: assistantMessage.content
                        });
                    }
                }

                // 如果没有检查到状态信息，可能需要提醒模型
                if (!statusChecked) {
                    messages.push({
                        role: "user",
                        content: "请明确指出当前任务的状态（complete/continue）"
                    });
                }

                // 防止无限循环
                if (stepCount > 10) {
                    console.log('\n⚠️ 步骤数超过限制，强制结束');
                    lastResult = '由于步骤数超过限制，执行被强制结束';
                    isTaskComplete = true;
                    return lastResult;
                }
            }
            
            // 返回最后的结果
            return lastResult;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ 调用 AI API 时出错:', error);
            throw new Error(`处理查询失败: ${errorMessage}`);
        }
    }

    async close(): Promise<void> {
        if (this.session) {
            await this.session.close();
        }
    }

    //定义chat loop 函数，用于处理用户的交互，当输入 exit 时退出
    async chatLoop(): Promise<void> {
        console.log("MCP Client Started!");
        console.log("Type your queries or 'exit' to exit.");
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (prompt: string): Promise<string> => {
            return new Promise((resolve) => {
              rl.question(prompt, resolve);
            });
        }

        try {
            while (true) {
                const userInput = await question("\n您: ");
                if (userInput.toLowerCase() === "exit") {
                    console.log('正在关闭连接...');
                    await this.close();
                    rl.close();
                    break;
                }
                console.log("正在处理您的查询...");
                const response = await this.processQuery(userInput);
                //console.log("\n🎯 最终结果:", response);
            }
        } finally {
            rl.close();
        }
    }
}

// Example usage
async function main() {
    const client = new MCPClient();
    try {
        const serverPath = process.argv[2];  // Get command line argument if provided
        await client.connectToServer(serverPath);
        console.log("Connected to server");
        
        await client.chatLoop();
        
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.close();
    }
}

// Example usage
main().catch(console.error);
