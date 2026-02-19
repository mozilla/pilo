# Use Node.js LTS version
FROM node:22-slim

# Install pnpm
RUN npm install -g pnpm

# Build argument to control Playwright installation
ARG INSTALL_PLAYWRIGHT_BROWSERS=false

# Set working directory to repo root
WORKDIR /app

# Copy workspace manifests so pnpm can resolve the workspace graph
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all package manifests before installing so pnpm can link the workspace
COPY packages/core/package.json ./packages/core/package.json
COPY packages/cli/package.json ./packages/cli/package.json
COPY packages/server/package.json ./packages/server/package.json
COPY packages/extension/package.json ./packages/extension/package.json

# Install all workspace dependencies
RUN pnpm install --frozen-lockfile

# Copy core source and build it (server depends on pilo-core)
COPY packages/core/ ./packages/core/
RUN pnpm --filter pilo-core run build

# Install Playwright system dependencies as root (requires apt)
RUN if [ "$INSTALL_PLAYWRIGHT_BROWSERS" = "true" ]; then \
    npx playwright install-deps firefox chromium; \
    fi

# Copy server source and build
COPY packages/server/ ./packages/server/
RUN pnpm --filter pilo-server run build

# Expose the port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Ensure node user owns the app files
RUN chown -R node:node /app

# Switch to non-root user (node user is already available in node:22-slim)
USER node

# Install Playwright browsers as node user (so they end up in /home/node/.cache)
# Note: ARG must be redeclared after USER to be accessible (with same default)
ARG INSTALL_PLAYWRIGHT_BROWSERS=false
RUN if [ "$INSTALL_PLAYWRIGHT_BROWSERS" = "true" ]; then \
    npx playwright install firefox chromium; \
    fi

# Start the server from the workspace root so pnpm resolves the filter correctly
WORKDIR /app/packages/server
CMD ["pnpm", "start"]
