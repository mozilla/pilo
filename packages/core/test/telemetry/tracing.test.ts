import { describe, it, expect, vi, beforeEach } from "vitest";

describe("tracing helpers", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("when @opentelemetry/api is NOT installed", () => {
    beforeEach(() => {
      vi.doMock("@opentelemetry/api", () => {
        throw new Error("Cannot find module '@opentelemetry/api'");
      });
    });

    it("getOTelApi returns undefined", async () => {
      const { getOTelApi } = await import("../../src/telemetry/tracing.js");
      const api = await getOTelApi();
      expect(api).toBeUndefined();
    });

    it("getTracer returns a no-op tracer", async () => {
      const { getTracer } = await import("../../src/telemetry/tracing.js");
      const tracer = await getTracer("test");
      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe("function");
    });

    it("no-op span methods are safe to call", async () => {
      const { getTracer } = await import("../../src/telemetry/tracing.js");
      const tracer = await getTracer("test");
      const span = tracer.startSpan("my-span", {
        attributes: { "test.attr": "value" },
      });

      expect(() => span.setAttribute("key", "value")).not.toThrow();
      expect(() => span.setAttribute("key", 42)).not.toThrow();
      expect(() => span.setAttribute("key", true)).not.toThrow();
      expect(() => span.setStatus({ code: 1 })).not.toThrow();
      expect(() => span.setStatus({ code: 2, message: "error" })).not.toThrow();
      expect(() => span.recordException(new Error("oops"))).not.toThrow();
      expect(() => span.recordException("string error")).not.toThrow();
      expect(() => span.end()).not.toThrow();
    });

    it("no-op span setAttribute returns this for chaining", async () => {
      const { getTracer } = await import("../../src/telemetry/tracing.js");
      const tracer = await getTracer("test");
      const span = tracer.startSpan("my-span");
      const result = span.setAttribute("key", "value");
      expect(result).toBe(span);
    });

    it("no-op span setStatus returns this for chaining", async () => {
      const { getTracer } = await import("../../src/telemetry/tracing.js");
      const tracer = await getTracer("test");
      const span = tracer.startSpan("my-span");
      const result = span.setStatus({ code: 0 });
      expect(result).toBe(span);
    });
  });

  describe("when @opentelemetry/api IS installed", () => {
    beforeEach(() => {
      vi.doUnmock("@opentelemetry/api");
    });

    it("getOTelApi returns the API module", async () => {
      const { getOTelApi } = await import("../../src/telemetry/tracing.js");
      const api = await getOTelApi();
      // @opentelemetry/api is installed as a devDependency, so this should resolve
      expect(api).toBeDefined();
      expect(typeof api).toBe("object");
    });

    it("getTracer returns a real tracer", async () => {
      const { getTracer } = await import("../../src/telemetry/tracing.js");
      const tracer = await getTracer("test-tracer", "1.0.0");
      expect(tracer).toBeDefined();
      expect(typeof tracer.startSpan).toBe("function");
    });
  });

  describe("SpanStatusCode constants", () => {
    it("exports SpanStatusCode with OK=1 and ERROR=2", async () => {
      const { SpanStatusCode } = await import("../../src/telemetry/tracing.js");
      expect(SpanStatusCode.OK).toBe(1);
      expect(SpanStatusCode.ERROR).toBe(2);
    });

    it("SpanStatusCode works without OTel installed", async () => {
      vi.doMock("@opentelemetry/api", () => {
        throw new Error("Cannot find module '@opentelemetry/api'");
      });
      const { SpanStatusCode } = await import("../../src/telemetry/tracing.js");
      expect(SpanStatusCode.OK).toBe(1);
      expect(SpanStatusCode.ERROR).toBe(2);
    });
  });

  describe("caching", () => {
    it("second call to getTracer returns same instance", async () => {
      const { getTracer } = await import("../../src/telemetry/tracing.js");
      const tracer1 = await getTracer("my-lib");
      const tracer2 = await getTracer("my-lib");
      expect(tracer1).toBe(tracer2);
    });

    it("second call to getOTelApi returns same result", async () => {
      const { getOTelApi } = await import("../../src/telemetry/tracing.js");
      const api1 = await getOTelApi();
      const api2 = await getOTelApi();
      expect(api1).toBe(api2);
    });

    it("does not retry after failed import", async () => {
      let callCount = 0;
      vi.doMock("@opentelemetry/api", () => {
        callCount++;
        throw new Error("Cannot find module '@opentelemetry/api'");
      });

      const { getOTelApi } = await import("../../src/telemetry/tracing.js");
      await getOTelApi();
      await getOTelApi();
      await getOTelApi();

      // Module resolution only attempted once (mocking intercepts the import)
      expect(callCount).toBeLessThanOrEqual(1);
    });
  });

  describe("withSpan", () => {
    describe("when @opentelemetry/api is NOT installed", () => {
      beforeEach(() => {
        vi.doMock("@opentelemetry/api", () => {
          throw new Error("Cannot find module '@opentelemetry/api'");
        });
      });

      it("runs the callback with a no-op span", async () => {
        const { withSpan } = await import("../../src/telemetry/tracing.js");
        const result = await withSpan("test.span", {}, async (span) => {
          span.setAttribute("key", "value"); // should not throw
          return 42;
        });
        expect(result).toBe(42);
      });

      it("propagates errors from the callback", async () => {
        const { withSpan } = await import("../../src/telemetry/tracing.js");
        await expect(
          withSpan("test.span", {}, async () => {
            throw new Error("callback error");
          }),
        ).rejects.toThrow("callback error");
      });
    });

    describe("when @opentelemetry/api IS installed", () => {
      it("creates a span and ends it after callback completes", async () => {
        const mockEnd = vi.fn();
        const mockStartSpan = vi.fn(() => ({
          setAttribute: vi.fn().mockReturnThis(),
          setStatus: vi.fn().mockReturnThis(),
          recordException: vi.fn(),
          end: mockEnd,
        }));

        const mockContext = {};
        const mockWithContext = vi.fn((_ctx: any, fn: any) => fn());

        vi.doMock("@opentelemetry/api", () => ({
          trace: {
            getTracer: () => ({ startSpan: mockStartSpan }),
            setSpan: vi.fn(() => mockContext),
          },
          context: {
            active: vi.fn(() => ({})),
            with: mockWithContext,
          },
        }));

        const { withSpan } = await import("../../src/telemetry/tracing.js");
        const result = await withSpan(
          "test.span",
          { attributes: { "test.key": "val" } },
          async (span) => {
            span.setAttribute("extra", "attr");
            return "done";
          },
        );

        expect(result).toBe("done");
        expect(mockStartSpan).toHaveBeenCalledWith("test.span", {
          attributes: { "test.key": "val" },
        });
        expect(mockEnd).toHaveBeenCalled();
        expect(mockWithContext).toHaveBeenCalled();
      });

      it("ends span even when callback throws", async () => {
        const mockEnd = vi.fn();
        const mockStartSpan = vi.fn(() => ({
          setAttribute: vi.fn().mockReturnThis(),
          setStatus: vi.fn().mockReturnThis(),
          recordException: vi.fn(),
          end: mockEnd,
        }));

        vi.doMock("@opentelemetry/api", () => ({
          trace: {
            getTracer: () => ({ startSpan: mockStartSpan }),
            setSpan: vi.fn(() => ({})),
          },
          context: {
            active: vi.fn(() => ({})),
            with: vi.fn((_ctx: any, fn: any) => fn()),
          },
        }));

        const { withSpan } = await import("../../src/telemetry/tracing.js");
        await expect(
          withSpan("test.span", {}, async () => {
            throw new Error("boom");
          }),
        ).rejects.toThrow("boom");

        expect(mockEnd).toHaveBeenCalled();
      });
    });
  });
});
