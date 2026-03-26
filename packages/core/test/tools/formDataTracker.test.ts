import { describe, it, expect, beforeEach } from "vitest";
import { FormDataTracker } from "../../src/tools/formDataTracker.js";

describe("FormDataTracker", () => {
  let tracker: FormDataTracker;

  beforeEach(() => {
    tracker = new FormDataTracker();
  });

  it("should report unsourced fields as not sourced", () => {
    expect(tracker.isFieldSourced("E42")).toBe(false);
  });

  it("should track sourced fields", () => {
    tracker.sourceField("E42", "user@example.com");
    expect(tracker.isFieldSourced("E42")).toBe(true);
  });

  it("should not report other refs as sourced", () => {
    tracker.sourceField("E42", "user@example.com");
    expect(tracker.isFieldSourced("E99")).toBe(false);
  });

  it("should track multiple fields", () => {
    tracker.sourceField("E42", "user@example.com");
    tracker.sourceField("E43", "s3cret");
    expect(tracker.isFieldSourced("E42")).toBe(true);
    expect(tracker.isFieldSourced("E43")).toBe(true);
  });

  it("should clear all sourced fields", () => {
    tracker.sourceField("E42", "user@example.com");
    tracker.sourceField("E43", "s3cret");
    tracker.clear();
    expect(tracker.isFieldSourced("E42")).toBe(false);
    expect(tracker.isFieldSourced("E43")).toBe(false);
  });

  it("should allow re-sourcing after clear", () => {
    tracker.sourceField("E42", "old@example.com");
    tracker.clear();
    tracker.sourceField("E42", "new@example.com");
    expect(tracker.isFieldSourced("E42")).toBe(true);
  });
});
