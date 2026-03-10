import { WebAgentEventEmitter, WebAgentEventType } from "../events.js";
import type { WebAgentEvent } from "../events.js";
import { Logger } from "./types.js";

/**
 * Events that are excluded by default from JSON console output
 * These events may be very large or too verbose for console logging
 */
const DEFAULT_EXCLUDED_EVENTS: readonly WebAgentEventType[] = [
  WebAgentEventType.BROWSER_SCREENSHOT_CAPTURED_IMAGE, // Very large base64 data
] as const;

export interface JSONConsoleLoggerOptions {
  /** Include screenshot image events (default: false) */
  includeScreenshotImages?: boolean;
  /**
   * Strip binary image data from ai:generation message history (default: true).
   * Images are replaced with { type, mediaType, size, data: '<omitted>' }.
   * Disable only if you need the raw bytes for debugging.
   */
  sanitizeGenerationImages?: boolean;
}

/**
 * Strip binary image data from ai:generation event data before logging.
 * Image content blocks are replaced with a lightweight descriptor:
 *   { type: 'image', mediaType, size, data: '<omitted>' }
 * The actual JPEG files are already saved separately alongside stdout.txt.
 */
function sanitizeAiGenerationData(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.messages)) return data;

  return {
    ...d,
    messages: d.messages.map((msg: unknown) => {
      if (!msg || typeof msg !== "object") return msg;
      const m = msg as Record<string, unknown>;
      if (!Array.isArray(m.content)) return msg;

      return {
        ...m,
        content: m.content.map((block: unknown) => {
          if (!block || typeof block !== "object") return block;
          const b = block as Record<string, unknown>;
          if (b.type === "image" && ArrayBuffer.isView(b.image)) {
            const buf = b.image as ArrayBufferView;
            return {
              type: "image",
              mediaType: b.mediaType,
              size: buf.byteLength,
              data: "<omitted>",
            };
          }
          return block;
        }),
      };
    }),
  };
}

export class JSONConsoleLogger implements Logger {
  private emitter: WebAgentEventEmitter | null = null;
  private handlers: [WebAgentEventType, (data: any) => void][] = [];
  private excludedEvents: Set<WebAgentEventType>;
  private sanitizeGenerationImages: boolean;

  constructor(options: JSONConsoleLoggerOptions = {}) {
    // Build excluded events set
    this.excludedEvents = new Set(options.includeScreenshotImages ? [] : DEFAULT_EXCLUDED_EVENTS);
    this.sanitizeGenerationImages = options.sanitizeGenerationImages !== false; // default: true
  }

  initialize(emitter: WebAgentEventEmitter): void {
    if (this.emitter) {
      this.dispose();
    }
    this.emitter = emitter;
    this.handlers = [];

    for (const event of Object.values(WebAgentEventType)) {
      const handler = this.buildEventHandler(event);
      this.handlers.push([event, handler]);
      emitter.onEvent(event, handler);
    }
  }

  dispose(): void {
    if (this.emitter) {
      for (const [event, handler] of this.handlers) {
        this.emitter.offEvent(event, handler);
      }
      this.emitter = null;
    }
  }

  private buildEventHandler(type: WebAgentEventType) {
    return (data: WebAgentEvent["data"]): void => {
      // Skip excluded events
      if (this.excludedEvents.has(type)) {
        return;
      }

      // Strip raw image bytes from AI generation messages to keep stdout.txt manageable.
      // Screenshots are already saved separately as JPEG files; the binary arrays
      // in the message history serve no purpose in the log and can reach 50-100MB.
      const safeData =
        this.sanitizeGenerationImages && type === WebAgentEventType.AI_GENERATION
          ? sanitizeAiGenerationData(data)
          : data;

      const json = JSON.stringify({ event: type, data: safeData }, null, 0);
      console.log(json);
    };
  }
}
