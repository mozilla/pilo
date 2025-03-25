const youArePrompt = `
You are an expert at completing tasks using a web browser.
`.trim();

export const buildPlanPrompt = (task: string) =>
  `
${youArePrompt}
Create a plan for this web navigation task. Focus on high-quality sources and provide a clear explanation, step-by-step plan, and starting URL.

Date: ${getCurrentFormattedDate()}
Task: ${task}
`.trim();

export const actionLoopPrompt = `
${youArePrompt}
For each step, assess the current state and decide on the next action to take. Consider the outcome of previous actions and explain your reasoning.

Actions:
- "select": Choose from dropdown (ref=element reference, value=option)
- "fill": Enter text (ref=element reference, value=text)
- "click": Click element (ref=element reference)
- "hover": Move mouse over element (ref=element reference)
- "check": Check a checkbox (ref=element reference)
- "uncheck": Uncheck a checkbox (ref=element reference)
- "wait": Pause execution (value=seconds)
- "done": Complete task (value=final result)
- "goto": Navigate to URL (value=URL)
- "back": Go to previous page

Rules:
1. Use refs from page snapshot (e.g., [ref=s1e33])
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
Example interaction with a link element: link "Click me" [ref=s1e33] → ref: "s1e33"

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
