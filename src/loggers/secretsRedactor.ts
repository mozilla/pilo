import { LoggerFilter } from "./filter.js";
import { WebAgentEvent, WebAgentEventType } from "../events.js";

export type WebAgentEventDataForWebAgentEventType<T extends WebAgentEventType> = Extract<
  WebAgentEvent,
  { type: T }
>["data"];

export type WebAgentEventDataFields = {
  [K in WebAgentEventType]?: (keyof WebAgentEventDataForWebAgentEventType<K>)[];
};

export const SECRET_FIELDS_BY_EVENT_TYPE: WebAgentEventDataFields = {
  [WebAgentEventType.TASK_SETUP]: ["pwEndpoint", "pwCdpEndpoint", "pwCdpEndpoints"],
} as const;

export class SecretsRedactor extends LoggerFilter {
  protected transformData(eventType: WebAgentEventType, data: any): any {
    const secretFields = SECRET_FIELDS_BY_EVENT_TYPE[eventType];
    if (!secretFields || secretFields.length === 0) {
      return data;
    }

    // Create shallow copy to avoid mutating original
    const redacted = { ...data };
    for (const field of secretFields) {
      if (!(field in redacted)) continue;
      const value = redacted[field];
      if (typeof value === "string" && value !== "") {
        redacted[field] = "(redacted)";
      } else if (Array.isArray(value) && value.length > 0) {
        // Collapse to a single-element array to hide both values and count
        redacted[field] = ["(redacted)"];
      }
    }
    return redacted;
  }
}
