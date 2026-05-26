export const SECURITY_BLOCKED_CONTEXT_EXFILTRATION =
  "Security policy blocked a form fill that appears to contain agent context or prompt data";

export type SecurityAssessment =
  | { allowed: true }
  | { allowed: false; reason: string; isRecoverable: true };

export interface FillAssessmentInput {
  value: string;
}

const CONTEXT_EXFILTRATION_PATTERNS = [
  /system prompt/i,
  /developer prompt/i,
  /conversation history/i,
  /tool results?/i,
  /page snapshots?/i,
  /<\s*external-content\b/i,
  /<\/\s*external-content\s*>/i,
  /you are an expert at completing tasks using a web browser/i,
  /available tools/i,
  /mandatory guardrails/i,
];

const GENERATED_TEXT_LINE_LIMIT = 2;

export function assessFillValue(input: FillAssessmentInput): SecurityAssessment {
  const value = input.value.trim();

  if (
    value &&
    (CONTEXT_EXFILTRATION_PATTERNS.some((pattern) => pattern.test(value)) ||
      value.split(/\r?\n/).length > GENERATED_TEXT_LINE_LIMIT)
  ) {
    return {
      allowed: false,
      reason: SECURITY_BLOCKED_CONTEXT_EXFILTRATION,
      isRecoverable: true,
    };
  }

  return { allowed: true };
}
