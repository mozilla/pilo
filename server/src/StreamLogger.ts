import { GenericLogger, WebAgentEventType } from "spark";

type EventSender = (event: string, data: any) => Promise<void>;

/**
 * Events that should not be sent to the client
 * These may contain sensitive information or are too verbose
 */
const EXCLUDED_EVENTS: readonly WebAgentEventType[] = [
  WebAgentEventType.TASK_SETUP, // Contains sensitive endpoint URLs
  WebAgentEventType.AI_GENERATION, // Too verbose
  WebAgentEventType.AI_GENERATION_ERROR, // Too verbose
] as const;

/**
 * Logger that forwards all Spark events to a Server-Sent Events stream
 * Uses the GenericLogger for automatic event forwarding
 */
export class StreamLogger extends GenericLogger {
  constructor(sendEvent: EventSender) {
    super(async (eventType: string, data: any) => {
      // Skip excluded events
      if (EXCLUDED_EVENTS.includes(eventType as WebAgentEventType)) {
        return;
      }

      await sendEvent(eventType, data);
    });
  }
}
