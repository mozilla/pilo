import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

export function initTelemetry(): (() => Promise<void>) | undefined {
  if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return undefined;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || "pilo-cli";

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter(),
  });

  sdk.start();
  console.log(`[OTel] Telemetry enabled for ${serviceName}`);

  const shutdown = async () => {
    await sdk.shutdown();
  };

  process.on("SIGTERM", () => {
    shutdown().catch((err) => console.error("[OTel] Shutdown error:", err));
  });

  return shutdown;
}
