import type { ReactElement } from "react";
import type { Theme } from "./theme";

type AgentEvent = { type: string; data: any; timestamp: number };

interface EventLogProps {
  events: AgentEvent[];
  theme: Theme;
}

/**
 * React component to render WebAgent events in a nice format
 */
export function EventLog({ events, theme: t }: EventLogProps): ReactElement {
  const formatEvent = (event: AgentEvent) => {
    const { type, data } = event;

    switch (type) {
      case "task:started":
        return (
          <div className="space-y-2">
            <div>
              <strong className={t.events.task}>🎯 Task:</strong>{" "}
              <span className={t.text.primary}>{data.task}</span>
            </div>
            <div>
              <strong className={t.events.explanation}>💡 Explanation:</strong>{" "}
              <span className={t.text.primary}>{data.explanation}</span>
            </div>
            <div>
              <strong className={t.events.plan}>📋 Plan:</strong>{" "}
              <span className={t.text.primary}>{data.plan}</span>
            </div>
            <div>
              <strong className={t.events.url}>🌐 Starting URL:</strong>{" "}
              <span className={t.events.url}>{data.url}</span>
            </div>
          </div>
        );

      case "task:completed":
        return data.finalAnswer ? (
          <div>
            <strong className={t.events.completion}>✨ Final Answer:</strong>{" "}
            <span className={t.text.primary}>{data.finalAnswer}</span>
          </div>
        ) : null;

      case "browser:navigated":
        const truncatedTitle =
          data.title.length > 50 ? data.title.slice(0, 47) + "..." : data.title;
        return (
          <>
            <div className={`${t.text.muted} my-2 text-center`}>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
            <div>
              <strong className={t.events.page}>📍 Current Page:</strong>{" "}
              <span className={t.text.primary}>{truncatedTitle}</span>
            </div>
          </>
        );

      case "agent:observed":
        return (
          <div>
            <strong className={t.events.observation}>🔭 Observation:</strong>{" "}
            <span className={t.text.primary}>{data.observation}</span>
          </div>
        );

      case "agent:reasoned":
        return (
          <div>
            <strong className={t.events.thought}>💭 Thought:</strong>{" "}
            <span className={t.text.primary}>{data.thought}</span>
          </div>
        );

      case "browser:action_started":
        return (
          <div>
            <strong className={t.events.action}>🎯 Action:</strong>{" "}
            <span className={`${t.text.primary} uppercase`}>{data.action}</span>
            {data.ref && <span className={`${t.events.actionRef} ml-2`}>ref: {data.ref}</span>}
            {data.value && (
              <span className={`${t.events.actionValue} ml-2`}>value: "{data.value}"</span>
            )}
          </div>
        );

      case "browser:action_completed":
        return data.success ? (
          <div className={t.events.success}>
            <strong>✅ Success</strong>
          </div>
        ) : (
          <div className={t.events.failure}>
            <strong>❌ Failed:</strong>{" "}
            <span className={t.text.primary}>{data.error || "Unknown error"}</span>
          </div>
        );

      case "agent:waiting":
        return <div className={t.events.waiting}>⏳ Waiting {data.seconds}s...</div>;

      case "browser:network_waiting":
        return <div className={t.events.network}>🌐 Waiting for network...</div>;

      case "browser:network_timeout":
        return <div className={t.events.network}>⚠️ Network timeout</div>;

      case "agent:processing":
        return data.status === "start" ? (
          <div className={t.events.processing}>
            🧮 {data.hasScreenshot ? "👁️ " : ""}Processing:{" "}
            <span className={t.text.primary}>{data.operation}...</span>
          </div>
        ) : null;

      default:
        // Generic fallback for any event we haven't specifically handled
        return (
          <div className={`${t.events.generic} text-sm`}>
            <strong>{type}:</strong>{" "}
            <span className={t.text.secondary}>{JSON.stringify(data, null, 2)}</span>
          </div>
        );
    }
  };

  return (
    <div
      className={`h-96 overflow-y-auto p-4 border ${t.border.secondary} rounded-lg ${t.bg.secondary} font-mono text-sm leading-relaxed`}
    >
      {events.length === 0 ? (
        <div className={`${t.text.muted} text-center mt-8`}>
          No events yet. Run a task to see agent activity here.
        </div>
      ) : (
        events
          .slice()
          .reverse()
          .map((event, index) => (
            <div
              key={events.length - index - 1}
              className={`mb-3 border-b ${t.border.primary} pb-2 last:border-b-0`}
            >
              {formatEvent(event)}
            </div>
          ))
      )}
    </div>
  );
}
