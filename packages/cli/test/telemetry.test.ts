import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("CLI telemetry setup", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("does nothing when OTEL_EXPORTER_OTLP_ENDPOINT is not set", async () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const { initTelemetry } = await import("../src/telemetry.js");
    const shutdown = initTelemetry();
    expect(shutdown).toBeUndefined();
  });

  it("returns a shutdown function when OTEL_EXPORTER_OTLP_ENDPOINT is set", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318";

    const { initTelemetry } = await import("../src/telemetry.js");
    const shutdown = initTelemetry();
    expect(shutdown).toBeTypeOf("function");

    if (shutdown) await shutdown();
  });
});
