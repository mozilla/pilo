import { useState, useEffect } from "react";
import { Settings, RotateCcw, ArrowLeft, Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../../../lib/utils";
import { TabstackIcon } from "./TabstackIcon";

type View = "chat" | "settings";

interface SidebarHeaderProps {
  /** The currently active view. */
  view: View;
  /** Called when the user requests a view change. */
  onNavigate: (view: View) => void;
  /** Called when the user clicks the clear chat button. */
  onClearChat: () => void;
  /** Optional extra class names for the root element. */
  className?: string;
}

export function SidebarHeader({ view, onNavigate, onClearChat, className }: SidebarHeaderProps) {
  const { setTheme, resolvedTheme } = useTheme();

  // Guard against async theme load from browser.storage producing a
  // flash of the wrong icon on first render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header
      className={cn(
        "flex items-center justify-between px-4 py-3 border-b border-border",
        className,
      )}
    >
      {/* Logo + title */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-7 w-7 items-center justify-center">
          <TabstackIcon className="h-7 w-7" />
        </div>
        <h1 className="text-sm font-semibold tracking-tight text-foreground">Tabstack Pilo</h1>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Theme toggle dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              aria-label="Toggle theme"
            >
              {mounted && resolvedTheme === "dark" ? (
                <Moon className="h-3.5 w-3.5" />
              ) : (
                <Sun className="h-3.5 w-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px]">
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-3.5 w-3.5" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-3.5 w-3.5" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-3.5 w-3.5" />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View-dependent buttons */}
        {view === "chat" ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              onClick={onClearChat}
              aria-label="Clear chat"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              onClick={() => onNavigate("settings")}
              aria-label="Open settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            onClick={() => onNavigate("chat")}
            aria-label="Back to chat"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </header>
  );
}
