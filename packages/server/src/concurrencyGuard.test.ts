import { describe, it, expect, afterEach } from "vitest";
import { getMaxConcurrentTasks } from "./concurrencyGuard.js";

describe("concurrencyGuard default cap", () => {
  afterEach(() => {
    delete process.env.MAX_CONCURRENT_TASKS;
  });

  it("defaults to 3 when MAX_CONCURRENT_TASKS is unset", () => {
    delete process.env.MAX_CONCURRENT_TASKS;
    expect(getMaxConcurrentTasks()).toBe(3);
  });

  it("honors MAX_CONCURRENT_TASKS env override", () => {
    process.env.MAX_CONCURRENT_TASKS = "12";
    expect(getMaxConcurrentTasks()).toBe(12);
  });
});
