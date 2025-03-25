# Spark 🔥

A powerful AI-powered web automation tool that helps you get answers and take actions in the browser. Spark uses advanced language models to understand web pages and perform complex tasks automatically.

## Features

- 🤖 **AI-Powered Navigation**: Automatically understands and navigates web pages using natural language
- 🎯 **Smart Task Planning**: Breaks down complex tasks into actionable steps
- 🔍 **Intelligent Element Detection**: Automatically finds and interacts with relevant page elements
- 🌐 **Browser Automation**: Built on Playwright for reliable web automation
- 📝 **Natural Language Interface**: Simply describe what you want to do in plain English
- 🔄 **Interactive Feedback**: Real-time updates on what the agent is thinking and doing

## Quick Start

1. Clone and install:

```bash
git clone https://github.com/Mozilla-Ocho/spark.git
cd spark
pnpm install
```

2. Install Playwright browsers:

```bash
pnpm playwright install firefox
```

3. Set up your OpenAI API key:

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

4. Run Spark:

```bash
pnpm run spark "what is the current temperature in London?"
```

## Examples

```bash
# Get current weather
pnpm run spark "is it raining in Tokyo"

# Check stock price
pnpm run spark "what is the current price of AAPL stock"

# Get latest news
pnpm run spark "what is the top headline on Reuters"
```

## Development

Built with TypeScript, Playwright, and OpenAI's GPT-4.

```bash
# Run tests
pnpm test
pnpm run test:watch  # for development

# Build
pnpm run build
```

## Requirements

- Node.js 20+
- OpenAI API key
- Firefox browser (for Playwright)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
