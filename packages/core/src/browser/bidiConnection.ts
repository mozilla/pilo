import WebSocket from "ws";
import { EventEmitter } from "node:events";
import { withSpan, SpanStatusCode, SpanName } from "../telemetry/tracing.js";

interface PendingCommand {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface BiDiResponse {
  id: number;
  type: "success" | "error";
  result?: unknown;
  error?: string;
  message?: string;
}

interface BiDiEvent {
  type: "event";
  method: string;
  params: Record<string, unknown>;
}

/**
 * Minimal WebDriver BiDi WebSocket client.
 *
 * Sends commands as {id, method, params}, correlates responses by id,
 * and emits unsolicited events for listeners.
 */
export class BiDiConnection extends EventEmitter {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, PendingCommand>();
  private readonly defaultTimeoutMs: number;

  constructor(
    private url: string,
    defaultTimeoutMs = 30_000,
  ) {
    super();
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /** Open the WebSocket connection. */
  connect(timeoutMs = 10_000): Promise<void> {
    return withSpan(SpanName.BIDI_CONNECT, { attributes: { "pilo.bidi.url": this.url } }, (span) =>
      this.connectImpl(timeoutMs, span),
    );
  }

  private connectImpl(
    timeoutMs: number,
    span: {
      setStatus: (s: { code: number; message?: string }) => void;
      recordException: (e: Error | string) => void;
    },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      let settled = false;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const rejectWithSpan = (error: Error) => {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        span.recordException(error);
        reject(error);
      };

      const timer = setTimeout(() => {
        ws.close();
        settle(() => rejectWithSpan(new Error(`WebSocket connect timeout after ${timeoutMs}ms`)));
      }, timeoutMs);

      ws.on("open", () => {
        settle(() => {
          this.ws = ws;
          this.setupHandlers();
          resolve();
        });
      });

      ws.on("error", (err) => {
        settle(() => rejectWithSpan(err instanceof Error ? err : new Error(String(err))));
      });

      ws.on("close", () => {
        settle(() => rejectWithSpan(new Error("WebSocket closed before connection established")));
      });
    });
  }

  /** Send a BiDi command and await the correlated response. */
  sendCommand(
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs?: number,
  ): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("WebSocket is not connected"));
    }

    const id = this.nextId++;
    const timeout = timeoutMs ?? this.defaultTimeoutMs;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(`Timeout waiting for response to ${method} (id=${id}) after ${timeout}ms`),
        );
      }, timeout);

      this.pending.set(id, { resolve, reject, timer });
      try {
        this.ws!.send(JSON.stringify({ id, method, params }));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** Close the connection and reject all pending commands. */
  close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.rejectAllPending("Connection closed");
  }

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /** Update the URL for reconnection (used by BiDiBrowser). */
  setUrl(url: string): void {
    this.url = url;
  }

  private setupHandlers(): void {
    const ws = this.ws!;

    ws.on("message", (data) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (typeof msg.id !== "number") {
        this.emit("event", msg as unknown as BiDiEvent);
        return;
      }

      const response = msg as unknown as BiDiResponse;
      const entry = this.pending.get(response.id);
      if (!entry) return;

      clearTimeout(entry.timer);
      this.pending.delete(response.id);

      if (response.type === "error") {
        entry.reject(new Error(`BiDi error: ${response.error} — ${response.message}`));
      } else {
        entry.resolve(response.result);
      }
    });

    ws.on("close", () => {
      this.rejectAllPending("WebSocket closed unexpectedly");
      this.ws = null;
    });

    ws.on("error", (err) => {
      this.rejectAllPending(`WebSocket error: ${err.message}`);
    });
  }

  private rejectAllPending(reason: string): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(reason));
    }
    this.pending.clear();
  }
}
