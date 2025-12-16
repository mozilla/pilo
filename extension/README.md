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
