import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Command } from "commander";
import { createConfigCommand } from "../../src/commands/config.js";

// ---------------------------------------------------------------------------
// Mock spark-core so tests do not touch real config files
// ---------------------------------------------------------------------------
vi.mock("spark-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("spark-core")>();
  return {
    ...actual,
    config: {
      getConfig: vi.fn().mockReturnValue({}),
      get: vi.fn(),
      set: vi.fn(),
      unset: vi.fn(),
      reset: vi.fn(),
      getConfigPath: vi.fn().mockReturnValue("/home/user/.config/spark/config.json"),
      listSources: vi.fn().mockReturnValue({
        global: { provider: "openai" },
        env: { browser: "chrome" },
        merged: { provider: "openai", browser: "chrome" },
      }),
    },
    getAIProviderInfo: vi.fn().mockReturnValue({
      provider: "openai",
      model: "gpt-4",
      hasApiKey: true,
      keySource: "env",
    }),
  };
});

// Mock fs to avoid touching the real filesystem
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(false),
    // unlinkSync is no longer called directly by CLI; config.reset() handles it
  };
});

// Mock utils to avoid reading real package.json
vi.mock("../../src/utils.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/utils.js")>();
  return {
    ...actual,
    getPackageInfo: vi
      .fn()
      .mockReturnValue({ name: "spark-cli", version: "0.1.0", description: "test" }),
    parseConfigValue: actual.parseConfigValue,
  };
});

import { config, type SparkConfigResolved } from "spark-core";
import { existsSync } from "fs";

const mockConfig = vi.mocked(config);
const mockExistsSync = vi.mocked(existsSync);

