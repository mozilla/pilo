import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import sparkRoutes from "./routes/spark.js";

const app = new Hono();

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
