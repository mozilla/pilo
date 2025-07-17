export const theme = {
  light: {
    // Backgrounds
    bg: {
      primary: "bg-white",
      secondary: "bg-gray-50",
      tertiary: "bg-gray-100",
      input: "bg-white",
      success: "bg-green-100",
      error: "bg-red-100",
      warning: "bg-yellow-100",
    },
    // Text colors
    text: {
      primary: "text-gray-900",
      secondary: "text-gray-600",
      muted: "text-gray-500",
      success: "text-green-800",
      error: "text-red-800",
      warning: "text-yellow-800",
    },
    // Borders
    border: {
      primary: "border-gray-200",
      secondary: "border-gray-300",
      input: "border-gray-300",
      success: "border-green-300",
      error: "border-red-300",
      warning: "border-yellow-300",
    },
    // Interactive states
    hover: {
      primary: "hover:bg-gray-100",
      secondary: "hover:bg-gray-200",
      settings: "hover:text-gray-900 hover:bg-gray-200",
    },
    // Event log specific colors
    events: {
      task: "text-yellow-600",
      explanation: "text-blue-600",
      plan: "text-purple-600",
      url: "text-blue-600",
      completion: "text-green-600",
      page: "text-indigo-600",
      observation: "text-cyan-600",
      thought: "text-pink-600",
      action: "text-yellow-600",
      actionRef: "text-blue-600",
      actionValue: "text-green-600",
      success: "text-green-600",
      failure: "text-red-600",
      waiting: "text-yellow-600",
      network: "text-gray-500",
      processing: "text-blue-600",
      generic: "text-gray-400",
    },
  },
  dark: {
    // Backgrounds
    bg: {
      primary: "bg-gray-900",
      secondary: "bg-gray-800",
      tertiary: "bg-gray-700",
      input: "bg-gray-800",
      success: "bg-green-900",
      error: "bg-red-900",
      warning: "bg-yellow-900",
    },
    // Text colors
    text: {
      primary: "text-white",
      secondary: "text-gray-300",
      muted: "text-gray-400",
      success: "text-green-200",
      error: "text-red-200",
      warning: "text-yellow-200",
    },
    // Borders
    border: {
      primary: "border-gray-700",
      secondary: "border-gray-600",
      input: "border-gray-600",
      success: "border-green-700",
      error: "border-red-700",
      warning: "border-yellow-700",
    },
    // Interactive states
    hover: {
      primary: "hover:bg-gray-700",
      secondary: "hover:bg-gray-600",
      settings: "hover:text-white hover:bg-gray-700",
    },
    // Event log specific colors
    events: {
      task: "text-yellow-400",
      explanation: "text-blue-400",
      plan: "text-purple-400",
      url: "text-blue-300",
      completion: "text-green-400",
      page: "text-indigo-400",
      observation: "text-cyan-400",
      thought: "text-pink-400",
      action: "text-yellow-400",
      actionRef: "text-blue-300",
      actionValue: "text-green-300",
      success: "text-green-400",
      failure: "text-red-400",
      waiting: "text-yellow-500",
      network: "text-gray-400",
      processing: "text-blue-400",
      generic: "text-gray-500",
    },
  },
};

export type Theme = typeof theme.light;
export type ThemeMode = "light" | "dark";
