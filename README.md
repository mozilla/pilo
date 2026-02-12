# Spark 🔥

AI-powered web automation that lets you control browsers using natural language. Just describe what you want to do, and Spark will navigate websites, fill forms, and gather information automatically.

## About Tabstack

Spark is part of [Tabstack](https://tabstack.ai), Mozilla's browsing infrastructure for AI agents. Tabstack provides the web execution layer that enables AI agents to automate workflows and turn web content into clean, structured data.

**Learn more:**

- [Tabstack Website](https://tabstack.ai)
- [Introduction to Tabstack](https://tabstack.ai/blog/intro-browsing-infrastructure-ai-agents)

**Community:**

- Join `#tabstack` on the [Mozilla AI Discord](https://discord.gg/mozillaai)

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/Mozilla-Ocho/spark.git
cd spark

# Install dependencies
pnpm install

# Install browsers for automation
pnpm playwright install

# Setup AI provider
pnpm spark config --init

# Run your first task
pnpm spark run "what's the weather in Tokyo?"
```

### Basic Usage

```bash
# Simple web queries
pnpm spark run "find the latest news on Reuters"
pnpm spark run "what's the current price of AAPL stock?"

# With specific starting URL
pnpm spark run "find flight deals to Paris" --url https://booking.com/

# With structured data
pnpm spark run "book a flight" --url https://booking.com/ --data '{"from":"NYC","to":"LAX","date":"2024-12-25"}'

# With safety constraints
pnpm spark run "search hotels in Tokyo" --guardrails "browse only, don't book anything"
```

## Features

- 🤖 **Natural Language Control**: Just describe what you want to do in plain English
- 🎯 **Smart Navigation**: Automatically finds and interacts with the right page elements
- 🔍 **Intelligent Planning**: Breaks down complex tasks into actionable steps
- 👁️ **Vision Capabilities**: AI can see full-page screenshots to better understand layouts
- 🌐 **Multi-Browser Support**: Works with Firefox, Chrome, Safari, and Edge
- 🛡️ **Safety First**: Provide guardrails to prevent unintended actions
- 📝 **Rich Context**: Pass structured data to help with form filling and complex tasks

## Installation

See [Quick Start](#quick-start) above for installation instructions.

## Usage

### Command Line

**Basic syntax:**

```bash
pnpm spark run "<task description>" [options]
```

See [Configuration Reference](#configuration-reference) for all available options.

**Configuration:**

```bash
pnpm spark config --init     # Setup wizard
pnpm spark config --show     # View current settings
pnpm spark config --reset    # Clear all settings
```

### Programmatic Usage

```javascript
import { WebAgent, PlaywrightBrowser } from "spark";
import { openai } from "@ai-sdk/openai";

const browser = new PlaywrightBrowser({ headless: false });
const provider = openai("gpt-4.1");

const agent = new WebAgent(browser, {
  provider,
  vision: true, // Enable screenshots for better visual understanding
  guardrails: "Do not make purchases",
});

try {
  const result = await agent.execute("find flights to Tokyo", {
    startingUrl: "https://airline.com",
  });
  console.log("Success:", result.success);
} finally {
  await agent.close();
}
```

## Examples

### Simple Tasks

```bash
pnpm spark run "is it raining in London?"
pnpm spark run "what's trending on Hacker News?"
pnpm spark run "find the contact email for example.com"
```

### With URLs

```bash
pnpm spark run "find flight deals" --url https://kayak.com
pnpm spark run "check if items are in stock" --url https://store.com
```

### With Structured Data

```bash
# Hotel search
pnpm spark run "find hotels" --url https://booking.com --data '{
  "location": "Paris",
  "checkIn": "2024-12-20",
  "checkOut": "2024-12-22",
  "guests": 2
}'

# Form filling
pnpm spark run "submit contact form" --url https://company.com/contact --data '{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Hello world"
}'
```

### With Safety Guardrails

```bash
# Browse-only mode
pnpm spark run "research product prices" --guardrails "only browse, don't buy anything"

# Domain restrictions
pnpm spark run "find company info" --url https://company.com --guardrails "stay on current domain only"

# Form restrictions
pnpm spark run "check shipping costs" --guardrails "don't submit any payment forms"
```

### Advanced Options

```bash
# Run a vanilla Firefox with WebDriver BiDi as protocol
pnpm spark run "test checkout flow" --channel moz-firefox

# Use a specific browser executable
pnpm spark run "test with custom Firefox" --executable-path /usr/bin/firefox

# Chrome browser testing
pnpm spark run "test checkout flow" --browser chrome --headless

# Headless automation
pnpm spark run "get daily stock prices" --headless --browser firefox

# Debug mode
pnpm spark run "complex automation task" --debug

# Vision mode for complex visual layouts
pnpm spark run "fill out complex form" --vision

# Enhanced reasoning for complex tasks
pnpm spark run "research and compare insurance plans" --reasoning-effort high

# Combined options
pnpm spark run "test signup flow" \
  --url https://app.com \
  --browser safari \
  --headless \
  --data '{"email":"test@example.com"}' \
  --guardrails "don't complete signup, just test the flow"
```

### Proxy Configuration

```bash
# Using an HTTP proxy
pnpm spark run "search for products" --proxy http://proxy.company.com:8080

# Using authenticated proxy
pnpm spark run "access internal site" \
  --proxy http://proxy.company.com:8080 \
  --proxy-username myuser \
  --proxy-password mypass

# Using SOCKS5 proxy
pnpm spark run "secure browsing" --proxy socks5://127.0.0.1:1080
```

## Configuration

Spark supports multiple AI providers and stores configuration globally:

```bash
# Setup wizard (recommended for first use)
pnpm spark config --init

# Manual configuration
pnpm spark config --set provider=openai
pnpm spark config --set openai_api_key=sk-your-key

# Or use OpenRouter
pnpm spark config --set provider=openrouter
pnpm spark config --set openrouter_api_key=sk-or-your-key

# Or use local AI providers
pnpm spark config --set provider=ollama
pnpm spark config --set model=llama3.2

pnpm spark config --set provider=lmstudio
pnpm spark config --set model=your-loaded-model

# Set defaults
pnpm spark config --set browser=chrome
pnpm spark config --set headless=true
pnpm spark config --set vision=true
pnpm spark config --set reasoning_effort=medium

# View settings
pnpm spark config --show

# Reset everything
pnpm spark config --reset
```

**Available AI Providers:**

- **OpenAI** (default) - Requires API key from [platform.openai.com](https://platform.openai.com/api-keys)
- **OpenRouter** - Requires API key from [openrouter.ai](https://openrouter.ai/keys)
- **Ollama** - Local models, requires [Ollama](https://ollama.ai) running locally
- **LM Studio** - Local models, requires [LM Studio](https://lmstudio.ai) server running on port 1234
- **Vertex AI** - Google Cloud AI, requires project setup and authentication

See [Configuration Priority](#configuration-priority) for how settings are resolved.

## Requirements

- **Node.js 20+**
- **AI Provider (one of):**
  - [OpenAI API key](https://platform.openai.com/api-keys) (cloud)
  - [OpenRouter API key](https://openrouter.ai/keys) (cloud)
  - [Ollama](https://ollama.ai) running locally (local)
  - [LM Studio](https://lmstudio.ai) server (local)
  - Google Cloud project with Vertex AI enabled
- **Browsers:** Automatically installed by Playwright (Firefox, Chrome, Safari, Edge)

## API Reference

### WebAgent

```javascript
import { WebAgent, PlaywrightBrowser } from "spark";
import { openai } from "@ai-sdk/openai";

const browser = new PlaywrightBrowser({ headless: false });
const provider = openai("gpt-4.1");

const agent = new WebAgent(browser, {
  provider,
  vision: true, // Enable screenshots for better visual understanding
  guardrails: "Do not make purchases",
});

const result = await agent.execute("find flights to Tokyo", { startingUrl: "https://airline.com" });
```

### PlaywrightBrowser Options

```javascript
// Basic usage
new PlaywrightBrowser({
  browser: "firefox" | "chrome" | "chromium" | "safari" | "webkit" | "edge",
  headless: boolean,
  blockAds: boolean,
  blockResources: ["image", "stylesheet", "font", "media", "manifest"],
  pwEndpoint: "ws://remote-browser:9222",
  pwCdpEndpoint: "ws://remote-browser:9222", // CDP endpoint for chromium browsers
});

// Advanced usage with full Playwright control
import { devices } from "playwright";

new PlaywrightBrowser({
  browser: "chrome",
  headless: true,
  launchOptions: {
    args: ["--disable-web-security"],
    proxy: { server: "http://proxy:8080" },
  },
  contextOptions: {
    ...devices["iPhone 12"],
    viewport: { width: 1920, height: 1080 },
    userAgent: "Custom Bot",
  },
});
```

## Development

```bash
# Run tests
pnpm test
pnpm run test:watch

# Build
pnpm run build

# Format code
pnpm run format
```

Built with TypeScript, Playwright, and the Vercel AI SDK.

## Configuration Reference

### Complete CLI Options

| Option                          | Description                                                | Default          | Example                                 |
| ------------------------------- | ---------------------------------------------------------- | ---------------- | --------------------------------------- |
| `--url <url>`                   | Starting URL for the task                                  | -                | `--url https://example.com`             |
| `--data <json>`                 | JSON data to provide context                               | -                | `--data '{"name":"John"}'`              |
| `--guardrails <text>`           | Safety constraints for execution                           | -                | `--guardrails "browse only"`            |
| `--provider <provider>`         | AI provider (openai, openrouter, vertex, ollama, lmstudio) | openai           | `--provider openrouter`                 |
| `--model <model>`               | AI model to use                                            | Provider default | `--model gpt-4o`                        |
| `--openai-api-key <key>`        | OpenAI API key                                             | -                | `--openai-api-key sk-...`               |
| `--openrouter-api-key <key>`    | OpenRouter API key                                         | -                | `--openrouter-api-key sk-or-...`        |
| `--browser <browser>`           | Browser (firefox, chrome, chromium, safari, webkit, edge)  | firefox          | `--browser chrome`                      |
| `--channel <channel>`           | Browser channel (chrome, msedge, chrome-beta, moz-firefox) | -                | `--channel chrome-beta`                 |
| `--executable-path <path>`      | Path to browser executable                                 | -                | `--executable-path /usr/bin/firefox`    |
| `--headless`                    | Run browser in headless mode                               | false            | `--headless`                            |
| `--debug`                       | Enable debug mode with snapshots                           | false            | `--debug`                               |
| `--vision`                      | Enable vision capabilities                                 | false            | `--vision`                              |
| `--no-block-ads`                | Disable ad blocking                                        | false            | `--no-block-ads`                        |
| `--block-resources <list>`      | Resources to block (comma-separated)                       | media,manifest   | `--block-resources image,font`          |
| `--max-iterations <n>`          | Maximum task iterations                                    | 50               | `--max-iterations 100`                  |
| `--max-validation-attempts <n>` | Maximum validation attempts                                | 3                | `--max-validation-attempts 5`           |
| `--max-repeated-actions <n>`    | Maximum action repetitions before warning/aborting         | 2                | `--max-repeated-actions 3`              |
| `--reasoning-effort <level>`    | Reasoning effort (none, low, medium, high)                 | none             | `--reasoning-effort high`               |
| `--proxy <url>`                 | Proxy server URL                                           | -                | `--proxy http://proxy:8080`             |
| `--proxy-username <user>`       | Proxy authentication username                              | -                | `--proxy-username myuser`               |
| `--proxy-password <pass>`       | Proxy authentication password                              | -                | `--proxy-password mypass`               |
| `--logger <type>`               | Logger type (console, json)                                | console          | `--logger json`                         |
| `--pw-endpoint <url>`           | Playwright endpoint for remote browser                     | -                | `--pw-endpoint ws://localhost:9222`     |
| `--pw-cdp-endpoint <url>`       | Chrome DevTools Protocol endpoint                          | -                | `--pw-cdp-endpoint ws://localhost:9222` |
| `--bypass-csp`                  | Bypass Content Security Policy                             | false            | `--bypass-csp`                          |

### Environment Variables

All configuration options can be set via environment variables. Environment variables take precedence over config file settings.

| Environment Variable               | Description                                                | CLI Equivalent              |
| ---------------------------------- | ---------------------------------------------------------- | --------------------------- |
| **AI Configuration**               |                                                            |                             |
| `SPARK_PROVIDER`                   | AI provider (openai, openrouter, vertex, ollama, lmstudio) | `--provider`                |
| `SPARK_MODEL`                      | AI model to use                                            | `--model`                   |
| `OPENAI_API_KEY`                   | OpenAI API key                                             | `--openai-api-key`          |
| `OPENROUTER_API_KEY`               | OpenRouter API key                                         | `--openrouter-api-key`      |
| `GOOGLE_VERTEX_PROJECT`            | Google Cloud project for Vertex AI                         | -                           |
| `GOOGLE_CLOUD_PROJECT`             | Alternative for Vertex project                             | -                           |
| `GCP_PROJECT`                      | Alternative for Vertex project                             | -                           |
| `GOOGLE_VERTEX_LOCATION`           | Vertex AI location/region                                  | -                           |
| `GOOGLE_CLOUD_REGION`              | Alternative for Vertex location                            | -                           |
| **Local AI Providers**             |                                                            |                             |
| `SPARK_OLLAMA_BASE_URL`            | Ollama server base URL                                     | -                           |
| `SPARK_OPENAI_COMPATIBLE_BASE_URL` | OpenAI-compatible API base URL                             | -                           |
| `SPARK_OPENAI_COMPATIBLE_NAME`     | OpenAI-compatible provider name                            | -                           |
| **Browser Configuration**          |                                                            |                             |
| `SPARK_BROWSER`                    | Browser to use                                             | `--browser`                 |
| `SPARK_CHANNEL`                    | Browser channel                                            | `--channel`                 |
| `SPARK_EXECUTABLE_PATH`            | Path to browser executable                                 | `--executable-path`         |
| `SPARK_HEADLESS`                   | Run headless (true/false)                                  | `--headless`                |
| `SPARK_BLOCK_ADS`                  | Block ads (true/false)                                     | `--no-block-ads`            |
| `SPARK_BLOCK_RESOURCES`            | Resources to block (comma-separated)                       | `--block-resources`         |
| **Proxy Configuration**            |                                                            |                             |
| `SPARK_PROXY`                      | Proxy server URL                                           | `--proxy`                   |
| `SPARK_PROXY_USERNAME`             | Proxy username                                             | `--proxy-username`          |
| `SPARK_PROXY_PASSWORD`             | Proxy password                                             | `--proxy-password`          |
| **Logging Configuration**          |                                                            |                             |
| `SPARK_LOGGER`                     | Logger type (console, json)                                | `--logger`                  |
| **WebAgent Configuration**         |                                                            |                             |
| `SPARK_DEBUG`                      | Enable debug mode (true/false)                             | `--debug`                   |
| `SPARK_VISION`                     | Enable vision (true/false)                                 | `--vision`                  |
| `SPARK_MAX_ITERATIONS`             | Maximum iterations                                         | `--max-iterations`          |
| `SPARK_MAX_VALIDATION_ATTEMPTS`    | Maximum validation attempts                                | `--max-validation-attempts` |
| `SPARK_MAX_REPEATED_ACTIONS`       | Maximum action repetitions                                 | `--max-repeated-actions`    |
| `SPARK_REASONING_EFFORT`           | Reasoning effort level                                     | `--reasoning-effort`        |
| **Playwright Configuration**       |                                                            |                             |
| `SPARK_PW_ENDPOINT`                | Playwright endpoint URL                                    | `--pw-endpoint`             |
| `SPARK_PW_CDP_ENDPOINT`            | CDP endpoint URL                                           | `--pw-cdp-endpoint`         |
| `SPARK_BYPASS_CSP`                 | Bypass CSP (true/false)                                    | `--bypass-csp`              |

### Configuration Priority

Configuration values are resolved in the following order (highest to lowest priority):

1. **Command-line options** - Directly passed to the command
2. **Environment variables** - Set in your shell or `.env` file
3. **Local `.env` file** - In your project directory
4. **Global config file** - Set via `pnpm spark config --set`

### Examples

```bash
# Using CLI options
pnpm spark run "search for flights" \
  --url https://airline.com \
  --browser chrome \
  --headless \
  --vision \
  --reasoning-effort high

# Using environment variables
export SPARK_PROVIDER=openrouter
export SPARK_MODEL=claude-3.5-sonnet
export SPARK_BROWSER=firefox
export SPARK_HEADLESS=true
pnpm spark run "book a hotel"

# Mixed usage (CLI options override environment variables)
export SPARK_BROWSER=firefox
pnpm spark run "search products" --browser chrome  # Will use chrome

# Setting defaults via config
pnpm spark config --set browser=chrome
pnpm spark config --set headless=true
pnpm spark config --set vision=true
pnpm spark run "test task"  # Uses configured defaults
```

## License

[Apache 2.0](LICENSE) - Copyright 2026 Mozilla Corporation

## Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting a Pull Request.
