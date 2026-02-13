import { GenericLogger, WebAgentEventType } from "@core";

type EventSender = (event: string, data: any) => Promise<void>;

interface StreamLoggerOptions {
  sendEvent: EventSender;
  includeScreenshotImages?: boolean; // default: false
}

/**
 * Base events that should not be sent to the client
 * These may contain sensitive information or are too verbose
 */
const BASE_EXCLUDED_EVENTS: readonly WebAgentEventType[] = [
  WebAgentEventType.TASK_SETUP, // Contains sensitive endpoint URLs
  WebAgentEventType.AI_GENERATION, // Too verbose
  WebAgentEventType.AI_GENERATION_ERROR, // Too verbose
] as const;

/**
 * Logger that forwards all Spark events to a Server-Sent Events stream
 * Uses the GenericLogger for automatic event forwarding
 */
export class StreamLogger extends GenericLogger {
  constructor(options: EventSender | StreamLoggerOptions) {
    // Support backward compatibility: if passed a function, use it as sendEvent
    const config =
      typeof options === "function"
        ? { sendEvent: options, includeScreenshotImages: false }
        : { includeScreenshotImages: false, ...options };

    // Build excluded events list based on options
    const excludedEvents = [
      ...BASE_EXCLUDED_EVENTS,
      ...(config.includeScreenshotImages
        ? []
        : [WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED_IMAGE]),
    ];

    super(async (eventType: string, data: any) => {
      // Skip excluded events
      if (excludedEvents.includes(eventType as WebAgentEventType)) {
        return;
      }

      await config.sendEvent(eventType, data);
    });
  }
}
