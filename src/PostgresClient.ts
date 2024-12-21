import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

// Define schemas for PostgreSQL operations
const QueryResultSchema = z.object({
  content: z.array(z.object({
    type: z.literal('text'),
    text: z.string()
  })),
  isError: z.boolean()
});

export class PostgresClient {
  private client: Client;
  private transport: StdioClientTransport;

  constructor(serverPath: string, databaseUrl: string) {
    console.log('Initializing PostgresClient with:', { serverPath, databaseUrl });
    this.transport = new StdioClientTransport({
      command: serverPath,
      args: [databaseUrl]
    });

    this.client = new Client({
      name: "postgres-mcp-client",
      version: "1.0.0",
    }, {
      capabilities: {}
    });
  }

  async connect(): Promise<void> {
    console.log('Connecting to PostgreSQL server...');
    await this.client.connect(this.transport);
    console.log('Connected successfully');
  }

  async close(): Promise<void> {
    console.log('Closing PostgreSQL connection...');
    // Close the transport
    await this.transport.close();
    console.log('Connection closed');
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    console.log('Executing SQL query:', sql);
    const result = await this.client.request(
      {
        method: "tools/call",
        params: {
          name: "query",
          arguments: {
            sql
          }
        }
      },
      QueryResultSchema
    );
    
    if (result.isError) {
      console.error('Query failed:', result);
      throw new Error("Query failed");
    }
    
    const parsedResult = result.content[0].text ? JSON.parse(result.content[0].text) : [];
    console.log('Query result:', parsedResult);
    return parsedResult;
  }

  async listTables(): Promise<string[]> {
    console.log('Listing tables...');
    const result = await this.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    const tables = result.map(row => row.table_name);
    console.log('Available tables:', tables);
    return tables;
  }
}
