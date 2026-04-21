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

  describe("recordSanitizedException", () => {
    it("sets pilo.error.class from error constructor name", async () => {
      const mockSetAttribute = vi.fn().mockReturnThis();
      const mockAddEvent = vi.fn();
      const span = {
        setAttribute: mockSetAttribute,
        setStatus: vi.fn().mockReturnThis(),
        recordException: vi.fn(),
        addEvent: mockAddEvent,
        end: vi.fn(),
      };

      const { recordSanitizedException } = await import("../../src/telemetry/tracing.js");
      recordSanitizedException(span as any, new TypeError("bad"));

      expect(mockSetAttribute).toHaveBeenCalledWith("pilo.error.class", "TypeError");
    });

    it("emits an OTel exception event with only exception.type", async () => {
      const mockAddEvent = vi.fn();
      const span = {
        setAttribute: vi.fn().mockReturnThis(),
        setStatus: vi.fn().mockReturnThis(),
        recordException: vi.fn(),
        addEvent: mockAddEvent,
        end: vi.fn(),
      };

      const { recordSanitizedException } = await import("../../src/telemetry/tracing.js");
      recordSanitizedException(span as any, new TypeError("bad"));

      expect(mockAddEvent).toHaveBeenCalledWith("exception", { "exception.type": "TypeError" });
    });

    it("never emits exception.message or exception.stacktrace", async () => {
      const mockAddEvent = vi.fn();
      const span = {
        setAttribute: vi.fn().mockReturnThis(),
        setStatus: vi.fn().mockReturnThis(),
        recordException: vi.fn(),
        addEvent: mockAddEvent,
        end: vi.fn(),
      };

      const { recordSanitizedException } = await import("../../src/telemetry/tracing.js");
      recordSanitizedException(span as any, new Error("DO NOT LOG THIS SENTINEL"));

      for (const call of mockAddEvent.mock.calls) {
        const attrs = (call[1] as Record<string, unknown>) ?? {};
        expect(attrs).not.toHaveProperty("exception.message");
        expect(attrs).not.toHaveProperty("exception.stacktrace");
      }
      const allCalls = JSON.stringify([
        mockAddEvent.mock.calls,
        (span.setAttribute as any).mock.calls,
      ]);
      expect(allCalls).not.toContain("DO NOT LOG THIS SENTINEL");
    });

    it("never calls span.recordException (avoids OTel's default message+stack emission)", async () => {
      const mockRecordException = vi.fn();
      const span = {
        setAttribute: vi.fn().mockReturnThis(),
        setStatus: vi.fn().mockReturnThis(),
        recordException: mockRecordException,
        addEvent: vi.fn(),
        end: vi.fn(),
      };

      const { recordSanitizedException } = await import("../../src/telemetry/tracing.js");
      recordSanitizedException(span as any, new Error("anything"));

      expect(mockRecordException).not.toHaveBeenCalled();
    });

    it("sets class to 'Unknown' for non-Error throws", async () => {
      const mockSetAttribute = vi.fn().mockReturnThis();
      const mockAddEvent = vi.fn();
      const span = {
        setAttribute: mockSetAttribute,
        setStatus: vi.fn().mockReturnThis(),
        recordException: vi.fn(),
        addEvent: mockAddEvent,
        end: vi.fn(),
      };

      const { recordSanitizedException } = await import("../../src/telemetry/tracing.js");
      recordSanitizedException(span as any, "a string");

      expect(mockSetAttribute).toHaveBeenCalledWith("pilo.error.class", "Unknown");
      expect(mockAddEvent).toHaveBeenCalledWith("exception", { "exception.type": "Unknown" });
    });

    it("sets pilo.error.code when opts.code is provided", async () => {
      const mockSetAttribute = vi.fn().mockReturnThis();
      const span = {
        setAttribute: mockSetAttribute,
        setStatus: vi.fn().mockReturnThis(),
        recordException: vi.fn(),
        addEvent: vi.fn(),
        end: vi.fn(),
      };

      const { recordSanitizedException } = await import("../../src/telemetry/tracing.js");
      recordSanitizedException(span as any, new Error("x"), { code: "NAVIGATION_TIMEOUT" });

      expect(mockSetAttribute).toHaveBeenCalledWith("pilo.error.code", "NAVIGATION_TIMEOUT");
    });

    it("omits pilo.error.code when opts.code is not provided", async () => {
      const mockSetAttribute = vi.fn().mockReturnThis();
      const span = {
        setAttribute: mockSetAttribute,
        setStatus: vi.fn().mockReturnThis(),
        recordException: vi.fn(),
        addEvent: vi.fn(),
        end: vi.fn(),
      };

      const { recordSanitizedException } = await import("../../src/telemetry/tracing.js");
      recordSanitizedException(span as any, new Error("x"));

      const attrCalls = mockSetAttribute.mock.calls.map((c) => c[0]);
      expect(attrCalls).not.toContain("pilo.error.code");
    });

    it("works with a no-op span when OTel is not installed", async () => {
      vi.doMock("@opentelemetry/api", () => {
        throw new Error("Cannot find module '@opentelemetry/api'");
      });
      const { getTracer, recordSanitizedException } =
        await import("../../src/telemetry/tracing.js");
      const tracer = await getTracer("test");
      const span = tracer.startSpan("s");

      expect(() => recordSanitizedException(span, new Error("x"))).not.toThrow();
    });
  });

  describe("withRemoteContext", () => {
    describe("when @opentelemetry/api is NOT installed", () => {
      beforeEach(() => {
        vi.doMock("@opentelemetry/api", () => {
          throw new Error("Cannot find module '@opentelemetry/api'");
        });
      });

      it("runs the callback directly", async () => {
        const { withRemoteContext } = await import("../../src/telemetry/tracing.js");
        const result = await withRemoteContext({ traceparent: "00-abc-def-01" }, async () => 99);
        expect(result).toBe(99);
      });
    });

    describe("when @opentelemetry/api IS installed", () => {
      it("extracts context from headers and runs callback within it", async () => {
        const mockExtractedCtx = { extracted: true };
        const mockExtract = vi.fn(() => mockExtractedCtx);
        const mockWithContext = vi.fn((_ctx: any, fn: any) => fn());

        vi.doMock("@opentelemetry/api", () => ({
          trace: {
            getTracer: () => ({ startSpan: vi.fn() }),
          },
          context: {
            active: vi.fn(() => ({})),
            with: mockWithContext,
          },
          propagation: {
            extract: mockExtract,
          },
        }));

        const { withRemoteContext } = await import("../../src/telemetry/tracing.js");
        const result = await withRemoteContext(
          { traceparent: "00-abc-def-01", tracestate: "vendor=value" },
          async () => "traced",
        );

        expect(result).toBe("traced");
        expect(mockExtract).toHaveBeenCalledWith(expect.anything(), {
          traceparent: "00-abc-def-01",
          tracestate: "vendor=value",
        });
        expect(mockWithContext).toHaveBeenCalledWith(mockExtractedCtx, expect.any(Function));
      });

      it("filters out undefined header values", async () => {
        const mockExtract = vi.fn(() => ({}));

        vi.doMock("@opentelemetry/api", () => ({
          trace: {
            getTracer: () => ({ startSpan: vi.fn() }),
          },
          context: {
            active: vi.fn(() => ({})),
            with: vi.fn((_ctx: any, fn: any) => fn()),
          },
          propagation: {
            extract: mockExtract,
          },
        }));

        const { withRemoteContext } = await import("../../src/telemetry/tracing.js");
        await withRemoteContext(
          { traceparent: "00-abc-def-01", tracestate: undefined },
          async () => {},
        );

        // Only defined values in the carrier
        const carrier = (mockExtract.mock.calls[0] as any[])[1];
        expect(carrier).toEqual({ traceparent: "00-abc-def-01" });
        expect(carrier).not.toHaveProperty("tracestate");
      });
    });
  });
});
