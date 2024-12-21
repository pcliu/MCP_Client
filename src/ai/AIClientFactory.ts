import { AIClient, AIClientType, AIClientConfig } from './AIClient.js';
import { OpenAIClient } from './OpenAIClient.js';
import { LMStudioClient } from './LMStudioClient.js';

export class AIClientFactory {
    static createClient(type: AIClientType, config: AIClientConfig): AIClient {
        switch (type) {
            case AIClientType.OPENAI:
                return new OpenAIClient(config);
            case AIClientType.LM_STUDIO:
                return new LMStudioClient(config);
            default:
                throw new Error(`Unsupported AI client type: ${type}`);
        }
    }
}
