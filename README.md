# Spark 🔥

A powerful AI-powered web automation library and CLI tool that helps you get answers and take actions in the browser. Spark uses advanced language models to understand web pages and perform complex tasks automatically.

Use Spark as a **library** in your Node.js applications or as a **CLI tool** for interactive automation.

## Features

- 🤖 **AI-Powered Navigation**: Automatically understands and navigates web pages using natural language
- 🎯 **Smart Task Planning**: Breaks down complex tasks into actionable steps
- 🔍 **Intelligent Element Detection**: Automatically finds and interacts with relevant page elements
- 🌐 **Browser Automation**: Built on Playwright for reliable web automation
- 📝 **Natural Language Interface**: Simply describe what you want to do in plain English
- 🔄 **Interactive Feedback**: Real-time updates on what the agent is thinking and doing

## Installation

### Install from GitHub (for development)

```bash
npm install https://github.com/Mozilla-Ocho/spark.git
# or
pnpm add https://github.com/Mozilla-Ocho/spark.git
# or
yarn add https://github.com/Mozilla-Ocho/spark.git
```

### Development Setup

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

## Usage

### Programmatic Usage (Library)

```javascript
import { WebAgent, PlaywrightBrowser } from "spark";

// Setup: Set OPENAI_API_KEY environment variable
// Install browsers: npx playwright install firefox

// Create a browser instance
const browser = new PlaywrightBrowser({
  headless: false,
  blockAds: true,
});

// Create WebAgent
const webAgent = new WebAgent(browser, {
  debug: false,
  guardrails: "Do not make any purchases",
});

// Execute a task
try {
  const result = await webAgent.execute("find flights to Tokyo", "https://airline.com", {
    departure: "NYC",
    passengers: 2,
  });
  console.log("Task completed:", result.success);
} finally {
  await webAgent.close();
}
```

#### Library API Reference

**WebAgent Constructor Options:**

- `debug`: boolean - Enable debug logging and page snapshots
- `guardrails`: string - Constraints to limit agent actions

**PlaywrightBrowser Constructor Options:**

- `headless`: boolean - Run browser in headless mode
- `blockAds`: boolean - Block ads and trackers
- `blockResources`: string[] - Block specific resource types
- `device`: string - Device type for emulation

**WebAgent.execute() Parameters:**

- `task`: string - Natural language task description
- `startingUrl`: string (optional) - Starting URL
- `data`: object (optional) - Contextual data for the task

**Returns:** `TaskExecutionResult` with success status and details

### CLI Usage

Spark accepts up to four arguments:

```bash
pnpm run spark "<task>" [url] [data] [guardrails]
```

- **task**: Natural language description of what you want to do (required)
- **url**: Starting URL to begin the task from (optional)
- **data**: JSON object with contextual data for the task (optional)
- **guardrails**: String with limitations or constraints for the agent (optional)

## Examples

### Basic Usage

```bash
# Get current weather
pnpm run spark "is it raining in Tokyo"

# Check stock price
pnpm run spark "what is the current price of AAPL stock"

# Get latest news
pnpm run spark "what is the top headline on Reuters"
```

### With Starting URL

```bash
# Start from a specific website
pnpm run spark "find the latest news" "https://news.ycombinator.com"

# Check weather on a specific weather site
pnpm run spark "get weather for San Francisco" "https://weather.com"

# Book a flight from NYC to LAX on December 25th for 2 passengers
pnpm run spark "book a flight from NYC to LAX on December 25th for 2 passengers" "https://airline.com"
```

### With Contextual Data

You can provide details either in the task description OR in the data object. Using the data object helps keep the task description clean and provides structured information the AI can easily reference.

```bash
# Same task as above, but with structured data instead of in the prompt
pnpm run spark "book a flight" "https://airline.com" '{"departure":"NYC","destination":"LAX","date":"2024-12-25","passengers":2}'

# Fill out a form with provided information
pnpm run spark "submit contact form" "https://example.com/contact" '{"name":"John Doe","email":"john@example.com","message":"Hello world"}'

# Compare: details in prompt vs. data object
pnpm run spark "find hotels in Paris from Dec 20-22 for 2 guests" "https://booking.com"
# vs.
pnpm run spark "find hotels" "https://booking.com" '{"location":"Paris","checkIn":"2024-12-20","checkOut":"2024-12-22","guests":2}'
```

**When to use data objects:**

- Complex information with multiple fields
- Structured data like dates, IDs, or specifications
- When you want to keep the task description simple and focused
- For reusable templates where only the data changes

The data object is passed as JSON and becomes available to the AI throughout the entire task execution, allowing it to reference the information when filling forms, making selections, or completing complex workflows.

### With Guardrails

You can provide guardrails to limit what the agent can do:

```bash
# Search without making any purchases
pnpm run spark "find flights to Tokyo" "https://airline.com" "" "Do not make any bookings or purchases"

# Browse only, no form submissions
pnpm run spark "check product availability" "https://store.com" '{"product":"laptop"}' "Only browse and search, do not submit any forms"

# Stay within current domain
pnpm run spark "find company contact info" "https://company.com" "" "Do not navigate to external websites"
```

**When to use guardrails:**

- Prevent unintended actions like purchases or bookings
- Limit navigation scope to specific domains
- Restrict form submissions or data entry
- Ensure the agent only performs safe, read-only operations

## Development

Built with TypeScript, Playwright, and OpenAI's GPT-4.1.

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
