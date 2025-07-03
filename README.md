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
spark run "find the weather forecast for Tokyo"
```

### Basic Usage

```bash
# Simple web queries
spark run "find the latest technology news on Reuters"
spark run "search for AAPL stock price on Yahoo Finance"

# With specific starting URL
spark run "search for hotels in Tokyo" --url https://booking.com/

# With structured data
spark run "search for flights" --url https://kayak.com --data '{"from":"NYC","to":"LAX","date":"2024-12-25"}'

# With safety constraints
spark run "research travel options to Tokyo" --guardrails "browse only, don't make any bookings"
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
  const result = await agent.execute("search for flights to Tokyo", "https://kayak.com");
  console.log("Success:", result.success);
} finally {
  await agent.close();
}
```

## Examples

### Simple Tasks

```bash
spark run "check weather conditions in London"
spark run "find trending stories on Hacker News"
spark run "find contact information on Wikipedia"
```

### With URLs

```bash
spark run "find flights from NYC to London departing next week" --url https://kayak.com
spark run "check if Nintendo Switch 2 is in stock" --url https://bestbuy.com
```

### With Structured Data

```bash
# Hotel search
spark run "search for hotels" --url https://booking.com --data '{
  "location": "Paris",
  "checkIn": "2024-12-20",
  "checkOut": "2024-12-22",
  "guests": 2
}'

# Form filling
spark run "search for healthy dinner recipes under 30 minutes" --url https://allrecipes.com --data '{
  "cookTime": "30 minutes",
  "dietType": "healthy",
  "mealType": "dinner"
}'
```

### With Safety Guardrails

```bash
# Browse-only mode
spark run "research noise cancelling headphones for air travel" --url https://amazon.com --guardrails "only browse, don't buy anything"

# Domain restrictions
spark run "search for chicken tikka masala recipes" --url https://allrecipes.com --guardrails "stay on current domain only"

# Form restrictions
spark run "check shipping costs for a gaming chair to Texas" --url https://amazon.com --guardrails "don't submit any payment forms"
```

### Advanced Options

```bash
# Firefox browser testing
spark run "search for weekend getaway deals" --url https://expedia.com --browser firefox --headless

# Headless automation
spark run "search for stock prices on Yahoo Finance" --headless --browser firefox

# Debug mode
spark run "compare hotel prices in Paris for December 20-22" --url https://booking.com --debug

# Vision mode for complex visual layouts
spark run "fill out flight search form for NYC to Tokyo" --url https://kayak.com --vision

# Combined options
spark run "research wireless earbuds under $200" \
  --url https://bestbuy.com \
  --browser firefox \
  --headless \
  --data '{"maxPrice":200,"category":"wireless earbuds"}' \
  --guardrails "only browse, don't add to cart"
```

### Proxy Configuration

```bash
# Using an HTTP proxy
spark run "find latest AI technology news" --url https://reuters.com --proxy http://proxy.company.com:8080

# Using authenticated proxy
spark run "find React hooks documentation" \
  --url https://react.dev \
  --proxy http://proxy.company.com:8080 \
  --proxy-username myuser \
  --proxy-password mypass

# Using SOCKS5 proxy
spark run "find breaking technology news" --url https://techcrunch.com --proxy socks5://127.0.0.1:1080

# Environment variables (alternative to CLI options)
export SPARK_PROXY=http://proxy.company.com:8080
export SPARK_PROXY_USERNAME=myuser
export SPARK_PROXY_PASSWORD=mypass
spark run "find latest JavaScript framework news" --url https://github.com/trending
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

const result = await agent.execute("search flights to Tokyo", "https://kayak.com");
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
