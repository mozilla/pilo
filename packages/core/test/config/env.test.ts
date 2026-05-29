import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseEnvConfig } from "../../src/config/env.js";

describe("env: firewall fields", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PILO_TRUSTED_HOSTNAMES;
    delete process.env.PILO_UNSAFE_MODE;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("parses PILO_TRUSTED_HOSTNAMES as comma-separated list", () => {
    process.env.PILO_TRUSTED_HOSTNAMES = "a.com,b.com";
    const result = parseEnvConfig();
    expect(result.trusted_hostnames).toEqual(["a.com", "b.com"]);
  });

  it("parses PILO_UNSAFE_MODE=true as boolean true", () => {
    process.env.PILO_UNSAFE_MODE = "true";
    const result = parseEnvConfig();
    expect(result.unsafe_mode).toBe(true);
  });

  it("parses PILO_UNSAFE_MODE=false as boolean false", () => {
    process.env.PILO_UNSAFE_MODE = "false";
    const result = parseEnvConfig();
    expect(result.unsafe_mode).toBe(false);
  });

  it("returns undefined when env vars are not set", () => {
    const result = parseEnvConfig();
    expect(result.trusted_hostnames).toBeUndefined();
    expect(result.unsafe_mode).toBeUndefined();
  });
});
