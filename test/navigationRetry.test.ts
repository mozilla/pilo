/**
 * Tests for navigation retry utilities and NavigationTimeoutException
 */

import { describe, it, expect } from "vitest";
import {
  calculateTimeout,
  DEFAULT_NAVIGATION_RETRY_CONFIG,
  NavigationRetryConfig,
} from "../src/browser/navigationRetry.js";
import { NavigationTimeoutException, BrowserException } from "../src/errors.js";

describe("Navigation Retry Utilities", () => {
  describe("calculateTimeout", () => {
    it("should return base timeout for first attempt", () => {
      const timeout = calculateTimeout(1, DEFAULT_NAVIGATION_RETRY_CONFIG);
      expect(timeout).toBe(30000);
    });

    it("should double timeout for second attempt with default config", () => {
      const timeout = calculateTimeout(2, DEFAULT_NAVIGATION_RETRY_CONFIG);
      expect(timeout).toBe(60000);
    });

    it("should quadruple timeout for third attempt with default config", () => {
      const timeout = calculateTimeout(3, DEFAULT_NAVIGATION_RETRY_CONFIG);
      expect(timeout).toBe(120000);
    });

    it("should use custom base timeout", () => {
      const config: NavigationRetryConfig = {
        baseTimeoutMs: 5000,
        maxTimeoutMs: 100000,
        maxAttempts: 3,
        timeoutMultiplier: 2,
      };
      expect(calculateTimeout(1, config)).toBe(5000);
      expect(calculateTimeout(2, config)).toBe(10000);
      expect(calculateTimeout(3, config)).toBe(20000);
    });

    it("should use custom multiplier", () => {
      const config: NavigationRetryConfig = {
        baseTimeoutMs: 10000,
        maxTimeoutMs: 100000,
        maxAttempts: 3,
        timeoutMultiplier: 3,
      };
      expect(calculateTimeout(1, config)).toBe(10000);
      expect(calculateTimeout(2, config)).toBe(30000);
      expect(calculateTimeout(3, config)).toBe(90000);
    });

    it("should handle multiplier of 1 (no escalation)", () => {
      const config: NavigationRetryConfig = {
        baseTimeoutMs: 15000,
        maxTimeoutMs: 100000,
        maxAttempts: 3,
        timeoutMultiplier: 1,
      };
      expect(calculateTimeout(1, config)).toBe(15000);
      expect(calculateTimeout(2, config)).toBe(15000);
      expect(calculateTimeout(3, config)).toBe(15000);
    });

    it("should round to whole numbers", () => {
      const config: NavigationRetryConfig = {
        baseTimeoutMs: 10000,
        maxTimeoutMs: 100000,
        maxAttempts: 3,
        timeoutMultiplier: 1.5,
      };
      expect(calculateTimeout(1, config)).toBe(10000);
      expect(calculateTimeout(2, config)).toBe(15000);
      expect(calculateTimeout(3, config)).toBe(22500);
    });

    it("should cap timeout at maxTimeoutMs", () => {
      const config: NavigationRetryConfig = {
        baseTimeoutMs: 10000,
        maxTimeoutMs: 25000,
        maxAttempts: 5,
        timeoutMultiplier: 2,
      };
      expect(calculateTimeout(1, config)).toBe(10000);
      expect(calculateTimeout(2, config)).toBe(20000);
      expect(calculateTimeout(3, config)).toBe(25000); // capped (would be 40000)
      expect(calculateTimeout(4, config)).toBe(25000); // capped (would be 80000)
      expect(calculateTimeout(5, config)).toBe(25000); // capped (would be 160000)
    });
  });

  describe("DEFAULT_NAVIGATION_RETRY_CONFIG", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_NAVIGATION_RETRY_CONFIG.baseTimeoutMs).toBe(30000);
      expect(DEFAULT_NAVIGATION_RETRY_CONFIG.maxTimeoutMs).toBe(120000);
      expect(DEFAULT_NAVIGATION_RETRY_CONFIG.maxAttempts).toBe(3);
      expect(DEFAULT_NAVIGATION_RETRY_CONFIG.timeoutMultiplier).toBe(2);
    });
  });

  describe("NavigationTimeoutException", () => {
    it("should create timeout exception with url and timeout", () => {
      const error = new NavigationTimeoutException("https://slow-site.com", 30000);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BrowserException);
      expect(error).toBeInstanceOf(NavigationTimeoutException);
      expect(error.name).toBe("NavigationTimeoutException");
      expect(error.url).toBe("https://slow-site.com");
      expect(error.timeoutMs).toBe(30000);
      expect(error.attempt).toBe(1);
      expect(error.maxAttempts).toBe(1);
      expect(error.isRecoverable).toBe(true);
    });

    it("should accept attempt info in context", () => {
      const error = new NavigationTimeoutException("https://example.com", 15000, {
        attempt: 2,
        maxAttempts: 3,
      });

      expect(error.attempt).toBe(2);
      expect(error.maxAttempts).toBe(3);
    });

    it("should generate descriptive message", () => {
      const error = new NavigationTimeoutException("https://example.com", 15000, {
        attempt: 1,
        maxAttempts: 3,
      });

      expect(error.message).toBe(
        "The page at 'https://example.com' is unreachable (timed out after 15000ms across 3 attempts). Try a different URL or approach.",
      );
    });

    it("should generate message for final attempt", () => {
      const error = new NavigationTimeoutException("https://example.com", 60000, {
        attempt: 3,
        maxAttempts: 3,
      });

      expect(error.message).toBe(
        "The page at 'https://example.com' is unreachable (timed out after 60000ms across 3 attempts). Try a different URL or approach.",
      );
    });
  });
});
