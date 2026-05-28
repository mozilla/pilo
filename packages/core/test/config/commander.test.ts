import { describe, it, expect } from "vitest";
import { Command } from "commander";
import { addConfigOptions } from "../../src/config/commander.js";

describe("CLI: firewall flags", () => {
  it("parses --trusted-hostnames as comma-separated list", () => {
    const cmd = new Command().exitOverride();
    addConfigOptions(cmd);
    cmd.action(() => {});
    cmd.parse(["node", "test", "--trusted-hostnames", "a.com,b.com"]);
    const opts = cmd.opts();
    expect(opts.trustedHostnames).toEqual(["a.com", "b.com"]);
  });

  it("parses --unsafe as boolean true", () => {
    const cmd = new Command().exitOverride();
    addConfigOptions(cmd);
    cmd.action(() => {});
    cmd.parse(["node", "test", "--unsafe"]);
    const opts = cmd.opts();
    expect(opts.unsafe).toBe(true);
  });

  it("does not set firewall opts when flags omitted", () => {
    const cmd = new Command().exitOverride();
    addConfigOptions(cmd);
    cmd.action(() => {});
    cmd.parse(["node", "test"]);
    const opts = cmd.opts();
    expect(opts.trustedHostnames).toBeUndefined();
    expect(opts.unsafe).toBeUndefined();
  });
});
