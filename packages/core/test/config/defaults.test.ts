import { describe, it, expect } from "vitest";
import { FIELDS, DEFAULTS } from "../../src/config/defaults.js";

describe("config defaults: firewall fields", () => {
  it("declares trusted_hostnames as string[] with empty default", () => {
    expect(FIELDS.trusted_hostnames).toBeDefined();
    expect(FIELDS.trusted_hostnames.type).toBe("string[]");
    expect(FIELDS.trusted_hostnames.category).toBe("action");
    expect(DEFAULTS.trusted_hostnames).toEqual([]);
  });

  it("declares unsafe_mode as boolean with false default", () => {
    expect(FIELDS.unsafe_mode).toBeDefined();
    expect(FIELDS.unsafe_mode.type).toBe("boolean");
    expect(FIELDS.unsafe_mode.category).toBe("action");
    expect(DEFAULTS.unsafe_mode).toBe(false);
  });

  it("declares upload_allowed_paths as string[] with empty default", () => {
    expect(FIELDS.upload_allowed_paths).toBeDefined();
    expect(FIELDS.upload_allowed_paths.type).toBe("string[]");
    expect(FIELDS.upload_allowed_paths.category).toBe("action");
    expect(DEFAULTS.upload_allowed_paths).toEqual([]);
  });

  it("trusted_hostnames description warns about data risk", () => {
    expect(FIELDS.trusted_hostnames.description).toMatch(/WARNING/);
    expect(FIELDS.trusted_hostnames.description.toLowerCase()).toContain("trust");
  });

  it("unsafe_mode description warns about data risk", () => {
    expect(FIELDS.unsafe_mode.description).toMatch(/WARNING/);
    expect(FIELDS.unsafe_mode.description.toLowerCase()).toContain("firewall");
  });

  it("trusted_hostnames has a CLI flag and env var", () => {
    expect(FIELDS.trusted_hostnames.cli).toBe("--trusted-hostnames");
    expect(FIELDS.trusted_hostnames.env).toContain("PILO_TRUSTED_HOSTNAMES");
  });

  it("unsafe_mode has a CLI flag and env var", () => {
    expect(FIELDS.unsafe_mode.cli).toBe("--unsafe");
    expect(FIELDS.unsafe_mode.env).toContain("PILO_UNSAFE_MODE");
  });

  it("upload_allowed_paths has a CLI flag and env var", () => {
    expect(FIELDS.upload_allowed_paths.cli).toBe("--upload-allowed-paths");
    expect(FIELDS.upload_allowed_paths.env).toContain("PILO_UPLOAD_ALLOWED_PATHS");
  });
});
