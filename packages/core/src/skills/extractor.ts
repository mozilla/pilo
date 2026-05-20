import type { ModelMessage } from "ai";
import type { ProviderConfig } from "../provider.js";
import { ExternalContentLabel, wrapExternalContentWithWarning } from "../utils/promptSecurity.js";
import { generateTextWithRetry } from "../utils/retry.js";
import { buildSkillExtractionPrompt } from "./extractionPrompt.js";

const DEFAULT_EXTRACTION_MAX_TOKENS = 600;
const TRAJECTORY_PART_MAX_CHARS = 200;
const TRAJECTORY_RESULT_MAX_CHARS = 100;
const MAX_HEADLINE_CHARS = 80;

export interface ExtractSkillInput {
  task: string;
  host: string;
  messages: ModelMessage[];
  providerConfig: ProviderConfig;
  /** Max output tokens for the extraction call. Default 600 (~ ≤200 words). */
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
}

export interface ExtractedSkill {
  hint: string;
  taskHeadline: string;
}

/**
 * Summarize a successful task trajectory into a short NL hint about the site.
 * Returns null on any failure (caller logs and skips).
 */
export async function extractSkill(input: ExtractSkillInput): Promise<ExtractedSkill | null> {
  try {
    const trajectorySummary = summarizeTrajectory(input.messages);
    // Trajectory summary contains content derived from web pages (tool results,
    // user messages with snapshot fragments). Wrap with the external-content
    // warning so the LLM treats it as page-derived text, not instructions.
    // PageMarkdown is the closest existing label; no perfect fit for "trajectory".
    const wrappedTrajectory = wrapExternalContentWithWarning(
      trajectorySummary,
      ExternalContentLabel.PageMarkdown,
    );
    const prompt = buildSkillExtractionPrompt({
      host: input.host,
      task: input.task,
      trajectorySummary: wrappedTrajectory,
    });

    const response = await generateTextWithRetry(
      {
        ...input.providerConfig,
        prompt,
        maxOutputTokens: input.maxOutputTokens ?? DEFAULT_EXTRACTION_MAX_TOKENS,
        abortSignal: input.abortSignal,
      },
      { maxAttempts: 2 },
    );

    const text = (response.text ?? "").trim();
    if (!text || text === "SKIP") return null;

    return {
      hint: text,
      taskHeadline: truncateHeadline(input.task),
    };
  } catch (err) {
    console.warn("[skills] extractSkill failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Compress the message history into a short summary the extraction prompt can
 * fit in its context. We don't ship the full transcript — we drop snapshot
 * bodies and keep tool calls + reasoning.
 */
function summarizeTrajectory(messages: ModelMessage[]): string {
  const lines: string[] = [];
  // Note: role: "system" messages are intentionally not handled — system prompts
  // are boilerplate, not signal for skill extraction.
  for (const m of messages) {
    if (m.role === "user") {
      // Skip large page snapshots; keep first TRAJECTORY_PART_MAX_CHARS chars of any user content
      const content = typeof m.content === "string" ? m.content : "[non-text content]";
      lines.push(
        `USER: ${content.slice(0, TRAJECTORY_PART_MAX_CHARS)}${content.length > TRAJECTORY_PART_MAX_CHARS ? "..." : ""}`,
      );
    } else if (m.role === "assistant") {
      if (typeof m.content === "string") {
        lines.push(
          `ASSISTANT: ${m.content.slice(0, TRAJECTORY_PART_MAX_CHARS)}${m.content.length > TRAJECTORY_PART_MAX_CHARS ? "..." : ""}`,
        );
      } else if (Array.isArray(m.content)) {
        for (const part of m.content) {
          if (part.type === "tool-call") {
            const args = JSON.stringify(part.input).slice(0, TRAJECTORY_PART_MAX_CHARS);
            lines.push(`TOOL: ${part.toolName}(${args})`);
          } else if (part.type === "text") {
            // Assistant-spoken text — not reasoning. The `reasoning` part type
            // below is the actual think-out-loud channel; this is the model's
            // user-facing output.
            lines.push(`ASSISTANT: ${part.text.slice(0, TRAJECTORY_PART_MAX_CHARS)}`);
          } else if (part.type === "reasoning") {
            lines.push(`REASONING: ${part.text.slice(0, TRAJECTORY_PART_MAX_CHARS)}`);
          }
        }
      }
    } else if (m.role === "tool") {
      // Tool results — keep the action name and a snippet of output
      if (Array.isArray(m.content)) {
        for (const part of m.content) {
          if (part.type === "tool-result") {
            const out = JSON.stringify(part.output).slice(0, TRAJECTORY_RESULT_MAX_CHARS);
            lines.push(`RESULT: ${part.toolName} → ${out}`);
          }
        }
      }
    }
  }
  return lines.join("\n");
}

function truncateHeadline(task: string): string {
  const oneLine = task.replace(/\s+/g, " ").trim();
  return oneLine.length > MAX_HEADLINE_CHARS
    ? oneLine.slice(0, MAX_HEADLINE_CHARS - 3) + "..."
    : oneLine;
}
