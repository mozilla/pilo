/**
 * Web Action Tools
 *
 * Defines browser automation tools using AI SDK's tool() helper.
 * Each tool includes description, inputSchema, and execute function.
 */

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import {
  AriaBrowser,
  FieldMetadata,
  FileUploadConfig,
  PageAction,
  SCROLL_DIRECTIONS,
} from "../browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { buildExtractionPrompt, TOOL_STRINGS } from "../prompts.js";
import type { ProviderConfig } from "../provider.js";
import { BrowserException } from "../errors.js";
import { generateTextWithRetry } from "../utils/retry.js";
import { wrapExternalContentWithWarning, ExternalContentLabel } from "../utils/promptSecurity.js";
import {
  assessFill,
  assessFormSubmission,
  assessNavigation,
  assessDataFill,
  collectSensitiveValues,
  redactSensitiveValues,
  extractHostname,
  type FirewallConfig,
} from "../security/actionFirewall.js";
import type { FirewallBlockedNonInteractiveEventData } from "../events.js";
import { buildFirewallRemediations } from "../security/firewallRemediations.js";
import {
  withSpan,
  SpanStatusCode,
  SpanName,
  recordSanitizedException,
} from "../telemetry/tracing.js";

interface WebActionContext {
  browser: AriaBrowser;
  eventEmitter: WebAgentEventEmitter;
  providerConfig: ProviderConfig;
  abortSignal?: AbortSignal;
  approvedRefs?: ReadonlySet<string>;
  agentFilledRefs: Set<string>;
  operationalRefs: Set<string>;
  firewall: FirewallConfig;
  interactive: boolean;
  allowFileUpload?: false | FileUploadConfig;
  /** Timeout for LLM provider calls in milliseconds (used by extract). */
  llmProviderTimeoutMs?: number;
  /**
   * Caller-supplied Input Data, keyed by name. When present with ≥1 key, the
   * fill_user_data tool is exposed so the agent can fill fields by key without
   * ever seeing the values — they are substituted directly at the browser sink.
   */
  data?: Record<string, unknown>;
}

/**
 * Tool output structure for browser actions
 * This structure is guaranteed to be consistent for easy error checking:
 * - success: always present, indicates if action succeeded
 * - action: always present, the action that was attempted
 * - error: present when success is false, contains error message
 * - isRecoverable: present when error is recoverable (browser exceptions)
 * - ref/value: present when provided as input
 */
type ActionResult = {
  success: boolean;
  action: string;
  ref?: string;
  value?: string | number;
  error?: string;
  isRecoverable?: boolean;
  // Snapshot-time role + accessible name for the targeted element. Optional
  // (only populated when a ref is provided and the browser can resolve it).
  // Used by the repetition detector to distinguish logical targets even
  // when ref strings churn between snapshots.
  targetIdentity?: { role: string; name: string };
};

const EMPTY_APPROVED_REFS = new Set<string>();

function emitNonInteractiveBlock(
  context: WebActionContext,
  kind: "freeform-fill" | "form-submission" | "navigation",
  reason: string,
  pageHostname: string | null,
  formActionHostnames: string[],
): void {
  if (context.interactive) return;
  const hostsForRemediation =
    pageHostname === null ? formActionHostnames : [pageHostname, ...formActionHostnames];
  const data: FirewallBlockedNonInteractiveEventData = {
    timestamp: Date.now(),
    iterationId: "",
    reason,
    kind,
    pageHostname,
    formActionHostnames,
    remediations: buildFirewallRemediations(hostsForRemediation),
  };
  context.eventEmitter.emit(WebAgentEventType.FIREWALL_BLOCKED_NON_INTERACTIVE, data);
}

function failedActionResult(
  action: string,
  error: string,
  context: WebActionContext,
  ref?: string,
  value?: string | number,
): ActionResult {
  context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
    success: false,
    action,
    error,
    isRecoverable: true,
  });

  return {
    success: false,
    action,
    ...(ref && { ref }),
    ...(value !== undefined && { value }),
    error,
    isRecoverable: true,
  };
}

