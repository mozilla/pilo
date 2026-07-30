/**
 * Hermetic tests for the integration harness itself — no browser, so these run
 * in the default suite even though the Firefox tests beside them are gated.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serveFixtures } from "./firefoxHarness.js";

let stop: (() => Promise<void>) | undefined;

afterEach(async () => {
  await stop?.();
  stop = undefined;
});

describe("serveFixtures", () => {
  it("serves a file from the fixtures root", async () => {
    const root = await mkdtemp(join(tmpdir(), "ff-harness-"));
    await writeFile(join(root, "index.html"), "<h1>hi</h1>");

    const server = await serveFixtures(root);
    stop = server.stop;

    const res = await fetch(`${server.baseUrl}/`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("hi");
    expect(server.requests).toContain("/");
  });

  it("refuses to serve a path that escapes the fixtures root", async () => {
    // The secret sits beside the fixtures dir, exactly where `..` would land.
    const base = await mkdtemp(join(tmpdir(), "ff-harness-"));
    const root = join(base, "fixtures");
    await mkdir(root);
    await writeFile(join(root, "index.html"), "<h1>hi</h1>");
    await writeFile(join(base, "secret.txt"), "TOP SECRET");

    const server = await serveFixtures(root);
    stop = server.stop;

    // fetch() normalises `..` in the path, so send the raw request ourselves.
    const url = new URL(server.baseUrl);
    const raw = await new Promise<string>((resolve, reject) => {
      import("node:net")
        .then(({ connect }) => {
          const socket = connect(Number(url.port), url.hostname, () => {
            socket.write(
              `GET /../secret.txt HTTP/1.1\r\nHost: ${url.host}\r\nConnection: close\r\n\r\n`,
            );
          });
          let data = "";
          socket.on("data", (chunk) => {
            data += chunk.toString();
          });
          socket.on("end", () => resolve(data));
          socket.on("error", reject);
        })
        .catch(reject);
    });

    expect(raw).not.toContain("TOP SECRET");
    expect(raw).toMatch(/^HTTP\/1\.1 (403|404)/);
  });
});
