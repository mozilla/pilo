/**
 * Support harness for gated Firefox BiDi integration tests.
 *
 * Launches Playwright's bundled Firefox binary directly (bypassing Playwright's
 * own driver) with a WebDriver BiDi remote-debugging endpoint, and serves static
 * fixture files over a local HTTP server.
 *
 * Not part of the public API surface: this module lives only under
 * `test/integration/` and must never be imported from production code or
 * exported through `src/index.ts` / `src/core.ts`.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { readFile, rm } from "node:fs/promises";
import { join, extname } from "node:path";
import { firefox } from "playwright";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
};

export async function serveFixtures(
  dir: string,
): Promise<{ baseUrl: string; stop: () => Promise<void> }> {
  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const file = join(dir, url.pathname === "/" ? "index.html" : url.pathname.slice(1));
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}

export async function startFirefoxBiDi(): Promise<{ bidiUrl: string; stop: () => Promise<void> }> {
  const bin = firefox.executablePath();
  const profile = join(process.cwd(), `.tmp-ff-profile-${process.pid}`);
  // NOTE: coarse pid-derived port for a single-PoC harness; there is no
  // free-port probe, so a collision is possible in principle. If this
  // harness grows beyond one PoC test, replace this with a `net`-based
  // free-port probe.
  const port = 9500 + (process.pid % 400);
  const proc: ChildProcess = spawn(
    bin,
    ["--remote-debugging-port", String(port), "--headless", "--no-remote", "--profile", profile],
    { stdio: "ignore" },
  );
  // Poll the BiDi websocket endpoint until it accepts connections.
  const bidiUrl = `ws://127.0.0.1:${port}/session`;
  try {
    await waitForPort(port, 20_000);
  } catch (err) {
    proc.kill("SIGKILL");
    throw err;
  }
  return {
    bidiUrl,
    stop: async () => {
      proc.kill("SIGKILL");
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const net = await import("node:net");
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ok = await new Promise<boolean>((resolve) => {
      const s = net.connect(port, "127.0.0.1");
      s.on("connect", () => {
        s.destroy();
        resolve(true);
      });
      s.on("error", () => resolve(false));
    });
    if (ok) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Firefox BiDi port ${port} never opened`);
}
