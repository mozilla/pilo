import "./loadEnv.js";
import { initTelemetry } from "./telemetry.js";

// Initialize OTel SDK before app creation
initTelemetry();

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { cors } from "hono/cors";
import { sentry } from "@hono/sentry";
import piloRoutes from "./routes/pilo.js";
import { setDraining, getActiveTasks } from "./concurrencyGuard.js";
import { registerHealthRoutes } from "./health.js";
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

// Liveness (/health) and readiness (/ready) probes.
registerHealthRoutes(app);

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

// How long to wait for in-flight tasks to complete before forcing shutdown.
// Override via PILO_DRAIN_TIMEOUT_MS. Default is 60s, suitable for most
// deployments. Increase for workloads with longer task durations.
const DRAIN_TIMEOUT_MS = Number(process.env.PILO_DRAIN_TIMEOUT_MS ?? 60_000);

function closeActiveConnections() {
  for (const ws of activeConnections) {
    try {
      ws.close(1001, "Server shutting down");
    } catch {
      // ignore errors on already-closed connections
    }
  }
}

// Graceful shutdown: stop accepting new tasks, wait for in-flight tasks to
// finish, then close remaining connections and exit.
process.on("SIGTERM", () => {
  console.log(
    `[pilo] SIGTERM received, draining in-flight tasks (timeout: ${DRAIN_TIMEOUT_MS}ms)...`,
  );

  setDraining(); // refuse new task:details messages
  server.close(); // stop accepting new HTTP/WS connections

  const deadline = Date.now() + DRAIN_TIMEOUT_MS;

  const poll = setInterval(() => {
    const remaining = getActiveTasks();
    if (remaining === 0) {
      clearInterval(poll);
      console.log("[pilo] All tasks complete, shutting down.");
      process.exit(0);
    }
    if (Date.now() >= deadline) {
      clearInterval(poll);
      console.log(
        `[pilo] Drain timeout reached with ${remaining} task(s) still active, shutting down.`,
      );
      closeActiveConnections();
      process.exit(0);
    }
    console.log(`[pilo] Draining... ${remaining} task(s) remaining.`);
  }, 1_000);
});
