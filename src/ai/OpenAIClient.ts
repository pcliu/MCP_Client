import OpenAI from 'openai';
import { AIClient, AIClientConfig } from './AIClient.js';

const SYSTEM_PROMPT = `You are a helpful assistant with access to a PostgreSQL database containing book information. 
You can help users query and analyze book data. The database has a 'book' table with columns: 
title, author, price, genre, published_date.
When users ask questions about books, use SQL queries to get the data you need.
Always format your SQL queries within \`\`\`sql code blocks.`;

const DEFAULT_CONFIG = {
    model: 'gpt-3.5-turbo'
};

export class OpenAIClient implements AIClient {
    private client: OpenAI;
    private model: string;

    constructor(config: AIClientConfig) {
        if (!config.apiKey) {
            throw new Error('OpenAI API key is required');
        }
        
        this.client = new OpenAI({
            apiKey: config.apiKey
        });
        
        this.model = config.model || DEFAULT_CONFIG.model;
    }

    async chat(prompt: string): Promise<string> {
        try {
            console.log('OpenAI: Sending request with prompt:', prompt);
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
                throw new Error('No response from OpenAI');
            }
            console.log('OpenAI response:', response);
            return response;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error('OpenAI request error:', errorMessage);
            throw new Error(`OpenAI request failed: ${errorMessage}`);
        }
    }
}
