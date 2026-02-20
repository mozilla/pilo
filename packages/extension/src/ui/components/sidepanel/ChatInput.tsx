import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../../lib/utils";

interface ChatInputProps {
  /** Called with the trimmed message text when the user submits. */
  onSend: (message: string) => void;
  /** Whether a task is currently executing. Shows the Stop button instead of Send. */
  isLoading: boolean;
  /** Whether the input is fully disabled (e.g. post-task-completion until a new request is started). */
  disabled?: boolean;
  /** Called when the user clicks the Stop button during execution. */
  onStop?: () => void;
}

/**
 * ChatInput renders the bottom-pinned input area for the sidepanel.
 *
 * Responsibilities:
 * - Auto-resizing textarea (max 120px)
 * - Enter to send / Shift+Enter for new line
 * - Send button (ArrowUp) when idle; Stop button (Square) when loading
 * - Clears and resets height after send
 * - Focuses textarea on mount
 *
 * This component is purely presentational for the input UI. All task
 * execution logic (background script messaging, conversation state) lives
 * in the parent.
 */
export function ChatInput({ onSend, isLoading, disabled = false, onStop }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the textarea when the component mounts
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = value.trim().length > 0 && !isLoading && !disabled;

  return (
    <div className="border-t border-border px-3 py-2">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 transition-colors",
          "focus-within:border-primary/40",
          disabled && "opacity-60",
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="What would you like me to do?"
          disabled={disabled || isLoading}
          rows={1}
          className="flex-1 resize-none bg-transparent text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
          aria-label="Task instruction input"
          data-testid="task-input"
        />

        {isLoading ? (
          <Button
            size="icon"
            variant="destructive"
            className="h-7 w-7 shrink-0 rounded-md disabled:opacity-30"
            onClick={onStop}
            aria-label="Stop task"
            data-testid="stop-button"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-7 w-7 shrink-0 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30"
            onClick={handleSubmit}
            disabled={!canSend}
            aria-label="Send instruction"
            data-testid="send-button"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
