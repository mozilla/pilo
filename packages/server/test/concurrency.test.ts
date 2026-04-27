import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  tryAcquire,
  release,
  getInflight,
  getMaxConcurrent,
  _resetInflight,
} from "../src/concurrency.js";

describe("concurrency limit", () => {
  const originalEnv = process.env.PILO_MAX_CONCURRENT_TASKS;

  beforeEach(() => {
    _resetInflight();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PILO_MAX_CONCURRENT_TASKS;
    } else {
      process.env.PILO_MAX_CONCURRENT_TASKS = originalEnv;
    }
    _resetInflight();
  });

  describe("tryAcquire / release", () => {
    it("returns true and increments while under the limit", () => {
      process.env.PILO_MAX_CONCURRENT_TASKS = "3";
      expect(tryAcquire()).toBe(true);
      expect(tryAcquire()).toBe(true);
      expect(getInflight()).toBe(2);
    });

    it("returns false and does NOT increment when at the limit", () => {
      process.env.PILO_MAX_CONCURRENT_TASKS = "2";
      expect(tryAcquire()).toBe(true);
      expect(tryAcquire()).toBe(true);
      expect(tryAcquire()).toBe(false);
      expect(getInflight()).toBe(2);
    });

    it("release decrements the counter", () => {
      process.env.PILO_MAX_CONCURRENT_TASKS = "2";
      tryAcquire();
      tryAcquire();
      release();
      expect(getInflight()).toBe(1);
    });

    it("after a release, a new tryAcquire succeeds again", () => {
      process.env.PILO_MAX_CONCURRENT_TASKS = "1";
      expect(tryAcquire()).toBe(true);
      expect(tryAcquire()).toBe(false);
      release();
      expect(tryAcquire()).toBe(true);
    });

    it("release floors at zero (safe to call extra times)", () => {
      release();
      release();
      release();
      expect(getInflight()).toBe(0);
    });
  });

  describe("limit configuration", () => {
    it("uses 10 as the default when PILO_MAX_CONCURRENT_TASKS is unset", () => {
      delete process.env.PILO_MAX_CONCURRENT_TASKS;
      expect(getMaxConcurrent()).toBe(10);
    });

    it("reads PILO_MAX_CONCURRENT_TASKS from env", () => {
      process.env.PILO_MAX_CONCURRENT_TASKS = "5";
      expect(getMaxConcurrent()).toBe(5);
    });

    it("falls back to default for non-numeric values", () => {
      process.env.PILO_MAX_CONCURRENT_TASKS = "not-a-number";
      expect(getMaxConcurrent()).toBe(10);
    });

    it("falls back to default for zero or negative values", () => {
      process.env.PILO_MAX_CONCURRENT_TASKS = "0";
      expect(getMaxConcurrent()).toBe(10);
      process.env.PILO_MAX_CONCURRENT_TASKS = "-3";
      expect(getMaxConcurrent()).toBe(10);
    });

    it("floors fractional values", () => {
      process.env.PILO_MAX_CONCURRENT_TASKS = "3.7";
      expect(getMaxConcurrent()).toBe(3);
    });
  });
});
