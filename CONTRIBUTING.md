# Contributing to Pilo

Thank you for your interest in contributing to Pilo! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Before You Start](#before-you-start)
- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Building](#building)
- [Code Style](#code-style)
- [Making Changes](#making-changes)
- [Submitting Your Contribution](#submitting-your-contribution)
- [Review Process](#review-process)
- [Your First Contribution](#your-first-contribution)
- [Code of Conduct](#code-of-conduct)
- [Questions](#questions)

## Before You Start

### Check Existing Issues

Before starting work, check if there is already an open issue for what you would like to contribute. If there is not, consider opening one to discuss your proposed changes with the maintainers.

### Understand the Project

Pilo is an AI-powered web automation library and CLI tool structured as a pnpm monorepo. Familiarize yourself with the project's goals and architecture before making significant changes.

### Communication

- For bug reports and feature requests, open an issue
- For questions and discussions, use the appropriate communication channels
- For security issues, follow our security disclosure policy

## Prerequisites

| Tool    | Version   | Notes                                                                                                          |
| ------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| Node.js | `^22.0.0` | Required. Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage versions. |
| pnpm    | `9.0.0`   | **Required.** Do not use npm or yarn for this project.                                                         |

### Installing pnpm

If you do not have pnpm installed, use [Corepack](https://nodejs.org/api/corepack.html) (bundled with Node.js 16+):

```bash
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

Or install directly:

```bash
npm install -g pnpm@9.0.0
```

Verify your versions:

```bash
node --version   # should be 22.x
pnpm --version   # should be 9.0.0
```

## Development Setup

```bash
# 1. Fork the repository, then clone your fork
git clone https://github.com/<your-username>/pilo.git
cd pilo

# 2. Install all workspace dependencies
pnpm install

# 3. Install browser automation drivers (needed for Playwright-based tests and CLI use)
pnpm playwright install

# 4. Verify the baseline is clean
pnpm run check
```

### Configure an AI Provider (optional, for running automations locally)

```bash
pnpm pilo config init
```

This stores your configuration at `~/.config/pilo/config.json`.

## Project Structure

```
pilo/
├── packages/
│   ├── core/        # pilo-core: automation engine and config system
│   ├── cli/         # pilo-cli: CLI commands and config integration
│   ├── server/      # pilo-server: Hono-based server
│   └── extension/   # pilo-extension: WXT/React browser extension
├── scripts/         # Build, release, and CI scripts
├── dist/            # Assembled output (root build only, not committed)
├── package.json     # @tabstack/pilo workspace root + published package
└── pnpm-workspace.yaml
```

| Package              | npm name         | Description                                                                                  |
| -------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| `packages/core`      | `pilo-core`      | Core automation library. Browser-safe subset via `core.ts`; full Node.js API via `index.ts`. |
| `packages/cli`       | `pilo-cli`       | CLI entry point, commands, and config integration.                                           |
| `packages/server`    | `pilo-server`    | Hono-based server component.                                                                 |
| `packages/extension` | `pilo-extension` | WXT-based browser extension with React UI.                                                   |
| root                 | `@tabstack/pilo` | Published npm package: bundles core + CLI + pre-built extension.                             |

## Development Workflow

### Full Validation

Before and after making changes, run the full check to confirm nothing is broken:

```bash
pnpm run check
```

This chains `typecheck` (which includes pre-test bundle generation, formatting check, and per-package typechecks) followed by all tests.

### Step-by-Step (during active development)

```bash
# 1. Format code
pnpm run format

# 2. Typecheck all packages (also checks formatting)
pnpm run typecheck

# 3. Run all tests
pnpm -r run test
```

### Running the CLI Locally

```bash
pnpm pilo run "task description"
pnpm pilo config init
pnpm pilo config set <key> <value>
pnpm pilo config get <key>
pnpm pilo config list
pnpm pilo config show
pnpm pilo config unset <key>
pnpm pilo config reset
pnpm pilo extension install chrome
pnpm pilo extension install firefox [--tmp]
```

### Extension Development

```bash
# Hot-reloading dev mode (Chrome)
pnpm run dev:extension -- --chrome

# Hot-reloading dev mode (Firefox)
pnpm run dev:extension -- --firefox

# With a temporary browser profile (clean state on every start)
pnpm run dev:extension -- --chrome --tmp
pnpm run dev:extension -- --firefox --tmp
```

### Server Development

```bash
pnpm run dev:server
```

## Testing

All packages use [Vitest](https://vitest.dev/) for unit tests. The extension additionally uses [Playwright](https://playwright.dev/) for end-to-end tests.

Test files live in each package's `test/` directory, mirroring the `src/` structure.

### Running Tests

```bash
# All packages
pnpm -r run test

# Specific package
pnpm --filter pilo-core run test
pnpm --filter pilo-cli run test
pnpm --filter pilo-server run test
pnpm --filter pilo-extension run test

# Extension end-to-end tests
pnpm --filter pilo-extension run test:e2e           # headed
pnpm --filter pilo-extension run test:e2e:headless  # headless
```

### Writing Tests

- Use `vi.mock()` from Vitest for mocking.
- Write tests for new features and bug fixes.
- Ensure all existing tests pass before submitting.
- Add both unit tests and integration tests where appropriate.

## Building

```bash
# Full production build (core + extension, then compiles into dist/)
pnpm run build

# Build all packages individually
pnpm -r run build

# Clean all build artifacts
pnpm run clean
```

The root build assembles the published package at `dist/`. This includes the core library, CLI binary, and pre-built extension for both Chrome and Firefox.

## Code Style

### Formatter

All code is formatted with [Prettier](https://prettier.io/). Configuration lives at the root `.prettierrc` only; do not add package-level Prettier config.

```bash
pnpm run format        # Format all files
pnpm run format:check  # Check without modifying
```

Format is enforced in CI. Unformatted code will fail the typecheck step.

### TypeScript

- Use the latest stable TypeScript features.
- Avoid `any`. Use `unknown` with type narrowing where the type is genuinely unknown.
- Keep functions focused and modular.
- Prioritize readability over cleverness.

### Architectural Rules

- **No barrel imports** except `index.ts` and `core.ts` in `packages/core`, and `browser/ariaTree/index.ts`. Do not create new barrel files.
- **Cross-package references** use the `workspace:*` protocol, not relative `file:` paths.
- **Extension imports**: The extension must import from `pilo-core/core` (not `pilo-core`) to avoid pulling in Node.js-only dependencies.
- **Shared dependencies**: All packages must use the same version of any shared dependency. CI enforces this via `scripts/check-dep-versions.mjs`.

## Making Changes

### Branch Naming Conventions

Use descriptive branch names that follow this pattern:

- `feature/short-description` - For new features
- `fix/short-description` - For bug fixes
- `docs/short-description` - For documentation changes
- `refactor/short-description` - For code refactoring
- `test/short-description` - For test additions or improvements

Example: `feature/add-chrome-extension-support`

### Commit Messages

Write clear, descriptive commit messages:

- Use the imperative mood ("Add feature" not "Added feature")
- Keep the first line under 72 characters
- Add a blank line followed by a detailed description if needed
- Reference issue numbers when applicable (e.g., "Fix #123")

Example:

```
Add support for Chrome extension automation

Implement browser extension detection and interaction capabilities.
This allows agents to interact with Chrome extensions programmatically.

Fixes #123
```

### Secret Scanning

Before committing, scan for accidentally included secrets:

```bash
# Install gitleaks (macOS)
brew install gitleaks

# Scan staged changes before each commit
gitleaks protect -v
```

#### Optional: Pre-Commit Hook

```bash
# Enable automatic scanning before every commit
git config core.hooksPath .githooks

# Disable
git config --unset core.hooksPath
```

Never commit real API keys. Use obviously fake values like `"fake-key-123"` in tests.

## Submitting Your Contribution

### Pull Request Process

1. **Fork and Clone**: Fork the repository and clone it locally
2. **Create a Branch**: Create a new branch for your changes
3. **Make Changes**: Implement your changes following the guidelines above
4. **Test**: Ensure all tests pass and add new tests as needed
5. **Check**: Run `pnpm run check` to confirm everything passes
6. **Commit**: Commit your changes with clear commit messages
7. **Push**: Push your branch to your fork
8. **Open a Pull Request**: Open a PR against the main repository

### Pull Request Description

Your PR description should include:

- **What**: A clear description of what you have changed
- **Why**: The motivation for the change (link to issue if applicable)
- **How**: An overview of your implementation approach
- **Testing**: What testing you have done
- **Screenshots**: If applicable, include before/after screenshots

Example template:

```markdown
## Description

Brief description of the changes

## Motivation

Why is this change necessary? What problem does it solve?

## Implementation

How did you implement the solution?

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Related Issues

Fixes #123
```

## Review Process

### What to Expect

- Maintainers will review your PR and may request changes
- Be responsive to feedback and questions
- Reviews may take time; please be patient
- Your PR may go through multiple rounds of review

### Review Criteria

Reviewers will check for:

- Code quality and adherence to project standards
- Test coverage and quality
- Documentation updates (if applicable)
- Backward compatibility
- Performance implications
- Security considerations

### Making Updates

- Address review feedback by pushing new commits to your branch
- Respond to review comments to clarify your approach
- Mark conversations as resolved once addressed

## Your First Contribution

New to open source? Here are some ways to get started:

### Good First Issues

Look for issues labeled `good first issue` or `beginner-friendly`. These are specifically curated for newcomers.

### Documentation

Documentation improvements are always welcome and a great way to learn the project:

- Fix typos or clarify unclear sections
- Add examples or tutorials
- Improve code comments

### Small Bug Fixes

Start with small, well-defined bug fixes to get familiar with the contribution process.

### Ask for Help

Don't hesitate to ask questions on issues or in discussions. The community is here to help!

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

Key points:

- Be respectful and inclusive
- Welcome diverse perspectives
- Accept constructive criticism gracefully
- Focus on what is best for the community

## Questions

### Where to Ask

- **General Questions**: Open a discussion or issue
- **Bug Reports**: Open an issue with steps to reproduce
- **Feature Requests**: Open an issue describing your idea
- **Security Issues**: Follow the security disclosure policy

### Getting Help

If you are stuck:

1. Check existing documentation and issues
2. Search for similar questions or problems
3. Ask in the appropriate channel with specific details
4. Be patient and respectful when awaiting responses

## License

By contributing to Pilo, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Pilo! Your efforts help make browser automation and AI agents more accessible and powerful for everyone.
