# Spark Server 🔥🌐

Web server for Spark AI-powered web automation. Provides HTTP API endpoints to execute web automation tasks using natural language.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your AI provider API key and desired configuration

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
  // Core task parameters
  "task": "string (required)",
  "url": "string (optional)",
  "data": "object (optional)",
  "guardrails": "string (optional)",

  // AI configuration overrides
  "provider": "openai|openrouter (optional)",
  "model": "string (optional)",

  // Browser configuration overrides
  "browser": "firefox|chrome|safari|edge (optional)",
  "headless": "boolean (optional)",
  "vision": "boolean (optional)",
  "debug": "boolean (optional)",
  "blockAds": "boolean (optional)",
  "blockResources": "array (optional)",
  "pwEndpoint": "string (optional)",
  "bypassCSP": "boolean (optional)",

  // WebAgent behavior overrides
  "maxIterations": "number (optional)",
  "maxValidationAttempts": "number (optional)",

  // Proxy configuration overrides
  "proxy": "string (optional)",
  "proxyUsername": "string (optional)",
  "proxyPassword": "string (optional)",

  // Logging configuration
  "logger": "console|json (optional)"
}
```

**Example with overrides:**

```json
{
  "task": "find flight deals to Tokyo",
  "url": "https://expedia.com",
  "provider": "openrouter",
  "model": "anthropic/claude-3-sonnet",
  "browser": "chrome",
  "vision": true,
  "debug": true,
  "guardrails": "browse only, don't book anything"
}
```

### Health Check

**GET** `/health`

Check server status.

## Environment Variables

Create a `.env` file with server-level defaults. All CLI environment variables are supported.

**Quick Start**: Copy `.env.example` for comprehensive configuration options including both development and production/Docker settings.

**Minimal Configuration**:

```bash
# Required - choose your AI provider
OPENAI_API_KEY=sk-your-key-here
SPARK_PROVIDER=openai
# OR
# OPENROUTER_API_KEY=sk-or-your-key-here
# SPARK_PROVIDER=openrouter

# Optional server settings
PORT=3000
SPARK_BROWSER=firefox
SPARK_HEADLESS=true
```

**See `.env.example` for all available configuration options including:**

- Multiple AI providers (OpenAI, OpenRouter)
- Browser settings (type, headless, ad blocking)
- Proxy configuration
- WebAgent behavior (debug, vision, limits)
- Playwright options

**Configuration Priority:** Request parameters > Environment variables > Global config file

## Development Commands

```bash
pnpm run dev          # Start dev server with hot reload
pnpm run build        # Build TypeScript to dist/
pnpm run start        # Start production server
pnpm run typecheck    # Run TypeScript type checking
pnpm test             # Run tests
```
