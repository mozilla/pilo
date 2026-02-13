# Use Node.js LTS version
FROM node:22-slim

# Install pnpm
RUN npm install -g pnpm

# Build argument to control Playwright installation
ARG INSTALL_PLAYWRIGHT_BROWSERS=false

# Set working directory
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json ./
COPY src ./src
RUN pnpm install --frozen-lockfile

# Install Playwright system dependencies as root (requires apt)
RUN if [ "$INSTALL_PLAYWRIGHT_BROWSERS" = "true" ]; then \
    npx playwright install-deps firefox chromium; \
    fi

# Copy server package files
COPY packages/server/package.json /app/packages/server/

# Install server dependencies
WORKDIR /app/packages/server
RUN pnpm install --frozen-lockfile

# Copy server source and build
COPY packages/server/src ./src
COPY packages/server/tsconfig.json ./
RUN pnpm run build

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

# Start the server
CMD ["pnpm", "start"]