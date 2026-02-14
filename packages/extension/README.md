# Spark Extension

Browser extension for Spark AI-powered web automation.

## Development

```bash
# Install dependencies
pnpm install

# Development (Firefox - persistent profile)
pnpm dev:firefox

# Development (Firefox - fresh temporary profile)
pnpm dev:firefox:tmp-profile

# Development (Chrome - fresh temporary profile)
pnpm dev:chrome:tmp-profile

# Build for production
pnpm build:firefox  # Firefox
pnpm build:chrome   # Chrome

# Create distribution packages
pnpm zip:firefox    # Firefox
pnpm zip:chrome     # Chrome

# Testing
pnpm test           # Run tests
pnpm test:watch     # Watch mode
```

## Supported AI Providers

The extension supports multiple AI providers:

- **OpenAI** - Cloud service with API key authentication
- **OpenRouter** - Cloud service with API key authentication (default)
- **Google Generative AI** - Cloud service with API key authentication
- **Ollama** - Local models with optional API key

### Using Ollama (Local Models)

To use Ollama with the browser extension, you need to configure CORS settings:

**Option 1: Enable in Ollama App**

1. Open Ollama app settings
2. Enable "Expose Ollama to the network"
3. Restart Ollama if needed

**Option 2: Set Environment Variable**

```bash
OLLAMA_ORIGINS="*" ollama serve
```

This is required because the browser extension sends `Origin` headers with requests, and Ollama needs to be configured to accept cross-origin requests from browser extensions.

In the extension settings:

- **Provider**: Select "Ollama (Local)"
- **Base URL**: Default is `http://localhost:11434/api`
- **Model**: Use any model you have installed (e.g., `llama3`, `qwen3-vl`)
- **API Key**: Optional (leave empty for local use)
