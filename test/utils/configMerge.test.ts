import { describe, it, expect } from "vitest";
import { mergeWithDefaults, createNavigationRetryConfig } from "../../src/utils/configMerge.js";
import { getConfigDefaults } from "../../src/config.js";

// Get navigation defaults from schema
const defaults = getConfigDefaults();
const DEFAULT_NAVIGATION_BASE_TIMEOUT_MS = defaults.navigation_timeout_ms;
const DEFAULT_NAVIGATION_MAX_TIMEOUT_MS = defaults.navigation_max_timeout_ms;
const DEFAULT_NAVIGATION_MAX_ATTEMPTS = defaults.navigation_max_attempts;
const DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER = defaults.navigation_timeout_multiplier;

describe("mergeWithDefaults", () => {
  it("should return defaults when overrides is undefined", () => {
    const defaults = { a: 1, b: 2 };
    const result = mergeWithDefaults(defaults, undefined);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("should return defaults when overrides is null", () => {
    const defaults = { a: 1, b: 2 };
    const result = mergeWithDefaults(defaults, null);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("should merge overrides with defaults", () => {
    const defaults = { a: 1, b: 2, c: 3 };
    const overrides = { b: 20, c: 30 };
    const result = mergeWithDefaults(defaults, overrides);
    expect(result).toEqual({ a: 1, b: 20, c: 30 });
  });

  it("should filter out undefined values from overrides", () => {
    const defaults = { a: 1, b: 2, c: 3 };
    const overrides = { a: undefined, b: 20 };
    const result = mergeWithDefaults(defaults, overrides);
    expect(result).toEqual({ a: 1, b: 20, c: 3 });
  });

  it("should filter out null values from overrides", () => {
    const defaults = { a: 1, b: 2, c: 3 };
    const overrides = { a: null, b: 20 } as any;
    const result = mergeWithDefaults(defaults, overrides);
    expect(result).toEqual({ a: 1, b: 20, c: 3 });
  });

  it("should preserve 0 values in overrides", () => {
    const defaults = { timeout: 30000 };
    const overrides = { timeout: 0 };
    const result = mergeWithDefaults(defaults, overrides);
    expect(result).toEqual({ timeout: 0 });
  });

  it("should preserve false values in overrides", () => {
    const defaults = { enabled: true };
    const overrides = { enabled: false };
    const result = mergeWithDefaults(defaults, overrides);
    expect(result).toEqual({ enabled: false });
  });

  it("should preserve empty string values in overrides", () => {
    const defaults = { name: "default" };
    const overrides = { name: "" };
    const result = mergeWithDefaults(defaults, overrides);
    expect(result).toEqual({ name: "" });
  });
});

describe("createNavigationRetryConfig", () => {
  it("should return all defaults when no overrides provided", () => {
    const result = createNavigationRetryConfig();
    expect(result).toEqual({
      baseTimeoutMs: DEFAULT_NAVIGATION_BASE_TIMEOUT_MS,
      maxTimeoutMs: DEFAULT_NAVIGATION_MAX_TIMEOUT_MS,
      maxAttempts: DEFAULT_NAVIGATION_MAX_ATTEMPTS,
      timeoutMultiplier: DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER,
    });
  });

  it("should return all defaults when overrides is null", () => {
    const result = createNavigationRetryConfig(null);
    expect(result).toEqual({
      baseTimeoutMs: DEFAULT_NAVIGATION_BASE_TIMEOUT_MS,
      maxTimeoutMs: DEFAULT_NAVIGATION_MAX_TIMEOUT_MS,
      maxAttempts: DEFAULT_NAVIGATION_MAX_ATTEMPTS,
      timeoutMultiplier: DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER,
    });
  });

  it("should override specific values while preserving defaults", () => {
    const result = createNavigationRetryConfig({
      baseTimeoutMs: 5000,
    });
    expect(result).toEqual({
      baseTimeoutMs: 5000,
      maxTimeoutMs: DEFAULT_NAVIGATION_MAX_TIMEOUT_MS,
      maxAttempts: DEFAULT_NAVIGATION_MAX_ATTEMPTS,
      timeoutMultiplier: DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER,
    });
  });

  it("should handle all undefined values in overrides", () => {
    const result = createNavigationRetryConfig({
      baseTimeoutMs: undefined,
      maxAttempts: undefined,
      timeoutMultiplier: undefined,
    });
    expect(result).toEqual({
      baseTimeoutMs: DEFAULT_NAVIGATION_BASE_TIMEOUT_MS,
      maxTimeoutMs: DEFAULT_NAVIGATION_MAX_TIMEOUT_MS,
      maxAttempts: DEFAULT_NAVIGATION_MAX_ATTEMPTS,
      timeoutMultiplier: DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER,
    });
  });

  it("should preserve 0 values", () => {
    // While 0 might not be a valid timeout, the function should preserve it
    // Validation is a separate concern
    const result = createNavigationRetryConfig({
      baseTimeoutMs: 0,
    });
    expect(result.baseTimeoutMs).toBe(0);
  });

  it("should allow overriding maxTimeoutMs", () => {
    const result = createNavigationRetryConfig({
      maxTimeoutMs: 60000,
    });
    expect(result.maxTimeoutMs).toBe(60000);
    // Other values should still be defaults
    expect(result.baseTimeoutMs).toBe(DEFAULT_NAVIGATION_BASE_TIMEOUT_MS);
    expect(result.maxAttempts).toBe(DEFAULT_NAVIGATION_MAX_ATTEMPTS);
  });

  it("should include onRetry callback when provided", () => {
    const onRetry = () => {};
    const result = createNavigationRetryConfig({
      onRetry,
    });
    expect(result.onRetry).toBe(onRetry);
  });

  it("should not include onRetry when not provided", () => {
    const result = createNavigationRetryConfig({});
    expect(result).not.toHaveProperty("onRetry");
  });

  it("should handle partial overrides correctly", () => {
    const onRetry = () => {};
    const result = createNavigationRetryConfig({
      baseTimeoutMs: 10000,
      maxAttempts: 5,
      onRetry,
    });
    expect(result).toEqual({
      baseTimeoutMs: 10000,
      maxTimeoutMs: DEFAULT_NAVIGATION_MAX_TIMEOUT_MS,
      maxAttempts: 5,
      timeoutMultiplier: DEFAULT_NAVIGATION_TIMEOUT_MULTIPLIER,
      onRetry,
    });
  });
});
