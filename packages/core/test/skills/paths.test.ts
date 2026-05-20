import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { homedir } from "os";
import { getDefaultSkillsCacheDir } from "../../src/skills/paths.js";

/**
 * Tests for getDefaultSkillsCacheDir. process.platform is non-writable on
 * some Node builds, so we use Object.defineProperty with configurable:true
 * to temporarily override it. Env vars are mutated directly and restored
 * in afterEach (vi.stubEnv is unavailable for delete semantics, so manual).
 */
describe("skills/paths", () => {
  describe("getDefaultSkillsCacheDir", () => {
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");
    const originalXdg = process.env.XDG_CACHE_HOME;
    const originalLocalAppData = process.env.LOCALAPPDATA;

    function setPlatform(platform: NodeJS.Platform): void {
      Object.defineProperty(process, "platform", {
        value: platform,
        configurable: true,
        writable: true,
      });
    }

    beforeEach(() => {
      delete process.env.XDG_CACHE_HOME;
      delete process.env.LOCALAPPDATA;
    });

    afterEach(() => {
      if (originalPlatformDescriptor) {
        Object.defineProperty(process, "platform", originalPlatformDescriptor);
      }
      if (originalXdg === undefined) {
        delete process.env.XDG_CACHE_HOME;
      } else {
        process.env.XDG_CACHE_HOME = originalXdg;
      }
      if (originalLocalAppData === undefined) {
        delete process.env.LOCALAPPDATA;
      } else {
        process.env.LOCALAPPDATA = originalLocalAppData;
      }
    });

    it("uses XDG_CACHE_HOME on Linux when set", () => {
      setPlatform("linux");
      process.env.XDG_CACHE_HOME = "/tmp/test-xdg";
      expect(getDefaultSkillsCacheDir()).toBe("/tmp/test-xdg/pilo/skills");
    });

    it("uses XDG_CACHE_HOME on macOS when set", () => {
      setPlatform("darwin");
      process.env.XDG_CACHE_HOME = "/tmp/test-xdg-mac";
      expect(getDefaultSkillsCacheDir()).toBe("/tmp/test-xdg-mac/pilo/skills");
    });

    it("falls back to ~/.cache/pilo/skills on Linux when XDG_CACHE_HOME is unset", () => {
      setPlatform("linux");
      expect(getDefaultSkillsCacheDir()).toBe(join(homedir(), ".cache", "pilo", "skills"));
    });

    it("falls back to ~/.cache/pilo/skills on macOS when XDG_CACHE_HOME is unset", () => {
      setPlatform("darwin");
      expect(getDefaultSkillsCacheDir()).toBe(join(homedir(), ".cache", "pilo", "skills"));
    });

    it("uses LOCALAPPDATA on Windows when set", () => {
      setPlatform("win32");
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";
      expect(getDefaultSkillsCacheDir()).toBe(
        join("C:\\Users\\Test\\AppData\\Local", "pilo", "skills"),
      );
    });

    it("falls back to ~/AppData/Local/pilo/skills on Windows when LOCALAPPDATA is unset", () => {
      setPlatform("win32");
      expect(getDefaultSkillsCacheDir()).toBe(
        join(homedir(), "AppData", "Local", "pilo", "skills"),
      );
    });

    it("ignores XDG_CACHE_HOME on Windows", () => {
      setPlatform("win32");
      process.env.XDG_CACHE_HOME = "/tmp/should-be-ignored";
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";
      const result = getDefaultSkillsCacheDir();
      expect(result).toBe(join("C:\\Users\\Test\\AppData\\Local", "pilo", "skills"));
      expect(result).not.toContain("should-be-ignored");
    });

    it("ignores LOCALAPPDATA on non-Windows platforms", () => {
      setPlatform("linux");
      process.env.LOCALAPPDATA = "C:\\Users\\Test\\AppData\\Local";
      const result = getDefaultSkillsCacheDir();
      expect(result).toBe(join(homedir(), ".cache", "pilo", "skills"));
      expect(result).not.toContain("AppData");
    });
  });
});
