# Spark Server 🔥🌐

Web server for Spark AI-powered web automation. Provides HTTP API endpoints to execute web automation tasks using natural language.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Add your OpenAI API key to .env
echo "OPENAI_API_KEY=sk-your-key-here" >> .env

# Start development server
pnpm run dev
```

## Basic Usage

```bash
# Simple web query
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{"task": "what is the weather in Tokyo?"}'
```

## API Endpoints

### Execute Spark Task

**POST** `/spark/run`

Execute a web automation task using natural language.

**Request Body:**

```json
{
  "task": "string (required)",
  "url": "string (optional)",
  "data": "object (optional)",
  "guardrails": "string (optional)"
}
```

### Health Check

**GET** `/health`

Check server status.

## Environment Variables

Create a `.env` file:

```bash
PORT=3000
OPENAI_API_KEY=sk-your-openai-api-key-here
```

## Development Commands

```bash
pnpm run dev          # Start dev server with hot reload
pnpm run build        # Build TypeScript to dist/
pnpm run start        # Start production server
pnpm run typecheck    # Run TypeScript type checking
pnpm test             # Run tests
```