/** Build a partial resolved config - tests only need specific keys, cast the rest */
function partialConfig(partial: Partial<SparkConfigResolved> = {}): SparkConfigResolved {
  return partial as SparkConfigResolved;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCommand(): Command {
  return createConfigCommand();
}

describe("CLI Config Command (subcommands)", () => {
  let originalExit: typeof process.exit;
  let mockExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalExit = process.exit;
    mockExit = vi.fn() as any;
    process.exit = mockExit as any;
    vi.clearAllMocks();

    // Restore default mocks after clearAllMocks
    mockConfig.getConfig.mockReturnValue(partialConfig());
    mockConfig.getConfigPath.mockReturnValue("/home/user/.config/spark/config.json");
    mockConfig.listSources.mockReturnValue({
      global: { provider: "openai" },
      env: { browser: "chrome" },
      merged: partialConfig({ provider: "openai", browser: "chrome" }),
    });
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  // -------------------------------------------------------------------------
  // Command structure
  // -------------------------------------------------------------------------

  describe("Command structure", () => {
    it("should be named 'config'", () => {
      const cmd = getCommand();
      expect(cmd.name()).toBe("config");
    });

    it("should expose expected subcommands", () => {
      const cmd = getCommand();
      const subNames = cmd.commands.map((c) => c.name());
      expect(subNames).toContain("init");
      expect(subNames).toContain("set");
      expect(subNames).toContain("get");
      expect(subNames).toContain("list");
      expect(subNames).toContain("show");
      expect(subNames).toContain("unset");
      expect(subNames).toContain("reset");
    });

    it("should NOT expose old --init / --set / --get / --list flags", () => {
      const cmd = getCommand();
      const flags = cmd.options.map((o) => o.flags);
      expect(flags).not.toContain("--init");
      expect(flags).not.toContain("--set <key-value>");
      expect(flags).not.toContain("--get <key>");
      expect(flags).not.toContain("--list");
      expect(flags).not.toContain("--show");
    });
  });

  // -------------------------------------------------------------------------
  // config set <key> <value>
  // -------------------------------------------------------------------------

  describe("config set <key> <value>", () => {
    it("should call config.set with parsed value for string", async () => {
      const cmd = getCommand();
      await cmd.parseAsync(["set", "browser", "chrome"], { from: "user" });

      expect(mockConfig.set).toHaveBeenCalledWith("browser", "chrome");
    });

    it("should call config.set with parsed boolean true", async () => {
      const cmd = getCommand();
      await cmd.parseAsync(["set", "headless", "true"], { from: "user" });

      expect(mockConfig.set).toHaveBeenCalledWith("headless", true);
    });

    it("should call config.set with parsed boolean false", async () => {
      const cmd = getCommand();
      await cmd.parseAsync(["set", "block_ads", "false"], { from: "user" });

      expect(mockConfig.set).toHaveBeenCalledWith("block_ads", false);
    });

    it("should call config.set with parsed number", async () => {
      const cmd = getCommand();
      await cmd.parseAsync(["set", "max_iterations", "30"], { from: "user" });

      expect(mockConfig.set).toHaveBeenCalledWith("max_iterations", 30);
    });

    it("should exit(1) when config.set throws", async () => {
      mockConfig.set.mockImplementationOnce(() => {
        throw new Error("invalid key");
      });

      const cmd = getCommand();
      await cmd.parseAsync(["set", "bad_key", "value"], { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  // -------------------------------------------------------------------------
  // config get <key>
  // -------------------------------------------------------------------------

  describe("config get <key>", () => {
    it("should print value when key exists", async () => {
      mockConfig.get.mockReturnValue("firefox");
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const cmd = getCommand();
      await cmd.parseAsync(["get", "browser"], { from: "user" });

      expect(mockConfig.get).toHaveBeenCalledWith("browser");
      expect(consoleSpy).toHaveBeenCalledWith("firefox");

      consoleSpy.mockRestore();
    });

    it("should exit(1) when key does not exist", async () => {
      mockConfig.get.mockReturnValue(undefined);
      vi.spyOn(console, "log").mockImplementation(() => {});

      const cmd = getCommand();
      await cmd.parseAsync(["get", "nonexistent"], { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  // -------------------------------------------------------------------------
  // config list
  // -------------------------------------------------------------------------

  describe("config list", () => {
    it("should call config.listSources", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      const cmd = getCommand();
      await cmd.parseAsync(["list"], { from: "user" });

      expect(mockConfig.listSources).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // config show
  // -------------------------------------------------------------------------

  describe("config show", () => {
    it("should call config.getConfig and print summary", async () => {
      mockConfig.getConfig.mockReturnValue(
        partialConfig({ provider: "openai", browser: "firefox", headless: false, block_ads: true }),
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const cmd = getCommand();
      await cmd.parseAsync(["show"], { from: "user" });

      expect(mockConfig.getConfig).toHaveBeenCalled();
      // Should have printed something about configuration
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // -------------------------------------------------------------------------
  // config unset <key>
  // -------------------------------------------------------------------------

  describe("config unset <key>", () => {
    it("should call config.unset with the given key", async () => {
      vi.spyOn(console, "log").mockImplementation(() => {});

      const cmd = getCommand();
      await cmd.parseAsync(["unset", "browser"], { from: "user" });

      expect(mockConfig.unset).toHaveBeenCalledWith("browser");
    });

    it("should exit(1) when config.unset throws", async () => {
      mockConfig.unset.mockImplementationOnce(() => {
        throw new Error("unset failed");
      });

      const cmd = getCommand();
      await cmd.parseAsync(["unset", "browser"], { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  // -------------------------------------------------------------------------
  // config reset
  // -------------------------------------------------------------------------

  describe("config reset", () => {
    it("should call config.reset() when config file exists", async () => {
      mockExistsSync.mockReturnValue(true);
      vi.spyOn(console, "log").mockImplementation(() => {});

      const cmd = getCommand();
      await cmd.parseAsync(["reset"], { from: "user" });

      // ConfigManager.reset() is called instead of direct unlinkSync
      expect(mockConfig.reset).toHaveBeenCalled();
    });

    it("should NOT call config.reset() when config file does not exist", async () => {
      mockExistsSync.mockReturnValue(false);
      vi.spyOn(console, "log").mockImplementation(() => {});

      const cmd = getCommand();
      await cmd.parseAsync(["reset"], { from: "user" });

      expect(mockConfig.reset).not.toHaveBeenCalled();
    });

    it("should exit(1) when config.reset() throws", async () => {
      mockExistsSync.mockReturnValue(true);
      mockConfig.reset.mockImplementationOnce(() => {
        throw new Error("permission denied");
      });

      const cmd = getCommand();
      await cmd.parseAsync(["reset"], { from: "user" });

      expect(mockExit).toHaveBeenCalledWith(1);
    });
  });

  // -------------------------------------------------------------------------
  // config init
  // -------------------------------------------------------------------------

  describe("config init", () => {
    it("should show guided setup when not yet configured", async () => {
      mockConfig.getConfig.mockReturnValue(partialConfig());
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const cmd = getCommand();
      await cmd.parseAsync(["init"], { from: "user" });

      // Should have printed setup instructions
      expect(consoleSpy).toHaveBeenCalled();
      const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(allOutput).toContain("config set");

      consoleSpy.mockRestore();
    });

    it("should warn when already configured", async () => {
      mockConfig.getConfig.mockReturnValue(
        partialConfig({ provider: "openai", openai_api_key: "sk-test" }),
      );

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const cmd = getCommand();
      await cmd.parseAsync(["init"], { from: "user" });

      const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join("\n");
      expect(allOutput).toContain("already exists");

      consoleSpy.mockRestore();
    });
  });
});
