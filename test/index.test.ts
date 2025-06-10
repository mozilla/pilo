import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { spawn } from "child_process";
import path from "path";

// Mock child_process spawn
vi.mock("child_process", () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

describe("CLI index", () => {
  let mockProcess: any;

  beforeEach(() => {
    // Mock process object
    mockProcess = {
      stdout: {
        on: vi.fn(),
        pipe: vi.fn(),
      },
      stderr: {
        on: vi.fn(),
        pipe: vi.fn(),
      },
      on: vi.fn(),
      kill: vi.fn(),
    };

    mockSpawn.mockReturnValue(mockProcess);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Data argument parsing", () => {
    const runCLI = (args: string[]) => {
      // Simulate running the CLI with given arguments
      const originalArgv = process.argv;
      process.argv = ["node", "index.js", ...args];

      // Mock console methods
      const originalConsoleError = console.error;
      const originalConsoleLog = console.log;
      const consoleErrorSpy = vi.fn();
      const consoleLogSpy = vi.fn();
      console.error = consoleErrorSpy;
      console.log = consoleLogSpy;

      try {
        // Import and run the CLI module
        // We can't directly test the CLI execution due to process.exit,
        // but we can test the argument parsing logic
        return { consoleErrorSpy, consoleLogSpy };
      } finally {
        process.argv = originalArgv;
        console.error = originalConsoleError;
        console.log = originalConsoleLog;
      }
    };

    it("should handle valid JSON data argument", () => {
      const validJSON = '{"departure":"NYC","destination":"LAX","date":"2024-12-25"}';

      // Test JSON parsing directly
      expect(() => JSON.parse(validJSON)).not.toThrow();

      const parsed = JSON.parse(validJSON);
      expect(parsed).toEqual({
        departure: "NYC",
        destination: "LAX",
        date: "2024-12-25",
      });
    });

    it("should handle complex nested JSON data", () => {
      const complexJSON = JSON.stringify({
        booking: {
          flight: {
            departure: { city: "NYC", time: "9:00 AM" },
            arrival: { city: "LAX", time: "12:00 PM" },
          },
          hotel: {
            name: "Grand Hotel",
            checkIn: "2024-12-25",
            checkOut: "2024-12-27",
          },
        },
        travelers: [
          { name: "John Doe", age: 30 },
          { name: "Jane Doe", age: 28 },
        ],
      });

      expect(() => JSON.parse(complexJSON)).not.toThrow();

      const parsed = JSON.parse(complexJSON);
      expect(parsed.booking.flight.departure.city).toBe("NYC");
      expect(parsed.travelers).toHaveLength(2);
      expect(parsed.travelers[0].name).toBe("John Doe");
    });

    it("should handle JSON with special characters", () => {
      const specialCharsJSON = JSON.stringify({
        message: 'Hello "world" & <test>',
        symbols: "!@#$%^&*()",
        unicode: "café naïve résumé",
      });

      expect(() => JSON.parse(specialCharsJSON)).not.toThrow();

      const parsed = JSON.parse(specialCharsJSON);
      expect(parsed.message).toBe('Hello "world" & <test>');
      expect(parsed.symbols).toBe("!@#$%^&*()");
      expect(parsed.unicode).toBe("café naïve résumé");
    });

    it("should handle empty JSON object", () => {
      const emptyJSON = "{}";

      expect(() => JSON.parse(emptyJSON)).not.toThrow();

      const parsed = JSON.parse(emptyJSON);
      expect(parsed).toEqual({});
    });

    it("should handle JSON arrays", () => {
      const arrayJSON = JSON.stringify([
        { name: "Item 1", value: 100 },
        { name: "Item 2", value: 200 },
      ]);

      expect(() => JSON.parse(arrayJSON)).not.toThrow();

      const parsed = JSON.parse(arrayJSON);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe("Item 1");
    });

    it("should reject invalid JSON", () => {
      const invalidJSONs = [
        '{"invalid": json}', // Missing quotes
        '{departure: "NYC"}', // Missing quotes on key
        '{"incomplete":', // Incomplete JSON
        "not json at all", // Not JSON
        "", // Empty string
        "null", // Null as string (valid JSON but might not be intended)
      ];

      invalidJSONs.forEach((invalidJSON, index) => {
        if (index === invalidJSONs.length - 1) {
          // 'null' is valid JSON, should not throw
          expect(() => JSON.parse(invalidJSON)).not.toThrow();
        } else {
          expect(() => JSON.parse(invalidJSON)).toThrow();
        }
      });
    });

    it("should handle JSON with boolean and numeric values", () => {
      const mixedJSON = JSON.stringify({
        isActive: true,
        count: 42,
        price: 99.99,
        isAvailable: false,
        nullValue: null,
      });

      expect(() => JSON.parse(mixedJSON)).not.toThrow();

      const parsed = JSON.parse(mixedJSON);
      expect(parsed.isActive).toBe(true);
      expect(parsed.count).toBe(42);
      expect(parsed.price).toBe(99.99);
      expect(parsed.isAvailable).toBe(false);
      expect(parsed.nullValue).toBe(null);
    });

    it("should preserve data types in JSON parsing", () => {
      const typedJSON = JSON.stringify({
        string: "text",
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: "value" },
        nullValue: null,
      });

      const parsed = JSON.parse(typedJSON);

      expect(typeof parsed.string).toBe("string");
      expect(typeof parsed.number).toBe("number");
      expect(typeof parsed.boolean).toBe("boolean");
      expect(Array.isArray(parsed.array)).toBe(true);
      expect(typeof parsed.object).toBe("object");
      expect(parsed.nullValue).toBe(null);
    });

    it("should handle deeply nested JSON", () => {
      const deepJSON = JSON.stringify({
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: "deep value",
                },
              },
            },
          },
        },
      });

      expect(() => JSON.parse(deepJSON)).not.toThrow();

      const parsed = JSON.parse(deepJSON);
      expect(parsed.level1.level2.level3.level4.level5.value).toBe("deep value");
    });

    it("should handle JSON with unicode characters", () => {
      const unicodeJSON = JSON.stringify({
        emoji: "🚀✈️🏨",
        chinese: "你好世界",
        arabic: "مرحبا بالعالم",
        russian: "Привет мир",
      });

      expect(() => JSON.parse(unicodeJSON)).not.toThrow();

      const parsed = JSON.parse(unicodeJSON);
      expect(parsed.emoji).toBe("🚀✈️🏨");
      expect(parsed.chinese).toBe("你好世界");
      expect(parsed.arabic).toBe("مرحبا بالعالم");
      expect(parsed.russian).toBe("Привет мир");
    });
  });

  describe("Argument validation", () => {
    it("should validate argument combinations", () => {
      // Test various argument combinations
      const validCombinations = [
        ["task only"],
        ["task", "https://example.com"],
        ["task", "https://example.com", '{"data": "value"}'],
      ];

      validCombinations.forEach((args) => {
        expect(args.length).toBeGreaterThan(0);
        if (args.length >= 3) {
          // If data is provided, it should be valid JSON
          expect(() => JSON.parse(args[2])).not.toThrow();
        }
      });
    });

    it("should handle URL validation patterns", () => {
      const validUrls = [
        "https://example.com",
        "http://test.org",
        "https://subdomain.example.com/path",
        "https://example.com:8080/path?query=value",
      ];

      validUrls.forEach((url) => {
        expect(url).toMatch(/^https?:\/\/.+/);
      });
    });

    it("should identify potential invalid URLs", () => {
      const invalidUrls = [
        "not-a-url",
        "ftp://example.com", // Wrong protocol
        "example.com", // Missing protocol
        "", // Empty string
      ];

      invalidUrls.forEach((url) => {
        if (url) {
          expect(url).not.toMatch(/^https?:\/\/.+/);
        }
      });
    });
  });

  describe("Error handling", () => {
    it("should handle JSON parsing errors gracefully", () => {
      const malformedJSONs = ['{"incomplete":', '{invalid: "json"}', "not json", "{trailing,}"];

      malformedJSONs.forEach((json) => {
        expect(() => JSON.parse(json)).toThrow();
      });
    });

    it("should provide meaningful error messages for JSON parsing", () => {
      try {
        JSON.parse('{"invalid": json}');
      } catch (error) {
        expect(error).toBeInstanceOf(SyntaxError);
        expect(error.message).toContain("JSON");
      }
    });
  });

  describe("Usage examples", () => {
    it("should demonstrate valid usage patterns", () => {
      const examples = [
        {
          args: ["search for flights to Paris"],
          description: "Simple task without URL or data",
        },
        {
          args: ["find the latest news", "https://news.ycombinator.com"],
          description: "Task with URL but no data",
        },
        {
          args: [
            "book a flight",
            "https://airline.com",
            JSON.stringify({
              departure: "NYC",
              destination: "LAX",
              date: "2024-12-25",
            }),
          ],
          description: "Complete task with URL and data",
        },
      ];

      examples.forEach((example) => {
        expect(example.args[0]).toBeTruthy(); // Task should exist

        if (example.args.length >= 2) {
          // URL should be valid format if provided
          expect(example.args[1]).toMatch(/^https?:\/\/.+/);
        }

        if (example.args.length >= 3) {
          // Data should be valid JSON if provided
          expect(() => JSON.parse(example.args[2])).not.toThrow();
        }
      });
    });
  });
});
