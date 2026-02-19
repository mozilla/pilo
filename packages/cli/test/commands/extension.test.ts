import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { createExtensionCommand } from "../../src/commands/extension.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    mkdtempSync: vi.fn().mockReturnValue("/tmp/spark-chrome-abc123"),
  };
});

vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();

  const mockProc = {
    on: vi.fn(),
  };

  return {
    ...actual,
    spawn: vi.fn().mockReturnValue(mockProc),
    execFileSync: vi.fn(),
  };
});

import { existsSync } from "fs";
import { spawn, execFileSync } from "child_process";

const mockExistsSync = vi.mocked(existsSync);
const mockSpawn = vi.mocked(spawn);
const mockExecFileSync = vi.mocked(execFileSync);

// Helper: make spawn resolve immediately via the "close" event
function makeSpawnResolve(code = 0) {
  const mockProc = {
    on: vi.fn().mockImplementation((event: string, handler: (code: number) => void) => {
      if (event === "close") {
        // Resolve asynchronously so the Promise inside the command can settle
        setImmediate(() => handler(code));
      }
    }),
  };
  mockSpawn.mockReturnValue(mockProc as any);
  return mockProc;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCommand(): Command {
  return createExtensionCommand();
}

describe("CLI Extension Command", () => {
  let originalExit: typeof process.exit;
  let mockExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalExit = process.exit;
    mockExit = vi.fn() as any;
    process.exit = mockExit as any;
    vi.clearAllMocks();

    // By default extension path does not exist
    mockExistsSync.mockReturnValue(false);
    // By default execFileSync (used for `which`) throws → binary not found
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not found");
    });
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  // -------------------------------------------------------------------------
  // Command structure
  // -------------------------------------------------------------------------

  describe("Command structure", () => {
    it("should be named 'extension'", () => {
      const cmd = getCommand();
      expect(cmd.name()).toBe("extension");
    });

    it("should expose 'install' subcommand", () => {
      const cmd = getCommand();
      const subNames = cmd.commands.map((c) => c.name());
      expect(subNames).toContain("install");
    });

    it("install subcommand should accept --tmp flag", () => {
      const cmd = getCommand();
      const installCmd = cmd.commands.find((c) => c.name() === "install")!;
      const flags = installCmd.options.map((o) => o.flags);
      expect(flags).toContain("--tmp");
    });

    it("install subcommand should accept --chrome-binary flag", () => {
      const cmd = getCommand();
      const installCmd = cmd.commands.find((c) => c.name() === "install")!;
      const flags = installCmd.options.map((o) => o.flags);
      expect(flags).toContain("--chrome-binary <path>");
    });

    it("install subcommand should accept --firefox-binary flag", () => {
      const cmd = getCommand();
      const installCmd = cmd.commands.find((c) => c.name() === "install")!;
      const flags = installCmd.options.map((o) => o.flags);
      expect(flags).toContain("--firefox-binary <path>");
    });
  });

  // -------------------------------------------------------------------------
  // Unsupported browser
  // -------------------------------------------------------------------------

  describe("Unsupported browser", () => {
    it("should exit(1) for an unsupported browser name", async () => {
      const cmd = getCommand();
      await cmd.parseAsync(["install", "safari"], { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  // -------------------------------------------------------------------------
  // Extension path missing
  // -------------------------------------------------------------------------

  describe("Extension path not found", () => {
    it("should exit(1) for chrome when extension path does not exist", async () => {
      // existsSync always returns false → extension not built
      const cmd = getCommand();
      await cmd.parseAsync(["install", "chrome"], { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it("should exit(1) for firefox when extension path does not exist", async () => {
      const cmd = getCommand();
      await cmd.parseAsync(["install", "firefox"], { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  // -------------------------------------------------------------------------
  // Chrome - launch
  // -------------------------------------------------------------------------

  describe("Chrome launch", () => {
    beforeEach(() => {
      // Make the extension path exist AND the Chrome binary exist on PATH
      mockExistsSync.mockImplementation((p) => {
        const path = String(p);
        // Return true for macOS Chrome path or any extension directory
        if (path.includes("Google Chrome") || path.includes("extension")) return true;
        return false;
      });
      // execFileSync for `which google-chrome` etc. should succeed for chrome
      mockExecFileSync.mockImplementation((cmd, args) => {
        const argArr = args as string[];
        if (
          String(cmd) === "which" &&
          ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"].includes(
            argArr[0],
          )
        ) {
          return Buffer.from("/usr/bin/google-chrome");
        }
        throw new Error("not found");
      });
    });

    it("should call spawn with --load-extension flag for chrome", async () => {
      makeSpawnResolve(0);

      const cmd = getCommand();
      await cmd.parseAsync(["install", "chrome"], { from: "user" });

      expect(mockSpawn).toHaveBeenCalled();
      const [, spawnArgs] = mockSpawn.mock.calls[0];
      expect((spawnArgs as string[]).some((a) => a.startsWith("--load-extension="))).toBe(true);
    });

    it("should include --user-data-dir when --tmp flag is passed for chrome", async () => {
      makeSpawnResolve(0);

      const cmd = getCommand();
      await cmd.parseAsync(["install", "chrome", "--tmp"], { from: "user" });

      expect(mockSpawn).toHaveBeenCalled();
      const [, spawnArgs] = mockSpawn.mock.calls[0];
      expect((spawnArgs as string[]).some((a) => a.startsWith("--user-data-dir="))).toBe(true);
    });

    it("should use --chrome-binary override when provided", async () => {
      makeSpawnResolve(0);

      const cmd = getCommand();
      await cmd.parseAsync(["install", "chrome", "--chrome-binary", "/custom/chrome"], {
        from: "user",
      });

      expect(mockSpawn).toHaveBeenCalled();
      const [binary] = mockSpawn.mock.calls[0];
      expect(binary).toBe("/custom/chrome");
    });

    it("should exit(1) when Chrome binary is not found and no override given", async () => {
      // existsSync: extension exists but macOS Chrome app does not
      mockExistsSync.mockImplementation((p) => {
        return String(p).includes("extension");
      });
      // execFileSync always throws → no chrome on PATH
      mockExecFileSync.mockImplementation(() => {
        throw new Error("not found");
      });

      const cmd = getCommand();
      await cmd.parseAsync(["install", "chrome"], { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  // -------------------------------------------------------------------------
  // Firefox - launch
  // -------------------------------------------------------------------------

  describe("Firefox launch", () => {
    beforeEach(() => {
      // Extension path exists
      mockExistsSync.mockImplementation((p) => {
        return String(p).includes("extension") || String(p).includes("web-ext");
      });
    });

    it("should call spawn with web-ext run and --source-dir for firefox", async () => {
      makeSpawnResolve(0);

      const cmd = getCommand();
      await cmd.parseAsync(["install", "firefox"], { from: "user" });

      expect(mockSpawn).toHaveBeenCalled();
      const [, spawnArgs] = mockSpawn.mock.calls[0];
      const args = spawnArgs as string[];
      expect(args[0]).toBe("run");
      expect(args.some((a) => a.startsWith("--source-dir="))).toBe(true);
    });

    it("should include --profile-create-if-missing when --tmp is passed for firefox", async () => {
      makeSpawnResolve(0);

      const cmd = getCommand();
      await cmd.parseAsync(["install", "firefox", "--tmp"], { from: "user" });

      expect(mockSpawn).toHaveBeenCalled();
      const [, spawnArgs] = mockSpawn.mock.calls[0];
      const args = spawnArgs as string[];
      expect(args).toContain("--profile-create-if-missing");
    });

    it("should include --firefox flag when --firefox-binary override is given", async () => {
      makeSpawnResolve(0);

      const cmd = getCommand();
      await cmd.parseAsync(["install", "firefox", "--firefox-binary", "/custom/firefox"], {
        from: "user",
      });

      expect(mockSpawn).toHaveBeenCalled();
      const [, spawnArgs] = mockSpawn.mock.calls[0];
      const args = spawnArgs as string[];
      expect(args.some((a) => a.startsWith("--firefox="))).toBe(true);
    });

    it("should exit(1) when web-ext is not found", async () => {
      // Extension exists but web-ext binary does not
      mockExistsSync.mockImplementation((p) => {
        const path = String(p);
        // extension path exists
        if (path.includes("extension") && !path.includes("web-ext")) return true;
        return false;
      });
      // `which web-ext` also fails
      mockExecFileSync.mockImplementation(() => {
        throw new Error("not found");
      });

      const cmd = getCommand();
      await cmd.parseAsync(["install", "firefox"], { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
