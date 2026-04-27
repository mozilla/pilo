import "dotenv/config";
import { initTelemetry } from "./telemetry.js";

// Initialize OTel SDK before app creation
initTelemetry();

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { cors } from "hono/cors";
import { sentry } from "@hono/sentry";
import { requestLog } from "./middleware/requestLog.js";
import { sentryContext } from "./middleware/sentryContext.js";
import { scrubBeforeBreadcrumb, scrubBeforeSend } from "./middleware/sentryScrubber.js";
import piloRoutes from "./routes/pilo.js";
import { createPiloWsRoute } from "./routes/piloWs.js";

const app = new Hono();

// Create WebSocket support
const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

// Add Sentry middleware. Scrubbers run on every event/breadcrumb before
// transport so user content never leaves the process via Sentry.
app.use(
  "*",
  sentry({
    dsn: process.env.SENTRY_DSN,
    beforeSend: scrubBeforeSend,
    beforeBreadcrumb: scrubBeforeBreadcrumb,
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

// Structured request access log (metadata only — no path/body/headers/IP).
app.use("*", requestLog());

// Sentry per-request scope tags (taskId, method, route, status).
app.use("*", sentryContext());

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
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

// Mount WebSocket routes (interactive)
app.route("/pilo", createPiloWsRoute(upgradeWebSocket));

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Pilo Server starting on port ${port}`);

const server = serve({
  fetch: app.fetch,
  port,
});

// Inject WebSocket support into the HTTP server
injectWebSocket(server);