async function assessFormSubmissionForAction(
  action: PageAction.Click | PageAction.Enter,
  context: WebActionContext,
  ref: string,
): Promise<ActionResult | null> {
  try {
    const [form, pageUrl] = await Promise.all([
      context.browser.getFormSubmissionContext(
        ref,
        action === PageAction.Click ? "click" : "enter",
      ),
      context.browser.getUrl(),
    ]);
    if (!form) return null;
    const pageHostname = extractHostname(pageUrl);
    const formActionHostnames = [
      extractHostname(form.actionUrl),
      extractHostname(form.submitterActionUrl),
    ].filter((h): h is string => h !== null);

    const assessment = assessFormSubmission({
      form,
      approvedRefs: context.approvedRefs ?? EMPTY_APPROVED_REFS,
      agentFilledRefs: context.agentFilledRefs,
      operationalRefs: context.operationalRefs,
      pageHostname,
      firewall: context.firewall,
    });

    if (!assessment.allowed) {
      emitNonInteractiveBlock(
        context,
        "form-submission",
        assessment.reason,
        pageHostname,
        formActionHostnames,
      );
      return failedActionResult(action, assessment.reason, context, ref);
    }
  } catch (error) {
    if (error instanceof BrowserException) {
      return failedActionResult(action, error.message, context, ref);
    }
    throw error;
  }

  return null;
}

/**
 * Helper function to perform an action with full error handling and logging
 * Handles browser exceptions and converts them to recoverable errors for the agent
 *
 * IMPORTANT: When this returns an error (success: false), the error is already
 * included in the tool result that the LLM sees. The agent layer should NOT
 * add a duplicate user message for these errors.
 */
async function performActionWithValidation(
  action: PageAction,
  context: WebActionContext,
  ref?: string,
  value?: string,
): Promise<ActionResult> {
  return withSpan(
    SpanName.BROWSER_ACTION,
    {
      attributes: {
        "pilo.browser.action_type": String(action),
        ...(ref && { "pilo.browser.element_ref": ref }),
      },
    },
    async (span) => {
      try {
        // Emit action started events
        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action,
          ref,
          value,
        });

        context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_STARTED, {
          action,
          ref,
          value,
        });

        // Capture target identity BEFORE the action runs — the snapshot's
        // identity map is the basis for the ref the LLM emitted, and the
        // action itself may invalidate the ref by causing navigation or DOM
        // teardown. Identity is advisory; null means we just won't fold it
        // into the repetition signature for this turn.
        let targetIdentity: { role: string; name: string } | undefined;
        if (ref) {
          const id = await context.browser.getRefIdentity(ref);
          if (id) targetIdentity = id;
        }

        // Perform the action
        await context.browser.performAction(ref || "", action, value);

        // Emit success
        context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
          success: true,
          action,
        });

        span.setAttribute("pilo.browser.success", true);
        return {
          success: true,
          action,
          ...(ref && { ref }),
          ...(value !== undefined && { value }),
          ...(targetIdentity && { targetIdentity }),
        };
      } catch (error) {
        // For browser exceptions, emit failure with error details and return error info
        if (error instanceof BrowserException) {
          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: false,
            action,
            error: error.message,
            isRecoverable: true,
          });

          span.setAttribute("pilo.browser.success", false);
          span.setAttribute("pilo.browser.recoverable", true);
          // Do NOT set span status ERROR for recoverable browser exceptions
          return {
            success: false,
            action,
            ...(ref && { ref }),
            ...(value !== undefined && { value }),
            error: error.message,
            isRecoverable: true,
          };
        }

        // For non-browser errors, emit failure without recoverable flag and re-throw
        context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
          success: false,
          action,
        });

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.constructor.name : "Unknown",
        });
        recordSanitizedException(span, error);
        throw error;
      }
    },
  );
}

/**
 * Choose the browser action for filling a caller-data field based on its type:
 * <select> uses Select, checkbox/radio inputs use Check, everything else Fill.
 */
function userDataFillAction(metadata: FieldMetadata): PageAction {
  const tagName = metadata.tagName.toLowerCase();
  if (tagName === "select") return PageAction.Select;
  const inputType = metadata.inputType?.toLowerCase() ?? null;
  if (inputType === "checkbox" || inputType === "radio") return PageAction.Check;
  return PageAction.Fill;
}

