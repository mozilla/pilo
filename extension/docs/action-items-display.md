# Plan: Display Only Action Items from Task Plans

## Goal

Filter task plan display to show only action item titles (e.g., "Search for relevant recipes") instead of full markdown with headers, strategy sections, and step descriptions.

## Constraint

The AI still needs the full plan for execution - this is **display-only filtering**.

## Approach: Structured Tool Output

Add an `actionItems` array field to the planning tools. The AI populates both:

- `plan`: Full markdown (used for execution)
- `actionItems`: Array of short action titles (used for display)

---

## Acceptance Criteria

### Core Functionality

1. **Planning tools accept `actionItems` parameter** - Both `create_plan` and `create_plan_with_url` tools accept an array of strings
2. **AI populates `actionItems` when planning** - Prompt instructs AI to provide short action titles (3-6 words each)
3. **`actionItems` flows through event system** - `task:started` event includes `actionItems` array
4. **Sidebar displays `actionItems` instead of `plan`** - Render as bulleted list of bold items

### Backwards Compatibility

5. **Graceful fallback when `actionItems` is missing** - Fall back to displaying `plan` if `actionItems` absent/empty
6. **Full `plan` still used for execution** - `plan` field unchanged in `buildTaskAndPlanPrompt()`

### Validation

7. **Type guard validates `actionItems`** - `isTaskStartedData()` validates optional `string[]`
8. **Zod schema enforces array of strings** - Invalid data rejected at tool level

### Display Format

9. **Action items render as numbered markdown list** - Each item as `1. Action title`, `2. Action title`, etc.
10. **No headers or descriptions** - Only numbered action titles in UI
