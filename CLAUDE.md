# Spark Project - Claude Instructions

## Project Overview

Spark is an AI-powered web automation library and CLI tool that lets you control browsers using natural language. It is structured as a pnpm monorepo under `packages/`, with the root package (`@tabstack/spark`) serving as both the workspace orchestrator and the publishable npm package.

## Monorepo Structure

```
spark/
├── packages/
│   ├── core/        # spark-core: automation engine
│   ├── cli/         # spark-cli: CLI commands and config
│   ├── server/      # spark-server: Hono-based server
│   └── extension/   # spark-extension: WXT/React browser extension
├── scripts/         # Build, release, and CI scripts
├── dist/            # Assembled output (root build only)
├── package.json     # @tabstack/spark workspace root + published package
└── pnpm-workspace.yaml
```

### Packages

| Path                 | npm name          | Description                                                                                 |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `packages/core`      | `spark-core`      | Core automation library. Browser-safe subset via `core.ts`; full Node.js API via `index.ts` |
| `packages/cli`       | `spark-cli`       | CLI entry point, commands, and config integration                                           |
| `packages/server`    | `spark-server`    | Hono-based server component                                                                 |
| `packages/extension` | `spark-extension` | WXT-based browser extension with React UI                                                   |
| root                 | `@tabstack/spark` | Published npm package: bundles core + CLI + pre-built extension                             |

### Core Package Layout (`packages/core/src/`)

- `browser/` - Browser automation implementations
- `config/` - Config system (see Config System section)
- `tools/` - AI agent tools
- `search/` - Search utilities
- `utils/` - Utility functions
- `index.ts` - Full Node.js public API (barrel)
- `core.ts` - Browser-safe public API (barrel, no Node.js deps)

### Extension Package Layout (`packages/extension/src/`)

- `ui/` - Sidepanel React components, hooks, stores
- `background/` - Service worker (AgentManager, ExtensionBrowser)
- `content/` - Content script entry (imports from `shared/`)
- `shared/` - Types, utils, and stores used across multiple entrypoints
- `entrypoints/` (root of extension package) - WXT entrypoints

## Common Commands

### Full Validation

```bash
pnpm run check          # format:check + typecheck + test across all packages
```

### Testing

```bash
pnpm -r run test                          # Run all tests across all packages
pnpm --filter spark-core run test         # Test core only
pnpm --filter spark-cli run test          # Test CLI only
pnpm --filter spark-extension run test    # Test extension only
pnpm --filter spark-server run test       # Test server only
```

### Building

```bash
pnpm run build          # Full assembly: core + CLI + extension → root dist/
pnpm -r run build       # Build all packages individually
pnpm run clean          # Clean all packages and root dist/
```

### Development

```bash
pnpm run dev:server                        # Run dev server
pnpm run dev:extension -- --chrome         # Extension dev (Chrome)
pnpm run dev:extension -- --firefox        # Extension dev (Firefox)
pnpm run format                            # Format all code with Prettier
pnpm run format:check                      # Check formatting
pnpm run typecheck                         # Typecheck all packages
```

### Installation & Setup

```bash
pnpm install              # Install all workspace dependencies
pnpm playwright install   # Install browser automation drivers
```

### Running Spark CLI Locally

```bash
pnpm spark run "task"            # Run an automation task
pnpm spark config init           # Initialize config interactively
pnpm spark config set <key> <value>
pnpm spark config get <key>
pnpm spark config list
pnpm spark config show
pnpm spark config unset <key>
pnpm spark config reset
pnpm spark extension install chrome [--tmp]
pnpm spark extension install firefox [--tmp]
```

## Development Workflow

1. **Before making changes**: Run `pnpm run check` to verify a clean baseline.
2. **After making changes**:
   - Run `pnpm run format` to format code.
   - Run `pnpm run typecheck` to check types across all packages.
   - Run `pnpm -r run test` to verify all tests pass.
3. **Full validation**: `pnpm run check` runs all three steps.

## Testing

- All packages use Vitest.
- Test files live in each package's `test/` directory, mirroring `src/` structure.
- Mocking uses `vi.mock()` from Vitest.

## Config System

The config system lives in `packages/core/src/config/` and is split by concern:

| File           | Purpose                                                                                |
| -------------- | -------------------------------------------------------------------------------------- |
| `defaults.ts`  | Browser-safe types, enums, field definitions, and defaults. Zero Node.js dependencies. |
| `env.ts`       | Environment variable parsing                                                           |
| `commander.ts` | CLI option integration (Commander.js)                                                  |
| `manager.ts`   | `ConfigManager` class and singleton                                                    |
| `index.ts`     | Public re-export (Node.js context only)                                                |

**Two-tier rule**: The extension must import from `spark-core/core` (not `spark-core`), which pulls in `config/defaults.ts` but not the Node.js-dependent files.

### Config File Location

| Platform    | Path                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| macOS/Linux | `$XDG_CONFIG_HOME/spark/config.json` (default: `~/.config/spark/config.json`) |
| Windows     | `%APPDATA%/spark/config.json`                                                 |

There is no migration from the legacy `~/.spark/` path. If a user has an old config there, they must re-run `spark config init`.

### Production vs. Dev Merge Strategy

The config system behaves differently depending on whether Spark is running from compiled output (production) or from source via `tsx` (dev). A build-time `__SPARK_PRODUCTION__` flag is baked into the compiled output by `packages/core/scripts/inject-prod-flag.mjs`.

