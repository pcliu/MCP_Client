import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ClientCapabilities, Tool } from "@modelcontextprotocol/sdk/types.js";
import Anthropic from '@anthropic-ai/sdk';
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
    private anthropic: Anthropic;

    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
            baseURL: 'https://api.anthropic.com',
            httpAgent: proxyAgent
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
        
        const messages: Array<{ role: "user" | "assistant", content: string }> = [
            { role: "user", content: query }
        ];
        const finalText: string[] = [];
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
                console.log(`\n📝 步骤 ${stepCount} - 等待 Claude 分析下一步操作...`);
                
                const claudeResponse = await this.anthropic.messages.create({
                    model: "claude-3-5-sonnet-20241022",
                    max_tokens: 1000,
                    messages,
                    system: `你是一个数据库助手。请基于用户的要求和之前的结果，决定下一步需要执行什么操作。
                    每次响应都必须包含 "status" 字段:
                    - "continue": 表示还需要执行更多操作
                    - "complete": 表示所有任务都已完成
                    请用 JSON 格式返回，例如：{"status": "continue", "reason": "需要执行下一步..."} 或 {"status": "complete", "reason": "所有查询已完成"}`,
                    tools: availableTools
                });

                if (!claudeResponse.content) {
                    throw new Error("No content in Claude's response");
                }

                let statusChecked = false;

                for (const content of claudeResponse.content) {
                    if (content.type === 'text') {
                        try {
                            // 尝试解析状态 JSON
                            const statusJson = JSON.parse(content.text);
                            if (statusJson.status === 'complete') {
                                console.log('\n✅ 任务完成！原因:', statusJson.reason);
                                isTaskComplete = true;
                                statusChecked = true;
                                break;
                            } else if (statusJson.status === 'continue') {
                                console.log('\n⏳ 继续执行下一步。原因:', statusJson.reason);
                                statusChecked = true;
                            }
                        } catch (e) {
                            // 如果不是 JSON 格式，当作普通文本处理
                            console.log('💭 Claude 说:', content.text);
                            finalText.push(content.text);
                        }
                    } else if (content.type === 'tool_use') {
                        try {
                            console.log(`\n🔧 正在执行工具: ${content.name}`);
                            console.log('📥 输入参数:', JSON.stringify(content.input, null, 2));
                            
                            // 执行工具调用
                            const result = await this.session.callTool({
                                name: content.name,
                                arguments: content.input as Record<string, unknown>
                            });
                            
                            console.log('📤 执行结果:', JSON.stringify(result.content, null, 2));
                            
                            // 记录工具调用结果
                            finalText.push(`[执行工具 ${content.name}] 返回结果: ${JSON.stringify(result.content)}`);
    
                            // 将结果添加到对话历史
                            messages.push({
                                role: "assistant",
                                content: `我执行了工具 ${content.name}`
                            });
                            messages.push({
                                role: "user",
                                content: `工具 ${content.name} 返回结果: ${JSON.stringify(result.content)}`
                            });
                        } catch (toolError: unknown) {
                            const errorMessage = toolError instanceof Error ? toolError.message : 'Unknown error';
                            console.error(`❌ 执行工具 ${content.name} 时出错:`, errorMessage);
                            finalText.push(`[执行工具 ${content.name} 出错: ${errorMessage}]`);
                            
                            messages.push({
                                role: "user",
                                content: `工具 ${content.name} 执行失败: ${errorMessage}`
                            });
                        }
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
                    console.log('⚠️ 步骤数超过限制，强制结束');
                    isTaskComplete = true;
                }
            }
    
            console.log('\n📋 完整执行记录:');
            console.log(finalText.join('\n'));
            
            return finalText.join('\n');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('❌ 调用 Claude API 时出错:', error);
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
                const userInput = await question("You: ");
                if (userInput.toLowerCase() === "exit") {
                    console.log('Closing connection...');
                    await this.close();
                    rl.close();
                    break;
                }
                console.log("Processing your query...");
                const response = await this.processQuery(userInput);
                console.log("AI:", response);
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