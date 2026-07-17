/**
 * Tabstack Tools
 *
 * Cloud-based extraction and generation tools using the Tabstack API.
 * These tools give the agent access to Tabstack's content extraction
 * capabilities, which are especially useful for PDFs and structured
 * data extraction.
 */

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type Tabstack from "@tabstack/sdk";
import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { TOOL_STRINGS } from "../prompts.js";
import { wrapExternalContentWithWarning, ExternalContentLabel } from "../utils/promptSecurity.js";
import {
  assessNavigation,
  extractHostname,
  type FirewallConfig,
} from "../security/actionFirewall.js";
import { buildFirewallRemediations } from "../security/firewallRemediations.js";
import type { FirewallBlockedNonInteractiveEventData } from "../events.js";

export interface TabstackToolContext {
  client: Tabstack;
  eventEmitter: WebAgentEventEmitter;
  firewall: FirewallConfig;
  interactive: boolean;
}

type TabstackBlockedResult = {
  success: false;
  action: string;
  url: string;
  error: string;
  isRecoverable: true;
};

/**
 * Gate a Tabstack fetch to the caller's trusted hosts. These tools fetch a
 * model-supplied URL server-side, so they are a data-egress sink identical to
 * `goto` and must pass the same destination allowlist (start host +
 * trusted_hostnames, bypassed by unsafe_mode). Returns a blocked result to
 * short-circuit the fetch, or null to proceed.
 */
function assessTabstackNavigation(
  context: TabstackToolContext,
  action: string,
  url: string,
): TabstackBlockedResult | null {
  const assessment = assessNavigation({ targetUrl: url, firewall: context.firewall });
  if (assessment.allowed) return null;

  const host = extractHostname(url);
  if (!context.interactive) {
    const data: FirewallBlockedNonInteractiveEventData = {
      timestamp: Date.now(),
      iterationId: "",
      reason: assessment.reason,
      kind: "navigation",
      pageHostname: host,
      formActionHostnames: [],
      remediations: buildFirewallRemediations(host ? [host] : []),
    };
    context.eventEmitter.emit(WebAgentEventType.FIREWALL_BLOCKED_NON_INTERACTIVE, data);
  }
  context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
    success: false,
    action,
    error: assessment.reason,
    isRecoverable: true,
  });
  return { success: false, action, url, error: assessment.reason, isRecoverable: true };
}

export function createTabstackTools(context: TabstackToolContext): ToolSet {
  return {
    tabstack_extract_markdown: tool({
      description: TOOL_STRINGS.tabstack.tabstack_extract_markdown.description,
      inputSchema: z.object({
        url: z.string().url().describe(TOOL_STRINGS.tabstack.tabstack_extract_markdown.url),
      }),
      execute: async ({ url }) => {
        const blocked = assessTabstackNavigation(context, "tabstack_extract_markdown", url);
        if (blocked) return blocked;

        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "tabstack_extract_markdown",
          value: url,
        });

        try {
          const result = await context.client.extract.markdown({ url, metadata: true });

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: true,
            action: "tabstack_extract_markdown",
          });

          return {
            success: true,
            action: "tabstack_extract_markdown",
            url: result.url,
            content: wrapExternalContentWithWarning(
              result.content,
              ExternalContentLabel.TabstackContent,
            ),
            metadata: result.metadata,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: false,
            action: "tabstack_extract_markdown",
            error: errorMessage,
            isRecoverable: true,
          });

          return {
            success: false,
            action: "tabstack_extract_markdown",
            url,
            error: errorMessage,
            isRecoverable: true,
          };
        }
      },
    }),

    // Note: `data` is intentionally NOT wrapped in <EXTERNAL-CONTENT> tags
    // because it's a structured object whose shape is constrained by the
    // caller-supplied `json_schema`. String values nested inside `data` are
    // still attacker-controllable (see issue #456 for the residual-risk
    // discussion); the truncator does walk them and will clip any tagged
    // content, but attackers crafting non-tagged payloads inside structured
    // fields are not stopped by this PR. Possible follow-up: per-leaf
    // wrapping or taint tracking on tool-result string values.
    tabstack_extract_json: tool({
      description: TOOL_STRINGS.tabstack.tabstack_extract_json.description,
      inputSchema: z.object({
        url: z.string().url().describe(TOOL_STRINGS.tabstack.tabstack_extract_json.url),
        json_schema: z
          .record(z.string(), z.unknown())
          .describe(TOOL_STRINGS.tabstack.tabstack_extract_json.json_schema),
      }),
      execute: async ({ url, json_schema }) => {
        const blocked = assessTabstackNavigation(context, "tabstack_extract_json", url);
        if (blocked) return blocked;

        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "tabstack_extract_json",
          value: url,
        });

        try {
          const data = await context.client.extract.json({ url, json_schema });

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: true,
            action: "tabstack_extract_json",
          });

          return {
            success: true,
            action: "tabstack_extract_json",
            url,
            data,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: false,
            action: "tabstack_extract_json",
            error: errorMessage,
            isRecoverable: true,
          });

          return {
            success: false,
            action: "tabstack_extract_json",
            url,
            error: errorMessage,
            isRecoverable: true,
          };
        }
      },
    }),

    // Same rationale as tabstack_extract_json above: `data` is intentionally
    // not wrapped because the caller-supplied schema constrains its shape.
    // See the comment on tabstack_extract_json for the residual-risk note.
    tabstack_generate_json: tool({
      description: TOOL_STRINGS.tabstack.tabstack_generate_json.description,
      inputSchema: z.object({
        url: z.string().url().describe(TOOL_STRINGS.tabstack.tabstack_generate_json.url),
        json_schema: z
          .record(z.string(), z.unknown())
          .describe(TOOL_STRINGS.tabstack.tabstack_generate_json.json_schema),
        instructions: z
          .string()
          .describe(TOOL_STRINGS.tabstack.tabstack_generate_json.instructions),
      }),
      execute: async ({ url, json_schema, instructions }) => {
        const blocked = assessTabstackNavigation(context, "tabstack_generate_json", url);
        if (blocked) return blocked;

        context.eventEmitter.emit(WebAgentEventType.AGENT_ACTION, {
          action: "tabstack_generate_json",
          value: url,
        });

        try {
          const data = await context.client.generate.json({ url, json_schema, instructions });

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: true,
            action: "tabstack_generate_json",
          });

          return {
            success: true,
            action: "tabstack_generate_json",
            url,
            data,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          context.eventEmitter.emit(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
            success: false,
            action: "tabstack_generate_json",
            error: errorMessage,
            isRecoverable: true,
          });

          return {
            success: false,
            action: "tabstack_generate_json",
            url,
            error: errorMessage,
            isRecoverable: true,
          };
        }
      },
    }),
  };
}
