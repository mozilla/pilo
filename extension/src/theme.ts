export const theme = {
  // Typography
  typography: {
    // Font sizes
    size: {
      xs: "text-xs", // 12px - metadata, timestamps, labels
      sm: "text-sm", // 14px - default body text
      base: "text-base", // 16px - emphasized body text
      lg: "text-lg", // 18px - subheadings, icons
      xl: "text-xl", // 20px - section headings
      "2xl": "text-2xl", // 24px - page titles
    },
    // Font weights - Clean hierarchy
    weight: {
      normal: "font-normal", // 400 - regular text
      medium: "font-medium", // 500 - slightly emphasized
      semibold: "font-semibold", // 600 - headings, labels
      bold: "font-bold", // 700 - major headings
    },
    // Line heights - For readability
    leading: {
      tight: "leading-tight", // 1.25
      snug: "leading-snug", // 1.375
      normal: "leading-normal", // 1.5
      relaxed: "leading-relaxed", // 1.625
    },
  },

  // Spacing
  spacing: {
    // Padding
    padding: {
      "0": "p-0",
      "1": "p-1", // 4px - tight spacing
      "2": "p-2", // 8px - compact elements
      "3": "p-3", // 12px - form inputs
      "4": "p-4", // 16px - standard containers
      "6": "p-6", // 24px - generous sections
    },
    paddingX: {
      "2": "px-2", // 8px - inline elements
      "3": "px-3", // 12px - buttons, inputs
      "4": "px-4", // 16px - cards, bubbles
    },
    paddingY: {
      "1": "py-1", // 4px - compact vertical
      "2": "py-2", // 8px - standard vertical
      "3": "py-3", // 12px - generous vertical
    },
    // Margins
    margin: {
      "0": "m-0",
      "1": "mt-1", // 4px - tight spacing
      "2": "mt-2", // 8px - standard spacing
      "3": "mt-3", // 12px - section spacing
      "4": "mt-4", // 16px - major spacing
    },
    marginBottom: {
      "1": "mb-1", // 4px - between related items
      "2": "mb-2", // 8px - between paragraphs
      "3": "mb-3", // 12px - between sections
      "4": "mb-4", // 16px - between messages
    },
    marginTop: {
      "1": "mt-1", // 4px - micro spacing
      "2": "mt-2", // 8px - standard spacing
      "3": "mt-3", // 12px - section spacing
      "4": "mt-4", // 16px - major spacing
    },
    // Gap (flexbox/grid spacing)
    gap: {
      "1": "gap-1", // 4px - tight grouping
      "2": "gap-2", // 8px - standard grouping
      "3": "gap-3", // 12px - comfortable spacing
      "4": "gap-4", // 16px - generous spacing
    },
    // Space (space-between utilities)
    space: {
      y: {
        "2": "space-y-2", // 8px vertical spacing
        "4": "space-y-4", // 16px vertical spacing
        "6": "space-y-6", // 24px section spacing
      },
    },
  },

  // Layout - Common layout utilities
  layout: {
    maxWidth: {
      xs: "max-w-xs", // 320px - compact containers
      sm: "max-w-sm", // 384px - small content
      md: "max-w-md", // 448px - medium content
      lg: "max-w-lg", // 512px - large content
      "lg:md": "lg:max-w-md", // Responsive sizing
    },
    rounded: {
      none: "rounded-none",
      sm: "rounded-sm", // 2px
      base: "rounded", // 4px
      md: "rounded-md", // 6px
      lg: "rounded-lg", // 8px
    },
    overflow: {
      hidden: "overflow-hidden",
      auto: "overflow-auto",
      yAuto: "overflow-y-auto",
      xAuto: "overflow-x-auto",
    },
    display: {
      flex: "flex",
      block: "block",
      inline: "inline",
      inlineBlock: "inline-block",
      hidden: "hidden",
    },
    flexDirection: {
      row: "flex-row",
      col: "flex-col",
    },
    justifyContent: {
      start: "justify-start",
      end: "justify-end",
      center: "justify-center",
      between: "justify-between",
    },
    alignItems: {
      start: "items-start",
      end: "items-end",
      center: "items-center",
    },
    flex: {
      "1": "flex-1",
      none: "flex-none",
      auto: "flex-auto",
    },
  },

  // Common utilities
  utilities: {
    // Text utilities
    textAlign: {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    },
    whitespace: {
      normal: "whitespace-normal",
      nowrap: "whitespace-nowrap",
      pre: "whitespace-pre",
      preWrap: "whitespace-pre-wrap",
    },
    // Transitions
    transition: {
      colors: "transition-colors",
      all: "transition-all",
      none: "transition-none",
    },
    // Cursor
    cursor: {
      pointer: "cursor-pointer",
      default: "cursor-default",
      notAllowed: "cursor-not-allowed",
    },
    // Opacity
    opacity: {
      "0": "opacity-0",
      "25": "opacity-25",
      "50": "opacity-50",
      "75": "opacity-75",
      "100": "opacity-100",
    },
    // Focus
    focus: {
      outline: "focus:outline-none",
      ring: "focus:ring-2",
      ringBlue: "focus:ring-2 focus:ring-blue-500",
      ringOffset: "focus:ring-2 focus:ring-offset-2",
    },
  },

  light: {
    // Backgrounds
    bg: {
      sidebar: "bg-[#E5E3DF]", // Light sidebar background in light mode
      panel: "bg-[#FDFCFA]", // Main panel background (off-white) - match AI messages
      primary: "bg-[#F5F3EF]", // Message bubbles background (cream) - user messages
      secondary: "bg-[#FDFCFA]", // Secondary message bubbles (off-white) - AI messages pop more
      tertiary: "bg-[#EBE9E5]", // Tertiary background (darker cream)
      input: "bg-white",
      success: "bg-green-50",
      error: "bg-red-50",
      warning: "bg-yellow-50",
    },
    // Text colors
    text: {
      primary: "text-gray-900",
      secondary: "text-gray-500",
      muted: "text-gray-400",
      success: "text-green-700",
      error: "text-red-700",
      warning: "text-yellow-700",
      accent: "text-[#FF6B35]", // Orange accent for spark icon
    },
    // Borders - Light borders for light mode
    border: {
      primary: "border-[#E5E3DF]", // Light border for panel in light mode
      secondary: "border-[#D8D6D2]", // Slightly darker border
      input: "border-[#E5E3DF]",
      success: "border-green-200",
      error: "border-red-200",
      warning: "border-yellow-200",
    },
    // Interactive states
    hover: {
      primary: "hover:bg-[#EBE9E5]", // Subtle hover on cream
      secondary: "hover:bg-[#E5E3DF]", // Slightly darker hover
      settings: "hover:text-gray-900 hover:bg-[#EBE9E5]",
    },
    // Event log specific colors
    events: {
      task: "text-amber-600",
      explanation: "text-blue-600",
      plan: "text-purple-600",
      url: "text-blue-600",
      completion: "text-emerald-600",
      page: "text-indigo-600",
      observation: "text-cyan-600",
      thought: "text-pink-600",
      action: "text-amber-600",
      actionRef: "text-blue-600",
      actionValue: "text-emerald-600",
      success: "text-emerald-600",
      failure: "text-red-600",
      waiting: "text-amber-600",
      network: "text-gray-400",
      processing: "text-blue-600",
      generic: "text-gray-400",
    },
  },
  dark: {
    // Backgrounds - Light cream panel (same as light mode)
    bg: {
      sidebar: "bg-[#1C1B22]", // Dark sidebar bg to match Firefox extension bar
      panel: "bg-[#FDFCFA]", // Light off-white panel background 
      primary: "bg-[#F5F3EF]", // Light cream message bubbles - User messages
      secondary: "bg-[#FDFCFA]", // Light off-white message bubbles - AI messages
      tertiary: "bg-[#EBE9E5]", // Darker cream for system messages
      input: "bg-white", // White input background
      success: "bg-green-50",
      error: "bg-red-50",
      warning: "bg-yellow-50",
    },
    // Text colors - Dark text on light backgrounds
    text: {
      primary: "text-gray-900", // Dark text for readability
      secondary: "text-gray-600",
      muted: "text-gray-500",
      success: "text-green-700",
      error: "text-red-700",
      warning: "text-yellow-700",
      accent: "text-[#FF6B35]", // Orange accent
    },
    // Borders - Dark borders for panel, light borders for bubbles
    border: {
      primary: "border-[#2F2F2F]", // Dark border for panel
      secondary: "border-[#E5E3DF]", // Light border for message bubbles
      input: "border-[#E5E3DF]",
      success: "border-green-200",
      error: "border-red-200",
      warning: "border-yellow-200",
    },
    // Interactive states - Subtle hover for light elements
    hover: {
      primary: "hover:bg-[#EBE9E5]", // Subtle hover on cream
      secondary: "hover:bg-[#E5E3DF]", // Slightly darker hover
      settings: "hover:text-white hover:bg-[#3A3A3A]", // Settings button
    },
    // Event log specific colors - Soft pastels for dark mode
    events: {
      task: "text-amber-400",
      explanation: "text-blue-400",
      plan: "text-purple-400",
      url: "text-blue-400",
      completion: "text-emerald-400",
      page: "text-indigo-400",
      observation: "text-cyan-400",
      thought: "text-pink-400",
      action: "text-amber-400",
      actionRef: "text-blue-400",
      actionValue: "text-emerald-400",
      success: "text-emerald-400",
      failure: "text-red-400",
      waiting: "text-yellow-400",
      network: "text-gray-500",
      processing: "text-blue-400",
      generic: "text-gray-600",
    },
  },
};

export type Theme = typeof theme.light;
export type ThemeMode = "light" | "dark";
