import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ClientCapabilities, Tool } from "@modelcontextprotocol/sdk/types.js";
import Anthropic from '@anthropic-ai/sdk';
import * as dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

export class MCPClient {
    private session: Client | null = null;
    private anthropic: Anthropic;

    constructor() {
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
    }

    async connectToServer(cliServerPath?: string): Promise<void> {
        dotenv.config();
    
        const serverScriptPath = cliServerPath || process.env.POSTGRES_SERVER_PATH;
        if (!serverScriptPath) {
            throw new Error("Server path not provided in command line or POSTGRES_SERVER_PATH environment variable");
        }
    
        const isPython = serverScriptPath.endsWith('.py');
        const isJs = serverScriptPath.endsWith('.js');
        
        if (!isPython && !isJs) {
            throw new Error("Server script must be a .py or .js file");
        }
    
        const command = isPython ? "python" : "node";
        const dbUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/mydb";
        
        const transport = new StdioClientTransport({
            command,
            args: [serverScriptPath, dbUrl],  // 添加数据库 URL 作为参数
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

        const messages: Array<{ role: "user" | "assistant", content: string }> = [
            {
                role: "user",
                content: query
            }
        ];

        const response = await this.session.listTools();
        const availableTools = response.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            input_schema: tool.inputSchema
        }));

        try {
            // Initial Claude API call
            const claudeResponse = await this.anthropic.messages.create({
                model: "claude-3-sonnet-20240229",
                max_tokens: 1000,
                messages,
                system: "你是一个数据库工程师，书籍的信息放在 book 表中",
                tools: availableTools
            });

            const toolResults = [];
            const finalText: string[] = [];

            if (!claudeResponse.content) {
                throw new Error("No content in Claude's response");
            }

            for (const content of claudeResponse.content) {
                if (content.type === 'text') {
                    finalText.push(content.text);
                } else if (content.type === 'tool_use') {
                    try {
                        // Execute tool call
                        const result = await this.session.callTool({
                            name: content.name,
                            arguments: content.input as Record<string, unknown>
                        });
                        
                        toolResults.push({ call: content.name, result });
                        finalText.push(`[Calling tool ${content.name}] returned: ${JSON.stringify(result.content)}`);

                        // Add tool result to messages
                        messages.push({
                            role: "user",
                            content: `Tool ${content.name} returned: ${JSON.stringify(result.content)}`
                        });

                        
                        // Get next response from Claude
                        const nextResponse = await this.anthropic.messages.create({
                            model: "claude-3-sonnet-20240229",
                            max_tokens: 1000,
                            messages
                        });

                        if (nextResponse.content?.[0]?.type === 'text') {
                            finalText.push(nextResponse.content[0].text);
                        }
                    } catch (toolError: unknown) {
                        const errorMessage = toolError instanceof Error ? toolError.message : 'Unknown error';
                        console.error(`Error executing tool ${content.name}:`, toolError);
                        finalText.push(`[Error executing tool ${content.name}: ${errorMessage}]`);
                    }
                }
            }

            return finalText.join('\n');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error in Claude API call:', error);
            throw new Error(`Failed to process query: ${errorMessage}`);
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