import { buildPromptTemplate } from "../utils/template.js";

const extractionTemplate = buildPromptTemplate(
  `
You are reviewing a successful web automation task to extract reusable knowledge
for future agents working on the same site.

**Site (host):** {{ host }}
**Task that was just completed:**
{{ task }}

**What the agent did (trajectory summary):**
{{ trajectorySummary }}

Write a short note (≤200 words) that a future agent visiting {{ host }} could
use to work more effectively. Focus on:
- Site quirks worth knowing (where things live, what didn't work, what did)
- Stable observations about the site's structure or navigation
- Pitfalls to avoid

Do NOT include:
- The specific task details (the next task will be different)
- Element references (E1, E2, ...) — they change between snapshots
- CSS selectors or DOM details — write in natural language
- Personally identifying information from the task
- Lines that start with "## " (this would be parsed as a section header by the store)

Write in the second person ("when you log in, ..."). Be concise.
If there is nothing site-specific worth saving, respond with the single word: SKIP
`.trim(),
);

export function buildSkillExtractionPrompt(args: {
  host: string;
  task: string;
  trajectorySummary: string;
}): string {
  return extractionTemplate(args);
}
