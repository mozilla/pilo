# @tabstack/spark-cli

AI-powered web automation CLI that lets you control browsers using natural language. Just describe what you want to do, and Spark will navigate websites, fill forms, and gather information automatically.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @tabstack/spark-cli
```

After installation, the `spark` command will be available globally:

```bash
spark --help
```

### Using npx (No Installation)

```bash
npx @tabstack/spark-cli run "what's the weather in Tokyo?"
```

## Quick Start

### 1. Configure Your AI Provider

On first run, Spark will guide you through setting up an AI provider:

```bash
spark config --init
```

This creates a `~/.sparkrc` configuration file with your AI provider settings.

### 2. Browser Installation (Automatic)

Spark uses Playwright for browser automation. The first time you run an automation task, Spark will detect if browsers are installed and prompt you to install them automatically:

```
⚠️  Playwright browsers are not installed.
These are required for web automation.

This will download ~300MB of browser binaries.
Would you like to install them now? [Y/n]:
```

You can also install browsers manually beforehand:

```bash
npx playwright install
```

### 3. Run Your First Task

```bash
spark run "what's the weather in Tokyo?"
```

## Usage Examples

### Simple Web Queries

```bash
# Get information from websites
spark run "find the latest news on Reuters"
spark run "what's the current price of AAPL stock?"
```

### Starting from a Specific URL

```bash
# Begin automation from a specific website
spark run "find flight deals to Paris" --url https://booking.com/
```

### Passing Structured Data

```bash
# Provide context data for the automation task
spark run "book a flight" \
  --url https://booking.com/ \
  --data '{"from":"NYC","to":"LAX","date":"2024-12-25"}'
```

### Adding Safety Constraints

```bash
# Add guardrails to prevent unwanted actions
spark run "search hotels in Tokyo" \
  --guardrails "browse only, don't book anything"
```

## Available Commands

- `spark run <task>` - Execute an automation task using natural language
- `spark config` - Manage configuration (AI provider, API keys, etc.)
- `spark examples` - View example use cases and templates
- `spark --help` - Show help for all commands
- `spark <command> --help` - Show help for a specific command

## Features

- 🤖 **Natural Language Control**: Describe tasks in plain English
- 🎯 **Smart Navigation**: Automatically finds and interacts with page elements
- 🔍 **Intelligent Planning**: Breaks down complex tasks into actionable steps
- 👁️ **Vision Capabilities**: AI can see full-page screenshots
- 🌐 **Multi-Browser Support**: Works with Firefox, Chrome, Safari, and Edge
- 🛡️ **Safety Controls**: Built-in guardrails to prevent unintended actions
- 🔌 **Multiple AI Providers**: Supports OpenAI, Anthropic, Google, and more

## Requirements

- Node.js 22 or higher
- An API key for a supported AI provider (OpenAI, Anthropic, Google, etc.)

## Configuration

Spark stores its configuration in `~/.sparkrc`. You can edit this file directly or use:

```bash
spark config --init  # Initialize configuration
spark config --list  # View current configuration
```

### Supported AI Providers

- OpenAI (GPT-4, GPT-4o)
- Anthropic (Claude)
- Google (Gemini)
- Vertex AI
- OpenRouter
- Ollama (for local models)

## Troubleshooting

### Browser Installation Issues

If the automatic browser installation fails or you want to reinstall browsers:

```bash
# Reinstall all browsers
npx playwright install --force

# Install only specific browsers
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit
```

**Note**: In CI/CD environments or non-interactive shells, Spark will not prompt for installation. You must install browsers before running automation tasks:

```bash
# In CI pipelines, run this before using Spark
npx playwright install
```

### API Key Issues

Make sure your AI provider API key is correctly set in `~/.sparkrc`:

```bash
spark config --init
```

### Permission Errors

If you get permission errors during global installation:

```bash
# On macOS/Linux
sudo npm install -g @tabstack/spark-cli

# Or use a node version manager (recommended)
# nvm, fnm, etc.
```

## More Information

- [Full Documentation](https://github.com/Mozilla-Ocho/spark)
- [GitHub Repository](https://github.com/Mozilla-Ocho/spark)
- [Report Issues](https://github.com/Mozilla-Ocho/spark/issues)

## License

MIT
