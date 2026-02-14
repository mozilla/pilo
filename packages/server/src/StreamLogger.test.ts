import { describe, it, expect, vi } from "vitest";
import { StreamLogger } from "./StreamLogger.js";
import { EventEmitter } from "events";

// Mock WebAgentEventEmitter
class MockWebAgentEventEmitter extends EventEmitter {
  onEvent(eventType: string, handler: (data: any) => void) {
    this.on(eventType, handler);
  }

  offEvent(eventType: string, handler: (data: any) => void) {
    this.off(eventType, handler);
  }

  emitEvent(eventType: string, data: any) {
    this.emit(eventType, data);
  }
}

describe("StreamLogger", () => {
  it("should create a StreamLogger instance", () => {
    const mockSendEvent = vi.fn();
    const logger = new StreamLogger(mockSendEvent);

    expect(logger).toBeDefined();
    expect(logger).toBeInstanceOf(StreamLogger);
  });

  it("should forward events to the provided sender function", async () => {
    const mockSendEvent = vi.fn().mockResolvedValue(undefined);
    const logger = new StreamLogger(mockSendEvent);
    const mockEmitter = new MockWebAgentEventEmitter();

    // Initialize the logger with the mock emitter
    logger.initialize(mockEmitter as any);

    // Emit an event that should be forwarded
    mockEmitter.emit("*", "test-event", { data: "test" });

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSendEvent).toHaveBeenCalledWith("test-event", { data: "test" });
  });

  it("should handle multiple events", async () => {
    const mockSendEvent = vi.fn().mockResolvedValue(undefined);
    const logger = new StreamLogger(mockSendEvent);
    const mockEmitter = new MockWebAgentEventEmitter();

    logger.initialize(mockEmitter as any);

    mockEmitter.emit("*", "event1", { data: "first" });
    mockEmitter.emit("*", "event2", { data: "second" });

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSendEvent).toHaveBeenCalledTimes(2);
    expect(mockSendEvent).toHaveBeenNthCalledWith(1, "event1", { data: "first" });
    expect(mockSendEvent).toHaveBeenNthCalledWith(2, "event2", { data: "second" });
  });

  it("should handle async send event function", async () => {
    const mockSendEvent = vi
      .fn()
      .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 10)));
    const logger = new StreamLogger(mockSendEvent);
    const mockEmitter = new MockWebAgentEventEmitter();

    logger.initialize(mockEmitter as any);

    mockEmitter.emit("*", "async-event", { data: "async-test" });

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockSendEvent).toHaveBeenCalledWith("async-event", { data: "async-test" });
  });

  it("should dispose properly", () => {
    const mockSendEvent = vi.fn();
    const logger = new StreamLogger(mockSendEvent);
    const mockEmitter = new MockWebAgentEventEmitter();

    logger.initialize(mockEmitter as any);

    expect(() => logger.dispose()).not.toThrow();
  });

  it("should exclude screenshot image events by default", async () => {
    const mockSendEvent = vi.fn().mockResolvedValue(undefined);
    const logger = new StreamLogger(mockSendEvent);
    const mockEmitter = new MockWebAgentEventEmitter();

    logger.initialize(mockEmitter as any);

    // Emit screenshot image event
    mockEmitter.emit("*", "browser:screenshot_captured_image", {
      image: "base64-encoded-data",
      mediaType: "image/jpeg",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Should not be forwarded
    expect(mockSendEvent).not.toHaveBeenCalled();
  });

  it("should include screenshot image events when opted in", async () => {
    const mockSendEvent = vi.fn().mockResolvedValue(undefined);
    const logger = new StreamLogger({
      sendEvent: mockSendEvent,
      includeScreenshotImages: true,
    });
    const mockEmitter = new MockWebAgentEventEmitter();

    logger.initialize(mockEmitter as any);

    // Emit screenshot image event
    mockEmitter.emit("*", "browser:screenshot_captured_image", {
      image: "base64-encoded-data",
      mediaType: "image/jpeg",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Should be forwarded
    expect(mockSendEvent).toHaveBeenCalledWith("browser:screenshot_captured_image", {
      image: "base64-encoded-data",
      mediaType: "image/jpeg",
    });
  });

  it("should maintain backward compatibility with function parameter", async () => {
    const mockSendEvent = vi.fn().mockResolvedValue(undefined);
    // Old-style: pass function directly
    const logger = new StreamLogger(mockSendEvent);
    const mockEmitter = new MockWebAgentEventEmitter();

    logger.initialize(mockEmitter as any);

    // Emit a regular event
    mockEmitter.emit("*", "test-event", { data: "test" });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Should work as before
    expect(mockSendEvent).toHaveBeenCalledWith("test-event", { data: "test" });
  });
});