| Mode                                    | Merge order                                     | Notes                                                          |
| --------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| **Production** (npm-installed)          | defaults → global config (required)             | No `.env` loading. No env var parsing. Config file must exist. |
| **Dev** (running from source via `tsx`) | defaults → global config (if exists) → env vars | Loads `.env` from CWD. Global config is optional.              |

### CLI Config Guard

`spark run` requires a config file to exist before executing. If no config is present, the command exits immediately with:

```
Error: No configuration found. Run 'spark config init' to set up your configuration.
```

All other commands (`config`, `extension`, `examples`) work without a config file.

## Architectural Constraints

- **No barrel imports** except `index.ts` and `core.ts` in core, and `browser/ariaTree/index.ts`. Do not create new barrel files.
- **ariaTree bundle** (`packages/core/src/browser/ariaTree/bundle.ts`) is auto-generated by the build script. It is not committed to git.
- **Prettier config** is consolidated at the root only (`.prettierrc`, `.prettierignore`). Do not add package-level Prettier config.
- **Dependency version alignment**: All packages must use the same version of any shared dependency. A CI workflow enforces this via `scripts/check-dep-versions.mjs`.
- **Cross-package references** use `workspace:*` protocol, not relative `file:` paths.

## npm Publishing

The root `@tabstack/spark` is the published package.

```bash
pnpm run build   # Assembles all outputs into dist/ via scripts/assemble.js
npm pack         # Produces the tarball for inspection
```

Published package contents (`dist/`):

- Core library (importable as `@tabstack/spark`)
- CLI binary (`spark`)
- Pre-built extension: `dist/extension/chrome/` and `dist/extension/firefox/` (unpacked)

Package exports:

- `.` - Full Node.js API (`dist/index.js`)

Internal workspace packages import `spark-core` directly and do not use root-level re-exports.

## Scripts

| Script                                       | Description                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `scripts/assemble.js`                        | Assembles root publishable package from sub-package build outputs       |
| `scripts/check-dep-versions.mjs`             | CI: verifies shared dependency version alignment across packages        |
| `scripts/release.sh`                         | Release automation                                                      |
| `packages/core/scripts/bundle-aria-tree.ts`  | Generates ariaTree bundle (auto-run during build, not committed)        |
| `packages/core/scripts/inject-prod-flag.mjs` | Post-compile: replaces `__SPARK_PRODUCTION__` with `true` in dist files |

## CI Workflows

CI is defined in `.github/workflows/`.

### Build & Test (`build-test.yml`)

The primary CI workflow. Uses `dorny/paths-filter@v3` for smart change detection so jobs run only when relevant files are modified.

| Job             | Trigger condition                        | Notes                            |
| --------------- | ---------------------------------------- | -------------------------------- |
| Core typecheck  | Always                                   | Runs on every push/PR.           |
| Core tests      | Core files changed                       |                                  |
| CLI tests       | CLI files changed, or core changed       | Core is a CLI dependency.        |
| Server tests    | Server files changed, or core changed    | Core is a server dependency.     |
| Extension tests | Extension files changed, or core changed | Core is an extension dependency. |

The core build output is cached and shared across jobs that depend on it.

### Dependency Check (`dep_check.yml`)

Runs two parallel jobs:

1. **Version alignment**: Verifies all packages use the same version of any shared dependency (`scripts/check-dep-versions.mjs`).
2. **Lockfile sync**: Verifies `pnpm-lock.yaml` is in sync with all `package.json` files via `pnpm install --frozen-lockfile`.

## AI Provider Configuration

Spark supports multiple AI providers:

- OpenAI
- OpenRouter (default)
- Google Generative AI
- Ollama
- Vertex AI

Configure interactively with: `pnpm spark config init`

## Security - Secret Scanning

**CRITICAL: Always scan for secrets before committing and especially before pushing to GitHub.**

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

1. **Before committing**: Run `gitleaks protect -v` to catch secrets in staged changes.
2. **Before pushing**: Run `gitleaks detect -v` to scan recent commits.
3. **If a false positive is found**: Add the fingerprint to `.gitleaksignore`.

### Optional: Pre-Commit Hook (Recommended)

A pre-commit hook is available to automatically scan for secrets before each commit.

To enable it:

```bash
# One-time setup: configure Git to use the .githooks directory
git config core.hooksPath .githooks

# Verify it's working (should run the gitleaks scan)
git commit --allow-empty -m "test hook"
```

To disable it:

```bash
git config --unset core.hooksPath
```

The hook can be bypassed with `git commit --no-verify`, but only do this for a false positive that is already documented in `.gitleaksignore`.

### Best Practices

- **Never commit real API keys** - use test values like `"fake-key-123"` in tests.
- **Test values should not look like real secrets** - avoid patterns like `sk-*`, `key_*`, etc.
- `.gitleaksignore` contains fingerprints of known false positives.

### False Positives

If gitleaks flags a test value:

1. **Preferred**: Change the test value to something obviously fake (e.g., `"fake-test-key-123"`).
2. **Alternative**: Add the fingerprint from gitleaks output to `.gitleaksignore`.

## Important Notes

- Node version: `^22.0.0` (specified in root `package.json` engines field)
- Package manager: `pnpm@9.0.0`
- The project is working toward being open-sourced.
