import { describe, it, expect } from "vitest";
import { parseClientMessage } from "./piloWs.js";

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
