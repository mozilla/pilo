import { describe, it, expect } from "vitest";

describe("cssTokenizer", () => {
  describe("tokenize", async () => {
    const { tokenize, StringToken, IdentToken, FunctionToken, WhitespaceToken, DelimToken } =
      await import("../../../src/browser/ariaTree/cssTokenizer.js");

    it("should tokenize simple strings", () => {
      const tokens = tokenize('"Hello World"');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toBeInstanceOf(StringToken);
      expect(tokens[0].value).toBe("Hello World");
    });

    it("should tokenize single-quoted strings", () => {
      const tokens = tokenize("'Hello'");
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toBeInstanceOf(StringToken);
      expect(tokens[0].value).toBe("Hello");
    });

    it("should tokenize identifiers", () => {
      const tokens = tokenize("button");
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toBeInstanceOf(IdentToken);
      expect(tokens[0].value).toBe("button");
    });

    it("should tokenize function calls", () => {
      const tokens = tokenize("attr(data-label)");
      expect(tokens.length).toBeGreaterThanOrEqual(3);
      expect(tokens[0]).toBeInstanceOf(FunctionToken);
      expect(tokens[0].value).toBe("attr");
    });

    it("should tokenize mixed content", () => {
      const tokens = tokenize('"Prefix " attr(name) " Suffix"');
      // Filter out whitespace and check we got StringToken and FunctionToken
      const nonWs = tokens.filter((t) => !(t instanceof WhitespaceToken));
      expect(nonWs.length).toBeGreaterThan(0);
      expect(nonWs[0]).toBeInstanceOf(StringToken);
      expect(nonWs[0].value).toBe("Prefix ");
      // There should be a FunctionToken somewhere for attr()
      const hasFunction = nonWs.some((t) => t instanceof FunctionToken);
      expect(hasFunction).toBe(true);
    });

    it("should handle empty string", () => {
      const tokens = tokenize("");
      expect(tokens).toHaveLength(0);
    });

    it("should tokenize whitespace", () => {
      const tokens = tokenize("a b");
      const wsTokens = tokens.filter((t) => t instanceof WhitespaceToken);
      expect(wsTokens.length).toBeGreaterThan(0);
    });

    it("should tokenize delimiters", () => {
      const tokens = tokenize("/");
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toBeInstanceOf(DelimToken);
      expect(tokens[0].value).toBe("/");
    });

    it("should handle content with slash separator", () => {
      // CSS content: "text" / "alt text"
      const tokens = tokenize('"text" / "alt"');
      const nonWs = tokens.filter((t) => !(t instanceof WhitespaceToken));
      expect(nonWs.length).toBeGreaterThanOrEqual(3);
      expect(nonWs[0]).toBeInstanceOf(StringToken);
      expect(nonWs[1]).toBeInstanceOf(DelimToken);
      expect(nonWs[1].value).toBe("/");
      expect(nonWs[2]).toBeInstanceOf(StringToken);
    });

    it("should handle escaped characters in strings", () => {
      const tokens = tokenize('"Hello\\nWorld"');
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toBeInstanceOf(StringToken);
    });

    it("should handle unicode escapes", () => {
      const tokens = tokenize('"\\0041"'); // 'A'
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toBeInstanceOf(StringToken);
    });

    it("should handle special characters", () => {
      const tokens = tokenize('"Click here!"');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].value).toBe("Click here!");
    });

    it("should provide toSource method", () => {
      const tokens = tokenize("button");
      expect(typeof tokens[0].toSource).toBe("function");
    });

    it("should handle multiple function arguments", () => {
      const tokens = tokenize("func(arg1, arg2)");
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe("preprocess (via tokenize)", async () => {
    const { tokenize } = await import("../../../src/browser/ariaTree/cssTokenizer.js");

    it("should handle null character", () => {
      const tokens = tokenize('"\x00"');
      expect(tokens).toHaveLength(1);
    });

    it("should handle newlines in strings", () => {
      // Newlines in strings create BadStringToken
      const tokens = tokenize('"line1\nline2"');
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe("token types", async () => {
    const {
      StringToken,
      IdentToken,
      FunctionToken,
      CloseParenToken,
      WhitespaceToken,
      DelimToken,
      ColonToken,
      SemicolonToken,
      CommaToken,
      NumberToken,
    } = await import("../../../src/browser/ariaTree/cssTokenizer.js");

    it("should have correct token types", () => {
      expect(StringToken).toBeDefined();
      expect(IdentToken).toBeDefined();
      expect(FunctionToken).toBeDefined();
      expect(CloseParenToken).toBeDefined();
      expect(WhitespaceToken).toBeDefined();
      expect(DelimToken).toBeDefined();
      expect(ColonToken).toBeDefined();
      expect(SemicolonToken).toBeDefined();
      expect(CommaToken).toBeDefined();
      expect(NumberToken).toBeDefined();
    });
  });
});
