import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import { ExternalLink, Search, Volume2, Copy, Check } from "lucide-react";
import { useState } from "react";

const ActionButton = ({ action, onOpen }) => {
  const isUrl = action.type === "OPEN_URL";
  const icon = isUrl ? <ExternalLink size={10} /> : <Search size={10} />;
  const label = isUrl ? action.value.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : action.value;

  return (
    <button onClick={() => onOpen(action)} title={action.value} style={{
      display: "inline-flex", alignItems: "center", gap: "5px",
      padding: "3px 8px",
      background: "rgba(0,212,255,0.06)",
      border: "1px solid rgba(0,212,255,0.25)",
      borderRadius: "2px",
      color: "var(--arc-primary)",
      fontSize: "10px", fontFamily: "var(--font-mono)",
      cursor: "pointer", transition: "all 0.2s",
      letterSpacing: "0.05em",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,212,255,0.15)"; e.currentTarget.style.borderColor = "var(--arc-primary)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,212,255,0.06)"; e.currentTarget.style.borderColor = "rgba(0,212,255,0.25)"; }}
    >
      {icon} {label}
    </button>
  );
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handle = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={handle} title="Copy" style={{
      background: "none", border: "none", cursor: "pointer",
      color: copied ? "var(--green-ok)" : "var(--text-dim)", padding: "2px", transition: "color 0.2s", display: "flex",
    }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
};

const ChatMessage = memo(({ msg, onSpeak, onAction }) => {
  const isUser = msg.role === "user";
  const isEmpty = !msg.content && msg.streaming;

  // ─── User Command: terminal line ───
  if (isUser) {
    return (
      <div style={{
        padding: "6px 24px",
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        color: "var(--text-dim)",
        letterSpacing: "0.04em",
        display: "flex", alignItems: "baseline", gap: "10px",
      }}>
        <span style={{ color: "var(--arc-dim)", fontSize: "11px", letterSpacing: "0.1em" }}>
          {new Date(msg.ts || Date.now()).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        <span style={{ color: "var(--arc-primary)", opacity: 0.6 }}>❯</span>
        <span>{msg.content}</span>
      </div>
    );
  }

  // ─── JARVIS Response: holographic panel ───
  return (
    <div style={{
      margin: "10px 24px 16px",
      position: "relative",
    }}>
      {/* Cyan left border glow */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: "2px",
        background: "linear-gradient(180deg, var(--arc-primary), transparent)",
        boxShadow: "0 0 12px var(--arc-primary)",
      }} />

      {/* Panel background */}
      <div style={{
        marginLeft: "12px",
        padding: "14px 18px",
        background: "rgba(0,212,255,0.02)",
        border: "1px solid rgba(0,212,255,0.08)",
        borderLeft: "none",
      }}>
        {/* JARVIS header */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          marginBottom: "10px",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: msg.streaming ? "var(--arc-primary)" : "var(--green-ok)",
            boxShadow: msg.streaming ? "0 0 8px var(--arc-primary)" : "0 0 8px var(--green-ok)",
            animation: msg.streaming ? "pulse 1.5s infinite" : "none",
          }} />
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: "9px",
            letterSpacing: "0.25em",
            color: msg.streaming ? "var(--arc-primary)" : "var(--green-ok)",
          }}>
            {msg.streaming ? "J.A.R.V.I.S :: PROCESSING" : "J.A.R.V.I.S :: RESPONSE"}
          </span>
        </div>

        {/* Content */}
        <div className="md-content" style={{
          fontSize: "15px",
          lineHeight: 1.7,
          color: "var(--text-primary)",
          textShadow: "0 0 20px rgba(0,212,255,0.1)",
          fontFamily: "var(--font-body)",
        }}>
          {isEmpty ? (
            <div style={{ display: "flex", gap: "5px", alignItems: "center", padding: "4px 0" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: "var(--arc-primary)",
                  animation: `typing 1.4s ease-in-out ${i * 0.2}s infinite`,
                }} />
              ))}
            </div>
          ) : (
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          )}
        </div>

        {/* Actions */}
        {msg.actions?.length > 0 && (
          <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
            {msg.actions.map((action, i) => (
              <ActionButton key={i} action={action} onOpen={onAction} />
            ))}
          </div>
        )}

        {/* Toolbar */}
        {!msg.streaming && msg.content && (
          <div style={{ display: "flex", gap: "10px", marginTop: "12px", opacity: 0.4, transition: "opacity 0.2s" }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = "0.8"}
            onMouseLeave={(e) => e.currentTarget.style.opacity = "0.4"}
          >
            <CopyButton text={msg.content} />
            {onSpeak && (
              <button onClick={() => onSpeak(msg.content)} title="Read aloud" style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-dim)", padding: "2px", display: "flex", transition: "color 0.2s",
              }}
                onMouseEnter={(e) => e.currentTarget.style.color = "var(--arc-primary)"}
                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
              >
                <Volume2 size={11} />
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