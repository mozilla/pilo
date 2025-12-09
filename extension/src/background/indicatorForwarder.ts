import browser from "webextension-polyfill";
import type { RealtimeEventMessage } from "../types/browser";

const INDICATOR_EVENT_TYPES = ["task:setup", "task:completed", "task:aborted"];

/**
 * Checks if an event type is an indicator event that should be forwarded
 * to the content script.
 */
export function isIndicatorEvent(eventType: string): boolean {
  return INDICATOR_EVENT_TYPES.includes(eventType);
}

/**
 * Forwards a realtime event message to the content script of the originating tab.
 * Only forwards indicator events (task:setup, task:completed, task:aborted).
 */
export async function forwardIndicatorEvent(message: RealtimeEventMessage): Promise<void> {
  console.log("[IndicatorForwarder] Called with:", message?.event?.type, "tabId:", message?.tabId);

  // Guard against malformed messages
  if (!message?.event?.type) {
    console.log("[IndicatorForwarder] Rejecting: malformed message");
    return;
  }
  // Validate tabId is a positive number (Chrome tab IDs are always positive)
  if (typeof message.tabId !== "number" || message.tabId < 0) {
    console.log("[IndicatorForwarder] Rejecting: invalid tabId:", message.tabId);
    return;
  }
  if (!isIndicatorEvent(message.event.type)) {
    console.log("[IndicatorForwarder] Rejecting: not an indicator event:", message.event.type);
    return;
  }
  try {
    console.log("[IndicatorForwarder] Forwarding to tab:", message.tabId);
    await browser.tabs.sendMessage(message.tabId, message);
    console.log("[IndicatorForwarder] Successfully sent to tab:", message.tabId);
  } catch (error) {
    console.log("[IndicatorForwarder] Failed to send to tab:", message.tabId, error);
  }
}
