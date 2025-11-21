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
  [WebAgentEventType.TASK_SETUP]: ["pwEndpoint", "pwCdpEndpoint"],
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
      if (field in redacted && typeof redacted[field] === "string" && redacted[field] !== "") {
        redacted[field] = "(redacted)";
      }
    }
    return redacted;
  }
}
