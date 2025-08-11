import { describe, it, expect } from "vitest";
import { buildPromptTemplate } from "../../src/utils/template.js";

describe("utils/template", () => {
  describe("buildPromptTemplate", () => {
    it("should create a basic template function", () => {
      const template = buildPromptTemplate("Hello {{ name }}!");
      expect(typeof template).toBe("function");
    });

    it("should substitute simple variables", () => {
      const template = buildPromptTemplate("Hello {{ name }}!");
      const result = template({ name: "World" });
      expect(result).toBe("Hello World!");
    });

    it("should handle multiple variables", () => {
      const template = buildPromptTemplate("{{ greeting }} {{ name }}, how are you {{ feeling }}?");
      const result = template({
        greeting: "Hello",
        name: "John",
        feeling: "today",
      });
      expect(result).toBe("Hello John, how are you today?");
    });

    it("should handle missing variables gracefully", () => {
      const template = buildPromptTemplate("Hello {{ name }}!");
      const result = template({});
      expect(result).toBe("Hello !");
    });

    it("should handle nested object properties", () => {
      const template = buildPromptTemplate("Hello {{ user.name }}, your email is {{ user.email }}");
      const result = template({
        user: {
          name: "John Doe",
          email: "john@example.com",
        },
      });
      expect(result).toBe("Hello John Doe, your email is john@example.com");
    });

    it("should handle conditional blocks", () => {
      const template = buildPromptTemplate("{% if showGreeting %}Hello {{ name }}!{% endif %}");

      const resultWithGreeting = template({
        showGreeting: true,
        name: "World",
      });
      expect(resultWithGreeting).toBe("Hello World!");

      const resultWithoutGreeting = template({
        showGreeting: false,
        name: "World",
      });
      expect(resultWithoutGreeting).toBe("");
    });

    it("should handle unless blocks", () => {
      const template = buildPromptTemplate(
        "{% unless hideMessage %}This message is visible{% endunless %}",
      );

      const resultVisible = template({ hideMessage: false });
      expect(resultVisible).toBe("This message is visible");

      const resultHidden = template({ hideMessage: true });
      expect(resultHidden).toBe("");
    });

    it("should handle each loops", () => {
      const template = buildPromptTemplate("{% for item in items %}{{ item }} {% endfor %}");
      const result = template({ items: ["apple", "banana", "cherry"] });
      expect(result).toBe("apple banana cherry ");
    });

    it("should handle complex nested templates", () => {
      const template = buildPromptTemplate(`
Task: {{ task }}
{% if explanation %}
Explanation: {{ explanation }}
{% endif %}
{% if items %}
Items:
{% for item in items %}
- {{ item.name }}: {{ item.description }}
{% endfor %}
{% endif %}`);

      const result = template({
        task: "Complete web form",
        explanation: "Fill out contact form",
        items: [
          { name: "Step 1", description: "Navigate to form" },
          { name: "Step 2", description: "Fill fields" },
        ],
      });

      expect(result).toContain("Task: Complete web form");
      expect(result).toContain("Explanation: Fill out contact form");
      expect(result).toContain("- Step 1: Navigate to form");
      expect(result).toContain("- Step 2: Fill fields");
    });

    it("should disable HTML escaping", () => {
      const template = buildPromptTemplate("Content: {{ content }}");
      const result = template({ content: "<script>alert('test')</script>" });
      expect(result).toBe("Content: <script>alert('test')</script>");
    });

    it("should handle special characters in content", () => {
      const template = buildPromptTemplate("Message: {{ message }}");
      const result = template({
        message: "This & that with \"quotes\" and 'apostrophes' & <tags>",
      });
      expect(result).toBe("Message: This & that with \"quotes\" and 'apostrophes' & <tags>");
    });

    it("should handle multiline content", () => {
      const template = buildPromptTemplate(`
{% if showPlan %}
Plan:
{{ plan }}
{% endif %}`);

      const result = template({
        showPlan: true,
        plan: "1. First step\n2. Second step\n3. Third step",
      });

      expect(result).toContain("Plan:");
      expect(result).toContain("1. First step");
      expect(result).toContain("2. Second step");
      expect(result).toContain("3. Third step");
    });

    it("should handle empty templates", () => {
      const template = buildPromptTemplate("");
      const result = template({});
      expect(result).toBe("");
    });

    it("should handle templates with only static content", () => {
      const template = buildPromptTemplate("This is static content with no variables");
      const result = template({});
      expect(result).toBe("This is static content with no variables");
    });

    it("should handle whitespace control", () => {
      const template = buildPromptTemplate(`
{% if condition %}
  Content with spaces
{% endif %}`);

      const result = template({ condition: true });
      expect(result).toContain("Content with spaces");
    });

    it("should handle complex data structures", () => {
      const template = buildPromptTemplate(`
{% if user %}
User: {{ user.name }}
{% if user.preferences %}
Preferences:
{% for pref in user.preferences %}
- {{ pref.key }}: {{ pref.value }}
{% endfor %}
{% endif %}
{% endif %}`);

      const result = template({
        user: {
          name: "John Doe",
          preferences: [
            { key: "theme", value: "dark" },
            { key: "language", value: "en" },
          ],
        },
      });

      expect(result).toContain("User: John Doe");
      expect(result).toContain("- theme: dark");
      expect(result).toContain("- language: en");
    });

    it("should handle number and boolean values", () => {
      const template = buildPromptTemplate(
        "Count: {{ count }}\nPrice: ${{ price }}\nAvailable: {{ isAvailable }}\nDiscount: {{ discount }}%",
      );

      const result = template({
        count: 42,
        price: 29.99,
        isAvailable: true,
        discount: 15,
      });

      expect(result).toContain("Count: 42");
      expect(result).toContain("Price: $29.99");
      expect(result).toContain("Available: true");
      expect(result).toContain("Discount: 15%");
    });

    it("should handle undefined and null values", () => {
      const template = buildPromptTemplate(
        "Value: {{ value }}, Null: {{ nullValue }}, Undefined: {{ undefinedValue }}",
      );
      const result = template({
        value: "test",
        nullValue: null,
        undefinedValue: undefined,
      });

      expect(result).toBe("Value: test, Null: , Undefined: ");
    });
  });
});
