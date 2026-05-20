/**
 * Skill cache - host resolver
 *
 * Resolves a URL string to a canonical host string suitable for use as a
 * skill cache key. Returns null for non-http(s) URLs or malformed input.
 *
 * The host string follows WHATWG URL semantics: includes the port for
 * non-default ports (e.g., "localhost:3000"), lowercased automatically,
 * and excludes any userinfo (username:password@) component.
 */
export function resolveHost(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.host; // includes port for non-default ports (e.g., "localhost:3000")
  } catch {
    return null;
  }
}
