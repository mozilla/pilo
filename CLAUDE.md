# Spark Project - Claude Instructions

## Project Overview

Spark is an AI-powered web automation library and CLI tool that lets you control browsers using natural language. The project is organized as a pnpm monorepo with the following packages:

- **Core library** (`packages/core/`) - Main automation engine (spark-core)
- **CLI** (`packages/cli/`) - Command-line interface (@spark/cli)
- **Extension** (`packages/extension/`) - Browser extension (spark-extension)
- **Server** (`packages/server/`) - Server component (@spark/server)

## Common Commands

### Testing

```bash
pnpm test              # Run all tests
pnpm test:watch        # Run tests in watch mode
```

### Development

```bash
pnpm build             # Build the project (TypeScript compilation)
pnpm typecheck         # Run TypeScript type checking
pnpm format            # Format code with Prettier
pnpm format:check      # Check code formatting
pnpm check             # Run format + typecheck + test (full validation)
```

### Running Spark CLI

```bash
pnpm spark <command>   # Run spark CLI locally (uses tsx)
pnpm spark run "task"  # Run an automation task (auto-installs browsers if needed)
pnpm spark config init # Create config file
pnpm spark config show # View current settings
pnpm spark extension install [firefox|chrome]  # Install browser extension
```

### Installation & Setup

```bash
pnpm install           # Install dependencies
pnpm playwright install # Install browser automation drivers
pnpm install-cli       # Build and install CLI globally
```

## Project Structure

```
spark/
├── package.json              # Workspace root (format scripts only)
├── pnpm-workspace.yaml
├── packages/
│   ├── core/                 # Main library (spark-core)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/              # Core library source code
│   │   │   ├── browser/      # Browser automation implementations
│   │   │   ├── tools/        # AI agent tools
│   │   │   └── utils/        # Utility functions
│   │   └── test/             # Test files (mirrors src structure)
│   ├── cli/                  # CLI tool (@spark/cli)
│   │   ├── package.json
│   │   └── src/
│   ├── server/               # Server component (@spark/server)
│   │   ├── package.json
│   │   └── src/
│   └── extension/            # Browser extension (spark-extension)
│       ├── package.json
│       └── src/
├── docs/                     # Documentation
└── scripts/                  # Build and deployment scripts
```

## Development Workflow

1. **Before making changes**: Run `pnpm check` to ensure everything is clean
2. **After making changes**:
   - Run `pnpm format` to format code
   - Run `pnpm typecheck` to check types
   - Run `pnpm test` to verify tests pass
3. **Full validation**: Run `pnpm check` (does all three)

### Working in the Monorepo

**From root:**

- `pnpm format` - Format all code
- `pnpm format:check` - Check formatting
- `pnpm spark <command>` - Run CLI locally
- `pnpm -r run test` - Run all tests
- `pnpm -r run typecheck` - Typecheck all packages
- `pnpm -F spark-core run test` - Run tests for specific package

**From a package directory (e.g., `cd packages/core`):**

- `pnpm test` - Run tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm typecheck` - Run type checking
- `pnpm build` - Build the package

### Package Dependencies

- CLI, server, and extension depend on `spark-core` via workspace protocol
- Use `"spark-core": "workspace:*"` in package.json

### Import Style

- All imports use `.js` extensions (NodeNext module resolution)
- No barrel imports (no index.ts re-export files)
- Import directly from specific files: `import { foo } from "spark-core/utils/foo.js"`

## Testing

- Tests use Vitest
- Test files are in `test/` directory, mirroring the `src/` structure
- Mocking is done with `vi.mock()` from Vitest

## AI Provider Configuration

Spark supports multiple AI providers:

- OpenAI
- OpenRouter (default)
- Google Generative AI
- Ollama
- Vertex AI

### Configuration System

The configuration system has been refactored into a modular architecture in `packages/core/src/config/`:

- **defaults.ts**: Type definitions, field definitions, and default values (browser-compatible)
- **configManager.ts**: Singleton config manager with build-mode-aware resolution
- **globalConfig.ts**: File I/O operations with XDG-compliant paths (`~/.config/spark/`)
- **envParser.ts**: Environment variable parsing and normalization
- **helpers.ts**: CLI option generation utilities

### Config Commands

Configuration is now managed via subcommands:

```bash
pnpm spark config init         # Create empty config file
pnpm spark config show         # Display current config
pnpm spark config set <key>=<value>  # Set a value
pnpm spark config get <key>    # Get a value
pnpm spark config reset        # Reset to defaults
```

**Config file location**: `~/.config/spark/config.json` (XDG-compliant on Linux/macOS)

In production mode (when installed via npm), the CLI requires a config file to exist. Run `spark config init` to create one.

## Security - Secret Scanning

**⚠️ CRITICAL: Always scan for secrets before committing and especially before pushing to GitHub!**

### Scanning for Secrets

```bash
# Scan uncommitted changes (fast - use before commits)
gitleaks protect -v

# Scan entire Git history (slower - good for audits)
gitleaks detect -v

# Install gitleaks if not already installed
brew install gitleaks  # macOS
```

### Workflow

1. **Before committing**: Run `gitleaks protect -v` to catch secrets in staged changes
2. **Before pushing**: Run `gitleaks detect -v` to scan recent commits
3. **If a false positive is found**: Add the fingerprint to `.gitleaksignore`

### Optional: Pre-Commit Hook (Recommended)

A pre-commit hook is available to automatically scan for secrets before each commit. **This is optional but recommended.**

To enable it:

```bash
# One-time setup: configure Git to use the .githooks directory
git config core.hooksPath .githooks

# Verify it's working (should run the gitleaks scan)
git commit --allow-empty -m "test hook"
```

To disable it:

```bash
# Revert to default hooks directory
git config --unset core.hooksPath
```

**Note**: The hook can be bypassed with `git commit --no-verify`, but this is not recommended unless you have a specific reason (e.g., known false positive already documented).

### Best Practices

- **Never commit real API keys** - use test values like `"fake-key-123"` in tests
- **Test values should not look like real secrets** - avoid patterns like `sk-*`, `key_*`, etc.
- `.gitleaksignore` contains fingerprints of known false positives

### False Positives

If gitleaks flags a test value:

1. **Preferred**: Change the test value to something obviously fake (e.g., `"fake-test-key-123"`)
2. **Alternative**: Add the fingerprint from gitleaks output to `.gitleaksignore`

## Important Notes

- Node version: ^22.0.0 (specified in package.json engines)
- Package manager: pnpm 9.0.0
- The project is working toward being open-sourced
