import { describe, it, expect } from "vitest";
import { SAFE_TO_BATCH_ACTIONS, isBatchTerminating } from "../src/tools/webActionTools.js";

describe("batch action classification", () => {
  it("treats form-fill actions as safe to batch", () => {
    for (const a of ["fill", "select", "check", "uncheck", "focus"]) {
      expect(isBatchTerminating(a)).toBe(false);
      expect(SAFE_TO_BATCH_ACTIONS.has(a)).toBe(true);
    }
  });

  it("treats navigating/terminal/unknown actions as batch-terminating", () => {
    for (const a of [
      "click",
      "enter",
      "goto",
      "back",
      "forward",
      "scroll",
      "wait",
      "webSearch",
      "extract",
      "done",
      "abort",
      "hover",
      "totally-unknown",
    ]) {
      expect(isBatchTerminating(a)).toBe(true);
    }
  });
});
