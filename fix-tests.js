#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Read the test file
const testFile = path.join(__dirname, "test/webAgent.test.ts");
let content = fs.readFileSync(testFile, "utf8");

// Replace action/done mocks that incorrectly use mockGenerateTextWithRetry
// These should use mockStreamText since the main loop still uses streamText

// Pattern 1: Click/action mocks
content = content.replace(
  /(\s+\/\/ Mock (?:action generation|click|extract|abort|done).*\n\s+)mockGenerateTextWithRetry\.mockResolvedValueOnce\({/g,
  "$1mockStreamText.mockReturnValueOnce(\n        createMockStreamResponse({",
);

// Pattern 2: Close the mock call properly - only for non-planning/non-validation mocks
content = content.replace(
  /(\s+messages: \[[\s\S]*?\]\s*,?\s*}\s*,?\s*}\s*as any\);)(\s*\/\/ Mock (?:validation|planning))/g,
  (match, p1, p2) => {
    // Don't change if it's followed by validation or planning
    return match;
  },
);

// Fix the closing for action mocks that were incorrectly changed
const lines = content.split("\n");
let inActionMock = false;
let braceCount = 0;
const newLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Detect start of action mock
  if (line.includes("mockStreamText.mockReturnValueOnce(")) {
    inActionMock = true;
    braceCount = 0;
  }

  if (inActionMock) {
    // Count braces
    for (const char of line) {
      if (char === "{") braceCount++;
      if (char === "}") braceCount--;
    }

    // Check if we should close the mock
    if (line.includes("} as any);") && braceCount === 0) {
      newLines.push(line.replace("} as any);", "}) as any,"));
      newLines.push("      );");
      inActionMock = false;
      continue;
    }
  }

  newLines.push(line);
}

content = newLines.join("\n");

// Write the fixed content back
fs.writeFileSync(testFile, content, "utf8");

console.log("Fixed test mocks");
