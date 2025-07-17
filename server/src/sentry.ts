import * as Sentry from "@sentry/node";

export function initializeSentry(): void {
  const sentryDsn = process.env.SENTRY_DSN;

  if (!sentryDsn) {
    console.log("Sentry DSN not found, skipping Sentry initialization");
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 1.0,
    integrations: [Sentry.httpIntegration(), Sentry.nativeNodeFetchIntegration()],
  });

  console.log("Sentry initialized successfully");
}

export { Sentry };
