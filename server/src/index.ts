import "dotenv/config";
import { initializeSentry } from "./sentry.js";

// Initialize Sentry as early as possible
initializeSentry();

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import sparkRoutes from "./routes/spark.js";
import { Sentry } from "./sentry.js";

const app = new Hono();

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

// Error handling middleware for Sentry
app.onError((err, c) => {
  // Capture the error with Sentry if it's initialized
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err);
  }

  console.error("Server error:", err);

  return c.json(
    {
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    },
    500,
  );
});

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Basic info endpoint
app.get("/", (c) => {
  return c.json({
    name: "Spark Server",
    version: "0.1.0",
    description: "Web server for Spark AI-powered web automation",
  });
});

// Mount Spark routes
app.route("/spark", sparkRoutes);

const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Spark Server starting on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
