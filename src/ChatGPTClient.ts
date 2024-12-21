import { PostgresClient } from './PostgresClient.js';
import { AIClient, AIClientType } from './ai/AIClient.js';
import { AIClientFactory } from './ai/AIClientFactory.js';

export class ChatGPTClient {
    private aiClient: AIClient;
    private dbClient: PostgresClient;

    constructor(config: { 
        apiKey?: string;
        baseURL?: string;
        model?: string;
        aiType: AIClientType;
    }, dbClient: PostgresClient) {
        console.log(`Initializing AI client of type: ${config.aiType}`);
        this.aiClient = AIClientFactory.createClient(config.aiType, config);
        this.dbClient = dbClient;
    }

    async chat(prompt: string): Promise<string> {
        try {
            console.log('Processing prompt:', prompt);
            const response = await this.aiClient.chat(prompt);
            console.log('AI response:', response);
            
            // 检查响应中是否包含 SQL 查询
            const sqlMatch = response.match(/```sql\n([\s\S]*?)\n```/);
            if (sqlMatch) {
                const sql = sqlMatch[1].trim();
                console.log('Executing SQL query:', sql);
                try {
                    const queryResult = await this.dbClient.query(sql);
                    console.log('Query result:', queryResult);
                    return response + "\n\nQuery Results:\n" + JSON.stringify(queryResult, null, 2);
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    console.error('Database query error:', errorMessage);
                    return response + "\n\nError executing query: " + errorMessage;
                }
            }

            return response;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('AI request error:', errorMessage);
            throw new Error(`AI request failed: ${errorMessage}`);
        }
    }

    async processUserQuery(question: string): Promise<string> {
        console.log('Processing user query:', question);
        try {
            return await this.chat(question);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('Error processing query:', errorMessage);
            return `Sorry, I encountered an error while processing your question: ${errorMessage}`;
        }
    }
}
