import { describe, it, expect } from "vitest";
import { reviver } from "../../src/utils/storage.js";

describe("reviver", () => {
  it("should convert ISO date string to Date object when key is timestamp", () => {
    const json = '{"timestamp":"2025-10-02T12:00:00.000Z"}';
    const result = JSON.parse(json, reviver);

    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.timestamp.toISOString()).toBe("2025-10-02T12:00:00.000Z");
  });

  it("should pass through non-timestamp keys unchanged", () => {
    const json = '{"name":"test","count":42,"active":true}';
    const result = JSON.parse(json, reviver);

    expect(result.name).toBe("test");
    expect(result.count).toBe(42);
    expect(result.active).toBe(true);
  });

  it("should handle null/undefined timestamp values", () => {
    const json = '{"timestamp":null}';
    const result = JSON.parse(json, reviver);

    expect(result.timestamp).toBeNull();
  });
});
