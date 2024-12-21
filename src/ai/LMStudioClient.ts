import OpenAI from 'openai';
import { AIClient, AIClientConfig } from './AIClient.js';

const SYSTEM_PROMPT = `You are a helpful assistant with access to a PostgreSQL database containing book information. 
You can help users query and analyze book data. The database has a 'book' table with columns: 
title, author, price, genre, published_date.
When users ask questions about books, use SQL queries to get the data you need.
Always format your SQL queries within \`\`\`sql code blocks.`;

const DEFAULT_CONFIG = {
    baseURL: 'http://localhost:1234/v1',
    model: 'local-model'
};

export class LMStudioClient implements AIClient {
    private client: OpenAI;
    private model: string;

    constructor(config: AIClientConfig) {
        this.client = new OpenAI({
            baseURL: config.baseURL || DEFAULT_CONFIG.baseURL,
            apiKey: 'not-needed'  // LM Studio doesn't require an API key
        });
        
        this.model = config.model || DEFAULT_CONFIG.model;
    }

    async chat(prompt: string): Promise<string> {
        try {
            console.log('LM Studio: Sending request with prompt:', prompt);
            const completion = await this.client.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: SYSTEM_PROMPT
                    },
                    { role: "user", content: prompt }
                ],
                model: this.model,
            });

            const response = completion.choices[0]?.message?.content;
            if (!response) {
                throw new Error('No response from LM Studio');
            }
            console.log('LM Studio response:', response);
            return response;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('LM Studio request error:', errorMessage);
            throw new Error(`LM Studio request failed: ${errorMessage}`);
        }
    }
}
