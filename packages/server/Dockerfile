# Use Node.js LTS version
FROM node:22-slim

# Install pnpm
RUN npm install -g pnpm

# Build argument to control Playwright installation
ARG INSTALL_PLAYWRIGHT_BROWSERS=false

# Set working directory
WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Copy core package (required by server)
COPY packages/core/package.json packages/core/tsconfig.json packages/core/vitest.config.ts ./packages/core/
COPY packages/core/src ./packages/core/src
COPY packages/core/scripts ./packages/core/scripts

# Copy CLI package files (needed as dependency)
COPY packages/cli/package.json packages/cli/tsconfig.json ./packages/cli/

# Copy server package files
COPY packages/server/package.json packages/server/tsconfig.json packages/server/tsup.config.ts ./packages/server/
COPY packages/server/src ./packages/server/src

# Install all workspace dependencies (skip prepare scripts to avoid build errors)
RUN pnpm install --ignore-scripts

# Install Playwright system dependencies as root (requires apt)
RUN if [ "$INSTALL_PLAYWRIGHT_BROWSERS" = "true" ]; then \
    npx playwright install-deps firefox chromium; \
    fi

# Build core spark package first (required by server)
RUN pnpm --filter spark-core run build

# Build server package
RUN pnpm --filter spark-server run build

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

# Set working directory to server package
WORKDIR /app/packages/server

# Start the server
CMD ["pnpm", "start"]