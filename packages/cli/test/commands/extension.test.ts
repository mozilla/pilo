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

// Helper: make spawn resolve immediately via the "close" event (blocking mode)
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
  let consoleLogs: string[];
  let originalConsoleLog: typeof console.log;

  beforeEach(() => {
    originalExit = process.exit;
    mockExit = vi.fn() as any;
    process.exit = mockExit as any;
    vi.clearAllMocks();

    // Capture console.log output for instruction-printing tests
    consoleLogs = [];
    originalConsoleLog = console.log;
    console.log = vi.fn((...args: unknown[]) => {
      consoleLogs.push(args.map(String).join(" "));
    });

    // By default extension path does not exist
    mockExistsSync.mockReturnValue(false);
    // By default execFileSync (used for `which`) throws → binary not found
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not found");
    });
  });

  afterEach(() => {
    process.exit = originalExit;
    console.log = originalConsoleLog;
    // Restore __SPARK_PRODUCTION__ to undefined (dev mode) after each test
    vi.unstubAllGlobals();
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

    it("install subcommand should NOT have --chrome-binary flag", () => {
      const cmd = getCommand();
      const installCmd = cmd.commands.find((c) => c.name() === "install")!;
      const flags = installCmd.options.map((o) => o.flags);
      expect(flags.some((f) => f.includes("--chrome-binary"))).toBe(false);
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
  // Production mode
  // -------------------------------------------------------------------------

  describe("Production mode (__SPARK_PRODUCTION__ === true)", () => {
    beforeEach(() => {
      vi.stubGlobal("__SPARK_PRODUCTION__", true);
    });

    // -----------------------------------------------------------------------
    // Extension path missing (production)
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Chrome instructions (production)
    // -----------------------------------------------------------------------

    describe("Chrome instructions", () => {
      beforeEach(() => {
        // Make the extension path exist
        mockExistsSync.mockImplementation((p) => {
          return String(p).includes("extension");
        });
      });

      it("should NOT spawn Chrome for chrome in production mode", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        expect(mockSpawn).not.toHaveBeenCalled();
      });

      it("should NOT call process.exit(1) for chrome when extension exists", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        expect(mockExit).not.toHaveBeenCalledWith(1);
      });

      it("should print the extension path in the instructions", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        const allOutput = consoleLogs.join("\n");
        // The resolved absolute path should appear in output
        expect(allOutput).toMatch(/extension/);
      });

      it("should print chrome://extensions in the instructions", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        const allOutput = consoleLogs.join("\n");
        expect(allOutput).toContain("chrome://extensions");
      });

      it("should print Load unpacked instructions", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        const allOutput = consoleLogs.join("\n");
        expect(allOutput).toContain("Load unpacked");
      });

      it("should print Developer mode step in the instructions", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        const allOutput = consoleLogs.join("\n");
        expect(allOutput).toContain("Developer mode");
      });
    });

    // -----------------------------------------------------------------------
    // Firefox launch (production)
    // -----------------------------------------------------------------------

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

      it("should include --no-reload in web-ext args for firefox", async () => {
        makeSpawnResolve(0);

        const cmd = getCommand();
        await cmd.parseAsync(["install", "firefox"], { from: "user" });

        expect(mockSpawn).toHaveBeenCalled();
        const [, spawnArgs] = mockSpawn.mock.calls[0];
        const args = spawnArgs as string[];
        expect(args).toContain("--no-reload");
      });

      it("should spawn web-ext with detached:false and stdio:inherit (blocking)", async () => {
        makeSpawnResolve(0);

        const cmd = getCommand();
        await cmd.parseAsync(["install", "firefox"], { from: "user" });

        expect(mockSpawn).toHaveBeenCalled();
        const [, , spawnOpts] = mockSpawn.mock.calls[0];
        expect((spawnOpts as any).detached).toBe(false);
        expect((spawnOpts as any).stdio).toBe("inherit");
      });

      it("should wait for web-ext to close before returning (blocking)", async () => {
        const mockProc = makeSpawnResolve(0);

        const cmd = getCommand();
        await cmd.parseAsync(["install", "firefox"], { from: "user" });

        // The close handler must have been registered
        const closeCalls = (mockProc.on as ReturnType<typeof vi.fn>).mock.calls.filter(
          (args: unknown[]) => args[0] === "close",
        );
        expect(closeCalls.length).toBeGreaterThan(0);
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

  // -------------------------------------------------------------------------
  // Dev mode
  // -------------------------------------------------------------------------

  describe("Dev mode (__SPARK_PRODUCTION__ === false)", () => {
    // __SPARK_PRODUCTION__ is only injected by the root tsup build (production).
    // In the test environment the global is undefined, which isProduction()
    // treats as false. No stubGlobal needed; the default state is already dev.

    it("should spawn pnpm with dev script and --chrome flag for chrome", async () => {
      makeSpawnResolve(0);

      const cmd = getCommand();
      await cmd.parseAsync(["install", "chrome"], { from: "user" });

      expect(mockSpawn).toHaveBeenCalled();
      const [binary, spawnArgs] = mockSpawn.mock.calls[0];
      expect(binary).toBe("pnpm");
      const args = spawnArgs as string[];
      expect(args).toContain("-F");
      expect(args).toContain("spark-extension");
      expect(args).toContain("dev");
      expect(args).toContain("--");
      expect(args).toContain("--chrome");
    });

    it("should spawn pnpm with dev script and --firefox flag for firefox", async () => {
      makeSpawnResolve(0);

      const cmd = getCommand();
      await cmd.parseAsync(["install", "firefox"], { from: "user" });

      expect(mockSpawn).toHaveBeenCalled();
      const [binary, spawnArgs] = mockSpawn.mock.calls[0];
      expect(binary).toBe("pnpm");
      const args = spawnArgs as string[];
      expect(args).toContain("dev");
      expect(args).toContain("--");
      expect(args).toContain("--firefox");
    });

    it("should forward --tmp flag as extra arg to the dev script", async () => {
      makeSpawnResolve(0);

      const cmd = getCommand();
      await cmd.parseAsync(["install", "chrome", "--tmp"], { from: "user" });

      expect(mockSpawn).toHaveBeenCalled();
      const [, spawnArgs] = mockSpawn.mock.calls[0];
      const args = spawnArgs as string[];
      expect(args).toContain("--tmp");
    });

    it("should not check existsSync for the extension path in dev mode", async () => {
      makeSpawnResolve(0);

      // existsSync returns false for everything - dev mode should not care
      mockExistsSync.mockReturnValue(false);

      const cmd = getCommand();
      await cmd.parseAsync(["install", "chrome"], { from: "user" });

      // Should NOT have called process.exit(1)
      expect(mockExit).not.toHaveBeenCalledWith(1);
      // Should have spawned pnpm
      expect(mockSpawn).toHaveBeenCalled();
    });

    it("should call process.exit(1) on spawn error in dev mode", async () => {
      const mockProc = {
        on: vi.fn().mockImplementation((event: string, handler: (...args: any[]) => void) => {
          if (event === "error") {
            setImmediate(() => handler(new Error("pnpm not found")));
          } else if (event === "close") {
            // Fire close after the error so the Promise resolves
            setImmediate(() => setImmediate(() => handler(1)));
          }
        }),
      };
      mockSpawn.mockReturnValue(mockProc as any);

      const cmd = getCommand();
      await cmd.parseAsync(["install", "chrome"], { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });
});
