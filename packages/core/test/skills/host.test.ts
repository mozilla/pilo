import { describe, it, expect } from "vitest";
import { resolveHost } from "../../src/skills/host.js";

describe("skills/host", () => {
  describe("resolveHost", () => {
    it("returns the hostname for a valid http URL", () => {
      expect(resolveHost("http://example.com/path")).toBe("example.com");
    });

    it("returns the hostname for a valid https URL", () => {
      expect(resolveHost("https://example.com/path")).toBe("example.com");
    });

    it("includes the port for non-default ports", () => {
      expect(resolveHost("http://localhost:3000/")).toBe("localhost:3000");
      expect(resolveHost("https://example.com:8443/foo")).toBe("example.com:8443");
    });

    it("omits the port for default ports", () => {
      // WHATWG URL drops default ports (80 for http, 443 for https)
      expect(resolveHost("http://example.com:80/")).toBe("example.com");
      expect(resolveHost("https://example.com:443/")).toBe("example.com");
    });

    it("lowercases the hostname (WHATWG URL normalizes automatically)", () => {
      expect(resolveHost("https://EXAMPLE.COM/")).toBe("example.com");
      expect(resolveHost("https://MixedCase.Example.ORG/")).toBe("mixedcase.example.org");
    });

    it("strips userinfo from the host", () => {
      expect(resolveHost("https://user:pass@example.com/")).toBe("example.com");
      expect(resolveHost("http://user@example.com:8080/")).toBe("example.com:8080");
    });

    it("returns null for file:// URLs", () => {
      expect(resolveHost("file:///etc/hosts")).toBe(null);
    });

    it("returns null for about: URLs", () => {
      expect(resolveHost("about:blank")).toBe(null);
    });

    it("returns null for data: URLs", () => {
      expect(resolveHost("data:text/plain,hello")).toBe(null);
    });

    it("returns null for chrome-extension:// URLs", () => {
      expect(resolveHost("chrome-extension://abcd1234/popup.html")).toBe(null);
    });

    it("returns null for ftp URLs", () => {
      expect(resolveHost("ftp://example.com/file.txt")).toBe(null);
    });

    it("returns null for malformed URLs", () => {
      expect(resolveHost("not a url")).toBe(null);
      expect(resolveHost("://example.com")).toBe(null);
      expect(resolveHost("http//example.com")).toBe(null);
    });

    it("returns null for empty strings", () => {
      expect(resolveHost("")).toBe(null);
    });

    it("handles URLs with query strings and fragments", () => {
      expect(resolveHost("https://example.com/path?q=1#frag")).toBe("example.com");
    });

    it("handles IDN/punycode hostnames", () => {
      // WHATWG URL converts unicode hostnames to punycode automatically
      const result = resolveHost("https://例え.jp/");
      expect(result).toBe("xn--r8jz45g.jp");
    });
  });
});
