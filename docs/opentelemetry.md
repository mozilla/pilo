# OpenTelemetry Support

Pilo has built-in OpenTelemetry (OTel) support for distributed tracing and metrics. Telemetry is opt-in and zero-overhead when disabled — if the `@opentelemetry/api` package is not installed or no exporter endpoint is configured, all instrumentation becomes no-op.

## Quick Start

### 1. Install OTel dependencies

The `pilo-core` package declares `@opentelemetry/api` as an **optional peer dependency**. To enable telemetry, install it along with an SDK and exporters:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-node \
  @opentelemetry/exporter-trace-otlp-proto \
  @opentelemetry/exporter-metrics-otlp-proto \
  @opentelemetry/resources @opentelemetry/semantic-conventions
```

### 2. Set environment variables

| Variable                      | Required          | Default | Description                                            |
| ----------------------------- | ----------------- | ------- | ------------------------------------------------------ |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Yes (to activate) | —       | OTLP collector endpoint (e.g. `http://localhost:4318`) |
| `OTEL_SERVICE_NAME`           | No                | `pilo`  | Service name in traces and metrics                     |
| `OTEL_METRIC_EXPORT_INTERVAL` | No                | `30000` | Metric export interval in milliseconds                 |

If `OTEL_EXPORTER_OTLP_ENDPOINT` is not set, telemetry is completely disabled.

### 3. Initialize the SDK (server usage)

If you are using `pilo-server`, telemetry is initialized automatically at startup — no code changes needed. Just set the environment variables above.

For custom Node.js applications, initialize the SDK **before** importing Pilo:

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: "my-pilo-app",
  }),
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
  }),
});

sdk.start();

// Now import and use Pilo — spans and metrics will be collected
import { WebAgent, PlaywrightBrowser } from "@tabstack/pilo";
```

## Using OTelMetricsLogger

Pilo's `OTelMetricsLogger` bridges WebAgent lifecycle events into OTel counters and histograms. Pass it as the `logger` option when creating a `WebAgent`:

```typescript
import { WebAgent, PlaywrightBrowser, OTelMetricsLogger } from "@tabstack/pilo";

const browser = new PlaywrightBrowser({
  /* ... */
});
await browser.start();

const agent = new WebAgent({
  browser,
  provider: "openrouter",
  model: "anthropic/claude-sonnet-4-20250514",
  apiKey: process.env.OPENROUTER_API_KEY!,
  logger: new OTelMetricsLogger(),
});

const result = await agent.execute("Search for Pilo on npm");
```

When `@opentelemetry/api` is not installed, `OTelMetricsLogger` becomes inert — no listeners are registered and no overhead is incurred.

## What Gets Instrumented

### Traces (Spans)

All spans use the `pilo-core` tracer.

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

### Metrics

All metrics use the `pilo-core` meter. Metrics are only active when `OTelMetricsLogger` is used as the logger.

**Counters:**

| Metric                       | Unit        | Description                                                 |
| ---------------------------- | ----------- | ----------------------------------------------------------- |
| `pilo.task.count`            | tasks       | Total tasks completed or aborted                            |
| `pilo.task.success`          | tasks       | Successfully completed tasks                                |
| `pilo.task.failure`          | tasks       | Failed or aborted tasks                                     |
| `pilo.agent.steps`           | steps       | Agent iteration steps                                       |
| `pilo.ai.generations`        | generations | AI generation calls                                         |
| `pilo.ai.errors`             | errors      | AI generation errors                                        |
| `pilo.ai.tokens.input`       | tokens      | Input tokens consumed                                       |
| `pilo.ai.tokens.output`      | tokens      | Output tokens consumed                                      |
| `pilo.browser.actions`       | actions     | Browser actions completed                                   |
| `pilo.browser.action.errors` | errors      | Failed browser actions                                      |
| `pilo.browser.navigations`   | navigations | Page navigations                                            |
| `pilo.browser.screenshots`   | screenshots | Screenshots captured                                        |
| `pilo.browser.reconnects`    | reconnects  | Browser reconnections                                       |
| `pilo.cdp.endpoint_cycles`   | cycles      | CDP endpoint failover cycles                                |
| `pilo.validation.quality`    | validations | Task validations (with `pilo.validation.quality` attribute) |

**Histograms:**

| Metric                         | Unit | Description                        |
| ------------------------------ | ---- | ---------------------------------- |
| `pilo.task.duration`           | ms   | End-to-end task duration           |
| `pilo.browser.action.duration` | ms   | Individual browser action duration |

All metrics include `pilo.provider` and `pilo.model` attributes when available (captured from the task setup event).

## Local Development with Jaeger

[Jaeger](https://www.jaegertracing.io/) is an open-source tracing backend that works well for local development.

### docker-compose.yml

```yaml
services:
  jaeger:
    image: jaegertracing/jaeger:2
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
│    ├── getTracer() ──► spans (trace API)            │
│    │     └── no-op if @opentelemetry/api missing    │
│    │                                                │
│    └── EventEmitter ──► OTelMetricsLogger           │
│                           └── counters/histograms   │
│                                (metrics API)        │
│                                                     │
│  @opentelemetry/api is an optional peer dep         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  pilo-server                                        │
│                                                     │
│  initTelemetry()                                    │
│    └── NodeSDK + OTLP exporters                     │
│         (activates only if OTEL_EXPORTER_OTLP_      │
│          ENDPOINT is set)                           │
└─────────────────────────────────────────────────────┘
```

- **Tracing** is built into core and works automatically when the OTel SDK is active.
- **Metrics** require passing `OTelMetricsLogger` as the `logger` option to `WebAgent`.
- Both degrade gracefully to no-ops when OTel is not available.
