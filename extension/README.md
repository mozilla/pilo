# Spark Extension

Browser extension for Spark AI-powered web automation.

## Development

```bash
# Install dependencies
pnpm install

# Development (Chrome)
pnpm dev

# Development (Firefox)
pnpm dev:firefox

# Build for production
pnpm build          # Chrome
pnpm build:firefox  # Firefox

# Create distribution packages
pnpm zip            # Chrome
pnpm zip:firefox    # Firefox
```

## Features

- **Sidebar Interface**: Clean React-based sidebar for task input
- **AI-powered Automation**: Integrates with Spark library for web automation
- **Cross-browser**: Supports both Chrome and Firefox
- **TypeScript**: Full type safety throughout

## Architecture

- **WXT Framework**: Modern web extension development framework
- **React**: UI components built with React 19
- **Sidebar**: Primary interface using browser sidebar API
- **Background Script**: Handles task execution and Spark integration
- **Content Script**: Provides page interaction capabilities

## TODO

- [ ] Integrate Spark library for actual task execution
- [ ] Add task progress tracking
- [ ] Implement task history
- [ ] Add configuration options
- [ ] Error handling improvements
