# Prose Typography Customization Plan

## Goal

Customize the `@tailwindcss/typography` plugin's typography to match our design requirements by creating a `prose-chat` modifier, following the plugin's established pattern (`prose-sm`, `prose-lg`, etc.).

## Approach

Create a `prose-chat` utility class using Tailwind v4's `@utility` directive, with values defined in `@theme`. This approach:

- Starts as a clone of `prose-base` metrics for a stable baseline
- Follows the typography plugin's modifier pattern
- Centralizes typography values in `@theme`
- Is composable with other prose modifiers
- Allows incremental customization from the baseline

## Architecture Decisions

| Decision               | Choice                | Rationale                          |
| ---------------------- | --------------------- | ---------------------------------- |
| Where to define values | `@theme` in CSS       | CSS-first, native Tailwind v4      |
| Override strategy      | `prose-chat` utility  | Follows plugin pattern, composable |
| Starting point         | Clone of `prose-base` | Stable baseline, then customize    |

## Future Considerations

- Adjust additional variables as design requirements emerge
- If JS access to these values is needed, mirror them in `theme.ts`
