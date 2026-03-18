import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export function initTelemetry(): (() => Promise<void>) | undefined {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return undefined;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || "tabstack-pilo";
  const metricIntervalMs = Number(process.env.OTEL_METRIC_EXPORT_INTERVAL) || 30_000;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: metricIntervalMs,
    }),
  });

  sdk.start();
  console.log(`[OTel] Telemetry enabled for ${serviceName}`);

  const shutdown = async () => {
    console.log("[OTel] Shutting down telemetry...");
    await sdk.shutdown();
  };

  process.on("SIGTERM", () => {
    shutdown().catch((err) => console.error("[OTel] Shutdown error:", err));
  });

  return shutdown;
}
