/**
 * Skill cache - config -> SkillStore factory (Node-only)
 *
 * Bridges a resolved Pilo config to a constructed SkillStore. Lives in a
 * separate file (rather than directly in `index.ts`) so the dependency on
 * `./store.js` and `./paths.js` — both Node-only — stays cleanly isolated
 * from the browser-safe `core.ts` boundary.
 */
import type { PiloConfigResolved } from "../config/defaults.js";
import { SkillStore } from "./store.js";
import { getDefaultSkillsCacheDir } from "./paths.js";

/**
 * Construct a SkillStore from a resolved Pilo config, or return null if
 * skills are disabled. Use this when wiring `WebAgent` from CLI / server.
 *
 * Not available from the browser-safe `core.ts` boundary — disk I/O requires
 * Node fs/path/os.
 */
export function createSkillStoreFromConfig(config: PiloConfigResolved): SkillStore | null {
  if (!config.skills_enabled) return null;
  const cacheDir = config.skills_cache_dir ?? getDefaultSkillsCacheDir();
  return new SkillStore({
    cacheDir,
    maxHostTokens: config.skills_max_host_tokens,
  });
}
