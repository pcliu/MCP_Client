# MCP PostgreSQL Client

A PostgreSQL client implementation based on the Model Context Protocol.

## Prerequisites

1. Download MCP PostgreSQL Server:
```bash
git clone https://github.com/modelcontextprotocol/servers.git
cd servers
git checkout main
```

2. Build the PostgreSQL server:
```bash
cd src/postgres
npm install
npm run build
```
The build process will create `dist/index.js` which will be used as the server entry point.

3. Copy the PostgreSQL server implementation or update your environment variables to point to the built server:
```bash
# Option 1: Copy the server
cp -r src/postgres /path/to/your/project/server

# Option 2: Update POSTGRES_SERVER_PATH in .env
POSTGRES_SERVER_PATH=/path/to/servers/src/postgres/dist/index.js
```

## Project Description

This project provides a PostgreSQL client implementation using the Model Context Protocol, supporting database operations and web server functionality.

## Requirements

- Node.js (Latest LTS version recommended)
- PostgreSQL database
- npm or yarn package manager

## Installation

1. After cloning the project, navigate to the project directory:
```bash
cd clients
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   Create a `.env` file and set the following variables:
   ```
   DATABASE_URL=your_postgresql_database_url
   PORT=server_port_number (default 3000)
   ```

## Usage

### Build the project
```bash
npm run build
```

### Run in development mode
```bash
npm run dev
```

### Start the web server
```bash
npm run web
```

## Project Structure

- `src/`
  - `index.ts` - Main entry file
  - `server.ts` - Web server implementation
  - `PostgresClient.ts` - PostgreSQL client implementation

## Main Features

- PostgreSQL database operations
- Web API service
- Model Context Protocol integration

## Important Notes

1. Ensure environment variables are properly configured before running
2. Make sure PostgreSQL database service is running
3. Verify that required ports are not in use

## Tech Stack

- TypeScript
- Express.js
- PostgreSQL
- Model Context Protocol SDK
- dotenv
- OpenAI SDK
- Zod
