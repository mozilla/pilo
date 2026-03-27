/**
 * Interactive Tools
 *
 * Provides the request_user_data tool for interactive mode, allowing the agent
 * to request personal/business data from the caller for form fields.
 * Also manages approved refs to gate fill/select/check actions.
 */

import { tool } from "ai";
import { z } from "zod";
import { nanoid } from "nanoid";
import type { AriaBrowser } from "../browser/ariaBrowser.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { TOOL_STRINGS } from "../prompts.js";
import type { UserDataCallback, UserDataRequest } from "../types/interactive.js";

interface InteractiveToolContext {
  callback: UserDataCallback;
  browser: AriaBrowser;
  eventEmitter: WebAgentEventEmitter;
}

/**
 * Tracks which element refs have been approved via request_user_data responses.
 * Used by the fill gate to prevent the agent from filling form fields with
 * generated data when interactive mode is on.
 */
export class ApprovedRefs {
  private refs = new Set<string>();

  add(ref: string): void {
    this.refs.add(ref);
  }

  has(ref: string): boolean {
    return this.refs.has(ref);
  }

  clear(): void {
    this.refs.clear();
  }
}

export function createInteractiveTools(context: InteractiveToolContext) {
  const approvedRefs = new ApprovedRefs();

  const tools = {
    request_user_data: tool({
      description: TOOL_STRINGS.webActions.requestUserData.description,
      inputSchema: z.object({
        reason: z
          .enum(["initial", "validation_error"])
          .describe(TOOL_STRINGS.webActions.requestUserData.reason),
        formDescription: z
          .string()
          .describe(TOOL_STRINGS.webActions.requestUserData.formDescription),
        fields: z
          .array(
            z.object({
              ref: z.string().describe("Element reference from page snapshot (e.g., E###)"),
              label: z.string().describe("The field's visible label"),
              fieldType: z.enum([
                "text",
                "email",
                "phone",
                "date",
                "number",
                "select",
                "checkbox",
                "radio",
                "textarea",
                "password",
                "other",
              ]),
              required: z.boolean().describe("Whether this field is required"),
              options: z
                .array(z.string())
                .optional()
                .describe("Available options for select/radio fields"),
              currentValue: z
                .string()
                .optional()
                .describe("Current value if already partially filled"),
              description: z
                .string()
                .optional()
                .describe(
                  "Additional context about the field (include validation error message on re-request)",
                ),
            }),
          )
          .describe("The form fields that need user data"),
      }),
      execute: async ({ reason, formDescription, fields }) => {
        const [pageUrl, pageTitle] = await Promise.all([
          context.browser.getUrl(),
          context.browser.getTitle(),
        ]);

        const request: UserDataRequest = {
          requestId: nanoid(8),
          pageUrl,
          pageTitle,
          formDescription,
          reason,
          fields,
        };

        // Emit request event
        context.eventEmitter.emit(WebAgentEventType.INTERACTIVE_DATA_REQUESTED, {
          requestId: request.requestId,
          pageUrl,
          pageTitle,
          formDescription,
          reason,
          fieldCount: fields.length,
        });

        // Block until the caller responds
        const response = await context.callback(request);

        // Emit response event (field count only, not values, to avoid logging sensitive data)
        context.eventEmitter.emit(WebAgentEventType.INTERACTIVE_DATA_RECEIVED, {
          requestId: request.requestId,
          fieldCount: response.fields.length,
          cancelled: response.cancelled ?? false,
        });

        if (response.cancelled) {
          return {
            success: false,
            action: "request_user_data",
            cancelled: true,
            message: "User cancelled the data request. You should abort the task.",
          };
        }

        // Record approved refs so the fill gate allows these fields
        for (const field of response.fields) {
          approvedRefs.add(field.ref);
        }

        return {
          success: true,
          action: "request_user_data",
          formDescription,
          fieldValues: response.fields,
          message:
            "User provided the requested data. Use the fill/select/check tools to enter each value into the corresponding form field using the ref provided.",
        };
      },
    }),
  };

  return { tools, approvedRefs } as const;
}

/**
 * Fill gate error message returned when the agent tries to fill a form field
 * without first requesting data via request_user_data.
 */
export const FILL_GATE_ERROR =
  "Interactive mode is enabled. You must use request_user_data to request the user's data before filling form fields. If this is a navigation/search field you control (not a form requiring user data), retry the action.";
