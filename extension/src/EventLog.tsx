import type { ReactElement } from "react";

type AgentEvent = { type: string; data: any; timestamp: number };

interface EventLogProps {
  events: AgentEvent[];
}

/**
 * React component to render WebAgent events in a nice format
 */
export function EventLog({ events }: EventLogProps): ReactElement {
  const formatEvent = (event: AgentEvent) => {
    const { type, data } = event;

    switch (type) {
      case "task:started":
        return (
          <div>
            <div>
              <strong>🎯 Task:</strong> {data.task}
            </div>
            <div>
              <strong>💡 Explanation:</strong> {data.explanation}
            </div>
            <div>
              <strong>📋 Plan:</strong> {data.plan}
            </div>
            <div>
              <strong>🌐 Starting URL:</strong> <span style={{ color: "#0074d9" }}>{data.url}</span>
            </div>
          </div>
        );

      case "task:completed":
        return data.finalAnswer ? (
          <div>
            <strong style={{ color: "green" }}>✨ Final Answer:</strong> {data.finalAnswer}
          </div>
        ) : null;

      case "browser:navigated":
        const truncatedTitle =
          data.title.length > 50 ? data.title.slice(0, 47) + "..." : data.title;
        return (
          <>
            <div style={{ color: "#aaa", margin: "8px 0 2px 0" }}>
              ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            </div>
            <div>
              <strong>📍 Current Page:</strong> {truncatedTitle}
            </div>
          </>
        );

      case "agent:observed":
        return (
          <div>
            <strong>🔭 Observation:</strong> {data.observation}
          </div>
        );

      case "agent:reasoned":
        return (
          <div>
            <strong>💭 Thought:</strong> {data.thought}
          </div>
        );

      case "browser:action_started":
        let details = `<strong>🎯 Action:</strong> ${data.action.toUpperCase()}`;
        if (data.ref) details += ` <span style="color:#0074d9">ref: ${data.ref}</span>`;
        if (data.value) details += ` <span style="color:green">value: "${data.value}"</span>`;
        return <div dangerouslySetInnerHTML={{ __html: details }} />;

      case "browser:action_completed":
        return data.success ? (
          <div style={{ color: "green" }}>
            <strong>✅ Success</strong>
          </div>
        ) : (
          <div style={{ color: "red" }}>
            <strong>❌ Failed:</strong> {data.error || "Unknown error"}
          </div>
        );

      case "agent:waiting":
        return <div style={{ color: "#b8860b" }}>⏳ Waiting {data.seconds}s...</div>;

      case "browser:network_waiting":
        return <div style={{ color: "#888" }}>🌐 Waiting for network...</div>;

      case "browser:network_timeout":
        return <div style={{ color: "#888" }}>⚠️ Network timeout</div>;

      case "agent:processing":
        return data.status === "start" ? (
          <div>
            🧮 {data.hasScreenshot ? "👁️ " : ""}Processing: {data.operation}...
          </div>
        ) : null;

      default:
        // Generic fallback for any event we haven't specifically handled
        return (
          <div style={{ color: "#666", fontSize: "0.9em" }}>
            <strong>{type}:</strong> {JSON.stringify(data, null, 2)}
          </div>
        );
    }
  };

  return (
    <div
      style={{
        height: "400px",
        overflowY: "auto",
        padding: "10px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        backgroundColor: "#f9f9f9",
        fontFamily: "monospace",
        fontSize: "13px",
        lineHeight: "1.4",
      }}
    >
      {events.length === 0 ? (
        <div style={{ color: "#999", textAlign: "center", marginTop: "20px" }}>
          No events yet. Run a task to see agent activity here.
        </div>
      ) : (
        events
          .slice()
          .reverse()
          .map((event, index) => (
            <div
              key={events.length - index - 1}
              style={{ marginBottom: "8px", borderBottom: "1px solid #eee", paddingBottom: "4px" }}
            >
              {formatEvent(event)}
            </div>
          ))
      )}
    </div>
  );
}
