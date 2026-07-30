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
import { join, extname, resolve, sep } from "node:path";
import { firefox } from "playwright";

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".png": "image/png",
};

export async function serveFixtures(
  dir: string,
): Promise<{ baseUrl: string; requests: string[]; stop: () => Promise<void> }> {
  // Records the pathname of every request that reaches the server. A resource
  // aborted by BiDi network interception never arrives here, so tests can assert
  // blocking by checking a path is absent from this list.
  const requests: string[] = [];
  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      requests.push(url.pathname);
      // WHATWG URL already strips and clamps dot segments, so url.pathname
      // cannot contain `..` — a request for /../../secret arrives as /secret.
      // The containment check below is belt-and-braces: it keeps "never reads
      // outside the fixtures dir" a local, checkable property of this handler
      // rather than an inherited consequence of how the pathname was parsed.
      const root = resolve(dir);
      const file = resolve(root, url.pathname === "/" ? "index.html" : `.${url.pathname}`);
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
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
    requests,
    stop: () => new Promise<void>((r) => server.close(() => r())),
  };
}

// Monotonic per-process counter so multiple Firefox instances in one test
// process get distinct profile directories (the port comes from a free-port
// probe, so it is already unique per launch).
let instanceSeq = 0;

/** Ask the OS for a free TCP port by binding port 0, then releasing it. */
async function getFreePort(): Promise<number> {
  const net = await import("node:net");
  return new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

export async function startFirefoxBiDi(): Promise<{ bidiUrl: string; stop: () => Promise<void> }> {
  const bin = firefox.executablePath();
  const profile = join(process.cwd(), `.tmp-ff-profile-${process.pid}-${instanceSeq++}`);
  // Bind a free port (avoids collisions when several instances run in one
  // process). A tiny TOCTOU window remains between release and Firefox binding;
  // acceptable for an opt-in manual harness.
  const port = await getFreePort();
  const proc: ChildProcess = spawn(
    bin,
    ["--remote-debugging-port", String(port), "--headless", "--no-remote", "--profile", profile],
    { stdio: "ignore" },
  );
  // Wait until the remote-debugging port accepts TCP connections. This does
  // not perform a BiDi WebSocket handshake, so the endpoint may briefly accept
  // a socket before it is ready to speak BiDi; the first command retries cover
  // that window.
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
