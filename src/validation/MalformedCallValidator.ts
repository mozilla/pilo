import { generateText, LanguageModel } from "ai";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Result from malformed function call correction
 */
export interface MalformedCallCorrectionResult {
  isSuccess: boolean;
  correctedResponse?: any;
  error?: string;
}

/**
 * Validates and corrects malformed function calls using LLM
 */
export class MalformedCallValidator {
  constructor(
    private provider: LanguageModel,
    private abortSignal?: AbortSignal,
  ) {}

  /**
   * Attempts to correct a malformed function call response using LLM
   */
  async correctMalformedCall(
    schema: any,
    malformedResponse: any,
  ): Promise<MalformedCallCorrectionResult> {
    try {
      const correctionPrompt = this.buildCorrectionPrompt(schema, malformedResponse);

      const response = await generateText({
        model: this.provider,
        prompt: correctionPrompt,
        temperature: 0,
        maxTokens: 1000,
        abortSignal: this.abortSignal,
      });

      // Clean up markdown code blocks if present
      let cleanResponse = response.text.trim();
      if (cleanResponse.startsWith("```json")) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanResponse.startsWith("```")) {
        cleanResponse = cleanResponse.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const correctedData = JSON.parse(cleanResponse);

      console.log("🔧 Malformed call corrected:", JSON.stringify(correctedData, null, 2));

      return {
        isSuccess: true,
        correctedResponse: correctedData,
      };
    } catch (error) {
      return {
        isSuccess: false,
        error: `Correction attempt failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Builds the correction prompt for malformed function calls
   */
  private buildCorrectionPrompt(schema: any, malformedResponse: any): string {
    // Convert schema to proper JSON schema format
    const jsonSchema = Object.fromEntries(
      Object.entries(schema).map(([toolName, toolDef]: [string, any]) => [
        toolName,
        {
          description: toolDef.description,
          parameters: zodToJsonSchema(toolDef.parameters),
        },
      ]),
    );

    const schemaString = JSON.stringify(jsonSchema, null, 2);

    const malformedString = JSON.stringify(malformedResponse, null, 2);

    return `You are a function call correction expert. A malformed function call was made and you need to fix it.

## Available Tools Schema
${schemaString}

## Malformed Response
${malformedString}

## Task
Fix the malformed function call to match the expected schema.

The response must use this EXACT format:
{
  "toolCalls": [
    {
      "toolName": "tool_name_from_schema",
      "args": { /* parameters matching the schema */ }
    }
  ]
}

Rules:
1. Use exactly one tool from the available tools list in the schema
2. Ensure all required parameters are provided according to the schema
3. Use "toolName" and "args" (not "function", "name", or "arguments")
4. Return only valid JSON (no markdown, no code blocks)
5. If the original intent is unclear, make the best reasonable interpretation

Return ONLY the JSON object:`;
  }
}
