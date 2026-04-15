import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketServer, WebSocket as WsWebSocket } from "ws";
import { BiDiConnection } from "../src/browser/bidiConnection.js";

// Helper to find a free port and start a WS server
function createMockBiDiServer(): {
  wss: WebSocketServer;
  url: string;
  lastClient: () => WsWebSocket | undefined;
  close: () => Promise<void>;
} {
  const wss = new WebSocketServer({ port: 0 });
  const addr = wss.address() as { port: number };
  let client: WsWebSocket | undefined;
  wss.on("connection", (ws) => {
    client = ws;
  });
  return {
    wss,
    url: `ws://127.0.0.1:${addr.port}`,
    lastClient: () => client,
    close: () => new Promise<void>((resolve) => wss.close(() => resolve())),
  };
}

describe("BiDiConnection", () => {
  let server: ReturnType<typeof createMockBiDiServer>;
  let conn: BiDiConnection;

  beforeEach(() => {
    server = createMockBiDiServer();
  });

  afterEach(async () => {
    conn?.close();
    await server.close();
  });

  describe("connect", () => {
    it("connects to a WebSocket server", async () => {
      conn = new BiDiConnection(server.url);
      await conn.connect();
      expect(conn.isConnected).toBe(true);
    });

    it("rejects on connection timeout", async () => {
      conn = new BiDiConnection("ws://192.0.2.1:1"); // non-routable
      await expect(conn.connect(500)).rejects.toThrow();
    });
  });

  describe("sendCommand", () => {
    it("sends a command and receives correlated response", async () => {
      conn = new BiDiConnection(server.url);
      await conn.connect();

      server.lastClient()!.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        server.lastClient()!.send(
          JSON.stringify({
            id: msg.id,
            type: "success",
            result: { echo: msg.method },
          }),
        );
      });

      const result = await conn.sendCommand("session.status", {});
      expect(result).toEqual({ echo: "session.status" });
    });

    it("rejects on BiDi error response", async () => {
      conn = new BiDiConnection(server.url);
      await conn.connect();

      server.lastClient()!.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        server.lastClient()!.send(
          JSON.stringify({
            id: msg.id,
            type: "error",
            error: "unknown command",
            message: "No such method",
          }),
        );
      });

      await expect(conn.sendCommand("bad.method")).rejects.toThrow("unknown command");
    });

    it("rejects on command timeout", async () => {
      conn = new BiDiConnection(server.url, 200);
      await conn.connect();

      // Server never responds
      await expect(conn.sendCommand("session.status")).rejects.toThrow("Timeout");
    });

    it("rejects if not connected", async () => {
      conn = new BiDiConnection(server.url);
      await expect(conn.sendCommand("session.status")).rejects.toThrow("not connected");
    });
  });

  describe("events", () => {
    it("emits unsolicited BiDi events", async () => {
      conn = new BiDiConnection(server.url);
      await conn.connect();

      const events: unknown[] = [];
      conn.on("event", (evt) => events.push(evt));

      server.lastClient()!.send(
        JSON.stringify({
          type: "event",
          method: "browsingContext.load",
          params: { context: "ctx-1" },
        }),
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ method: "browsingContext.load" });
    });
  });

  describe("close", () => {
    it("rejects all pending commands on close", async () => {
      conn = new BiDiConnection(server.url, 5000);
      await conn.connect();

      const promise = conn.sendCommand("session.status");
      conn.close();

      await expect(promise).rejects.toThrow("closed");
      expect(conn.isConnected).toBe(false);
    });
  });
});
