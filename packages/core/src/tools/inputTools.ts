/**
 * Input Tools
 *
 * Human-in-the-loop tools that allow the AI agent to request information
 * from the caller when it encounters data it cannot determine on its own.
 *
 * Currently supports: form data requests (requestFormData)
 * Future: general questions (ask), confirmations (confirm)
 */

import { tool } from "ai";
import { z } from "zod";
import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import { TOOL_STRINGS } from "../prompts.js";
import { nanoid } from "nanoid";
import { FormDataTracker } from "./formDataTracker.js";

// === Public Types (exported for consumers) ===

/** Field input type */
export type InputFieldType = "text" | "select" | "checkbox";

/** A form field the AI is requesting */
export interface InputFormField {
  /** Identifier used as key in the response */
  name: string;
  /** Human-readable label shown to the user */
  label: string;
  /** Element reference from page snapshot (e.g., E42) for the form field */
  ref?: string;
  /** Input type: "text" for free text, "select" for single choice, "checkbox" for multiple choices. Defaults to "text". */
  type?: InputFieldType;
  /** Valid options when type is "select" or "checkbox" */
  options?: string[];
  /** Whether input should be masked (e.g., passwords) */
  sensitive?: boolean;
}

/** Discriminated union for input requests (extensible for future input types) */
export type InputRequest = InputFormRequest;

export interface InputFormRequest {
  type: "form";
  questionId: string;
  question: string;
  fields: InputFormField[];
  pageUrl?: string;
  pageTitle?: string;
}

/** Discriminated union for input responses */
export type InputResponse = InputFormResponse | InputDeclinedResponse;

export interface InputFormResponse {
  type: "form";
  fields: Record<string, string>;
}

export interface InputDeclinedResponse {
  type: "declined";
  reason?: string;
}

/** Required callback for handling input requests from the agent */
export type OnInputCallback = (request: InputRequest) => Promise<InputResponse>;

// === Tool Context ===

export interface InputToolContext {
  eventEmitter: WebAgentEventEmitter;
  onInput?: OnInputCallback;
  inputTimeoutMs: number;
  abortSignal?: AbortSignal;
  getPageContext: () => { pageUrl?: string; pageTitle?: string };
  formDataTracker?: FormDataTracker;
}

// === Tool Creation ===

