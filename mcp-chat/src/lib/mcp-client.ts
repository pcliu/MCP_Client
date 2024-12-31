import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ClientCapabilities } from "@modelcontextprotocol/sdk/types.js";
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { HttpsProxyAgent } from 'https-proxy-agent';

export class MCPClient {
    private session: Client | null = null;
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.NEXT_PUBLIC_OPENROUTER_API_KEY,
            defaultHeaders: {
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'MCP Chat',
            },
        });
    }

    async connectToServer(cliServerPath?: string): Promise<void> {
        const serverPath = process.env.NEXT_PUBLIC_SQLITE_SERVER_PATH || "parent_of_servers_repo/servers/src/sqlite";
        const dbPath = process.env.NEXT_PUBLIC_SQLITE_DB_PATH || "~/test.db";

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

        const response = await client.listTools();
        console.log("Connected to server with tools:", response.tools.map(tool => tool.name));
    }

    async processQuery(query: string): Promise<string> {
        if (!this.session) {
            throw new Error("Not connected to server");
        }
    
        console.log('收到查询:', query);
        
        const messages: ChatCompletionMessageParam[] = [
            { role: "user", content: query }
        ];
        
        let stepCount = 0;
    
        const response = await this.session.listTools();
        const availableTools = response.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema
        }));
    
        try {
            while (true) {
                stepCount++;
                console.log(`步骤 ${stepCount}`);
                
                const openaiResponse = await this.openai.chat.completions.create({
                    model: 'deepseek/deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: `你是一个数据库助手。请基于用户的要求和之前的结果，决定下一步需要执行什么操作。
                            如果需要执行工具，请先用一句话说明你要做什么，然后再使用工具。
                            如果不需要执行工具，直接返回最终结果。`
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

                if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                    if (assistantMessage.content) {
                        console.log('AI 助手:', assistantMessage.content);
                    }

                    for (const toolCall of assistantMessage.tool_calls) {
                        try {
                            console.log(`执行工具: ${toolCall.function.name}`);
                            
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
                            
                            console.log('参数:', JSON.stringify(toolArguments, null, 2));
                            
                            const result = await this.session.callTool({
                                name: toolCall.function.name,
                                arguments: toolArguments
                            });
                            
                            console.log('结果:', result.content)
    
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
                            console.error(`执行工具 ${toolCall.function.name} 时出错:`, errorMessage);

                            messages.push({
                                role: "tool",
                                tool_call_id: toolCall.id,
                                content: `执行失败: ${errorMessage}`
                            });
                        }
                    }
                } else if (assistantMessage.content) {
                    console.log('AI 助手:', assistantMessage.content);
                    return assistantMessage.content;
                }

                if (stepCount > 10) {
                    console.log('步骤数超过限制，强制结束');
                    return '由于步骤数超过限制，执行被强制结束';
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('调用 AI API 时出错:', error);
            throw new Error(`处理查询失败: ${errorMessage}`);
        }
    }

    async close(): Promise<void> {
        if (this.session) {
            await this.session.close();
        }
    }
} 