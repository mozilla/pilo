import type { RealtimeEventMessage } from "../types/browser";
import { showIndicator, hideIndicator } from "./AgentIndicator";

export const INDICATOR_EVENT_TYPES = ["task:setup", "task:completed", "task:aborted"];

/**
 * Handles incoming realtime event messages and updates the agent indicator accordingly.
 */
export function handleIndicatorMessage(message: RealtimeEventMessage): void {
  console.log("[Spark:IndicatorHandler] Received message:", message?.event?.type);

  // Guard against malformed messages
  if (!message?.event?.type) {
    console.log("[Spark:IndicatorHandler] Ignoring malformed message");
    return;
  }

  const eventType = message.event.type;

  if (eventType === "task:setup") {
    console.log("[Spark:IndicatorHandler] Showing indicator");
    showIndicator();
  } else if (eventType === "task:completed" || eventType === "task:aborted") {
    console.log("[Spark:IndicatorHandler] Hiding indicator");
    hideIndicator();
  }
}
