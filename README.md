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
git clone https://github.com/yourusername/spark.git
cd spark
pnpm install
```

2. Set up your OpenAI API key:

```bash
cp .env.example .env
# Edit .env and add your OpenAI API key
```

3. Run Spark:

```bash
pnpm run spark "search for flights to Paris"
```

## Examples

```bash
# Compare products
pnpm run spark "compare prices of gaming laptops on Amazon"

# Research topics
pnpm run spark "find the best restaurants in San Francisco"

# Find travel information
pnpm run spark "find the cheapest hotel in New York for next weekend"
```

## Development

Built with TypeScript, Playwright, and OpenAI's GPT-4o.

```bash
# Run tests
pnpm test
pnpm run test:watch  # for development

# Build
pnpm run build
```

## Requirements

- Node.js 16+
- OpenAI API key
- Firefox browser (for Playwright)

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
