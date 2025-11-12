import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SecretsRedactor } from "../src/loggers/secretsRedactor.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../src/events.js";
import type { TaskSetupEventData, TaskStartEventData } from "../src/events.js";
import type { Logger } from "../src/loggers/types.js";

describe("SecretsRedactor", () => {
  let redactor: SecretsRedactor;
  let originalEmitter: WebAgentEventEmitter;
  let mockLogger: Logger;
  let capturedEvents: Array<{ type: string; data: any }>;

  beforeEach(() => {
    capturedEvents = [];

    // Create a mock logger that captures events
    let listener: ((eventType: string, data: any) => void) | undefined;
    let emitterRef: WebAgentEventEmitter | undefined;
    mockLogger = {
      initialize: vi.fn((emitter: WebAgentEventEmitter) => {
        listener = (eventType: string, data: any) => {
          capturedEvents.push({ type: eventType, data });
        };
        emitterRef = emitter;
        emitter.on("*", listener);
      }),
      dispose: vi.fn(() => {
        if (emitterRef && listener) {
          emitterRef.off("*", listener);
        }
        emitterRef = undefined;
        listener = undefined;
      }),
    };

    originalEmitter = new WebAgentEventEmitter();
    redactor = new SecretsRedactor(mockLogger);
    redactor.initialize(originalEmitter);
  });

  afterEach(() => {
    redactor.dispose();
  });

  describe("Secret redaction", () => {
    it("should redact pwEndpoint from TASK_SETUP events", () => {
      const eventData: TaskSetupEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Test task",
        browserName: "playwright:firefox",
        pwEndpoint: "ws://localhost:9222/devtools/browser/secret-id",
      };

      originalEmitter.emitEvent({
        type: WebAgentEventType.TASK_SETUP,
        data: eventData,
      });

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe(WebAgentEventType.TASK_SETUP);
      expect(capturedEvents[0].data.pwEndpoint).toBe("(redacted)");
    });

    it("should redact pwCdpEndpoint from TASK_SETUP events", () => {
      const eventData: TaskSetupEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Test task",
        browserName: "playwright:firefox",
        pwCdpEndpoint: "http://localhost:9222/secret-cdp-endpoint",
      };

      originalEmitter.emitEvent({
        type: WebAgentEventType.TASK_SETUP,
        data: eventData,
      });

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe(WebAgentEventType.TASK_SETUP);
      expect(capturedEvents[0].data.pwCdpEndpoint).toBe("(redacted)");
    });

    it("should redact multiple secret fields simultaneously", () => {
      const eventData: TaskSetupEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Test task",
        browserName: "playwright:firefox",
        pwEndpoint: "ws://localhost:9222/devtools/browser/secret-id",
        pwCdpEndpoint: "http://localhost:9222/secret-cdp-endpoint",
        proxy: "http://proxy.example.com:8080",
      };

      originalEmitter.emitEvent({
        type: WebAgentEventType.TASK_SETUP,
        data: eventData,
      });

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].data.pwEndpoint).toBe("(redacted)");
      expect(capturedEvents[0].data.pwCdpEndpoint).toBe("(redacted)");
    });

    it("should not redact undefined secret fields", () => {
      const eventData: TaskSetupEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Test task",
        browserName: "playwright:firefox",
        pwEndpoint: undefined,
        pwCdpEndpoint: undefined,
      };

      originalEmitter.emitEvent({
        type: WebAgentEventType.TASK_SETUP,
        data: eventData,
      });

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].data.pwEndpoint).toBeUndefined();
      expect(capturedEvents[0].data.pwCdpEndpoint).toBeUndefined();
    });

    it("should not redact empty string secret fields", () => {
      const eventData: TaskSetupEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Test task",
        browserName: "playwright:firefox",
        pwEndpoint: "",
        pwCdpEndpoint: "",
      };

      originalEmitter.emitEvent({
        type: WebAgentEventType.TASK_SETUP,
        data: eventData,
      });

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].data.pwEndpoint).toBe("");
      expect(capturedEvents[0].data.pwCdpEndpoint).toBe("");
    });
  });

  describe("Data preservation", () => {
    it("should preserve non-secret fields from TASK_SETUP events", () => {
      const eventData: TaskSetupEventData = {
        timestamp: 12345,
        iterationId: "test-1",
        task: "Test task",
        browserName: "playwright:firefox",
        vision: true,
        proxy: "http://proxy.example.com:8080",
        pwEndpoint: "ws://localhost:9222/secret",
      };

      originalEmitter.emitEvent({
        type: WebAgentEventType.TASK_SETUP,
        data: eventData,
      });

      expect(capturedEvents).toHaveLength(1);
      const capturedData = capturedEvents[0].data;
      expect(capturedData.timestamp).toBe(12345);
      expect(capturedData.iterationId).toBe("test-1");
      expect(capturedData.task).toBe("Test task");
      expect(capturedData.browserName).toBe("playwright:firefox");
      expect(capturedData.vision).toBe(true);
      expect(capturedData.proxy).toBe("http://proxy.example.com:8080");
    });

    it("should not mutate original event data", () => {
      const eventData: TaskSetupEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Test task",
        browserName: "playwright:firefox",
        pwEndpoint: "ws://localhost:9222/secret",
      };

      const originalPwEndpoint = eventData.pwEndpoint;

      originalEmitter.emitEvent({
        type: WebAgentEventType.TASK_SETUP,
        data: eventData,
      });

      // Original data should not be mutated
      expect(eventData.pwEndpoint).toBe(originalPwEndpoint);

      // But captured data should be redacted
      expect(capturedEvents[0].data.pwEndpoint).toBe("(redacted)");
    });
  });

  describe("Pass-through for non-secret events", () => {
    it("should pass through events with no secret fields unchanged", () => {
      const eventData: TaskStartEventData = {
        timestamp: 12345,
        iterationId: "test-1",
        task: "Test task",
        successCriteria: "Test criteria",
        plan: "Test plan",
        url: "https://example.com",
      };

      originalEmitter.emitEvent({
        type: WebAgentEventType.TASK_STARTED,
        data: eventData,
      });

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].type).toBe(WebAgentEventType.TASK_STARTED);
      expect(capturedEvents[0].data).toEqual(eventData);
    });

    it("should handle event types not in SECRET_FIELDS_BY_EVENT", () => {
      const eventData: TaskStartEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Test task",
        successCriteria: "Test criteria",
        plan: "Test plan",
        url: "https://example.com",
      };

      originalEmitter.emitEvent({
        type: WebAgentEventType.TASK_STARTED,
        data: eventData,
      });

      expect(capturedEvents).toHaveLength(1);
      expect(capturedEvents[0].data).toEqual(eventData);
    });
  });

  describe("Multiple events", () => {
    it("should handle multiple events correctly", () => {
      const setupData: TaskSetupEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Test task",
        browserName: "playwright:firefox",
        pwEndpoint: "ws://localhost:9222/secret",
      };

      const startData: TaskStartEventData = {
        timestamp: Date.now(),
        iterationId: "test-1",
        task: "Test task",
        successCriteria: "Test criteria",
        plan: "Test plan",
        url: "https://example.com",
      };

      originalEmitter.emitEvent({
        type: WebAgentEventType.TASK_SETUP,
        data: setupData,
      });

      originalEmitter.emitEvent({
        type: WebAgentEventType.TASK_STARTED,
        data: startData,
      });

      expect(capturedEvents).toHaveLength(2);

      // First event should have redacted secrets
      expect(capturedEvents[0].type).toBe(WebAgentEventType.TASK_SETUP);
      expect(capturedEvents[0].data.pwEndpoint).toBe("(redacted)");

      // Second event should pass through unchanged
      expect(capturedEvents[1].type).toBe(WebAgentEventType.TASK_STARTED);
      expect(capturedEvents[1].data).toEqual(startData);
    });
  });
});
