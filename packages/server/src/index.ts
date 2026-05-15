import "dotenv/config";
import { initTelemetry } from "./telemetry.js";

// Initialize OTel SDK before app creation
initTelemetry();

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { cors } from "hono/cors";
import { sentry } from "@hono/sentry";
import piloRoutes, { isAtCapacity } from "./routes/pilo.js";
import { createPiloWsRoute, type ActiveWS } from "./routes/piloWs.js";

const app = new Hono();

// Create WebSocket support
const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

// Add Sentry middleware
app.use(
  "*",
  sentry({
    dsn: process.env.SENTRY_DSN,
  }),
);

// Add CORS middleware
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Type"],
    credentials: false,
  }),
);

// Liveness: is the process alive?
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Readiness: should this pod receive traffic?
// Returns 503 when at concurrency limit so the load balancer stops routing here.
app.get("/ready", (c) => {
  if (isAtCapacity()) {
    return c.json({ status: "at capacity" }, 503);
  }
  return c.json({ status: "ok" });
});

// Basic info endpoint
app.get("/", (c) => {
  return c.json({
    name: "Pilo Server",
    version: "0.1.0",
    description: "Web server for Pilo AI-powered web automation",
  });
});

// Mount SSE routes (legacy, non-interactive)
app.route("/pilo", piloRoutes);

// Track active WebSocket connections for graceful shutdown
const activeConnections = new Set<ActiveWS>();

// Mount WebSocket routes (interactive)
app.route("/pilo", createPiloWsRoute(upgradeWebSocket, activeConnections));

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Pilo Server starting on port ${port}`);

const server = serve({
  fetch: app.fetch,
  port,
});

// Inject WebSocket support into the HTTP server
injectWebSocket(server);

// Graceful shutdown: send close frames to all active WebSocket connections before exiting
// so that clients (e.g. tabs-api) receive code 1001 rather than an abrupt 1006.
process.on("SIGTERM", () => {
  console.log("[pilo] SIGTERM received, closing active WebSocket connections...");
  for (const ws of activeConnections) {
    try {
      ws.close(1001, "Server shutting down");
    } catch {
      // ignore errors on already-closed connections
    }
  }
  server.close();
  // Safety valve: if the event loop hasn't drained after 10s, exit cleanly.
  setTimeout(() => process.exit(0), 10_000).unref();
});