export function createWebActionTools(context: WebActionContext): ToolSet {
  if (!context.agentFilledRefs || !context.operationalRefs) {
    throw new Error("Web action provenance tracking sets are required");
  }
  if (!context.firewall) {
    throw new Error("FirewallConfig is required on WebActionContext");
  }
  if (typeof context.interactive !== "boolean") {
    throw new Error("interactive flag is required on WebActionContext");
  }

  const tools: ToolSet = {
    click: tool({
      description: TOOL_STRINGS.webActions.click.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        const blocked = await assessFormSubmissionForAction(PageAction.Click, context, ref);
        if (blocked) return blocked;

        return await performActionWithValidation(PageAction.Click, context, ref);
      },
    }),

    fill: tool({
      description: TOOL_STRINGS.webActions.fill.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
        value: z.string().describe(TOOL_STRINGS.webActions.common.textValue),
      }),
      execute: async ({ ref, value }) => {
        try {
          const [metadata, pageUrl] = await Promise.all([
            context.browser.getFieldMetadata(ref),
            context.browser.getUrl(),
          ]);
          const pageHostname = extractHostname(pageUrl);
          const userApproved = Boolean(context.approvedRefs?.has(ref));
          const assessment = assessFill({
            field: metadata,
            source: userApproved ? "user-approved" : "agent",
            pageHostname,
            firewall: context.firewall,
          });

          if (!assessment.allowed) {
            emitNonInteractiveBlock(context, "freeform-fill", assessment.reason, pageHostname, []);
            return failedActionResult(PageAction.Fill, assessment.reason, context, ref);
          }

          const result = await performActionWithValidation(PageAction.Fill, context, ref, value);
          if (result.success && !userApproved) {
            context.agentFilledRefs.add(ref);
            if (assessment.operational) {
              context.operationalRefs.add(ref);
            }
          }
          return result;
        } catch (error) {
          if (error instanceof BrowserException) {
            return failedActionResult(PageAction.Fill, error.message, context, ref);
          }
          throw error;
        }
      },
    }),

    upload_file: tool({
      description: TOOL_STRINGS.webActions.uploadFile.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.uploadFile.ref),
        path: z.string().describe(TOOL_STRINGS.webActions.uploadFile.path),
      }),
      execute: async ({ ref, path }) => {
        const uploadConfig = context.allowFileUpload;
        if (!uploadConfig || uploadConfig.allowedPaths.length === 0) {
          return failedActionResult(PageAction.UploadFile, "upload_disabled", context, ref, path);
        }

        return await performActionWithValidation(PageAction.UploadFile, context, ref, path);
      },
    }),

    select: tool({
      description: TOOL_STRINGS.webActions.select.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
        value: z.string().describe(TOOL_STRINGS.webActions.select.value),
      }),
      execute: async ({ ref, value }) => {
        return await performActionWithValidation(PageAction.Select, context, ref, value);
      },
    }),

    hover: tool({
      description: TOOL_STRINGS.webActions.hover.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        return await performActionWithValidation(PageAction.Hover, context, ref);
      },
    }),

    check: tool({
      description: TOOL_STRINGS.webActions.check.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        return await performActionWithValidation(PageAction.Check, context, ref);
      },
    }),

    uncheck: tool({
      description: TOOL_STRINGS.webActions.uncheck.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        return await performActionWithValidation(PageAction.Uncheck, context, ref);
      },
    }),

    focus: tool({
      description: TOOL_STRINGS.webActions.focus.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        return await performActionWithValidation(PageAction.Focus, context, ref);
      },
    }),

    enter: tool({
      description: TOOL_STRINGS.webActions.enter.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.common.elementRef),
      }),
      execute: async ({ ref }) => {
        const blocked = await assessFormSubmissionForAction(PageAction.Enter, context, ref);
        if (blocked) return blocked;

        return await performActionWithValidation(PageAction.Enter, context, ref);
      },
    }),

    wait: tool({
      description: TOOL_STRINGS.webActions.wait.description,
      inputSchema: z.object({
        seconds: z.number().min(0).max(120).describe(TOOL_STRINGS.webActions.wait.seconds),
      }),
      execute: async ({ seconds }) => {
        // Sleep here rather than going through browser.performAction (which
        // calls page.waitForTimeout — a fixed, abort-blind timeout). Polling
        // the abort signal keeps user aborts responsive to within ~500ms even
        // at the full 120s cap.
        return withSpan(
          SpanName.BROWSER_ACTION,
          { attributes: { "pilo.browser.action_type": "wait" } },
          async (span) => {
            context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
              action: "wait",
              value: String(seconds),
            });
            context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_STARTED, {
              action: "wait",
              value: String(seconds),
            });

            const ABORT_POLL_MS = 500;
            const deadline = Date.now() + seconds * 1000;
            while (Date.now() < deadline) {
              if (context.abortSignal?.aborted) {
                const error = new Error("Wait cancelled by abort signal");
                context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
                  success: false,
                  action: "wait",
                  error: error.message,
                });
                span.setAttribute("pilo.browser.success", false);
                throw error;
              }
              await new Promise((resolve) =>
                setTimeout(resolve, Math.min(ABORT_POLL_MS, deadline - Date.now())),
              );
            }

            context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
              success: true,
              action: "wait",
            });
            context.eventEmitter.emit(WebAgentEventType.AGENT_WAITING, { seconds });
            span.setAttribute("pilo.browser.success", true);

            return {
              success: true,
              action: "wait",
              value: String(seconds),
            };
          },
        );
      },
    }),

    scroll: tool({
      description: TOOL_STRINGS.webActions.scroll.description,
      inputSchema: z.object({
        direction: z.enum(SCROLL_DIRECTIONS).describe(TOOL_STRINGS.webActions.scroll.direction),
      }),
      execute: async ({ direction }) => {
        return await performActionWithValidation(PageAction.Scroll, context, undefined, direction);
      },
    }),

    goto: tool({
      description: TOOL_STRINGS.webActions.goto.description,
      inputSchema: z.object({
        url: z.url().describe(TOOL_STRINGS.webActions.goto.url),
      }),
      execute: async ({ url }) => {
        const assessment = assessNavigation({ targetUrl: url, firewall: context.firewall });
        if (!assessment.allowed) {
          // For a navigation block the relevant host is the target, so pass it
          // as the remediation host (add it to trusted_hostnames to allow).
          const targetHostname = extractHostname(url);
          emitNonInteractiveBlock(context, "navigation", assessment.reason, targetHostname, []);
          return failedActionResult(PageAction.Goto, assessment.reason, context, undefined, url);
        }

        const result = await performActionWithValidation(PageAction.Goto, context, undefined, url);

        if (result.success) {
          // Get page info after navigation
          const [title, currentUrl] = await Promise.all([
            context.browser.getTitle(),
            context.browser.getUrl(),
          ]);
          context.eventEmitter.emit(WebAgentEventType.BROWSER_NAVIGATED, {
            title,
            url: currentUrl,
          });
          return { ...result, title };
        }

        return result;
      },
    }),

    back: tool({
      description: TOOL_STRINGS.webActions.back.description,
      inputSchema: z.object({}),
      execute: async () => {
        const result = await performActionWithValidation(PageAction.Back, context);

        if (result.success) {
          // Get page info after navigation
          const [title, url] = await Promise.all([
            context.browser.getTitle(),
            context.browser.getUrl(),
          ]);
          context.eventEmitter.emit(WebAgentEventType.BROWSER_NAVIGATED, { title, url });
        }

        return result;
      },
    }),

    forward: tool({
      description: TOOL_STRINGS.webActions.forward.description,
      inputSchema: z.object({}),
      execute: async () => {
        const result = await performActionWithValidation(PageAction.Forward, context);

        if (result.success) {
          // Get page info after navigation
          const [title, url] = await Promise.all([
            context.browser.getTitle(),
            context.browser.getUrl(),
          ]);
          context.eventEmitter.emit(WebAgentEventType.BROWSER_NAVIGATED, { title, url });
        }

        return result;
      },
    }),

    extract: tool({
      description: TOOL_STRINGS.webActions.extract.description,
      inputSchema: z.object({
        description: z.string().describe(TOOL_STRINGS.webActions.extract.dataDescription),
      }),
      execute: async ({ description }) => {
        // Extract doesn't use browser.performAction - it's a special AI operation
        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "extract",
          value: description,
        });

        // Get the page markdown content
        let markdown = await context.browser.getMarkdown();

        // Redact any caller-data secret that the page echoes back (e.g. a value
        // just placed via fill_user_data), so it does not re-enter the model
        // context through the extracted content.
        if (context.data) {
          markdown = redactSensitiveValues(markdown, collectSensitiveValues(context.data));
        }

        // Build extraction prompt
        const prompt = buildExtractionPrompt(description, markdown);

        // Use the provider to extract the data with retry
        const extractResponse = await generateTextWithRetry(
          {
            ...context.providerConfig,
            prompt,
            maxOutputTokens: 5000,
            abortSignal: context.abortSignal,
            timeout: context.llmProviderTimeoutMs,
          },
          {
            maxAttempts: 3,
            onRetry: (attempt, error) => {
              context.eventEmitter.emit(WebAgentEventType.AGENT_STATUS, {
                message: `Extract retry attempt ${attempt} after error: ${error instanceof Error ? error.message : String(error)}`,
              });
            },
          },
        );

        // Emit the extracted data event
        context.eventEmitter.emit(WebAgentEventType.AGENT_EXTRACTED, {
          extractedData: extractResponse.text,
        });

        return {
          success: true,
          action: "extract",
          description,
          extractedData: wrapExternalContentWithWarning(
            extractResponse.text,
            ExternalContentLabel.ExtractResult,
          ),
        };
      },
    }),

    done: tool({
      description: TOOL_STRINGS.webActions.done.description,
      inputSchema: z.object({
        result: z.string().describe(TOOL_STRINGS.webActions.done.result),
      }),
      execute: async ({ result }) => {
        // Done is a terminal action - doesn't interact with browser
        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "done",
          value: result,
        });
        return { success: true, action: "done", result, isTerminal: true };
      },
    }),

    abort: tool({
      description: TOOL_STRINGS.webActions.abort.description,
      inputSchema: z.object({
        reason: z.string().describe(TOOL_STRINGS.webActions.abort.reason),
      }),
      execute: async ({ reason }) => {
        // Abort is a terminal action - doesn't interact with browser
        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "abort",
          value: reason,
        });
        return { success: true, action: "abort", reason, isTerminal: true };
      },
    }),
  };

  // Only expose fill_user_data when the caller supplied Input Data. It fills a
  // field with one of those values by key: the resolved value goes straight to
  // the browser sink and is NEVER returned or emitted (only the "{{key}}" mask
  // or the key). It is routed through the SAME firewall gate as the regular fill
  // tool and records provenance in agentFilledRefs (NEVER approvedRefs), so a
  // prompt-injected model cannot exfiltrate caller data to an untrusted host.
  if (context.data && Object.keys(context.data).length) {
    tools.fill_user_data = tool({
      description: TOOL_STRINGS.webActions.fillUserData.description,
      inputSchema: z.object({
        ref: z.string().describe(TOOL_STRINGS.webActions.fillUserData.ref),
        key: z.string().describe(TOOL_STRINGS.webActions.fillUserData.key),
      }),
      execute: async ({ ref, key }) => {
        const value = context.data?.[key];
        if (
          value == null ||
          (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")
        ) {
          return failedActionResult(
            "fill_user_data",
            "Unknown or non-fillable data key: " +
              key +
              ". Available keys: " +
              Object.keys(context.data ?? {}).join(", "),
            context,
            ref,
          );
        }

        try {
          const [metadata, pageUrl] = await Promise.all([
            context.browser.getFieldMetadata(ref),
            context.browser.getUrl(),
          ]);
          const pageHostname = extractHostname(pageUrl);

          // Stricter than the regular fill gate: caller data may be placed only
          // on a caller-trusted host, with NO operational-field exemption. An
          // operational field (search box) on an untrusted host is still an
          // attacker-readable sink for a secret, so caller data must not inherit
          // assessFill's search-box carve-out.
          const assessment = assessDataFill({ pageHostname, firewall: context.firewall });
          if (!assessment.allowed) {
            emitNonInteractiveBlock(context, "freeform-fill", assessment.reason, pageHostname, []);
            return failedActionResult("fill_user_data", assessment.reason, context, ref);
          }

          const action = userDataFillAction(metadata);

          // Emit the KEY as a mask, never the literal value.
          context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
            action: "fill_user_data",
            ref,
            value: "{{" + key + "}}",
          });
          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_STARTED, {
            action: "fill_user_data",
            ref,
            value: "{{" + key + "}}",
          });

          // The resolved value is passed straight to the browser sink. It is
          // never returned or emitted — only the key/mask is surfaced.
          await context.browser.performAction(ref, action, String(value));

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: true,
            action: "fill_user_data",
          });

          // Record provenance so a following submit check can gate on it. Use
          // agentFilledRefs only — NEVER approvedRefs (caller data is not
          // user-approved per-field) and NEVER operationalRefs (the operational
          // exemption would let caller data submit cross-host; a secret is not
          // operational input).
          context.agentFilledRefs.add(ref);

          return { success: true, action: "fill_user_data", ref, key };
        } catch (error) {
          if (error instanceof BrowserException) {
            return failedActionResult("fill_user_data", error.message, context, ref);
          }
          throw error;
        }
      },
    });
  }

  return tools;
}
