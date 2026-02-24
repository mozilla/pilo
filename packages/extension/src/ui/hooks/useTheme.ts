import { useState, useEffect, useCallback } from "react";
import browser from "webextension-polyfill";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "pilo-theme";
const DARK_CLASS = "dark";

function getSystemTheme(): ResolvedTheme {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

function applyTheme(resolvedTheme: ResolvedTheme): void {
  const root = document.documentElement;
  if (resolvedTheme === "dark") {
    root.classList.add(DARK_CLASS);
  } else {
    root.classList.remove(DARK_CLASS);
  }
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return getSystemTheme();
  }
  return mode;
}

export interface UseThemeReturn {
  /** The stored user preference: "light", "dark", or "system". */
  theme: ThemeMode;
  /** Set and persist the user's theme preference. */
  setTheme: (mode: ThemeMode) => void;
  /** The actual applied theme: "light" or "dark" (never "system"). */
  resolvedTheme: ResolvedTheme;
}

export function useTheme(): UseThemeReturn {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  // Load stored preference on mount.
  useEffect(() => {
    let cancelled = false;

    browser.storage.local.get(STORAGE_KEY).then((result) => {
      if (cancelled) return;

      const stored = result[STORAGE_KEY];
      const initialMode: ThemeMode =
        stored === "light" || stored === "dark" || stored === "system" ? stored : "system";

      const initial = resolveTheme(initialMode);
      setMode(initialMode);
      setResolvedTheme(initial);
      applyTheme(initial);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for system preference changes when mode is "system".
  useEffect(() => {
    if (mode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = (e: MediaQueryListEvent) => {
      const next: ResolvedTheme = e.matches ? "dark" : "light";
      setResolvedTheme(next);
      applyTheme(next);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mode]);

  // Sync theme across multiple sidepanel instances via storage change events.
  useEffect(() => {
    const handleStorageChange = (
      changes: Record<string, browser.Storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local" || !(STORAGE_KEY in changes)) return;

      const newValue = changes[STORAGE_KEY]?.newValue;
      const updated: ThemeMode =
        newValue === "light" || newValue === "dark" || newValue === "system" ? newValue : "system";

      const next = resolveTheme(updated);
      setMode(updated);
      setResolvedTheme(next);
      applyTheme(next);
    };

    browser.storage.onChanged.addListener(handleStorageChange);
    return () => browser.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const setTheme = useCallback((nextMode: ThemeMode) => {
    const next = resolveTheme(nextMode);
    setMode(nextMode);
    setResolvedTheme(next);
    applyTheme(next);
    browser.storage.local.set({ [STORAGE_KEY]: nextMode });
  }, []);

  return { theme: mode, setTheme, resolvedTheme };
}
