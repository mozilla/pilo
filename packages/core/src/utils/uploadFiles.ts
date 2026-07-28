import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { FileUploadConfig } from "../browser/ariaBrowser.js";

/**
 * Resolve the subset of upload-allowlist entries that are existing regular files,
 * as absolute paths. Directory entries and missing/unreadable paths are skipped.
 *
 * Used to advertise concrete uploadable file paths to the agent. Node-only
 * (filesystem access): exported from `index.ts`, never from the browser-safe
 * `core.ts` barrel.
 */
export async function resolveAdvertisedUploadFiles(
  allowFileUpload: false | FileUploadConfig,
): Promise<string[]> {
  if (!allowFileUpload || allowFileUpload.allowedPaths.length === 0) {
    return [];
  }
  const files: string[] = [];
  for (const entry of allowFileUpload.allowedPaths) {
    try {
      const resolved = path.resolve(entry);
      const stat = await fs.stat(resolved);
      if (stat.isFile()) {
        files.push(resolved);
      }
    } catch {
      // Missing or unreadable entry — cannot be advertised.
    }
  }
  return files;
}
