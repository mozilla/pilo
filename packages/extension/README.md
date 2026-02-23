# Pilo Extension

Browser extension for Pilo AI-powered web automation. The extension adds a side panel to your browser that lets you run Pilo automation tasks interactively on any page, without leaving the browser.

## Installation (from npm package)

The Pilo extension is bundled with `@tabstack/pilo`. After installing the npm package, use the `pilo extension install` command to load it into your browser.

### Chrome / Brave / Edge

Chrome stable ignores the `--load-extension` flag when launched programmatically, so the extension must be loaded manually:

```bash
pilo extension install chrome
```

This command prints the extension directory path and step-by-step instructions:

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the extension directory printed by the command above

### Firefox

Firefox supports loading the extension directly from the CLI via `web-ext`:

```bash
# Launch Firefox with the extension loaded (persistent profile)
pilo extension install firefox

# Launch Firefox with a temporary profile
pilo extension install firefox --tmp
```

## Supported AI Providers

The extension supports multiple AI providers:

- **OpenAI** - Cloud service with API key authentication
- **OpenRouter** - Cloud service with API key authentication (default)
- **Google Generative AI** - Cloud service with API key authentication
- **Ollama** - Local models with optional API key

### Using Ollama (Local Models)

To use Ollama with the browser extension, you need to configure CORS settings so the extension can reach the local server.

**Option 1: Enable in the Ollama app**

1. Open Ollama app settings
2. Enable "Expose Ollama to the network"
3. Restart Ollama if needed

**Option 2: Set an environment variable**

```bash
OLLAMA_ORIGINS="*" ollama serve
```

In the extension settings:

- **Provider**: Select "Ollama (Local)"
- **Base URL**: Default is `http://localhost:11434/api`
- **Model**: Use any model you have installed (e.g., `llama3`, `qwen3-vl`)
- **API Key**: Optional (leave empty for local use)

## Development

### Prerequisites

- Node.js `^22.0.0`
- pnpm `9.0.0`

Install dependencies from the monorepo root:

```bash
pnpm install
```

### Dev Mode (hot reload)

Run the extension in a live-reloading browser instance:

```bash
# From the monorepo root:
pnpm run dev:extension -- --chrome    # Chrome with persistent profile
pnpm run dev:extension -- --firefox   # Firefox with persistent profile

# With a temporary profile (fresh state on every run):
pnpm run dev:extension -- --chrome --tmp
pnpm run dev:extension -- --firefox --tmp

# From inside packages/extension:
pnpm dev -- --chrome
pnpm dev -- --firefox
pnpm dev -- --chrome --tmp
```

The `--tmp` flag starts the browser with a clean temporary profile. Use it when you want to test the extension from a blank state.

### Production Build

```bash
# From the monorepo root or inside packages/extension:
pnpm run build:chrome    # Build for Chrome (MV3)
pnpm run build:firefox   # Build for Firefox (MV2)

# Build both (used by the root publish pipeline):
pnpm run build:publish
```

Build output is written to `.output/chrome-mv3/` and `.output/firefox-mv2/` inside `packages/extension`.

### Testing

```bash
# Unit tests (Vitest)
pnpm test

# End-to-end tests (Playwright)
pnpm test:e2e

# End-to-end tests in headless mode
pnpm test:e2e:headless
```

### TypeScript

```bash
pnpm typecheck
```

## Project Structure

```
packages/extension/
├── src/
│   ├── ui/          # Side panel React components, hooks, and stores
│   ├── background/  # Service worker (AgentManager, ExtensionBrowser)
│   ├── content/     # Content script entry
│   └── shared/      # Types, utilities, and stores shared across entrypoints
├── entrypoints/     # WXT entrypoints (sidepanel, background, content)
├── scripts/         # Dev script (dev.ts)
└── test/            # Test files
```

The extension is built with [WXT](https://wxt.dev/) and React. It imports from `pilo-core/core` (the browser-safe subset of the core library) rather than `pilo-core`, which avoids pulling in Node.js-only dependencies.
