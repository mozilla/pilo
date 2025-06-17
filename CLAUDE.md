# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Development commands:

- `pnpm run spark "<task>" [url] [data] [guardrails]` - Run Spark with a natural language task, optional starting URL, optional JSON data, and optional guardrails
- `pnpm run build` - Compile TypeScript to dist/
- `pnpm run typecheck` - Run TypeScript type checking without emitting files
- `pnpm test` - Run tests with Vitest
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run format` - Format code with Prettier
- `pnpm run format:check` - Check code formatting without modifying files
- `pnpm run check` - **Recommended for Claude Code**: Format code, run type checking, and run tests in sequence

Setup commands:

- `pnpm install` - Install dependencies
- `pnpm playwright install firefox` - Install Firefox browser for Playwright
- `cp .env.example .env` - Copy environment template (then edit with your OpenAI API key)

## Architecture

Spark is an AI-powered web automation library and CLI tool that combines natural language understanding with browser automation. The architecture consists of several key components:

### Core Components

- **WebAgent** (`src/webAgent.ts`) - The main orchestrator that:

  - Creates task plans using LLM reasoning
  - Manages the action loop for web automation
  - Validates task completion
  - Handles error recovery and retries
  - Processes contextual data passed from the CLI

- **Browser Abstraction Layer** (`src/browser/`) - Provides browser automation:

  - `ariaBrowser.ts` - Interface defining browser capabilities
  - `playwrightBrowser.ts` - Playwright-based implementation with Firefox
  - Uses aria snapshots for AI-friendly page representation

- **AI Integration** (`src/prompts.ts`, `src/schemas.ts`) - LLM integration:
  - Handlebars-based prompt templates for consistent generation
  - Zod schemas for type-safe AI responses (`planSchema`, `planAndUrlSchema`, `actionSchema`)
  - Contextual data embedding in prompts via JSON format
  - Uses OpenAI GPT-4.1 by default

### Key Patterns

- **Event-Driven Architecture** - Uses EventEmitter for logging and state updates
- **Aria-Based Interaction** - Uses accessibility tree for element identification (refs like `s1e23`)
- **Optimistic Loading** - Uses "commit" wait strategy for faster navigation
- **Action Validation** - Validates AI responses before execution with retry logic
- **Resource Blocking** - Blocks ads and unnecessary resources for performance
- **Contextual Data Flow** - JSON data objects flow from CLI through WebAgent to prompts for LLM reference

### File Structure

- `src/index.ts` - Main library export point for programmatic usage
- `src/lib.ts` - Library exports (WebAgent, PlaywrightBrowser, types)
- `src/cli.ts` - CLI entry point with task, URL, and data argument parsing
- `src/webAgent.ts` - Main automation logic
- `src/browser/` - Browser implementations
- `src/events.ts` - Event system
- `src/loggers.ts` - Logging abstractions
- `src/prompts.ts` - LLM prompts
- `src/schemas.ts` - Type definitions
- `test/` - Test files

## Guardrails

Guardrails provide a way to limit what the WebAgent can do during task execution. When provided, the agent will consider these constraints in its thought process before taking any action.

Examples:

- `"Do not make any purchases or bookings"`
- `"Only search and browse, do not submit any forms"`
- `"Avoid clicking on external links outside the current domain"`

The guardrails are passed as a string parameter and are included in the AI's decision-making process at each step.

## Environment

Requires `.env` file with `OPENAI_API_KEY` for LLM functionality. Tests run in jsdom environment via Vitest configuration.

## Testing

- Individual test files can be run with `pnpm test <filename>`
- Tests use Vitest with jsdom for browser environment simulation
- Test files are located in `test/` directory and mirror the `src/` structure
- Use `pnpm run check` to format, type check, and test in one command

## Server Development

The server subdirectory (`server/`) has its own package.json with identical development commands:

- `cd server && pnpm run check` - Format, type check, and test the server
- `cd server && pnpm run dev` - Start server in development mode
- `cd server && pnpm run build` - Build server for production
