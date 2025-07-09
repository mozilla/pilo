# Use Node.js LTS version
FROM node:22-slim

# Install pnpm
RUN npm install -g pnpm

# Build argument to control Playwright installation
ARG INSTALL_PLAYWRIGHT_BROWSERS=false

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S spark -u 1001

# Set working directory
WORKDIR /app
RUN chown -R spark:nodejs /app

# Copy root package files and build main spark package
COPY package.json pnpm-lock.yaml ./
COPY src ./src
COPY tsconfig.json ./
RUN pnpm install

# Install Playwright browsers (Firefox and Chromium) if requested
RUN if [ "$INSTALL_PLAYWRIGHT_BROWSERS" = "true" ]; then \
    pnpm exec playwright install --with-deps firefox chromium; \
    fi

RUN pnpm run build

# Now work on the server
WORKDIR /app/server
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install

# Copy server source and build
COPY server/src ./src
COPY server/tsconfig.json ./
RUN pnpm run build

# Expose the port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Switch to non-root user
USER spark

# Start the server
CMD ["pnpm", "start"]