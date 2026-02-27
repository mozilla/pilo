FROM node:22-slim

# Install pnpm
RUN npm install -g pnpm

# Build argument to control Playwright browser installation
ARG INSTALL_PLAYWRIGHT_BROWSERS=true

# Set working directory to repo root
WORKDIR /app

# Copy workspace manifests so pnpm can resolve the workspace graph
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all package manifests before installing so pnpm can link the workspace
COPY packages/core/package.json ./packages/core/package.json
COPY packages/cli/package.json ./packages/cli/package.json
COPY packages/server/package.json ./packages/server/package.json
COPY packages/extension/package.json ./packages/extension/package.json

# Install all workspace dependencies.
# --ignore-scripts prevents the root prepare lifecycle script from running
# pilo-core build before its source has been copied into the image.
# We then selectively rebuild only packages with native binaries (esbuild)
# so their postinstall scripts run without triggering the root prepare.
RUN pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm rebuild esbuild

# Copy core source and build it (CLI depends on pilo-core)
COPY packages/core/ ./packages/core/
RUN pnpm --filter pilo-core run build

# Install Playwright system dependencies as root (requires apt)
RUN if [ "$INSTALL_PLAYWRIGHT_BROWSERS" = "true" ]; then \
    npx playwright install-deps chromium; \
    fi

# Copy CLI source and build
COPY packages/cli/ ./packages/cli/
RUN pnpm --filter pilo-cli run build

# Set environment variables
ENV NODE_ENV=production

# Create minimal stub config for root user (container may run as root)
RUN mkdir -p /root/.config/pilo && echo '{}' > /root/.config/pilo/config.json

# Ensure node user owns the app files
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Create minimal stub configs to satisfy the CLI config guard.
# The guard only checks for file existence; actual provider/key config
# is supplied via environment variables (dev-mode env var loading).
# Both root and node user paths are created because callers may run
# the container as either user.
RUN mkdir -p /home/node/.config/pilo && echo '{}' > /home/node/.config/pilo/config.json

# Install Playwright browsers as node user (so they end up in /home/node/.cache)
# ARG must be redeclared after USER to be accessible (with same default)
ARG INSTALL_PLAYWRIGHT_BROWSERS=true
RUN if [ "$INSTALL_PLAYWRIGHT_BROWSERS" = "true" ]; then \
    npx playwright install chromium; \
    fi

# Run pilo CLI - subcommand args are appended by the caller
ENTRYPOINT ["node", "/app/packages/cli/dist/cli/src/cli.js"]
