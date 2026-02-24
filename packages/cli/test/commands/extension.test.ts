import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { createExtensionCommand, findWebExtBinaryFrom } from "../../src/commands/extension.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    mkdtempSync: vi.fn().mockReturnValue("/tmp/pilo-chrome-abc123"),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
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

vi.mock("pilo-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("pilo-core")>();
  return {
    ...actual,
    config: {
      getConfigPath: vi.fn().mockReturnValue("/home/user/.config/pilo/config.json"),
      getGlobalConfig: vi.fn().mockReturnValue({}),
    },
  };
});

vi.mock("../../src/extensionConfig.js", () => ({
  mapConfigToExtensionSettings: vi.fn().mockReturnValue({}),
}));

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { spawn, execFileSync } from "child_process";
import { config as piloConfig } from "pilo-core";
import { mapConfigToExtensionSettings } from "../../src/extensionConfig.js";

const mockExistsSync = vi.mocked(existsSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockSpawn = vi.mocked(spawn);
const mockExecFileSync = vi.mocked(execFileSync);
const mockGetConfigPath = vi.mocked(piloConfig.getConfigPath);
const mockGetGlobalConfig = vi.mocked(piloConfig.getGlobalConfig);
const mockMapConfigToExtensionSettings = vi.mocked(mapConfigToExtensionSettings);

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

/** Stub configManager so it reports a config file exists and returns the given config. */
function stubConfigExists(globalConfig: Record<string, unknown> = { provider: "openai" }) {
  mockExistsSync.mockImplementation((p) => {
    const path = String(p);
    // Config file exists
    if (path.includes("config.json")) return true;
    // Extension directory exists
    if (path.includes("extension")) return true;
    // web-ext binary exists
    if (path.includes("web-ext")) return true;
    return false;
  });
  mockGetGlobalConfig.mockReturnValue(globalConfig as any);
}

describe("CLI Extension Command", () => {
  let originalExit: typeof process.exit;
  let mockExit: ReturnType<typeof vi.fn>;
  let consoleLogs: string[];
  let consoleWarns: string[];
  let consoleErrors: string[];
  let originalConsoleLog: typeof console.log;
  let originalConsoleWarn: typeof console.warn;
  let originalConsoleError: typeof console.error;

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

    // Capture console.warn for seeding warning tests
    consoleWarns = [];
    originalConsoleWarn = console.warn;
    console.warn = vi.fn((...args: unknown[]) => {
      consoleWarns.push(args.map(String).join(" "));
    });

    // Capture console.error for error-message tests
    consoleErrors = [];
    originalConsoleError = console.error;
    console.error = vi.fn((...args: unknown[]) => {
      consoleErrors.push(args.map(String).join(" "));
    });

    // By default extension path does not exist
    mockExistsSync.mockReturnValue(false);
    // By default execFileSync (used for `which`) throws → binary not found
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not found");
    });
    // By default config manager returns empty global config
    mockGetConfigPath.mockReturnValue("/home/user/.config/pilo/config.json");
    mockGetGlobalConfig.mockReturnValue({});
    // By default mapping returns empty (no fields to seed)
    mockMapConfigToExtensionSettings.mockReturnValue({});
  });

  afterEach(() => {
    process.exit = originalExit;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    // Restore __PILO_PRODUCTION__ to undefined (dev mode) after each test
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

  describe("Production mode (__PILO_PRODUCTION__ === true)", () => {
    beforeEach(() => {
      vi.stubGlobal("__PILO_PRODUCTION__", true);
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

  describe("Dev mode (__PILO_PRODUCTION__ === false)", () => {
    // __PILO_PRODUCTION__ is only injected by the root tsup build (production).
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
      expect(args).toContain("pilo-extension");
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

  // -------------------------------------------------------------------------
  // Config seeding
  // -------------------------------------------------------------------------

  describe("Config seeding", () => {
    // -----------------------------------------------------------------------
    // No config file → skip seeding with warning
    // -----------------------------------------------------------------------

    describe("when no global config file exists", () => {
      it("should warn and skip seeding in production chrome", async () => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        // Extension dir exists, but config file does not
        mockExistsSync.mockImplementation((p) => {
          const path = String(p);
          return path.includes("extension") && !path.includes("config.json");
        });

        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        expect(mockWriteFileSync).not.toHaveBeenCalled();
        const warnOutput = consoleWarns.join("\n");
        expect(warnOutput).toMatch(/No config file found/);
      });

      it("should warn and skip seeding in dev mode", async () => {
        makeSpawnResolve(0);
        // existsSync returns false for everything (config not found)
        mockExistsSync.mockReturnValue(false);

        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        expect(mockWriteFileSync).not.toHaveBeenCalled();
        const warnOutput = consoleWarns.join("\n");
        expect(warnOutput).toMatch(/No config file found/);
      });
    });

    // -----------------------------------------------------------------------
    // Config exists but mapping yields empty object → skip writing
    // -----------------------------------------------------------------------

    describe("when config maps to empty settings", () => {
      it("should not write pilo.config.json in production chrome", async () => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        stubConfigExists({});
        // Mapping returns empty object (no useful fields)
        mockMapConfigToExtensionSettings.mockReturnValue({});

        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        expect(mockWriteFileSync).not.toHaveBeenCalled();
      });

      it("should not write pilo.config.json in dev mode", async () => {
        makeSpawnResolve(0);
        // Config file exists
        mockExistsSync.mockImplementation((p) => String(p).includes("config.json"));
        mockMapConfigToExtensionSettings.mockReturnValue({});

        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        expect(mockWriteFileSync).not.toHaveBeenCalled();
      });
    });

    // -----------------------------------------------------------------------
    // Config exists and maps to non-empty settings → write file
    // -----------------------------------------------------------------------

    describe("when config maps to non-empty settings", () => {
      const fakeSettings = { provider: "openai" as const, model: "gpt-4.1", apiKey: "sk-abc" };

      beforeEach(() => {
        mockMapConfigToExtensionSettings.mockReturnValue(fakeSettings);
      });

      it("should write pilo.config.json in production chrome path", async () => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        stubConfigExists({ provider: "openai", model: "gpt-4.1", openai_api_key: "sk-abc" });

        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        expect(mockWriteFileSync).toHaveBeenCalledOnce();
        const [filePath, content] = mockWriteFileSync.mock.calls[0] as [string, string, string];
        expect(filePath).toMatch(/pilo\.config\.json$/);
        // Content should be the pretty-printed JSON of the mapped settings
        expect(JSON.parse(content)).toEqual(fakeSettings);
      });

      it("should write pilo.config.json in production firefox path", async () => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        stubConfigExists({ provider: "openai", model: "gpt-4.1", openai_api_key: "sk-abc" });
        makeSpawnResolve(0);

        const cmd = getCommand();
        await cmd.parseAsync(["install", "firefox"], { from: "user" });

        expect(mockWriteFileSync).toHaveBeenCalledOnce();
        const [filePath, content] = mockWriteFileSync.mock.calls[0] as [string, string, string];
        expect(filePath).toMatch(/pilo\.config\.json$/);
        expect(JSON.parse(content)).toEqual(fakeSettings);
      });

      it("should write pilo.config.json into the extension public/ dir in dev mode", async () => {
        makeSpawnResolve(0);
        mockExistsSync.mockImplementation((p) => String(p).includes("config.json"));

        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        expect(mockWriteFileSync).toHaveBeenCalledOnce();
        const [filePath] = mockWriteFileSync.mock.calls[0] as [string, string, string];
        // Should be inside packages/extension/public/
        expect(filePath).toMatch(/extension[/\\]public[/\\]pilo\.config\.json$/);
      });

      it("should pretty-print the JSON with 2-space indent", async () => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        stubConfigExists({ provider: "openai", openai_api_key: "sk-abc" });

        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        const [, content] = mockWriteFileSync.mock.calls[0] as [string, string, string];
        expect(content).toBe(JSON.stringify(fakeSettings, null, 2));
      });

      it("should log a success message naming the config path", async () => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        stubConfigExists({ provider: "openai", openai_api_key: "sk-abc" });
        mockGetConfigPath.mockReturnValue("/home/user/.config/pilo/config.json");

        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        const allOutput = consoleLogs.join("\n");
        expect(allOutput).toMatch(/Seeded extension with config from/);
        expect(allOutput).toContain("/home/user/.config/pilo/config.json");
      });

      it("should call mkdirSync to ensure extension dir exists before writing", async () => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        stubConfigExists({ provider: "openai", openai_api_key: "sk-abc" });

        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        expect(mockMkdirSync).toHaveBeenCalledOnce();
        const [, opts] = mockMkdirSync.mock.calls[0] as [string, { recursive: boolean }];
        expect(opts?.recursive).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // Write failure → warn and continue (best-effort)
    // -----------------------------------------------------------------------

    describe("when writing pilo.config.json fails", () => {
      it("should warn and not exit(1) in production chrome", async () => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        stubConfigExists({ provider: "openai", openai_api_key: "sk-abc" });
        mockMapConfigToExtensionSettings.mockReturnValue({
          provider: "openai" as const,
          apiKey: "sk-abc",
        });
        mockWriteFileSync.mockImplementation(() => {
          throw new Error("EROFS: read-only file system");
        });

        const cmd = getCommand();
        await cmd.parseAsync(["install", "chrome"], { from: "user" });

        // Must NOT exit with 1 (seeding failure should not block install)
        expect(mockExit).not.toHaveBeenCalledWith(1);
        const warnOutput = consoleWarns.join("\n");
        expect(warnOutput).toMatch(/Failed to write extension seed config/);
      });
    });
  });

  // -------------------------------------------------------------------------
  // config-sync subcommand
  // -------------------------------------------------------------------------

  describe("config-sync subcommand", () => {
    // -----------------------------------------------------------------------
    // Command structure
    // -----------------------------------------------------------------------

    describe("Command structure", () => {
      it("should expose 'config-sync' subcommand", () => {
        const cmd = getCommand();
        const subNames = cmd.commands.map((c) => c.name());
        expect(subNames).toContain("config-sync");
      });

      it("config-sync should have no required arguments", () => {
        const cmd = getCommand();
        const syncCmd = cmd.commands.find((c) => c.name() === "config-sync")!;
        expect(syncCmd.registeredArguments.length).toBe(0);
      });
    });

    // -----------------------------------------------------------------------
    // No config file → exit with error
    // -----------------------------------------------------------------------

    describe("when no global config file exists", () => {
      it("should exit(1) and print error in dev mode", async () => {
        // existsSync returns false for everything (no config file)
        mockExistsSync.mockReturnValue(false);

        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        expect(mockExit).toHaveBeenCalledWith(1);
        expect(consoleErrors.join("\n")).toMatch(/No configuration found/);
      });

      it("should exit(1) and print error in production mode", async () => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        mockExistsSync.mockReturnValue(false);

        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        expect(mockExit).toHaveBeenCalledWith(1);
      });
    });

    // -----------------------------------------------------------------------
    // Dev mode
    // -----------------------------------------------------------------------

    describe("Dev mode", () => {
      const fakeSettings = { provider: "openai" as const, apiKey: "sk-abc" };

      beforeEach(() => {
        mockMapConfigToExtensionSettings.mockReturnValue(fakeSettings);
        // Config file exists; extension public/ dir can be created
        mockExistsSync.mockImplementation((p) => String(p).includes("config.json"));
      });

      it("should write pilo.config.json into extension public/ dir", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        expect(mockWriteFileSync).toHaveBeenCalledOnce();
        const [filePath] = mockWriteFileSync.mock.calls[0] as [string, string, string];
        expect(filePath).toMatch(/extension[/\\]public[/\\]pilo\.config\.json$/);
      });

      it("should print dev mode success message", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        const allOutput = consoleLogs.join("\n");
        expect(allOutput).toMatch(/dev mode/i);
      });

      it("should print reload reminder", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        const allOutput = consoleLogs.join("\n");
        expect(allOutput).toMatch(/Reload the extension/i);
      });

      it("should not call process.exit(1) when successful", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        expect(mockExit).not.toHaveBeenCalledWith(1);
      });
    });

    // -----------------------------------------------------------------------
    // Production mode: both browser dirs exist
    // -----------------------------------------------------------------------

    describe("Production mode — both browser dirs exist", () => {
      const fakeSettings = { provider: "openai" as const, apiKey: "sk-abc" };

      beforeEach(() => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        mockMapConfigToExtensionSettings.mockReturnValue(fakeSettings);
        // Config file exists; both browser extension dirs exist
        mockExistsSync.mockImplementation((p) => {
          const path = String(p);
          return path.includes("config.json") || path.includes("extension");
        });
      });

      it("should write pilo.config.json to both chrome and firefox dirs", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        // writeFileSync called twice: once per browser
        expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
        const paths = mockWriteFileSync.mock.calls.map((c) => String(c[0]));
        expect(paths.some((p) => p.includes("chrome"))).toBe(true);
        expect(paths.some((p) => p.includes("firefox"))).toBe(true);
      });

      it("should print success message listing both browsers", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        const allOutput = consoleLogs.join("\n");
        expect(allOutput).toMatch(/chrome/i);
        expect(allOutput).toMatch(/firefox/i);
      });

      it("should print reload reminder", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        const allOutput = consoleLogs.join("\n");
        expect(allOutput).toMatch(/Reload the extension/i);
      });

      it("should not call process.exit(1) when both dirs exist", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        expect(mockExit).not.toHaveBeenCalledWith(1);
      });
    });

    // -----------------------------------------------------------------------
    // Production mode: only chrome dir exists
    // -----------------------------------------------------------------------

    describe("Production mode — only chrome dir exists", () => {
      const fakeSettings = { provider: "openai" as const, apiKey: "sk-abc" };

      beforeEach(() => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        mockMapConfigToExtensionSettings.mockReturnValue(fakeSettings);
        // Config file exists; only the chrome extension dir exists
        mockExistsSync.mockImplementation((p) => {
          const path = String(p);
          if (path.includes("config.json")) return true;
          if (path.includes("extension") && path.includes("chrome")) return true;
          return false;
        });
      });

      it("should write pilo.config.json only to the chrome dir", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        expect(mockWriteFileSync).toHaveBeenCalledOnce();
        const [filePath] = mockWriteFileSync.mock.calls[0] as [string, string, string];
        expect(filePath).toMatch(/chrome/);
        expect(filePath).not.toMatch(/firefox/);
      });

      it("should print success message listing only chrome", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        const allOutput = consoleLogs.join("\n");
        expect(allOutput).toMatch(/chrome/i);
        expect(allOutput).not.toMatch(/firefox/i);
      });
    });

    // -----------------------------------------------------------------------
    // Production mode: only firefox dir exists
    // -----------------------------------------------------------------------

    describe("Production mode — only firefox dir exists", () => {
      const fakeSettings = { provider: "openai" as const, apiKey: "sk-abc" };

      beforeEach(() => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        mockMapConfigToExtensionSettings.mockReturnValue(fakeSettings);
        // Config file exists; only the firefox extension dir exists
        mockExistsSync.mockImplementation((p) => {
          const path = String(p);
          if (path.includes("config.json")) return true;
          if (path.includes("extension") && path.includes("firefox")) return true;
          return false;
        });
      });

      it("should write pilo.config.json only to the firefox dir", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        expect(mockWriteFileSync).toHaveBeenCalledOnce();
        const [filePath] = mockWriteFileSync.mock.calls[0] as [string, string, string];
        expect(filePath).toMatch(/firefox/);
        expect(filePath).not.toMatch(/chrome/);
      });

      it("should print success message listing only firefox", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        const allOutput = consoleLogs.join("\n");
        expect(allOutput).toMatch(/firefox/i);
        expect(allOutput).not.toMatch(/chrome/i);
      });
    });

    // -----------------------------------------------------------------------
    // Production mode: no browser dirs exist
    // -----------------------------------------------------------------------

    describe("Production mode — no browser dirs exist", () => {
      beforeEach(() => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        // Config file exists, but NO extension dirs exist
        mockExistsSync.mockImplementation((p) => String(p).includes("config.json"));
      });

      it("should exit(1) when no browser extension dirs are found", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        expect(mockExit).toHaveBeenCalledWith(1);
      });

      it("should print a helpful error message", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        expect(consoleErrors.join("\n")).toMatch(/No installed extension directories found/i);
      });
    });

    // -----------------------------------------------------------------------
    // Empty config mapping
    // -----------------------------------------------------------------------

    describe("when config maps to empty settings", () => {
      beforeEach(() => {
        // Config file exists but mapping yields nothing useful
        mockExistsSync.mockImplementation((p) => String(p).includes("config.json"));
        mockMapConfigToExtensionSettings.mockReturnValue({});
      });

      it("should not write pilo.config.json in dev mode", async () => {
        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        expect(mockWriteFileSync).not.toHaveBeenCalled();
      });

      it("should not write pilo.config.json in production mode when only chrome exists", async () => {
        vi.stubGlobal("__PILO_PRODUCTION__", true);
        mockExistsSync.mockImplementation((p) => {
          const path = String(p);
          return (
            path.includes("config.json") || (path.includes("extension") && path.includes("chrome"))
          );
        });

        const cmd = getCommand();
        await cmd.parseAsync(["config-sync"], { from: "user" });

        expect(mockWriteFileSync).not.toHaveBeenCalled();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// findWebExtBinaryFrom – path resolution unit tests
// ---------------------------------------------------------------------------

describe("findWebExtBinaryFrom", () => {
  // Simulate a global npm install: <prefix>/lib/node_modules/@tabstack/pilo/dist/cli/src/
  const fakeGlobalDir = "/fake/root/dist/cli/src";
  // Simulate a local scoped install: <project>/node_modules/@tabstack/pilo/dist/cli/src/
  const fakeLocalDir = "/fake/project/node_modules/@tabstack/pilo/dist/cli/src";

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: nothing exists, `which` fails
    mockExistsSync.mockReturnValue(false);
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not found");
    });
  });

  it("should check package root node_modules first (3 levels up from dist/cli/src/)", () => {
    const checkedPaths: string[] = [];
    mockExistsSync.mockImplementation((p) => {
      checkedPaths.push(String(p));
      return false;
    });

    findWebExtBinaryFrom(fakeGlobalDir);

    expect(checkedPaths[0]).toBe("/fake/root/node_modules/.bin/web-ext");
  });

  it("should return the binary path when found at package root node_modules", () => {
    mockExistsSync.mockImplementation((p) => String(p) === "/fake/root/node_modules/.bin/web-ext");

    const result = findWebExtBinaryFrom(fakeGlobalDir);
    expect(result).toBe("/fake/root/node_modules/.bin/web-ext");
  });

  it("should check hoisted node_modules when package root bin is missing (6 levels up)", () => {
    const checkedPaths: string[] = [];
    mockExistsSync.mockImplementation((p) => {
      checkedPaths.push(String(p));
      return false;
    });

    findWebExtBinaryFrom(fakeLocalDir);

    // Second path checked: 6 levels up to project root
    expect(checkedPaths[1]).toBe("/fake/project/node_modules/.bin/web-ext");
  });

  it("should return the binary path when found at hoisted node_modules", () => {
    mockExistsSync.mockImplementation(
      (p) => String(p) === "/fake/project/node_modules/.bin/web-ext",
    );

    const result = findWebExtBinaryFrom(fakeLocalDir);
    expect(result).toBe("/fake/project/node_modules/.bin/web-ext");
  });

  it("should prefer package root bin over hoisted bin", () => {
    // Both exist, but package root should win
    mockExistsSync.mockReturnValue(true);

    const result = findWebExtBinaryFrom(fakeLocalDir);
    expect(result).toBe("/fake/project/node_modules/@tabstack/pilo/node_modules/.bin/web-ext");
  });

  it("should fall back to global PATH when no local binary exists", () => {
    mockExistsSync.mockReturnValue(false);
    mockExecFileSync.mockReturnValue(Buffer.from("/usr/local/bin/web-ext"));

    const result = findWebExtBinaryFrom(fakeGlobalDir);
    expect(result).toBe("web-ext");
  });

  it("should return null when web-ext is not found anywhere", () => {
    mockExistsSync.mockReturnValue(false);
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const result = findWebExtBinaryFrom(fakeGlobalDir);
    expect(result).toBeNull();
  });
});
