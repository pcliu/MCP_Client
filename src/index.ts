import { PostgresClient } from './PostgresClient.js';
import { ChatGPTClient } from './ChatGPTClient.js';
import { AIClientType } from './ai/AIClient.js';
import dotenv from 'dotenv';
import * as readline from 'readline';

dotenv.config();

async function main() {
  const serverPath = process.env.POSTGRES_SERVER_PATH || '/path/to/postgres/server';
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mydb';
  const client = new PostgresClient(serverPath, databaseUrl);

  const aiType = process.env.AI_TYPE === 'lm_studio' ? AIClientType.LM_STUDIO : AIClientType.OPENAI;
  console.log(`Using AI type: ${aiType}`);

  const aiConfig = {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
    aiType: aiType
  };
  
  const chatGPT = new ChatGPTClient(aiConfig, client);

  try {
    await client.connect();
    console.log('Connected to PostgreSQL server');

    // 列出所有表
    console.log('Listing all tables...');
    const tables = await client.listTables();
    console.log('Available tables:', tables);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, resolve);
      });
    };

    console.log('\nWelcome to the Book Database AI Assistant!');
    console.log('You can ask questions about books, and I will help you find the information.');
    console.log('Type "exit" to quit.\n');

    while (true) {
      const userInput = await question('Ask a question about books: ');
      console.log('Processing question:', userInput);
      
      if (userInput.toLowerCase() === 'exit') {
        console.log('Closing connection...');
        await client.close();
        rl.close();
        break;
      }

      try {
        const response = await chatGPT.processUserQuery(userInput);
        console.log('\nAI Response:', response, '\n');
      } catch (err) {
        console.error('Error:', err instanceof Error ? err.message : String(err));
      }
    }

  } catch (error) {
    console.error('Error occurred:', error);
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        console.error('Please check your AI API key configuration');
      } else if (error.message.includes('connect')) {
        console.error('Database connection error. Please check your database configuration.');
      }
    }
    throw error;
  }
}

process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down...');
  process.exit(0);
});

main().catch((error) => {
  console.error('Application error:', error);
  process.exit(1);
});