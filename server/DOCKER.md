# Docker Setup

Containerized Spark server with Browserless browser automation.

## Quick Start

```bash
# Setup environment
cp .env.docker .env
# Edit .env and add your OPENAI_API_KEY

# Start services with Firefox
docker-compose -f docker-compose-firefox.yml up -d

# OR Start services with Chromium
docker-compose -f docker-compose-chromium.yml up -d

# Test it
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{"task": "find weather forecast for Tokyo"}'
```

## Services

- **Spark Server**: http://localhost:3000
- **Browserless Dashboard**: http://localhost:3001

## Environment

Create `.env` file:

```bash
OPENAI_API_KEY=your_openai_api_key_here
```

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
