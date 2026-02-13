# Spark Extension Installation

The Spark CLI includes a browser extension that can be installed for enhanced functionality.

## Installation

Install the extension using the CLI:

```bash
# Install for Chrome (default)
spark extension install

# Install for Firefox
spark extension install --browser firefox
```

## How It Works

The extension is bundled with the CLI during build. When you run `spark extension install`:

1. The extension files are copied from the CLI to `~/.spark/extension/{browser}/`
2. The browser's extension page is opened automatically (if possible)
3. Instructions are displayed for manually completing the installation

## Chrome Installation

1. Enable **Developer mode** (toggle in top right of `chrome://extensions/`)
2. Click **Load unpacked**
3. Select the directory: `~/.spark/extension/chrome/`

## Firefox Installation

1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select the file: `~/.spark/extension/firefox/manifest.json`

**Note:** Firefox temporary add-ons are removed when the browser closes. For persistent installation, the extension needs to be packaged and signed.

## Build Process

The extension is built as part of the CLI build process:

1. Extension builds: `pnpm run build:extension` (builds both Chrome and Firefox versions)
2. CLI build: `pnpm run build` (compiles CLI and bundles extensions into `dist/extension/`)

The extension source is in `packages/extension/` and builds to `.output/{browser}/`.
