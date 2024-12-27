export interface AIClientConfig {
    apiKey?: string;
    baseURL?: string;
    model?: string;
    aiType: AIClientType;
}

export enum AIClientType {
    OPENAI = 'openai',
    LM_STUDIO = 'lm_studio'
}

export interface AIClient {
    chat(prompt: string): Promise<string>;
}