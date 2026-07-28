/**
 * Interactive Tools
 *
 * Provides the request_user_data tool for interactive mode, allowing the agent
 * to request personal/business data from the caller for form fields.
 * Also manages approved refs to gate fill/select/check actions.
 */

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { nanoid } from "nanoid";
import { type AriaBrowser, PageAction } from "../browser/ariaBrowser.js";
import { BrowserException } from "../errors.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { TOOL_STRINGS } from "../prompts.js";
import type { UserDataCallback, UserDataRequest, FormFieldResponse } from "../types/interactive.js";

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
export class ApprovedRefs extends Set<string> {}

/**
 * Maps field types from the request schema to the appropriate browser action.
 */
function getActionForFieldType(
  fieldType: string,
): PageAction.Fill | PageAction.Select | PageAction.Check {
  switch (fieldType) {
    case "select":
      return PageAction.Select;
    case "checkbox":
    case "radio":
      return PageAction.Check;
    default:
      return PageAction.Fill;
  }
}

/**
 * Fill form fields directly via the browser, bypassing the LLM.
 * Returns a summary of what was filled and any errors encountered.
 */
async function fillFieldsDirectly(
  browser: AriaBrowser,
  responseFields: FormFieldResponse[],
  requestFields: Array<{ ref: string; fieldType: string }>,
): Promise<{ filled: number; errors: string[] }> {
  const fieldTypeMap = new Map(requestFields.map((f) => [f.ref, f.fieldType]));
  let filled = 0;
  const errors: string[] = [];

  for (const field of responseFields) {
    const fieldType = fieldTypeMap.get(field.ref) ?? "text";
    const action = getActionForFieldType(fieldType);

    try {
      await browser.performAction(field.ref, action, field.value);
      filled++;
    } catch (error) {
      if (error instanceof BrowserException) {
        errors.push(`${field.ref}: ${error.message}`);
      } else {
        throw error;
      }
    }
  }

  return { filled, errors };
}

export function createInteractiveTools(context: InteractiveToolContext): {
  tools: ToolSet;
  approvedRefs: ApprovedRefs;
} {
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
          fields,
        };

        // Emit the appropriate event based on reason
        if (reason === "validation_error") {
          // Build field error map from field descriptions (which contain validation error messages)
          const fieldErrors: Record<string, string> = {};
          for (const field of fields) {
            if (field.description) {
              fieldErrors[field.ref] = field.description;
            }
          }
          context.eventEmitter.emit(WebAgentEventType.INTERACTIVE_FORM_DATA_ERROR, {
            requestId: request.requestId,
            pageUrl,
            pageTitle,
            formDescription,
            fields,
            fieldErrors,
          });
        } else {
          context.eventEmitter.emit(WebAgentEventType.INTERACTIVE_FORM_DATA_REQUEST, {
            requestId: request.requestId,
            pageUrl,
            pageTitle,
            formDescription,
            fields,
          });
        }

        // Block until the caller responds
        let response;
        try {
          response = await context.callback(request);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          // Emit error event for callback failures too (timeout, disconnect)
          context.eventEmitter.emit(WebAgentEventType.INTERACTIVE_FORM_DATA_ERROR, {
            requestId: request.requestId,
            pageUrl,
            pageTitle,
            formDescription,
            fields,
            fieldErrors: { _callback: errorMsg },
          });
          throw error;
        }

        if (response.cancelled) {
          return {
            success: false,
            action: "request_user_data",
            cancelled: true,
            message: "User cancelled the data request. You should abort the task.",
          };
        }

        // Fill fields directly via the browser so the LLM never sees
        // (and cannot modify) the user's values.
        const fillResults = await fillFieldsDirectly(context.browser, response.fields, fields);

        // Record approved refs so the fill gate allows subsequent
        // interactions (e.g., check/uncheck) on these fields.
        for (const field of response.fields) {
          approvedRefs.add(field.ref);
        }

        return {
          success: true,
          action: "request_user_data",
          formDescription,
          filledCount: fillResults.filled,
          errorCount: fillResults.errors.length,
          errors: fillResults.errors.length > 0 ? fillResults.errors : undefined,
          message:
            fillResults.errors.length > 0
              ? `Filled ${fillResults.filled} of ${response.fields.length} fields. Some fields had errors: ${fillResults.errors.join("; ")}. Check the page state and decide how to proceed.`
              : `All ${fillResults.filled} fields were filled with the user's data. Do NOT re-fill these fields. Proceed with form submission or the next step.`,
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
  "Interactive mode is enabled. You must use request_user_data to request the user's data before filling form fields with personal data. If this is a navigation/search field you control (not a form requiring user data), retry the same action and it will be allowed through.";
