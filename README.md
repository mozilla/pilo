# Spark 🔥

AI-powered web automation that lets you control browsers using natural language. Just describe what you want to do, and Spark will navigate websites, fill forms, and gather information automatically.

## Quick Start

### Installation

```bash
# Install globally
npm install -g https://github.com/Mozilla-Ocho/spark.git

# Setup AI provider (choose OpenAI or OpenRouter)
spark config --init

# Run your first task
spark run "what's the weather in Tokyo?"
```

### Basic Usage

```bash
# Simple web queries
spark run "find the latest news on Reuters"
spark run "what's the current price of AAPL stock?"

# With specific starting URL
spark run "find flight deals to Paris" --url https://booking.com/

# With structured data
spark run "book a flight" --url https://booking.com/ --data '{"from":"NYC","to":"LAX","date":"2024-12-25"}'

# With safety constraints
spark run "search hotels in Tokyo" --guardrails "browse only, don't book anything"
```

## Features

- 🤖 **Natural Language Control**: Just describe what you want to do in plain English
- 🎯 **Smart Navigation**: Automatically finds and interacts with the right page elements
- 🔍 **Intelligent Planning**: Breaks down complex tasks into actionable steps
- 👁️ **Vision Capabilities**: AI can see full-page screenshots to better understand layouts
- 🌐 **Multi-Browser Support**: Works with Firefox, Chrome, Safari, and Edge
- 🛡️ **Safety First**: Provide guardrails to prevent unintended actions
- 📝 **Rich Context**: Pass structured data to help with form filling and complex tasks

## Installation Options

### Development Setup

```bash
git clone https://github.com/Mozilla-Ocho/spark.git
cd spark
pnpm install
pnpm playwright install
pnpm spark config --init
pnpm spark run "test task"
```

## Usage

### Command Line

**Basic syntax:**

```bash
spark run "<task description>" [options]
```

**Common options:**

- `--url <url>` - Starting website URL
- `--data '<json>'` - Structured data for the task
- `--guardrails "<text>"` - Safety constraints
- `--browser <name>` - Browser choice (firefox, chrome, safari, edge)
- `--headless` - Run without visible browser window
- `--debug` - Show detailed logs and page snapshots
- `--vision` - Enable vision capabilities with full-page screenshots
- `--proxy <url>` - Proxy server URL (http://host:port, https://host:port, socks5://host:port)
- `--proxy-username <username>` - Proxy authentication username
- `--proxy-password <password>` - Proxy authentication password

**Configuration:**

```bash
spark config --init     # Setup wizard
spark config --show     # View current settings
spark config --reset    # Clear all settings
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
  const result = await agent.execute("find flights to Tokyo", "https://airline.com");
  console.log("Success:", result.success);
} finally {
  await agent.close();
}
```

## Examples

### Simple Tasks

```bash
spark run "is it raining in London?"
spark run "what's trending on Hacker News?"
spark run "find the contact email for example.com"
```

### With URLs

```bash
spark run "find flight deals" --url https://kayak.com
spark run "check if items are in stock" --url https://store.com
```

### With Structured Data

```bash
# Hotel search
spark run "find hotels" --url https://booking.com --data '{
  "location": "Paris",
  "checkIn": "2024-12-20",
  "checkOut": "2024-12-22",
  "guests": 2
}'

# Form filling
spark run "submit contact form" --url https://company.com/contact --data '{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Hello world"
}'
```

### With Safety Guardrails

```bash
# Browse-only mode
spark run "research product prices" --guardrails "only browse, don't buy anything"

# Domain restrictions
spark run "find company info" --url https://company.com --guardrails "stay on current domain only"

# Form restrictions
spark run "check shipping costs" --guardrails "don't submit any payment forms"
```

### Advanced Options

```bash
# Chrome browser testing
spark run "test checkout flow" --browser chrome --headless

# Headless automation
spark run "get daily stock prices" --headless --browser firefox

# Debug mode
spark run "complex automation task" --debug

# Vision mode for complex visual layouts
spark run "fill out complex form" --vision

# Combined options
spark run "test signup flow" \
  --url https://app.com \
  --browser safari \
  --headless \
  --data '{"email":"test@example.com"}' \
  --guardrails "don't complete signup, just test the flow"
```

### Proxy Configuration

```bash
# Using an HTTP proxy
spark run "search for products" --proxy http://proxy.company.com:8080

# Using authenticated proxy
spark run "access internal site" \
  --proxy http://proxy.company.com:8080 \
  --proxy-username myuser \
  --proxy-password mypass

# Using SOCKS5 proxy
spark run "secure browsing" --proxy socks5://127.0.0.1:1080

# Environment variables (alternative to CLI options)
export SPARK_PROXY=http://proxy.company.com:8080
export SPARK_PROXY_USERNAME=myuser
export SPARK_PROXY_PASSWORD=mypass
spark run "task with proxy from env vars"
```

## Configuration

Spark supports multiple AI providers and stores configuration globally:

```bash
# Setup wizard (recommended for first use)
spark config --init

# Manual configuration
spark config --set provider=openai
spark config --set openai_api_key=sk-your-key

# Or use OpenRouter
spark config --set provider=openrouter
spark config --set openrouter_api_key=sk-or-your-key

# Set defaults
spark config --set browser=chrome
spark config --set headless=true

# View settings
spark config --show

# Reset everything
spark config --reset
```

**Configuration priority:**

1. Environment variables (highest)
2. Local `.env` file (development)
3. Global config file (lowest)

## Requirements

- **Node.js 20+**
- **AI Provider API key:**
  - [OpenAI API key](https://platform.openai.com/api-keys) (default), or
  - [OpenRouter API key](https://openrouter.ai/keys) (alternative)
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

const result = await agent.execute("find flights to Tokyo", "https://airline.com");
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
# Install dependencies
pnpm install

# Run tests
pnpm test
pnpm run test:watch

# Build
pnpm run build

# Format code
pnpm run format
```

Built with TypeScript, Playwright, and the Vercel AI SDK.

## License

MIT

## Contributing

Contributions welcome! Please submit a Pull Request.
