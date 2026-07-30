import { describe, it, expect, afterEach, vi } from "vitest";
import { FoxcloudBrowser } from "../src/browser/foxcloudBrowser.js";

// Mock BiDiConnection (same pattern as bidiBrowser tests)
vi.mock("../src/browser/bidiConnection.js", () => {
  const MockBiDiConnection = vi.fn(function (this: any) {
    this.connect = vi.fn().mockResolvedValue(undefined);
    this.close = vi.fn();
    this.sendCommand = vi.fn().mockResolvedValue(undefined);
    this.isConnected = true;
    this.setUrl = vi.fn();
    this.on = vi.fn();
    this.off = vi.fn();
    this.removeAllListeners = vi.fn();
  });
  return { BiDiConnection: MockBiDiConnection };
});

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("FoxcloudBrowser", () => {
  let browser: FoxcloudBrowser;

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe("start", () => {
    it("creates a session, polls until RUNNING, then connects BiDi", async () => {
      const sessionId = "test-session-123";

      // POST /v1/sessions → 201
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: sessionId, state: "CREATING" }),
      });

      // GET poll → CREATING
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: sessionId, state: "CREATING" }),
      });

      // GET poll → RUNNING
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: sessionId, state: "RUNNING" }),
      });

      browser = new FoxcloudBrowser({
        brokerUrl: "http://localhost:8080",
        sessionPollIntervalMs: 10,
      });

      const conn = (browser as any).connection;
      conn.sendCommand
        .mockResolvedValueOnce({}) // session.new
        .mockResolvedValueOnce({
          contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
        });

      await browser.start();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8080/v1/sessions",
        expect.objectContaining({ method: "POST" }),
      );

      expect(conn.setUrl).toHaveBeenCalledWith(`ws://localhost:8080/v1/sessions/${sessionId}/bidi`);
    });

    it("passes proxy_url in session creation request", async () => {
      const sessionId = "test-session-proxy";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: sessionId, state: "RUNNING" }),
      });

      browser = new FoxcloudBrowser({
        brokerUrl: "http://localhost:8080",
        proxyUrl: "http://user:pass@proxy.example.com:8080",
      });

      const conn = (browser as any).connection;
      conn.sendCommand.mockResolvedValueOnce({}).mockResolvedValueOnce({
        contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
      });

      await browser.start();

      expect(mockFetch).toHaveBeenCalledWith("http://localhost:8080/v1/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxy_url: "http://user:pass@proxy.example.com:8080" }),
      });
    });

    it("does not send body when no proxy is configured", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "sess-no-proxy", state: "RUNNING" }),
      });

      browser = new FoxcloudBrowser({ brokerUrl: "http://localhost:8080" });

      const conn = (browser as any).connection;
      conn.sendCommand.mockResolvedValueOnce({}).mockResolvedValueOnce({
        contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
      });

      await browser.start();

      expect(mockFetch).toHaveBeenCalledWith("http://localhost:8080/v1/sessions", {
        method: "POST",
      });
    });

    it("forwards blockResources to the BiDi base class so an intercept is registered", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "sess-block", state: "RUNNING" }),
      });

      browser = new FoxcloudBrowser({
        brokerUrl: "http://localhost:8080",
        blockResources: ["image"],
      });

      const conn = (browser as any).connection;
      conn.sendCommand.mockResolvedValueOnce({}).mockResolvedValueOnce({
        contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
      });

      await browser.start();

      expect(conn.sendCommand).toHaveBeenCalledWith(
        "network.addIntercept",
        expect.objectContaining({ phases: ["beforeRequestSent"] }),
      );
    });
  });

  describe("shutdown", () => {
    it("closes BiDi connection and deletes session", async () => {
      browser = new FoxcloudBrowser({ brokerUrl: "http://localhost:8080" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "sess-1", state: "RUNNING" }),
      });

      const conn = (browser as any).connection;
      conn.sendCommand.mockResolvedValueOnce({}).mockResolvedValueOnce({
        contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
      });

      await browser.start();
      mockFetch.mockClear();

      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

      await browser.shutdown();

      expect(conn.close).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8080/v1/sessions/sess-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("park", () => {
    it("posts to park endpoint and disconnects", async () => {
      browser = new FoxcloudBrowser({ brokerUrl: "http://localhost:8080" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "sess-1", state: "RUNNING" }),
      });
      const conn = (browser as any).connection;
      conn.sendCommand.mockResolvedValueOnce({}).mockResolvedValueOnce({
        contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
      });
      await browser.start();
      mockFetch.mockClear();

      mockFetch.mockResolvedValueOnce({ ok: true });

      await browser.park();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8080/v1/sessions/sess-1/park",
        expect.objectContaining({ method: "POST" }),
      );
      expect(conn.close).toHaveBeenCalled();
    });
  });

  describe("resume", () => {
    it("posts to resume endpoint and reconnects BiDi", async () => {
      browser = new FoxcloudBrowser({ brokerUrl: "http://localhost:8080" });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "sess-1", state: "RUNNING" }),
      });
      const conn = (browser as any).connection;
      conn.sendCommand.mockResolvedValueOnce({}).mockResolvedValueOnce({
        contexts: [{ context: "ctx-1", url: "about:blank", children: [] }],
      });
      await browser.start();

      mockFetch.mockResolvedValueOnce({ ok: true }); // park
      await browser.park();
      mockFetch.mockClear();
      conn.sendCommand.mockClear();

      mockFetch.mockResolvedValueOnce({ ok: true }); // resume
      conn.sendCommand
        .mockResolvedValueOnce({}) // session.new
        .mockResolvedValueOnce({
          contexts: [{ context: "ctx-2", url: "https://example.com", children: [] }],
        });

      await browser.resume();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8080/v1/sessions/sess-1/resume",
        expect.objectContaining({ method: "POST" }),
      );
      expect(conn.connect).toHaveBeenCalled();
    });
  });
});
