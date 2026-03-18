/**
 * Tabstack Tools
 *
 * Cloud-based extraction and generation tools using the Tabstack API.
 * These tools give the agent access to Tabstack's content extraction
 * capabilities, which are especially useful for PDFs and structured
 * data extraction.
 */

import { tool } from "ai";
import { z } from "zod";
import type Tabstack from "@tabstack/sdk";
import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { TOOL_STRINGS } from "../prompts.js";

export interface TabstackToolContext {
  client: Tabstack;
  eventEmitter: WebAgentEventEmitter;
}

export function createTabstackTools(context: TabstackToolContext) {
  return {
    tabstack_extract_markdown: tool({
      description: TOOL_STRINGS.tabstack.tabstack_extract_markdown.description,
      inputSchema: z.object({
        url: z.string().url().describe(TOOL_STRINGS.tabstack.tabstack_extract_markdown.url),
      }),
      execute: async ({ url }) => {
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
            content: result.content,
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

    tabstack_extract_json: tool({
      description: TOOL_STRINGS.tabstack.tabstack_extract_json.description,
      inputSchema: z.object({
        url: z.string().url().describe(TOOL_STRINGS.tabstack.tabstack_extract_json.url),
        json_schema: z
          .record(z.string(), z.unknown())
          .describe(TOOL_STRINGS.tabstack.tabstack_extract_json.json_schema),
      }),
      execute: async ({ url, json_schema }) => {
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
