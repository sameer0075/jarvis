import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import { ExternalLink, Search, Volume2, Copy, Check } from "lucide-react";
import { useState } from "react";

const ActionButton = ({ action, onOpen }) => {
  const isUrl = action.type === "OPEN_URL";
  const icon = isUrl ? <ExternalLink size={11} /> : <Search size={11} />;
  const label = isUrl
    ? action.value.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]
    : action.value;

  return (
    <button
      onClick={() => onOpen(action)}
      title={action.value}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "4px 10px",
        background: "rgba(0,212,255,0.08)",
        border: "1px solid rgba(0,212,255,0.3)",
        borderRadius: "3px",
        color: "var(--arc-primary)",
        fontSize: "11px",
        fontFamily: "var(--font-mono)",
        cursor: "pointer",
        transition: "all 0.2s",
        maxWidth: "280px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(0,212,255,0.18)";
        e.currentTarget.style.borderColor = "var(--arc-primary)";
        e.currentTarget.style.boxShadow = "0 0 10px rgba(0,212,255,0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(0,212,255,0.08)";
        e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {icon}
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </button>
  );
};

const TypingDots = () => (
  <div style={{ display: "flex", gap: "5px", alignItems: "center", padding: "4px 0" }}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          width: 6, height: 6,
          borderRadius: "50%",
          background: "var(--arc-primary)",
          animation: `typing 1.4s ease-in-out ${i * 0.2}s infinite`,
        }}
      />
    ))}
  </div>
);

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handle}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: copied ? "var(--green-ok)" : "var(--text-dim)",
        padding: "2px",
        transition: "color 0.2s",
        display: "flex",
      }}
      title="Copy"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
};

const ChatMessage = memo(({ msg, onSpeak, onAction }) => {
  const isUser = msg.role === "user";
  const isEmpty = !msg.content && msg.streaming;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        gap: "12px",
        padding: "8px 16px",
        animation: "fadeSlideIn 0.25s ease",
      }}
    >
      {/* Avatar */}
      <div style={{
        flexShrink: 0,
        width: 30, height: 30,
        borderRadius: "50%",
        background: isUser ? "rgba(255,209,102,0.12)" : "rgba(0,212,255,0.08)",
        border: `1px solid ${isUser ? "rgba(255,209,102,0.4)" : "var(--border-bright)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "10px",
        fontFamily: "var(--font-display)",
        color: isUser ? "var(--gold)" : "var(--arc-primary)",
        letterSpacing: "0.05em",
        marginTop: "2px",
      }}>
        {isUser ? "YOU" : "J"}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: "75%",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        alignItems: isUser ? "flex-end" : "flex-start",
      }}>
        <div style={{
          background: isUser
            ? "linear-gradient(135deg, rgba(255,209,102,0.1), rgba(255,209,102,0.05))"
            : "var(--bg-card)",
          border: `1px solid ${isUser ? "rgba(255,209,102,0.25)" : "var(--border)"}`,
          borderRadius: isUser ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
          padding: "10px 14px",
          position: "relative",
        }}>
          {isEmpty ? (
            <TypingDots />
          ) : (
            <div className="md-content" style={{
              fontSize: "14px",
              lineHeight: 1.65,
              color: isUser ? "var(--gold)" : "var(--text-primary)",
              fontFamily: isUser ? "var(--font-body)" : "var(--font-body)",
            }}>
              {isUser ? (
                <span>{msg.content}</span>
              ) : (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              )}
            </div>
          )}
        </div>

        {/* Actions row */}
        {msg.actions?.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {msg.actions.map((action, i) => (
              <ActionButton key={i} action={action} onOpen={onAction} />
            ))}
          </div>
        )}

        {/* Toolbar */}
        {!isUser && !msg.streaming && msg.content && (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <CopyButton text={msg.content} />
            {onSpeak && (
              <button
                onClick={() => onSpeak(msg.content)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-dim)", padding: "2px", display: "flex",
                  transition: "color 0.2s",
                }}
                title="Read aloud"
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--arc-primary)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
              >
                <Volume2 size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

ChatMessage.displayName = "ChatMessage";
export default ChatMessage;
