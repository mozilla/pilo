/**
 * Skill cache - default paths (Node-only)
 *
 * Resolves the default cache directory for skill files. Honors XDG_CACHE_HOME
 * on Linux/macOS and LOCALAPPDATA on Windows, falling back to platform-typical
 * locations otherwise.
 *
 * IMPORTANT: This module depends on Node.js `path` and `os` and must not be
 * imported from browser-safe contexts.
 */
import { join } from "path";
import { homedir } from "os";

/**
 * Returns the platform-appropriate default directory for the skill cache.
 *
 * Use this when constructing a `SkillStore` without a user-configured
 * `skills_cache_dir` (the `WebAgent` integration calls this to resolve the
 * default).
 *
 * - Linux/macOS: `$XDG_CACHE_HOME/pilo/skills` (falls back to `~/.cache/pilo/skills`)
 * - Windows: `%LOCALAPPDATA%/pilo/skills` (falls back to `~/AppData/Local/pilo/skills`)
 */
export function getDefaultSkillsCacheDir(): string {
  if (process.platform === "win32") {
    const base = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
    return join(base, "pilo", "skills");
  }
  const xdg = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
  return join(xdg, "pilo", "skills");
}
