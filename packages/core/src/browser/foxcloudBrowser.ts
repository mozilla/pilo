/**
 * Client for foxcloud-bidi, an experimental proof-of-concept service that runs
 * headless Firefox instances controlled via WebDriver BiDi. There are no plans
 * for public release or availability of the foxcloud service. But, this client
 * could serve as a useful reference for implementing something similar.
 */

import { BiDiBrowser } from "./bidiBrowser.js";
import type { BiDiBrowserOptions } from "./bidiBrowser.js";
import { withSpan, SpanStatusCode, SpanName } from "../telemetry/tracing.js";

export interface FoxcloudBrowserOptions extends Omit<BiDiBrowserOptions, "bidiUrl"> {
  /** foxcloud broker REST endpoint, e.g. "http://localhost:8080" */
  brokerUrl: string;
  /** HTTP proxy URL for Firefox to use, e.g. "http://user:pass@proxy:8080" */
  proxyUrl?: string;
  /** How long to wait for session to reach RUNNING state. Default 60000ms. */
  sessionPollTimeoutMs?: number;
  /** Polling interval when waiting for session. Default 1000ms. */
  sessionPollIntervalMs?: number;
}

export class FoxcloudBrowser extends BiDiBrowser {
  override readonly browserName = "foxcloud";

  private readonly brokerUrl: string;
  private readonly proxyUrl?: string;
  private readonly sessionPollTimeoutMs: number;
  private readonly sessionPollIntervalMs: number;
  private sessionId: string | null = null;

  constructor(options: FoxcloudBrowserOptions) {
    super({ actionTimeoutMs: options.actionTimeoutMs });
    // Strip a single trailing slash if present
    this.brokerUrl = options.brokerUrl.endsWith("/")
      ? options.brokerUrl.slice(0, -1)
      : options.brokerUrl;
    this.proxyUrl = options.proxyUrl;
    this.sessionPollTimeoutMs = options.sessionPollTimeoutMs ?? 60_000;
    this.sessionPollIntervalMs = options.sessionPollIntervalMs ?? 1_000;
  }

  override async start(): Promise<void> {
    return withSpan(
      SpanName.FOXCLOUD_START,
      { attributes: { "pilo.foxcloud.broker_url": this.brokerUrl } },
      async (span) => {
        try {
          const fetchOptions: RequestInit = { method: "POST" };
          if (this.proxyUrl) {
            fetchOptions.headers = { "Content-Type": "application/json" };
            fetchOptions.body = JSON.stringify({ proxy_url: this.proxyUrl });
          }

          const createResp = await fetch(`${this.brokerUrl}/v1/sessions`, fetchOptions);
          if (!createResp.ok) {
            const body = await createResp.text();
            throw new Error(`Failed to create foxcloud session (${createResp.status}): ${body}`);
          }
          const session = (await createResp.json()) as { id: string; state: string };
          this.sessionId = session.id;
          span.setAttribute("pilo.foxcloud.session_id", session.id);

          if (session.state !== "RUNNING") {
            await this.pollUntilRunning();
          }

          const brokerUrlObj = new URL(this.brokerUrl);
          const wsProtocol = brokerUrlObj.protocol === "https:" ? "wss:" : "ws:";
          const bidiUrl = `${wsProtocol}//${brokerUrlObj.host}/v1/sessions/${this.sessionId}/bidi`;

          try {
            await super.start(bidiUrl);
          } catch (error) {
            // BiDi connection failed — clean up the foxcloud session to avoid leaks
            await this.deleteSession();
            throw error;
          }
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.recordException(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      },
    );
  }

  override async shutdown(): Promise<void> {
    await super.shutdown();
    await this.deleteSession();
  }

  /** Best-effort session cleanup via REST API. */
  private async deleteSession(): Promise<void> {
    if (!this.sessionId) return;
    const id = this.sessionId;
    this.sessionId = null;
    try {
      await fetch(`${this.brokerUrl}/v1/sessions/${id}`, { method: "DELETE" });
    } catch {
      // Best effort — broker may be unreachable
    }
  }

  async park(): Promise<void> {
    if (!this.sessionId) throw new Error("No active session to park");

    const resp = await fetch(`${this.brokerUrl}/v1/sessions/${this.sessionId}/park`, {
      method: "POST",
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Park failed (${resp.status}): ${body}`);
    }

    this.connection.close();
  }

  async resume(): Promise<void> {
    if (!this.sessionId) throw new Error("No active session to resume");

    const resp = await fetch(`${this.brokerUrl}/v1/sessions/${this.sessionId}/resume`, {
      method: "POST",
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Resume failed (${resp.status}): ${body}`);
    }

    const brokerUrlObj = new URL(this.brokerUrl);
    const wsProtocol = brokerUrlObj.protocol === "https:" ? "wss:" : "ws:";
    const bidiUrl = `${wsProtocol}//${brokerUrlObj.host}/v1/sessions/${this.sessionId}/bidi`;

    await super.start(bidiUrl);
  }

  private async pollUntilRunning(): Promise<void> {
    const deadline = Date.now() + this.sessionPollTimeoutMs;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, this.sessionPollIntervalMs));

      const resp = await fetch(`${this.brokerUrl}/v1/sessions/${this.sessionId}`);
      if (!resp.ok) continue;

      const session = (await resp.json()) as { state: string };
      if (session.state === "RUNNING") return;
      if (session.state === "TERMINATED") {
        throw new Error("foxcloud session terminated during creation");
      }
    }

    throw new Error(
      `foxcloud session did not reach RUNNING state within ${this.sessionPollTimeoutMs}ms`,
    );
  }
}
