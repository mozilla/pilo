/**
 * Skill cache - prompt injector
 *
 * Wraps the raw markdown read from a host's skill file with framing text that
 * instructs the model to treat the notes as advisory hints from prior runs.
 * The model is reminded to verify against the live snapshot before acting on
 * any specific claim.
 *
 * Returns an empty string when there is nothing to inject (null, empty, or
 * whitespace-only input) so callers can use the result to gate the prompt
 * block without a separate boolean.
 */
export function formatSkillSection(hostMarkdown: string | null): string {
  if (!hostMarkdown || !hostMarkdown.trim()) return "";
  return `<!-- NOTES FROM PRIOR RUNS ON THIS SITE -->
You have visited this site before. Below are notes from prior successful runs.
Use what is relevant to the current task; the page may have changed, so verify
against the live snapshot before acting on any specific claim.

${hostMarkdown.trim()}
<!-- END NOTES -->`;
}
