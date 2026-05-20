const getMax = () => Number(process.env.MAX_CONCURRENT_TASKS ?? 3);

let activeTasks = 0;
let draining = false;

export const isAtCapacity = () => activeTasks >= getMax();

export const getMaxConcurrentTasks = getMax;

/** Returns the number of tasks currently executing. */
export const getActiveTasks = (): number => activeTasks;

/**
 * Enter drain mode. Once set, acquireSlot() always returns false so no new
 * tasks are accepted. Intended for graceful shutdown.
 */
export const setDraining = (): void => {
  draining = true;
};

/**
 * Atomically check capacity and claim a slot. Returns true if the slot was
 * acquired (caller must call releaseSlot when done), false if at capacity or
 * draining.
 * Safe to call from synchronous event handlers — no await between check and
 * increment means no TOCTOU race across concurrent connections.
 */
export const acquireSlot = (): boolean => {
  if (draining || isAtCapacity()) return false;
  activeTasks++;
  return true;
};

export const releaseSlot = (): void => {
  activeTasks--;
};

/** Exposed for unit tests only. */
export const _resetActiveTasksForTesting = (): void => {
  activeTasks = 0;
  draining = false;
};
