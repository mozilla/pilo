import type { ReactElement } from "react";
import type { Theme } from "./theme";

import type { ChatMessage } from "./hooks/useConversation";

interface ChatMessageProps {
  type: ChatMessage["type"];
  content: string;
  timestamp?: Date;
  theme: Theme;
  isStreaming?: boolean;
  reasoning?: string[];
}

// Simple markdown-like rendering for bold text
function renderContent(content: string): ReactElement {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={index}>{part.slice(2, -2)}</strong>;
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

export function ChatMessage({
  type,
  content,
  timestamp,
  theme: t,
  isStreaming,
  reasoning,
}: ChatMessageProps): ReactElement {
  const isUser = type === "user";
  const isSystem = type === "system";

  return (
    <li className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          isUser
            ? `${t.bg.primary} ${t.text.primary} border ${t.border.primary}`
            : isSystem
              ? `${t.bg.tertiary} ${t.text.muted} border ${t.border.primary}`
              : `${t.bg.secondary} ${t.text.primary} border ${t.border.primary}`
        }`}
      >
        {!isUser && !isSystem && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">⚡</span>
            <span className={`text-xs font-medium ${t.text.secondary}`}>Spark</span>
          </div>
        )}

        {/* Show reasoning steps if streaming */}
        {(isStreaming || reasoning) && reasoning && reasoning.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-500 mb-2">💭 Thinking...</div>
            {reasoning.map((step, index) => (
              <div key={index} className={`text-xs ${t.text.secondary} mb-1`}>
                {index + 1}. {step}
              </div>
            ))}
          </div>
        )}

        {/* Show content if not streaming or if streaming is finished */}
        {(!isStreaming || content) && (
          <div
            className={`${isUser ? "text-message-user" : "text-message-assistant"} whitespace-pre-wrap`}
          >
            {renderContent(content)}
          </div>
        )}

        {/* Show loading indicator if streaming and no content yet */}
        {isStreaming && !content && (
          <div className="flex items-center gap-2 text-sm">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 0 1 4 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className={t.text.muted}>Working on your request...</span>
          </div>
        )}

        {timestamp && (
          <div className={`text-xs ${t.text.muted} mt-1`}>{timestamp.toLocaleTimeString()}</div>
        )}
      </div>
    </li>
  );
}
