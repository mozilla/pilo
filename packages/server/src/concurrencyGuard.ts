const getMax = () => Number(process.env.MAX_CONCURRENT_TASKS ?? 5);

let activeTasks = 0;

export const isAtCapacity = () => activeTasks >= getMax();

export const getMaxConcurrentTasks = getMax;

/**
 * Atomically check capacity and claim a slot. Returns true if the slot was
 * acquired (caller must call releaseSlot when done), false if at capacity.
 * Safe to call from synchronous event handlers — no await between check and
 * increment means no TOCTOU race across concurrent connections.
 */
export const acquireSlot = (): boolean => {
  if (isAtCapacity()) return false;
  activeTasks++;
  return true;
};

export const releaseSlot = (): void => {
  activeTasks--;
};

/** Exposed for unit tests only. */
export const _resetActiveTasksForTesting = (): void => {
  activeTasks = 0;
};
