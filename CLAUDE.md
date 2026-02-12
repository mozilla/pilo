# Spark Project - Claude Instructions

## Project Overview

Spark is an AI-powered web automation library and CLI tool that lets you control browsers using natural language. The project consists of:

- **Core library** (`src/`) - Main automation engine
- **CLI** (`src/cli/`) - Command-line interface
- **Extension** (`extension/`) - Browser extension
- **Server** (`server/`) - Server component

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
pnpm spark run "task"  # Run an automation task
pnpm spark config      # Configure AI provider settings
```

### Installation & Setup

```bash
pnpm install           # Install dependencies
pnpm playwright install # Install browser automation drivers
pnpm install-cli       # Build and install CLI globally
```

## Project Structure

- `src/` - Core library source code
  - `browser/` - Browser automation implementations
  - `cli/` - CLI commands and configuration
  - `tools/` - AI agent tools
  - `utils/` - Utility functions
- `test/` - Test files (mirrors src structure)
- `extension/` - Browser extension code
- `server/` - Server component
- `docs/` - Documentation
- `scripts/` - Build and deployment scripts

## Development Workflow

1. **Before making changes**: Run `pnpm check` to ensure everything is clean
2. **After making changes**:
   - Run `pnpm format` to format code
   - Run `pnpm typecheck` to check types
   - Run `pnpm test` to verify tests pass
3. **Full validation**: Run `pnpm check` (does all three)

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

Configure with: `pnpm spark config --init`

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
