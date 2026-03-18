import { describe, it, expect, vi } from "vitest";
import { createTabstackClient } from "../../src/tabstack/client.js";
import Tabstack from "@tabstack/sdk";

vi.mock("@tabstack/sdk", () => {
  const MockTabstack = vi.fn();
  return { default: MockTabstack };
});

describe("createTabstackClient", () => {
  it("should create a Tabstack instance with the provided API key", () => {
    createTabstackClient("test-api-key-123");

    expect(Tabstack).toHaveBeenCalledWith({
      apiKey: "test-api-key-123",
      baseURL: null,
    });
  });

  it("should pass baseURL when provided", () => {
    createTabstackClient("test-api-key-123", "http://127.0.0.1:8080");

    expect(Tabstack).toHaveBeenCalledWith({
      apiKey: "test-api-key-123",
      baseURL: "http://127.0.0.1:8080",
    });
  });

  it("should return the created instance", () => {
    const instance = createTabstackClient("key-456");
    expect(instance).toBeDefined();
  });
});
