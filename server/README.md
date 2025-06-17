# Spark Server 🔥🌐

Web server for Spark AI-powered web automation. Provides HTTP API endpoints to execute web automation tasks using natural language.

## Quick Start

### Installation

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

### Basic Usage

```bash
# Simple web query
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{"task": "what is the weather in Tokyo?"}'

# With starting URL
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{
    "task": "search for TypeScript tutorials",
    "url": "https://google.com"
  }'
```

## Features

- 🚀 **HTTP API**: RESTful endpoints for web automation
- 🤖 **Natural Language**: Same Spark AI capabilities via HTTP
- 🔧 **Hono Framework**: Fast, lightweight web server
- 🛡️ **Safety Controls**: Guardrails support for safe automation
- 📊 **Structured Data**: Pass JSON context to automation tasks
- 🏥 **Health Monitoring**: Built-in health check endpoints

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

**Response:**

```json
{
  "success": true,
  "result": {
    "success": true,
    "message": "Task completed successfully",
    "url": "https://final-page.com",
    "screenshot": "base64-screenshot-data"
  }
}
```

**Examples:**

```bash
# Simple search
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{"task": "find the latest news on Reuters"}'

# With URL and guardrails
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{
    "task": "search for flight deals to Paris",
    "url": "https://kayak.com",
    "guardrails": "only search, do not book anything"
  }'

# With structured data
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{
    "task": "find hotels for the trip details",
    "url": "https://booking.com",
    "data": {
      "destination": "Paris",
      "checkIn": "2024-12-20",
      "checkOut": "2024-12-22",
      "guests": 2
    }
  }'
```

### Health Check

**GET** `/health`

Check server status.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-06-12T10:30:00.000Z"
}
```

### Spark Service Status

**GET** `/spark/status`

Check Spark automation service status.

**Response:**

```json
{
  "status": "ready",
  "service": "spark-automation",
  "timestamp": "2024-06-12T10:30:00.000Z"
}
```

### Server Info

**GET** `/`

Get basic server information.

**Response:**

```json
{
  "name": "Spark Server",
  "version": "0.1.0",
  "description": "Web server for Spark AI-powered web automation"
}
```

## Configuration

### Environment Variables

Create a `.env` file in the server directory:

```bash
# Server configuration
PORT=3000

# Spark configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### Available Scripts

```bash
# Development
pnpm run dev          # Start dev server with hot reload
pnpm run build        # Build TypeScript to dist/
pnpm run start        # Start production server

# Code Quality
pnpm run typecheck    # Run TypeScript type checking
pnpm run format       # Format code with Prettier
pnpm run format:check # Check code formatting

# Testing
pnpm test             # Run tests
pnpm run test:watch   # Run tests in watch mode
```

## Examples

### Basic Web Queries

```bash
# Weather check
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{"task": "check the weather in London"}'

# Stock price lookup
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{"task": "find the current price of AAPL stock"}'

# News search
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{"task": "what are the top stories on Hacker News?"}'
```

### Advanced Automation

```bash
# Form interaction with data
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{
    "task": "submit a contact form",
    "url": "https://company.com/contact",
    "data": {
      "name": "John Doe",
      "email": "john@example.com",
      "message": "Hello from Spark API"
    },
    "guardrails": "fill the form but do not submit it"
  }'

# E-commerce research
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{
    "task": "find product information and prices",
    "url": "https://store.com",
    "data": {"product": "wireless headphones", "maxPrice": 200},
    "guardrails": "browse and research only, do not add to cart"
  }'
```

## Error Handling

The API returns appropriate HTTP status codes:

- `200` - Success
- `400` - Bad request (missing task, invalid JSON)
- `500` - Server error (missing API key, automation failure)

**Error Response Format:**

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

## Requirements

- **Node.js 20+**
- **OpenAI API key** - Required for AI-powered automation
- **Firefox browser** - Automatically installed by Playwright
- **Spark library** - Automatically linked from parent project

## Architecture

Built on top of the Spark automation library with:

- **Hono** - Fast, lightweight web framework
- **TypeScript** - Type-safe development
- **Playwright** - Browser automation (headless Firefox)
- **OpenAI GPT-4.1** - AI reasoning and planning

The server creates isolated browser instances for each request and properly cleans up resources after task completion.

## Development

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
# Add your OpenAI API key to .env

# Start development server
pnpm run dev

# Test the API
curl http://localhost:3000/health
```

## License

MIT - Same as parent Spark project