export function createInputTools(context: InputToolContext) {
  return {
    requestFormData: tool({
      description: TOOL_STRINGS.input.requestFormData.description,
      inputSchema: z.object({
        question: z.string().describe(TOOL_STRINGS.input.requestFormData.question),
        fields: z
          .array(
            z.object({
              name: z.string().describe(TOOL_STRINGS.input.requestFormData.fieldName),
              label: z.string().describe(TOOL_STRINGS.input.requestFormData.fieldLabel),
              ref: z.string().describe(TOOL_STRINGS.input.requestFormData.fieldRef),
              type: z
                .enum(["text", "select", "checkbox"])
                .optional()
                .describe(TOOL_STRINGS.input.requestFormData.fieldType),
              options: z
                .array(z.string())
                .optional()
                .describe(TOOL_STRINGS.input.requestFormData.fieldOptions),
              sensitive: z
                .boolean()
                .optional()
                .describe(TOOL_STRINGS.input.requestFormData.fieldSensitive),
            }),
          )
          .describe(TOOL_STRINGS.input.requestFormData.fields),
      }),
      execute: async ({ question, fields }) => {
        if (!context.onInput) {
          return {
            success: false,
            action: "requestFormData",
            error: "No input handler configured. Proceed with available information or abort.",
          };
        }

        const questionId = nanoid(12);
        const pageContext = context.getPageContext();

        const request: InputFormRequest = {
          type: "form",
          questionId,
          question,
          fields,
          ...pageContext,
        };

        // Emit input:form event for observability
        context.eventEmitter.emit(WebAgentEventType.INPUT_FORM, {
          questionId,
          question,
          fields,
          ...pageContext,
        });

        const startTime = Date.now();

        try {
          // Race the callback against timeout and abort signal
          const response = await raceWithCancellation(
            context.onInput(request),
            context.inputTimeoutMs,
            context.abortSignal,
          );

          const responseTimeMs = Date.now() - startTime;

          // Emit response event
          context.eventEmitter.emit(WebAgentEventType.INPUT_FORM_RESPONSE, {
            questionId,
            response,
            responseTimeMs,
          });

          if (response.type === "declined") {
            return {
              success: false,
              action: "requestFormData",
              error: response.reason
                ? `User declined to provide form data: ${response.reason}`
                : "User declined to provide form data",
            };
          }

          // Validate the response against the field definitions
          const validationErrors = validateFormResponse(fields, response.fields);
          if (validationErrors.length > 0) {
            // Emit error event with original form info + validation errors
            context.eventEmitter.emit(WebAgentEventType.INPUT_FORM_ERROR, {
              questionId,
              question,
              fields,
              errors: validationErrors,
              ...pageContext,
            });

            return {
              success: false,
              action: "requestFormData",
              error: `Invalid form input: ${validationErrors.join("; ")}`,
            };
          }

          // Track sourced fields by ref for fill guard enforcement
          if (context.formDataTracker) {
            for (const field of fields) {
              const value = response.fields[field.name];
              if (value !== undefined && field.ref) {
                context.formDataTracker.sourceField(field.ref, value);
              }
            }
          }

          return {
            success: true,
            action: "requestFormData",
            fields: response.fields,
          };
        } catch (error) {
          if (error instanceof TimeoutError) {
            return {
              success: false,
              action: "requestFormData",
              error:
                "Timed out waiting for form input. Proceed with available information or abort.",
            };
          }

          if (error instanceof AbortError) {
            return {
              success: false,
              action: "requestFormData",
              error: "Request was cancelled.",
            };
          }

          return {
            success: false,
            action: "requestFormData",
            error: `Failed to get form input: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
      },
    }),
  };
}

// === Validation ===

/**
 * Validate a form response against the field definitions.
 * Returns an array of error messages (empty if valid).
 */
function validateFormResponse(
  fields: Array<{ name: string; label: string; type?: string; options?: string[] }>,
  responseFields: Record<string, string>,
): string[] {
  const errors: string[] = [];

  for (const field of fields) {
    const value = responseFields[field.name];

    // Checkbox fields are optional (empty string means none selected)
    if (field.type === "checkbox") {
      if (value !== undefined && value !== "" && field.options && field.options.length > 0) {
        const selected = value.split(",").map((v) => v.trim());
        const invalid = selected.filter((v) => !field.options!.includes(v));
        if (invalid.length > 0) {
          errors.push(
            `Invalid values for ${field.name}: "${invalid.join(", ")}". Must be from: ${field.options.join(", ")}`,
          );
        }
      }
      continue;
    }

    // Check required field is present
    if (value === undefined || value === "") {
      errors.push(`Missing required field: ${field.name}`);
      continue;
    }

    // Check select field value is in options
    if (field.type === "select" && field.options && field.options.length > 0) {
      if (!field.options.includes(value)) {
        errors.push(
          `Invalid value for ${field.name}: "${value}". Must be one of: ${field.options.join(", ")}`,
        );
      }
    }
  }

  return errors;
}

// === Helpers ===

class TimeoutError extends Error {
  constructor() {
    super("Input request timed out");
    this.name = "TimeoutError";
  }
}

class AbortError extends Error {
  constructor() {
    super("Input request aborted");
    this.name = "AbortError";
  }
}

/**
 * Race a promise against a timeout and an optional AbortSignal.
 * Cleans up the timeout handle and abort listener once the race settles.
 */
function raceWithCancellation<T>(
  promise: Promise<T>,
  timeoutMs: number,
  abortSignal?: AbortSignal,
): Promise<T> {
  if (abortSignal?.aborted) {
    return Promise.reject(new AbortError());
  }

  let timeoutHandle: ReturnType<typeof setTimeout>;
  let abortHandler: (() => void) | undefined;

  const cleanup = () => {
    clearTimeout(timeoutHandle);
    if (abortHandler && abortSignal) {
      abortSignal.removeEventListener("abort", abortHandler);
    }
  };

  const racers: Promise<T>[] = [promise];

  // Timeout racer
  racers.push(
    new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new TimeoutError()), timeoutMs);
    }),
  );

  // AbortSignal racer
  if (abortSignal) {
    racers.push(
      new Promise<never>((_, reject) => {
        abortHandler = () => reject(new AbortError());
        abortSignal.addEventListener("abort", abortHandler, { once: true });
      }),
    );
  }

  return Promise.race(racers).finally(cleanup);
}
