import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { resolveAdvertisedUploadFiles } from "../../src/utils/uploadFiles.js";

describe("resolveAdvertisedUploadFiles", () => {
  let dir: string;
  let filePath: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "pilo-upload-"));
    filePath = path.join(dir, "sample.txt");
    await fs.writeFile(filePath, "x");
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("returns [] when uploads are disabled", async () => {
    expect(await resolveAdvertisedUploadFiles(false)).toEqual([]);
  });

  it("returns [] when the allowlist is empty", async () => {
    expect(await resolveAdvertisedUploadFiles({ allowedPaths: [] })).toEqual([]);
  });

  it("includes file entries, resolved to absolute paths", async () => {
    const result = await resolveAdvertisedUploadFiles({ allowedPaths: [filePath] });
    expect(result).toEqual([path.resolve(filePath)]);
  });

  it("excludes directory entries", async () => {
    const result = await resolveAdvertisedUploadFiles({ allowedPaths: [dir] });
    expect(result).toEqual([]);
  });

  it("skips missing or unreadable entries", async () => {
    const result = await resolveAdvertisedUploadFiles({
      allowedPaths: [path.join(dir, "does-not-exist.txt"), filePath],
    });
    expect(result).toEqual([path.resolve(filePath)]);
  });
});
