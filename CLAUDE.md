# Pilo Project - Claude Instructions

## Project Overview

Pilo is an AI-powered web automation library and CLI tool that lets you control browsers using natural language. It is structured as a pnpm monorepo under `packages/`, with the root package (`@tabstack/pilo`) serving as both the workspace orchestrator and the publishable npm package.

## Monorepo Structure

```
pilo/
├── packages/
│   ├── core/        # pilo-core: automation engine
│   ├── cli/         # pilo-cli: CLI commands and config
│   ├── server/      # pilo-server: Hono-based server
│   └── extension/   # pilo-extension: WXT/React browser extension
├── scripts/         # Build, release, and CI scripts
├── dist/            # Assembled output (root build only)
├── package.json     # @tabstack/pilo workspace root + published package
└── pnpm-workspace.yaml
```

### Packages

| Path                 | npm name         | Description                                                                                 |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `packages/core`      | `pilo-core`      | Core automation library. Browser-safe subset via `core.ts`; full Node.js API via `index.ts` |
| `packages/cli`       | `pilo-cli`       | CLI entry point, commands, and config integration                                           |
| `packages/server`    | `pilo-server`    | Hono-based server component                                                                 |
| `packages/extension` | `pilo-extension` | WXT-based browser extension with React UI                                                   |
| root                 | `@tabstack/pilo` | Published npm package: bundles core + CLI + pre-built extension                             |

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
pnpm run check          # typecheck (pretest + format:check + per-package typechecks) + test across all packages
```

### Testing

```bash
pnpm -r run test                                       # Run all tests across all packages
pnpm --filter pilo-core run test                      # Test core only
pnpm --filter pilo-cli run test                       # Test CLI only
pnpm --filter pilo-extension run test                 # Test extension only (unit, vitest)
pnpm --filter pilo-server run test                    # Test server only
pnpm --filter pilo-extension run test:e2e             # Extension e2e tests (headed, Playwright)
pnpm --filter pilo-extension run test:e2e:headless    # Extension e2e tests (headless)
```

### Building

```bash
pnpm run build          # Full assembly: prebuild (core + extension) then tsup compiles core + CLI into root dist/
pnpm -r run build       # Build all packages individually
pnpm run clean          # Clean all packages and root dist/
```

### Development

```bash
pnpm run dev:server                           # Run dev server (tsx watch)
pnpm run dev:extension -- --chrome            # Extension dev (Chrome, WXT HMR)
pnpm run dev:extension -- --firefox           # Extension dev (Firefox, WXT HMR)
pnpm run dev:extension -- --chrome --tmp      # Extension dev with temporary profile
pnpm run format                               # Format all code with Prettier
pnpm run format:check                         # Check formatting
pnpm run typecheck                            # Generate ariaTree bundle + format:check + typecheck all packages
```

### Installation & Setup

```bash
pnpm install              # Install all workspace dependencies
pnpm playwright install   # Install browser automation drivers
```

### Running Pilo CLI Locally

```bash
pnpm pilo run "task"            # Run an automation task
pnpm pilo config init           # Initialize config interactively
pnpm pilo config set <key> <value>
pnpm pilo config get <key>
pnpm pilo config list
pnpm pilo config show
pnpm pilo config unset <key>
pnpm pilo config reset
pnpm pilo extension install chrome [--tmp]
pnpm pilo extension install firefox [--tmp] [--firefox-binary <path>]
```

## Development Workflow

1. **Before making changes**: Run `pnpm run check` to verify a clean baseline.
2. **After making changes**:
   - Run `pnpm run format` to format code.
   - Run `pnpm run typecheck` to run formatting checks and typecheck all packages (single entry point for both).
   - Run `pnpm -r run test` to verify all tests pass.
3. **Full validation**: `pnpm run check` chains `typecheck` (which includes pretest + format:check + per-package typechecks) and then all tests.

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

**Two-tier rule**: The extension must import from `pilo-core/core` (not `pilo-core`), which pulls in `config/defaults.ts` but not the Node.js-dependent files.

### Config File Location

| Platform    | Path                                                                        |
| ----------- | --------------------------------------------------------------------------- |
| macOS/Linux | `$XDG_CONFIG_HOME/pilo/config.json` (default: `~/.config/pilo/config.json`) |
| Windows     | `%APPDATA%/pilo/config.json`                                                |

There is no migration from the legacy `~/.pilo/` path. If a user has an old config there, they must re-run `pilo config init`.

### Production vs. Dev Merge Strategy

The config system behaves differently depending on whether Pilo is running from compiled output (production) or from source via `tsx` (dev). The `__PILO_PRODUCTION__` flag is injected by the root `tsup` build via the `define` option in `tsup.config.ts`. Individual package builds are always dev mode; only the root tsup build produces production artifacts.

| Mode                                    | Merge order                                       | Notes                                                          |
| --------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| **Production** (npm-installed)          | defaults -> global config (required)              | No `.env` loading. No env var parsing. Config file must exist. |
| **Dev** (running from source via `tsx`) | defaults -> global config (if exists) -> env vars | Loads `.env` from CWD. Global config is optional.              |

### CLI Config Guard

`pilo run` requires a config file to exist before executing. If no config is present, the command exits immediately with:

```
Error: No configuration found. Run 'pilo config init' to set up your configuration.
```

All other commands (`config`, `extension`, `examples`) work without a config file.

## Architectural Constraints

- **No barrel imports** except `index.ts` and `core.ts` in core, and `browser/ariaTree/index.ts`. Do not create new barrel files.
- **ariaTree bundle** (`packages/core/src/browser/ariaTree/bundle.ts`) is auto-generated by the build script. It is not committed to git.
- **Prettier config** is consolidated at the root only (`.prettierrc`, `.prettierignore`). Do not add package-level Prettier config.
- **Dependency version alignment**: All packages must use the same version of any shared dependency. A CI workflow enforces this via `scripts/check-dep-versions.mjs`.
- **Cross-package references** use `workspace:*` protocol, not relative `file:` paths.
- **Vite aliases for pilo-core subpaths**: The extension's `wxt.config.ts` must define Vite `resolve.alias` entries for `pilo-core/core` and `pilo-core/ariaTree`, pointing to the core package source files. Vite cannot resolve `workspace:*` subpath exports on its own.
- **tsconfig paths for dev resolution**: The CLI and server `tsconfig.json` files define `paths` entries for `pilo-core` (bare + wildcard) so `tsc` and `tsx` can resolve the workspace package to source without a prior build. Do not add `rootDir` to these tsconfigs (the paths alias pulls in files from `../core/src/`, which conflicts with a `rootDir` of `./src`).

## npm Publishing

The root `@tabstack/pilo` is the published package.

```bash
pnpm run build   # Runs prebuild (core + extension), then tsup compiles core + CLI into dist/
npm pack         # Produces the tarball for inspection
```

Build pipeline: `prebuild` (core build + extension build:publish) -> `tsup` (compiles core + CLI source into `dist/`) -> `onSuccess` (copies extension artifacts to `dist/extension/`).

Published package contents (`dist/`):

- Core library (importable as `@tabstack/pilo`)
- CLI binary (`pilo`)
- Pre-built extension: `dist/extension/chrome/` and `dist/extension/firefox/` (unpacked)

Package exports:

- `.` - Full Node.js API (`dist/core/src/index.js`)

Internal workspace packages import `pilo-core` directly and do not use root-level re-exports.

## Scripts

| Script                                      | Description                                                                                                                                                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tsup.config.ts`                            | Root tsup build config: compiles core + CLI source into `dist/`, resolves `pilo-core` workspace imports, injects `__PILO_PRODUCTION__` via `define`, copies extension artifacts via `onSuccess` |
| `scripts/check-dep-versions.mjs`            | CI: verifies shared dependency version alignment across packages                                                                                                                                |
| `scripts/release.sh`                        | Release automation                                                                                                                                                                              |
| `packages/core/scripts/bundle-aria-tree.ts` | Generates ariaTree bundle (auto-run during build, not committed)                                                                                                                                |
| `packages/extension/scripts/dev.ts`         | Parses `--chrome`/`--firefox`/`--tmp` flags and runs `wxt dev -b <browser>` with appropriate env                                                                                                |

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

Pilo supports multiple AI providers:

- OpenAI
- OpenRouter (default)
- Google Generative AI
- Ollama
- Vertex AI

Configure interactively with: `pnpm pilo config init`

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
