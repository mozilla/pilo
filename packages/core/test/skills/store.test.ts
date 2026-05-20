import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { SkillStore, type SkillEntry } from "../../src/skills/store.js";

describe("skills/store", () => {
  let tempDir: string;
  let cacheDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "pilo-skills-test-"));
    cacheDir = join(tempDir, "skills");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function makeStore(maxHostTokens?: number): SkillStore {
    return new SkillStore({ cacheDir, maxHostTokens });
  }

  function entry(overrides: Partial<SkillEntry> = {}): SkillEntry {
    return {
      date: "2026-05-19",
      taskHeadline: "Buy a widget",
      hint: "Click the Buy Now button on the product page.",
      ...overrides,
    };
  }

  describe("read", () => {
    it("returns null when the host file does not exist", async () => {
      const store = makeStore();
      expect(await store.read("example.com")).toBe(null);
    });

    it("returns the file contents when the host file exists", async () => {
      const store = makeStore();
      await store.append("example.com", entry());
      const result = await store.read("example.com");
      expect(result).not.toBe(null);
      expect(result).toContain("Buy a widget");
      expect(result).toContain("Click the Buy Now button");
    });

    it("returns null when the cache dir does not exist", async () => {
      const store = makeStore();
      expect(existsSync(cacheDir)).toBe(false);
      expect(await store.read("example.com")).toBe(null);
    });
  });

  describe("append", () => {
    it("creates the cache dir lazily on first write", async () => {
      const store = makeStore();
      expect(existsSync(cacheDir)).toBe(false);
      await store.append("example.com", entry());
      expect(existsSync(cacheDir)).toBe(true);
    });

    it("creates a file with the correct entry format when none exists", async () => {
      const store = makeStore();
      await store.append("example.com", entry());
      const content = readFileSync(join(cacheDir, "example.com.md"), "utf-8");
      expect(content).toBe(
        "## 2026-05-19 — Buy a widget\n\nClick the Buy Now button on the product page.",
      );
    });

    it("appends a new section separated by a blank line", async () => {
      const store = makeStore();
      await store.append(
        "example.com",
        entry({ date: "2026-05-18", taskHeadline: "First task", hint: "First hint." }),
      );
      await store.append(
        "example.com",
        entry({ date: "2026-05-19", taskHeadline: "Second task", hint: "Second hint." }),
      );
      const content = readFileSync(join(cacheDir, "example.com.md"), "utf-8");
      expect(content).toBe(
        "## 2026-05-18 — First task\n\nFirst hint.\n\n## 2026-05-19 — Second task\n\nSecond hint.",
      );
    });

    it("trims leading/trailing whitespace from hint body", async () => {
      const store = makeStore();
      await store.append("example.com", entry({ hint: "  \n  Body with whitespace  \n\n" }));
      const content = readFileSync(join(cacheDir, "example.com.md"), "utf-8");
      expect(content).toBe("## 2026-05-19 — Buy a widget\n\nBody with whitespace");
    });

    it("enforces the token budget by trimming oldest sections", async () => {
      // 50 tokens * 4 chars = 200 char budget.
      const store = makeStore(50);
      // Each section is roughly 50 chars.
      for (let i = 0; i < 10; i++) {
        await store.append(
          "example.com",
          entry({
            date: `2026-05-${String(i + 1).padStart(2, "0")}`,
            taskHeadline: `Task ${i}`,
            hint: `Hint body number ${i} with some filler content.`,
          }),
        );
      }
      const content = readFileSync(join(cacheDir, "example.com.md"), "utf-8");
      // File should be at or under 200 chars (best-effort — see note in store).
      expect(content.length).toBeLessThanOrEqual(200);
      // The most recent section must be present.
      expect(content).toContain("Task 9");
      // The oldest section should have been dropped.
      expect(content).not.toContain("Task 0");
    });

    it("never trims the just-written newest entry, even if it alone exceeds the budget", async () => {
      // 10 tokens * 4 chars = 40 char budget. A single entry will exceed this.
      const store = makeStore(10);
      const bigEntry = entry({
        taskHeadline: "Big task with a long headline that exceeds budget alone",
        hint: "This hint body is intentionally longer than the 40 char budget so we can verify retention.",
      });
      await store.append("example.com", bigEntry);
      const content = readFileSync(join(cacheDir, "example.com.md"), "utf-8");
      // The single newest entry must be retained in full.
      expect(content).toContain("Big task with a long headline");
      expect(content).toContain("intentionally longer than the 40 char budget");
    });

    it("uses the default token budget when none is provided", async () => {
      const store = makeStore();
      // Add a small entry; should fit comfortably in the default 4000-token budget.
      await store.append("example.com", entry());
      const content = readFileSync(join(cacheDir, "example.com.md"), "utf-8");
      expect(content.length).toBeLessThan(4000 * 4);
      expect(content).toContain("Buy a widget");
    });
  });

  describe("clear", () => {
    it("removes only the specified host's file when host is given", async () => {
      const store = makeStore();
      await store.append("a.example.com", entry({ taskHeadline: "Task A" }));
      await store.append("b.example.com", entry({ taskHeadline: "Task B" }));

      await store.clear("a.example.com");

      expect(existsSync(join(cacheDir, "a.example.com.md"))).toBe(false);
      expect(existsSync(join(cacheDir, "b.example.com.md"))).toBe(true);
    });

    it("removes all *.md files when no host arg is given", async () => {
      const store = makeStore();
      await store.append("a.example.com", entry({ taskHeadline: "Task A" }));
      await store.append("b.example.com", entry({ taskHeadline: "Task B" }));

      await store.clear();

      expect(existsSync(join(cacheDir, "a.example.com.md"))).toBe(false);
      expect(existsSync(join(cacheDir, "b.example.com.md"))).toBe(false);
    });

    it("leaves non-md files alone when clearing without a host arg", async () => {
      const store = makeStore();
      await store.append("a.example.com", entry());
      // Drop a non-md file in the cache dir.
      const nonMd = join(cacheDir, "keep-me.txt");
      writeFileSync(nonMd, "not a skill file");

      await store.clear();

      expect(existsSync(join(cacheDir, "a.example.com.md"))).toBe(false);
      expect(existsSync(nonMd)).toBe(true);
    });

    it("is a no-op when the cache dir does not exist", async () => {
      const store = makeStore();
      expect(existsSync(cacheDir)).toBe(false);
      // Should not throw.
      await expect(store.clear()).resolves.toBeUndefined();
      await expect(store.clear("anything.example.com")).resolves.toBeUndefined();
    });

    it("is a no-op when clearing a host whose file does not exist", async () => {
      const store = makeStore();
      await store.append("a.example.com", entry());
      // Should not throw.
      await expect(store.clear("nonexistent.example.com")).resolves.toBeUndefined();
      // The existing file should still be present.
      expect(existsSync(join(cacheDir, "a.example.com.md"))).toBe(true);
    });
  });

  describe("filename escaping", () => {
    it("URL-encodes ':' (port separator) in host filenames", async () => {
      const store = makeStore();
      await store.append("localhost:3000", entry({ taskHeadline: "Local task" }));
      // encodeURIComponent turns ":" into "%3A".
      expect(existsSync(join(cacheDir, "localhost%3A3000.md"))).toBe(true);
      expect(existsSync(join(cacheDir, "localhost:3000.md"))).toBe(false);
    });

    it("reads back content written under an escaped host name", async () => {
      const store = makeStore();
      await store.append("localhost:3000", entry({ taskHeadline: "Local task" }));
      const content = await store.read("localhost:3000");
      expect(content).toContain("Local task");
    });

    it("clear(host) uses the same escaping rule", async () => {
      const store = makeStore();
      await store.append("localhost:3000", entry());
      await store.clear("localhost:3000");
      expect(existsSync(join(cacheDir, "localhost%3A3000.md"))).toBe(false);
    });

    it("accepts hostnames containing underscores", async () => {
      // Some dev/staging hosts and CDNs return underscored hostnames; these
      // are valid WHATWG host shapes and must round-trip cleanly.
      const store = makeStore();
      await expect(
        store.append("my_dev.example.com", entry({ taskHeadline: "Underscored host" })),
      ).resolves.toBeUndefined();
      const content = await store.read("my_dev.example.com");
      expect(content).toContain("Underscored host");
    });

    it("accepts IPv6 literals with port and round-trips them", async () => {
      const store = makeStore();
      await expect(
        store.append("[::1]:3000", entry({ taskHeadline: "IPv6 host" })),
      ).resolves.toBeUndefined();
      // Filename must be deterministic for the same input host.
      const files = readdirSync(cacheDir).filter((f) => f.endsWith(".md"));
      expect(files.length).toBe(1);
      // A second append to the same host must land in the same file.
      await store.append("[::1]:3000", entry({ taskHeadline: "Second IPv6 task" }));
      const filesAfter = readdirSync(cacheDir).filter((f) => f.endsWith(".md"));
      expect(filesAfter.length).toBe(1);
      const content = await store.read("[::1]:3000");
      expect(content).toContain("IPv6 host");
      expect(content).toContain("Second IPv6 task");
    });
  });

  describe("atomic write", () => {
    it("survives concurrent appends with well-formed output (last-writer-wins, intermediate entries may be lost)", async () => {
      const store = makeStore();
      // Fire several appends in parallel. append() is not concurrency-safe:
      // each call does a read-modify-write, so two appends in flight will both
      // read the pre-append content and one will overwrite the other (TOCTOU).
      // The atomic-rename strategy guarantees the on-disk file is always
      // well-formed markdown — never half-written — but we cannot assert that
      // all entries survive. See the JSDoc warning on SkillStore.append().
      const appends = Array.from({ length: 5 }, (_, i) =>
        store.append(
          "example.com",
          entry({
            date: `2026-05-${String(i + 10).padStart(2, "0")}`,
            taskHeadline: `Task ${i}`,
            hint: `Hint ${i}`,
          }),
        ),
      );
      await Promise.all(appends);

      const content = readFileSync(join(cacheDir, "example.com.md"), "utf-8");
      // Each section must start with "## " and be well-formed.
      const sections = content.split(/\n(?=## )/);
      expect(sections.length).toBeGreaterThan(0);
      for (const section of sections) {
        expect(section.startsWith("## ")).toBe(true);
      }
      // At least one of the writers must have landed (the last successful one).
      // We don't assert which — concurrent reordering is allowed.
      const taskMatches = content.match(/Task \d/g) ?? [];
      expect(taskMatches.length).toBeGreaterThanOrEqual(1);
      // No leftover tmp files in the cache dir.
      const files = readdirSync(cacheDir);
      const tmpFiles = files.filter((f) => f.includes(".tmp."));
      expect(tmpFiles).toEqual([]);
    });
  });

  describe("path traversal hardening", () => {
    // Hosts that must be rejected at the validator. Note: embedded whitespace
    // is accepted by the validator (it's not a traversal vector) and gets
    // URL-encoded into the filename; only chars that could escape the cache
    // directory or smuggle a filename across newlines are rejected.
    const invalidHosts: Array<[string, string]> = [
      ["../etc/passwd", "parent directory traversal"],
      ["foo/bar", "embedded slash"],
      ["foo\\bar", "embedded backslash"],
      ["", "empty string"],
      ["example.com\0evil", "embedded null byte"],
      ["example.com\nevil", "embedded newline"],
      ["example.com\revil", "embedded carriage return"],
      ["..", "lone parent directory"],
      ["a..b", "double-dot anywhere in the host"],
    ];

    for (const [host, description] of invalidHosts) {
      it(`read() rejects ${description}: ${JSON.stringify(host)}`, async () => {
        const store = makeStore();
        await expect(store.read(host)).rejects.toThrow(/Invalid host/);
      });

      it(`append() rejects ${description}: ${JSON.stringify(host)}`, async () => {
        const store = makeStore();
        await expect(store.append(host, entry())).rejects.toThrow(/Invalid host/);
      });

      it(`clear(host) rejects ${description}: ${JSON.stringify(host)}`, async () => {
        const store = makeStore();
        await expect(store.clear(host)).rejects.toThrow(/Invalid host/);
      });
    }

    it("accepts a plain hostname", async () => {
      const store = makeStore();
      await expect(store.read("example.com")).resolves.toBe(null);
    });

    it("accepts a hostname with port", async () => {
      const store = makeStore();
      await expect(store.read("localhost:3000")).resolves.toBe(null);
    });

    it("accepts a hostname with underscores", async () => {
      const store = makeStore();
      await expect(store.read("my_dev.example.com")).resolves.toBe(null);
    });

    it("accepts IPv6 literals with port", async () => {
      const store = makeStore();
      await expect(store.read("[::1]:3000")).resolves.toBe(null);
    });
  });
});
