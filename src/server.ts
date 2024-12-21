import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PostgresClient } from './PostgresClient.js';
import { ChatGPTClient } from './ChatGPTClient.js';
import { AIClientType } from './ai/AIClient.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Initialize clients
const serverPath = process.env.POSTGRES_SERVER_PATH || '/path/to/postgres/server';
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mydb';
const postgresClient = new PostgresClient(serverPath, databaseUrl);

let currentAIType = process.env.AI_TYPE === 'lm_studio' ? AIClientType.LM_STUDIO : AIClientType.OPENAI;
let chatGPT = createChatGPTClient(currentAIType);

function createChatGPTClient(aiType: AIClientType) {
    const aiConfig = {
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.AI_BASE_URL,
        model: process.env.AI_MODEL,
        aiType: aiType
    };
    return new ChatGPTClient(aiConfig, postgresClient);
}

// Connect to PostgreSQL
postgresClient.connect().then(() => {
    console.log('Connected to PostgreSQL server');
}).catch(error => {
    console.error('Failed to connect to PostgreSQL:', error);
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.post('/api/model', (req, res) => {
    const { model } = req.body;
    currentAIType = model === 'lm_studio' ? AIClientType.LM_STUDIO : AIClientType.OPENAI;
    chatGPT = createChatGPTClient(currentAIType);
    console.log(`Switched to ${currentAIType} model`);
    res.json({ model: currentAIType });
});

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    try {
        const response = await chatGPT.processUserQuery(message);
        res.json({ response });
    } catch (error) {
        console.error('Error processing query:', error);
        res.status(500).json({ error: 'Failed to process query' });
    }
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
