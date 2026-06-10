import React, { useRef, useEffect } from "react";
import { X, User, Bot, Clock, Copy, Check } from "lucide-react";

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

function MessageBubble({ msg, index }) {
  const [copied, setCopied] = React.useState(false);
  const isUser = msg.role === "user";
  const isStreaming = msg.streaming;
  const isStatus = msg.isStatus;

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      alignItems: "flex-start",
      gap: "10px",
      marginBottom: "12px",
      animation: `message-fade-in 0.3s ${index * 0.05}s ease-out both`,
      opacity: isStreaming ? 0.8 : 1,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: isUser ? "rgba(0,212,255,0.1)" : "rgba(255,209,102,0.1)",
        border: `1px solid ${isUser ? "rgba(0,212,255,0.2)" : "rgba(255,209,102,0.2)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, marginTop: "2px",
      }}>
        {isUser ? <User size={13} color="#00d4ff" /> : <Bot size={13} color="#ffd166" />}
      </div>

      <div style={{
        maxWidth: "85%",
        display: "flex", flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          marginBottom: "4px",
        }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "8px",
            color: "var(--arc-dim)", letterSpacing: "0.1em",
          }}>
            {isUser ? "YOU" : "JARVIS"}
          </span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "8px",
            color: "var(--text-dim)", opacity: 0.5,
          }}>
            {formatTime(msg.ts)}
          </span>
          {msg.activeAgents && msg.activeAgents.length > 0 && (
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "7px",
              color: "var(--arc-primary)", opacity: 0.7,
              letterSpacing: "0.05em",
            }}>
              [{msg.activeAgents.join(", ").toUpperCase()}]
            </span>
          )}
        </div>

        <div style={{
          padding: "10px 14px",
          borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
          background: isUser 
            ? "rgba(0,212,255,0.06)" 
            : isStatus 
              ? "rgba(0,212,255,0.03)" 
              : "rgba(255,209,102,0.04)",
          border: `1px solid ${isUser 
            ? "rgba(0,212,255,0.1)" 
            : isStatus 
              ? "rgba(0,212,255,0.06)" 
              : "rgba(255,209,102,0.08)"}`,
          fontFamily: "var(--font-mono)", fontSize: "12px",
          color: isStatus ? "var(--arc-dim)" : "var(--text-primary)",
          lineHeight: 1.6,
          letterSpacing: "0.01em",
          wordBreak: "break-word",
          position: "relative",
        }}>
          {msg.content || (isStreaming && !isStatus ? (
            <span style={{ color: "var(--arc-dim)", fontStyle: "italic" }}>Thinking...</span>
          ) : null)}
          
          {isStreaming && !isStatus && (
            <span style={{
              display: "inline-block", width: "6px", height: "12px",
              background: "var(--arc-primary)", marginLeft: "4px",
              animation: "cursor-blink 1s step-end infinite",
              verticalAlign: "middle",
            }} />
          )}

          {!isUser && !isStreaming && msg.content && (
            <button
              onClick={handleCopy}
              style={{
                position: "absolute", top: "6px", right: "6px",
                background: "none", border: "none",
                color: copied ? "var(--green-ok)" : "var(--arc-dim)",
                cursor: "pointer", padding: "2px",
                opacity: 0, transition: "opacity 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "1"}
              onMouseLeave={e => e.currentTarget.style.opacity = "0"}
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          )}
        </div>

        {msg.actions && msg.actions.length > 0 && (
          <div style={{
            display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap",
          }}>
            {msg.actions.map((action, i) => (
              <span key={i} style={{
                fontFamily: "var(--font-mono)", fontSize: "8px",
                color: "var(--arc-primary)",
                padding: "2px 8px",
                borderRadius: "2px",
                border: "1px solid rgba(0,212,255,0.15)",
                background: "rgba(0,212,255,0.03)",
                letterSpacing: "0.05em",
              }}>
                {action.type}: {action.value?.slice(0, 30) || ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({ messages, isOpen, onClose }) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (!isOpen) return null;

  return (
    <div style={{
      width: "340px", minWidth: "340px",
      background: "rgba(2,4,8,0.95)",
      borderLeft: "1px solid var(--border)",
      backdropFilter: "blur(16px)",
      display: "flex", flexDirection: "column",
      position: "relative", zIndex: 15,
      animation: "panel-slide-in 0.3s ease-out",
    }}>
      <div style={{
        padding: "14px 16px",
        borderBottom: "1px solid rgba(0,212,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Clock size={13} color="var(--arc-primary)" />
          <span style={{
            fontFamily: "var(--font-display)", fontSize: "11px",
            letterSpacing: "0.2em", color: "var(--arc-primary)",
          }}>
            SESSION LOG
          </span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "9px",
            color: "var(--arc-dim)", marginLeft: "4px",
          }}>
            {messages.length} entries
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none",
            color: "var(--text-dim)", cursor: "pointer",
            padding: "4px", display: "flex",
            transition: "color 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--red-alert)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-dim)"}
        >
          <X size={14} />
        </button>
      </div>

      <div
        ref={scrollRef}
        style={{
          flex: 1, overflowY: "auto",
          padding: "16px",
        }}
      >
        {messages.length === 0 ? (
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            height: "200px", gap: "12px",
          }}>
            <Bot size={32} color="var(--arc-dim)" opacity={0.3} />
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "10px",
              color: "var(--arc-dim)", letterSpacing: "0.1em",
            }}>
              NO MESSAGES YET
            </span>
          </div>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble key={msg.id || i} msg={msg} index={i} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}