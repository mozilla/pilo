/**
 * Skill cache - per-host storage (Node-only)
 *
 * Stores natural-language skill hints in one markdown file per host. Each
 * call to `append()` writes a dated section, trimming the oldest sections
 * once the file exceeds an approximate token budget. The most recently
 * written section is never trimmed.
 *
 * IMPORTANT: This module performs disk I/O via Node.js `fs` and must not be
 * imported from browser-safe contexts.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  readdirSync,
} from "fs";
import { randomUUID } from "node:crypto";
import { join } from "path";

/** Approximate chars-per-token heuristic for the trim budget. Replace with a
 *  real tokenizer if precision becomes important. */
const CHARS_PER_TOKEN_APPROX = 4;

export interface SkillEntry {
  /** ISO date string, YYYY-MM-DD */
  date: string;
  /** Short task headline (truncated to ~80 chars) */
  taskHeadline: string;
  /** The NL hint body */
  hint: string;
}

export interface SkillStoreOptions {
  cacheDir: string;
  /** Approximate token budget per host file. Default 4000. */
  maxHostTokens?: number;
}

export class SkillStore {
  constructor(private readonly options: SkillStoreOptions) {}

  /** Returns the host file's raw markdown, or null if absent. */
  async read(host: string): Promise<string | null> {
    const path = this.pathFor(host);
    if (!existsSync(path)) return null;
    try {
      return readFileSync(path, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Appends a new section, then trims oldest sections if over the token budget.
   *
   * **Not safe for concurrent calls on the same host.** Calls are not
   * serialized — two appends in flight will both read the pre-append content
   * and one will overwrite the other. The agent's extraction path serializes
   * naturally (one await call per run), so this is fine for v1. If a future
   * consumer needs concurrent writes, add per-host serialization (e.g., a
   * `Map<host, Promise<void>>` chain).
   */
  async append(host: string, entry: SkillEntry): Promise<void> {
    const path = this.pathFor(host);
    if (!existsSync(this.options.cacheDir)) {
      mkdirSync(this.options.cacheDir, { recursive: true });
    }
    const existing = (await this.read(host)) ?? "";
    const section = this.formatEntry(entry);
    const updated = existing ? `${existing}\n\n${section}` : section;
    const trimmed = this.trimToBudget(updated);
    this.atomicWrite(path, trimmed);
  }

  /** Remove one host's file, or (with no arg) the whole cache dir's *.md. */
  async clear(host?: string): Promise<void> {
    if (host !== undefined) {
      // pathFor() validates the host; an empty/invalid string throws here
      // rather than silently falling through to the clear-all path.
      const path = this.pathFor(host);
      if (existsSync(path)) unlinkSync(path);
      return;
    }
    if (!existsSync(this.options.cacheDir)) return;
    for (const file of readdirSync(this.options.cacheDir)) {
      if (file.endsWith(".md")) unlinkSync(join(this.options.cacheDir, file));
    }
  }

  private pathFor(host: string): string {
    // SkillStore is part of the public API; typical callers go through
    // WebAgent and have already passed through resolveHost(), but external
    // callers might not. We defend against path traversal here rather than
    // trusting the input shape.
    //
    // We intentionally allow underscores (some dev/staging/CDN hosts have
    // them) and IPv6 literals (e.g. "[::1]:3000") — both are valid WHATWG
    // host shapes that a stricter regex would reject. The list below is the
    // minimum set of characters that would let an attacker escape the cache
    // directory or smuggle a filename across newlines.
    if (
      typeof host !== "string" ||
      host.length === 0 ||
      host.includes("/") ||
      host.includes("\\") ||
      host.includes("..") ||
      host.includes("\0") ||
      host.includes("\n") ||
      host.includes("\r")
    ) {
      throw new Error(`Invalid host: ${JSON.stringify(host)}`);
    }
    // encodeURIComponent handles ":", "[", "]", and other URL-safe-but-not-FS-safe
    // characters. The result is deterministic and reversible (not that we need
    // to reverse it — the host is always passed back in by the caller).
    const safe = encodeURIComponent(host);
    return join(this.options.cacheDir, `${safe}.md`);
  }

  private formatEntry(entry: SkillEntry): string {
    return `## ${entry.date} — ${entry.taskHeadline}\n\n${entry.hint.trim()}`;
  }

  private trimToBudget(content: string): string {
    const max = this.options.maxHostTokens ?? 4000;
    // Approximate: CHARS_PER_TOKEN_APPROX chars per token. Cheap, no tokenizer dependency.
    const maxChars = max * CHARS_PER_TOKEN_APPROX;
    if (content.length <= maxChars) return content;
    // Drop oldest sections (sections start with "## "). Keep the newest entry
    // even if it alone exceeds the budget — never truncate the just-written one.
    const sections = content.split(/\n(?=## )/);
    while (sections.length > 1 && sections.join("\n").length > maxChars) {
      sections.shift();
    }
    return sections.join("\n");
  }

  private atomicWrite(path: string, content: string): void {
    const tmp = `${path}.tmp.${randomUUID()}`;
    writeFileSync(tmp, content, "utf-8");
    renameSync(tmp, path);
  }
}
