# OpenTelemetry Support

Pilo has built-in OpenTelemetry (OTel) support for distributed tracing. Telemetry is opt-in and zero-overhead when disabled — if the `@opentelemetry/api` package is not installed or no exporter endpoint is configured, all instrumentation becomes no-op.

## Quick Start

### 1. Install OTel dependencies

The `pilo-core` package declares `@opentelemetry/api` as an **optional peer dependency**. To enable telemetry, install it along with an SDK and exporters:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node \
  @opentelemetry/exporter-trace-otlp-proto \
  @opentelemetry/resources @opentelemetry/semantic-conventions
```

### 2. Set environment variables

| Variable                      | Required          | Default | Description                                            |
| ----------------------------- | ----------------- | ------- | ------------------------------------------------------ |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Yes (to activate) | —       | OTLP collector endpoint (e.g. `http://localhost:4318`) |
| `OTEL_SERVICE_NAME`           | No                | `pilo`  | Service name in traces                                 |

If `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, telemetry is completely disabled.

### 3. Initialize the SDK (server usage)

If you are using `pilo-server`, telemetry is initialized automatically at startup — no code changes needed. Just set the environment variables above.

For custom Node.js applications, initialize the SDK **before** importing Pilo:

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "my-pilo-app",
  }),
  traceExporter: new OTLPTraceExporter(),
});

sdk.start();

// Now import and use Pilo — spans will be collected
import { WebAgent, PlaywrightBrowser } from "@tabstack/pilo";
```

## What Gets Instrumented

### Traces (Spans)

All spans use the `pilo-core` tracer and form a connected hierarchy via automatic context propagation:

```
pilo.task.execute (root)
├── pilo.task.plan
│   └── pilo.ai.generate
├── pilo.browser.navigate
├── pilo.agent.step (per iteration)
│   ├── pilo.browser.snapshot
│   ├── pilo.ai.generate
│   │   ├── pilo.browser.action
│   │   │   └── pilo.browser.perform
│   │   └── pilo.search.execute
│   └── pilo.task.validate
│       └── pilo.ai.generate
└── pilo.browser.reconnect (on error recovery)
```

| Span Name                 | Location          | Key Attributes                                                                               |
| ------------------------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `pilo.task.execute`       | WebAgent          | `pilo.task`, `pilo.url`, `pilo.task.success`                                                 |
| `pilo.task.plan`          | WebAgent          | `pilo.task`, `pilo.url`, `pilo.plan.has_url`                                                 |
| `pilo.agent.step`         | WebAgent          | `pilo.step.number`, `pilo.step.iteration_id`                                                 |
| `pilo.ai.generate`        | WebAgent / retry  | `pilo.ai.finish_reason`, `pilo.ai.attempts`, `pilo.ai.input_tokens`, `pilo.ai.output_tokens` |
| `pilo.task.validate`      | WebAgent          | `pilo.validation.attempt`, `pilo.validation.quality`, `pilo.validation.accepted`             |
| `pilo.browser.reconnect`  | WebAgent          | `pilo.cdp.endpoint_index`, `pilo.cdp.total`                                                  |
| `pilo.browser.action`     | webActionTools    | `pilo.browser.action_type`, `pilo.browser.element_ref`, `pilo.browser.success`               |
| `pilo.browser.perform`    | PlaywrightBrowser | `pilo.browser.action_type`, `pilo.browser.element_ref`                                       |
| `pilo.browser.navigate`   | PlaywrightBrowser | `pilo.browser.url`                                                                           |
| `pilo.browser.screenshot` | PlaywrightBrowser | —                                                                                            |
| `pilo.browser.snapshot`   | PlaywrightBrowser | —                                                                                            |
| `pilo.search.execute`     | searchTools       | `pilo.search.query`, `pilo.search.success`                                                   |

Error handling: all spans call `span.setStatus(ERROR)` and `span.recordException()` for non-recoverable errors. Recoverable errors (e.g., browser element not found, search failures) are recorded for observability but do not set the span status to ERROR, since the LLM handles retries.

### Distributed Tracing

When pilo-server receives requests with W3C Trace Context headers (`traceparent`, `tracestate`), it automatically joins the caller's trace. This enables end-to-end tracing across services — e.g., an upstream API server → pilo-server → browser operations all appear as one connected trace.

## Local Development with Jaeger

[Jaeger](https://www.jaegertracing.io/) is an open-source tracing backend that works well for local development.

### docker-compose.yml

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686" # Jaeger UI
      - "4317:4317" # OTLP gRPC
      - "4318:4318" # OTLP HTTP
    environment:
      - COLLECTOR_OTLP_ENABLED=true
```

```bash
docker compose up -d
```

Then run Pilo with:

```bash
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm run dev:server
```

Open http://localhost:16686 to view traces in the Jaeger UI.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  pilo-core                                          │
│                                                     │
│  WebAgent / Browser / Tools                         │
│    │                                                │
│    └── withSpan() ──► spans (trace API)             │
│          ├── automatic parent-child context          │
│          └── no-op if @opentelemetry/api missing    │
│                                                     │
│  @opentelemetry/api is an optional peer dep         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  pilo-server                                        │
│                                                     │
│  initTelemetry()                                    │
│    └── NodeSDK + OTLP trace exporter                │
│         (activates only if OTEL_EXPORTER_OTLP_      │
│          ENDPOINT is set)                           │
│                                                     │
│  withRemoteContext()                                │
│    └── Extracts W3C traceparent from incoming       │
│         requests for distributed tracing            │
└─────────────────────────────────────────────────────┘
```
