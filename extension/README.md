# Spark Extension

Browser extension for Spark AI-powered web automation.

## Development

```bash
# Install dependencies
pnpm install

# Development (Firefox - persistent profile)
pnpm dev:firefox

# Development (Chrome - persistent profile)
pnpm dev:chrome

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

### Opening the Side Panel During Development

Chrome does not persist the side panel's open/closed state across browser restarts. To make development easier, the extension includes two workarounds:

#### 1. One-Click Panel Opening

The extension is configured to open the side panel when you click the extension icon. This behavior persists across development restarts, so you only need one click to open the panel.

**How it works**: The `setPanelBehavior({ openPanelOnActionClick: true })` configuration is set in the background script's `onInstalled` listener, which persists in Chrome's profile data.

#### 2. Keyboard Shortcut

You can open the side panel instantly using a keyboard shortcut:
- **Mac**: `Cmd+Shift+S`
- **Windows/Linux**: `Ctrl+Shift+S`

The keyboard shortcut triggers the same action as clicking the extension icon.

**Note**: In Firefox, the sidebar opens automatically via the `open_at_install: true` manifest configuration, so these workarounds are only needed for Chrome development.
