/**
 * In-process concurrency limit for task execution.
 *
 * Bounds how many tasks can run concurrently across all SSE and WebSocket
 * connections. When at the limit, new requests get an immediate
 * `AT_CAPACITY` rejection with a `Retry-After` hint, instead of queuing
 * indefinitely on the server and tying up file descriptors / memory.
 *
 * The limit comes from `PILO_MAX_CONCURRENT_TASKS` (default 10). Read lazily
 * each call so tests can override at runtime; production reads it once at
 * startup since the env var doesn't change.
 *
 * In-process only — fine for the current single-instance deployment. If we
 * ever scale to multiple replicas, replace with a Redis-backed token bucket
 * or rely on the load balancer's queue depth.
 */

const DEFAULT_LIMIT = 10;

function parseLimit(): number {
  const env = process.env.PILO_MAX_CONCURRENT_TASKS;
  if (env === undefined) return DEFAULT_LIMIT;
  const n = Number(env);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.floor(n);
}

let inflight = 0;

/**
 * Try to acquire a task slot. Returns true on success (caller MUST eventually
 * call `release()` exactly once). Returns false when at the limit; the caller
 * should respond with an AT_CAPACITY error.
 */
export function tryAcquire(): boolean {
  if (inflight >= parseLimit()) return false;
  inflight++;
  return true;
}

/**
 * Release a previously-acquired task slot. Safe to call when the counter is
 * already at zero (no-op) so cleanup paths don't need to track acquisition
 * state precisely — but each successful `tryAcquire` should be paired with
 * exactly one release.
 */
export function release(): void {
  if (inflight > 0) inflight--;
}

/** Current number of in-flight tasks. */
export function getInflight(): number {
  return inflight;
}

/** The configured maximum (re-evaluated each call from the env var). */
export function getMaxConcurrent(): number {
  return parseLimit();
}

/** Test-only: reset the inflight counter. */
export function _resetInflight(): void {
  inflight = 0;
}
