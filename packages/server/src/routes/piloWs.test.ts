import { describe, it, expect } from "vitest";
import { parseClientMessage, InputResponseRegistry, serializeMessage } from "./piloWs.js";

describe("parseClientMessage", () => {
  it("returns a TaskStartMessage for a valid task:start message", () => {
    const raw = JSON.stringify({
      event: "task:start",
      data: { task: "Do something" },
    });
    const result = parseClientMessage(raw);
    expect(result).toEqual({
      event: "task:start",
      data: { task: "Do something" },
    });
  });

  it("returns an InputFormResponseMessage for a valid input:form_response message", () => {
    const raw = JSON.stringify({
      event: "input:form_response",
      data: {
        questionId: "q1",
        response: { type: "form", fields: { name: "Alice" } },
      },
    });
    const result = parseClientMessage(raw);
    expect(result).toEqual({
      event: "input:form_response",
      data: {
        questionId: "q1",
        response: { type: "form", fields: { name: "Alice" } },
      },
    });
  });

  it("returns null for an unknown event type", () => {
    const raw = JSON.stringify({ event: "unknown:event", data: {} });
    expect(parseClientMessage(raw)).toBeNull();
  });

  it("returns null for a message missing the event field", () => {
    const raw = JSON.stringify({ data: { task: "Do something" } });
    expect(parseClientMessage(raw)).toBeNull();
  });

  it("returns null for a non-object event field", () => {
    const raw = JSON.stringify({ event: 123, data: {} });
    expect(parseClientMessage(raw)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseClientMessage("not json")).toBeNull();
  });
});

describe("InputResponseRegistry", () => {
  it("should resolve a pending request when response is delivered", async () => {
    const registry = new InputResponseRegistry();
    const responsePromise = registry.waitForResponse("q1");
    const delivered = registry.deliver("q1", {
      type: "form",
      fields: { email: "test@test.com" },
    });
    expect(delivered).toBe(true);
    const response = await responsePromise;
    expect(response).toEqual({
      type: "form",
      fields: { email: "test@test.com" },
    });
  });

  it("should return false when delivering to unknown questionId", () => {
    const registry = new InputResponseRegistry();
    const delivered = registry.deliver("unknown", {
      type: "form",
      fields: {},
    });
    expect(delivered).toBe(false);
  });

  it("should handle declined responses", async () => {
    const registry = new InputResponseRegistry();
    const responsePromise = registry.waitForResponse("q1");
    registry.deliver("q1", {
      type: "declined",
      reason: "User refused",
    });
    const response = await responsePromise;
    expect(response).toEqual({
      type: "declined",
      reason: "User refused",
    });
  });

  it("should reject all pending requests on rejectAll", async () => {
    const registry = new InputResponseRegistry();
    const p1 = registry.waitForResponse("q1");
    const p2 = registry.waitForResponse("q2");
    registry.rejectAll("Connection closed");
    const r1 = await p1;
    const r2 = await p2;
    expect(r1).toEqual({ type: "declined", reason: "Connection closed" });
    expect(r2).toEqual({ type: "declined", reason: "Connection closed" });
  });

  it("should not deliver to the same questionId twice", async () => {
    const registry = new InputResponseRegistry();
    const responsePromise = registry.waitForResponse("q1");
    registry.deliver("q1", { type: "form", fields: { a: "1" } });
    const secondDelivery = registry.deliver("q1", {
      type: "form",
      fields: { a: "2" },
    });
    expect(secondDelivery).toBe(false);
    const response = await responsePromise;
    expect(response.type).toBe("form");
  });
});

describe("serializeMessage", () => {
  it("should include event, taskId, and data", () => {
    const result = JSON.parse(
      serializeMessage({
        event: "agent:action",
        taskId: "task_xyz",
        data: { action: "click" },
      }),
    );
    expect(result).toEqual({
      event: "agent:action",
      taskId: "task_xyz",
      data: { action: "click" },
    });
  });

  it("should serialize input:form with timeoutMs", () => {
    const result = JSON.parse(
      serializeMessage({
        event: "input:form",
        taskId: "task_abc",
        data: {
          questionId: "q1",
          question: "Enter credentials",
          fields: [{ name: "email", label: "Email" }],
          timeoutMs: 120000,
        },
      }),
    );
    expect(result.event).toBe("input:form");
    expect(result.taskId).toBe("task_abc");
    expect(result.data.timeoutMs).toBe(120000);
  });
});
