import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

describe("extension command", () => {
  const cliPath = join(__dirname, "../dist/index.js");

  beforeAll(() => {
    // Ensure CLI is built
    if (!existsSync(cliPath)) {
      throw new Error("CLI not built. Run 'pnpm run build' first.");
    }
  });

  it("should show extension command in help", () => {
    const output = execSync(`node ${cliPath} --help`, { encoding: "utf-8" });
    expect(output).toContain("extension");
    expect(output).toContain("Manage the Spark browser extension");
  });

  it("should show extension install command in help", () => {
    const output = execSync(`node ${cliPath} extension --help`, { encoding: "utf-8" });
    expect(output).toContain("install");
    expect(output).toContain("Install the Spark browser extension");
  });

  it("should show browser option in install help", () => {
    const output = execSync(`node ${cliPath} extension install --help`, { encoding: "utf-8" });
    expect(output).toContain("-b, --browser");
    expect(output).toContain("chrome");
    expect(output).toContain("firefox");
  });

  it("should reject unsupported browser", () => {
    try {
      execSync(`node ${cliPath} extension install --browser safari`, { encoding: "utf-8" });
      expect.fail("Should have thrown an error for unsupported browser");
    } catch (error: any) {
      expect(error.message).toContain("Unsupported browser");
    }
  });
});
