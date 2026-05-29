/**
 * Sentinel prefixes for feedback user messages.
 * Placed in a separate file to avoid circular imports between prompts.ts and webAgent.ts.
 * webAgent.ts re-exports these constants.
 */

/** Sentinel prefix on `[STEP-ERROR-FEEDBACK]` user messages. Used by `trimOldHistory` pass 4. */
export const STEP_ERROR_FEEDBACK_PREFIX = "[STEP-ERROR-FEEDBACK]\n";

/** Sentinel prefix on `[VALIDATION-FEEDBACK]` user messages. Used by `trimOldHistory` pass 4. */
export const VALIDATION_FEEDBACK_PREFIX = "[VALIDATION-FEEDBACK]\n";

/** Sentinel prefix on `[REPEATED-ACTION-WARNING]` user messages. Used by `trimOldHistory` pass 4. */
export const REPETITION_WARNING_PREFIX = "[REPEATED-ACTION-WARNING]\n";
