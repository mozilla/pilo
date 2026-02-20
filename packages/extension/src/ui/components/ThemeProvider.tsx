import { useTheme } from "../hooks/useTheme";

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps the app root to activate theme side effects (class toggling,
 * storage persistence, system preference detection) via useTheme().
 *
 * Individual components consume useTheme() directly to read/set the theme.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  useTheme();
  return <>{children}</>;
}
