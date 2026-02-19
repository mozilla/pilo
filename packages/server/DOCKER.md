# Docker Setup

Containerized Pilo server with Browserless browser automation.

## Quick Start

```bash
# Setup environment
cp .env.example .env
# Edit .env with your AI provider API key and settings

# Start services with Firefox
docker-compose -f docker-compose-firefox.yml up -d

# OR Start services with Chromium
docker-compose -f docker-compose-chromium.yml up -d

# Test it
curl -X POST http://localhost:3000/pilo/run \
  -H "Content-Type: application/json" \
  -d '{"task": "find weather forecast for Tokyo"}'
```

## Services

- **Pilo Server**: http://localhost:3000
- **Browserless Dashboard**: http://localhost:3001

## Environment

Copy and configure environment file:

```bash
cp .env.example .env
# Edit .env with your settings
```

**Minimal Docker configuration:**

```bash
# Required - choose your AI provider
OPENAI_API_KEY=your_openai_api_key_here
PILO_PROVIDER=openai
# OR
# OPENROUTER_API_KEY=your_openrouter_api_key_here
# PILO_PROVIDER=openrouter
```

**See `.env.example` for complete configuration options.**

## Useful Commands

```bash
# View logs (replace with your chosen compose file)
docker-compose -f docker-compose-firefox.yml logs -f

# Stop services
docker-compose -f docker-compose-firefox.yml down

# Rebuild and restart
docker-compose -f docker-compose-firefox.yml up --build
```

## Browser Options

Two compose files are provided for different browsers:

- **docker-compose-chromium.yml** - Uses Chromium browser
- **docker-compose-firefox.yml** - Uses Firefox browser

Both connect automatically via the configured `PW_ENDPOINT`.
