import { describe, it, expect } from "vitest";
import { scrubBeforeBreadcrumb, scrubBeforeSend } from "../../src/middleware/sentryScrubber.js";
import type { Breadcrumb, ErrorEvent } from "@sentry/types";

const SENTINEL = "SENSITIVE-CANARY-q4r7";

describe("scrubBeforeSend", () => {
  it("strips request.data (request body)", () => {
    const event: ErrorEvent = {
      request: {
        method: "POST",
        url: "https://api.example.com/pilo/run",
        data: { task: SENTINEL, secret: "abc" },
      },
    };
    const result = scrubBeforeSend(event);
    expect(result.request?.data).toBeUndefined();
  });

  it("strips request.query_string", () => {
    const event: ErrorEvent = {
      request: { query_string: `token=${SENTINEL}` },
    };
    const result = scrubBeforeSend(event);
    expect(result.request?.query_string).toBeUndefined();
  });

  it("strips request.cookies", () => {
    const event: ErrorEvent = {
      request: { cookies: { session: SENTINEL } },
    };
    const result = scrubBeforeSend(event);
    expect(result.request?.cookies).toBeUndefined();
  });

  it("strips Authorization, Cookie, Set-Cookie headers (case-insensitive)", () => {
    const event: ErrorEvent = {
      request: {
        headers: {
          Authorization: `Bearer ${SENTINEL}`,
          cookie: `session=${SENTINEL}`,
          "Set-Cookie": `refresh=${SENTINEL}`,
          "Content-Type": "application/json",
          "X-Custom": "safe-value",
        },
      },
    };
    const result = scrubBeforeSend(event);
    const headers = result.request?.headers ?? {};
    expect(headers.Authorization).toBeUndefined();
    expect(headers.cookie).toBeUndefined();
    expect(headers["Set-Cookie"]).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Custom"]).toBe("safe-value");
  });

  it("reduces exception.value to exception.type (drops error.message)", () => {
    const event: ErrorEvent = {
      exception: {
        values: [
          {
            type: "TypeError",
            value: `Cannot read property of ${SENTINEL}`,
          },
        ],
      },
    };
    const result = scrubBeforeSend(event);
    expect(result.exception?.values?.[0].value).toBe("TypeError");
  });

  it("drops exception.stacktrace (may contain page content via selectors)", () => {
    const event: ErrorEvent = {
      exception: {
        values: [
          {
            type: "Error",
            value: "boom",
            stacktrace: {
              frames: [{ filename: "x", function: `processSelector("${SENTINEL}")` }],
            },
          },
        ],
      },
    };
    const result = scrubBeforeSend(event);
    expect(result.exception?.values?.[0].stacktrace).toBeUndefined();
  });

  it("drops contexts.response.body", () => {
    const event: ErrorEvent = {
      contexts: {
        response: { status_code: 200, body: { task: SENTINEL } },
      },
    };
    const result = scrubBeforeSend(event);
    const response = result.contexts?.response as { body?: unknown };
    expect(response?.body).toBeUndefined();
  });

  it("drops event.extra (arbitrary user-attached data)", () => {
    const event: ErrorEvent = {
      extra: { context: SENTINEL },
    };
    const result = scrubBeforeSend(event);
    expect(result.extra).toBeUndefined();
  });

  it("never lets the sentinel reach the post-scrub event (canary)", () => {
    const event: ErrorEvent = {
      request: {
        data: { task: SENTINEL },
        query_string: `q=${SENTINEL}`,
        cookies: { c: SENTINEL },
        headers: { Authorization: `Bearer ${SENTINEL}` },
      },
      exception: {
        values: [{ type: "Err", value: SENTINEL, stacktrace: { frames: [] } }],
      },
      extra: { foo: SENTINEL },
      contexts: {
        response: { body: SENTINEL },
      },
    };
    const result = scrubBeforeSend(event);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it("preserves bounded metadata (tags, level, environment)", () => {
    const event: ErrorEvent = {
      tags: { taskId: "task-123", phase: "execution", reason: "INTERNAL_ERROR" },
      level: "error",
      environment: "production",
    };
    const result = scrubBeforeSend(event);
    expect(result.tags).toEqual({
      taskId: "task-123",
      phase: "execution",
      reason: "INTERNAL_ERROR",
    });
    expect(result.level).toBe("error");
    expect(result.environment).toBe("production");
  });
});

describe("scrubBeforeBreadcrumb", () => {
  it("drops console breadcrumbs (Sentry auto-captures, often verbose)", () => {
    const breadcrumb: Breadcrumb = {
      category: "console",
      message: "some log",
      data: { args: [SENTINEL] },
    };
    expect(scrubBeforeBreadcrumb(breadcrumb)).toBeNull();
  });

  it("strips disallowed keys from data, keeps allowlisted ones", () => {
    const breadcrumb: Breadcrumb = {
      category: "task",
      message: "task.start",
      data: {
        taskId: "task-123",
        method: "POST",
        route: "/pilo/run",
        url: `https://example.com/${SENTINEL}`,
        body: { task: SENTINEL },
        secret: SENTINEL,
      },
    };
    const result = scrubBeforeBreadcrumb(breadcrumb);
    expect(result?.data).toEqual({
      taskId: "task-123",
      method: "POST",
      route: "/pilo/run",
    });
  });

  it("never lets sentinel data reach the post-scrub breadcrumb (canary)", () => {
    const breadcrumb: Breadcrumb = {
      category: "task",
      message: "anything",
      data: {
        taskId: "task-123",
        url: `https://example.com/${SENTINEL}`,
        body: SENTINEL,
        anything: SENTINEL,
      },
    };
    const result = scrubBeforeBreadcrumb(breadcrumb);
    expect(JSON.stringify(result)).not.toContain(SENTINEL);
  });

  it("returns the breadcrumb unchanged when data is absent", () => {
    const breadcrumb: Breadcrumb = {
      category: "task",
      message: "task.start",
    };
    const result = scrubBeforeBreadcrumb(breadcrumb);
    expect(result).toEqual(breadcrumb);
  });
});
