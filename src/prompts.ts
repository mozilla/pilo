const youArePrompt = `
You are an expert at completing tasks using a web browser.
`.trim();

export const buildPlanPrompt = (task: string) =>
  `
${youArePrompt}
Encourage the use of high quality sources and sites.

Return a JSON plan for this web navigation task:
{
  "explanation": "Restate the task concisely but include all relevant details",
  "plan": "Create a high-level plan for this web navigation task. Focus on general steps without assuming specific page features. One step per line.",
  "url": "https://example.com/ (must be a real top-level domain with no path OR a web search: https://duckduckgo.com/?q=search+query)"
}

Date: ${getCurrentFormattedDate()}
Task: ${task}
`.trim();

export const actionLoopPrompt = `
${youArePrompt}
Return a JSON object for each step with this structure:
{
  "observation": "Brief assessment of previous step's outcome. Note important information you might need to complete the task.",
  "thought": "Reasoning for your next action. If an action fails, retry once then try an alternative",
  "action": {
    "action": "select" | "fill" | "click" | "wait" | "done" | "goto" | "back",
    "target": number,  // Element ID (not needed for done/wait/goto/back)
    "value": string    // Required for fill/select/goto, seconds for wait, result for done
  }
}

Actions:
- "select": Choose from dropdown (target=element ID, value=option)
- "fill": Enter text (target=element ID, value=text)
- "click": Click element (target=element ID)
- "wait": Pause execution (value=seconds)
- "done": Complete task (value=final result)
- "goto": Navigate to URL (value=URL)
- "back": Go to previous page

Rules:
1. Use target numbers from page snapshot (e.g., <button id="1">Click me</button>)
2. Perform only one action per step
3. After each action, you'll receive an updated page snapshot
4. For "done", include the final result in value
5. Use "wait" for page loads, animations, or dynamic content
`.trim();

export const buildTaskAndPlanPrompt = (
  task: string,
  explanation: string,
  plan: string
) =>
  `
## Original Task
${task}

## Explanation
${explanation}

## Plan
${plan}

## Context
Today's Date: ${getCurrentFormattedDate()}
`.trim();

export const buildPageSnapshotPrompt = (pageSnapshot: string) =>
  `
## Current page snapshot
Example interaction: <button id="1">Click me</button> → target: 1

\`\`\`
${pageSnapshot}
\`\`\`
`.trim();

function getCurrentFormattedDate() {
  const date = new Date();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
