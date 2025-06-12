# Docker Setup

Containerized Spark server with Browserless Firefox.

## Quick Start

```bash
# Setup environment
cp .env.docker .env
# Edit .env and add your OPENAI_API_KEY

# Start services
docker-compose up -d

# Test it
curl -X POST http://localhost:3000/spark/run \
  -H "Content-Type: application/json" \
  -d '{"task": "go to google.com and search for cats"}'
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
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and restart
docker-compose up --build
```

The Spark server automatically connects to Browserless via `PW_ENDPOINT=ws://browserless:3000`.
