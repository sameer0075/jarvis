import React, { memo, useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { ExternalLink, Search, Volume2, Copy, Check, Zap } from "lucide-react";

// ── Inject global keyframes once ─────────────────────────────────────────────
const STYLES = `
  @keyframes jarvis-entry {
    0%   { opacity:0; transform: translateX(-8px) scaleY(0.96); clip-path: inset(0 100% 0 0); }
    40%  { opacity:1; transform: translateX(0)    scaleY(1);    clip-path: inset(0 60%  0 0); }
    100% { opacity:1; transform: translateX(0)    scaleY(1);    clip-path: inset(0 0%   0 0); }
  }
  @keyframes user-entry {
    0%   { opacity:0; transform: translateX(12px); }
    100% { opacity:1; transform: translateX(0); }
  }
  @keyframes border-scan {
    0%   { background-position: 0% 0%; }
    100% { background-position: 0% 100%; }
  }
  @keyframes dot-blink {
    0%,100% { opacity:1; } 50% { opacity:0.2; }
  }
  @keyframes glitch-1 {
    0%,100% { clip-path: inset(0 0 98% 0); transform: translateX(0); }
    10%     { clip-path: inset(20% 0 60% 0); transform: translateX(-3px); }
    30%     { clip-path: inset(50% 0 30% 0); transform: translateX(2px); }
    50%     { clip-path: inset(80% 0 5%  0); transform: translateX(-1px); }
  }
  @keyframes glitch-2 {
    0%,100% { clip-path: inset(0 0 98% 0); transform: translateX(0); opacity:0; }
    15%     { clip-path: inset(10% 0 70% 0); transform: translateX(3px); opacity:0.6; }
    45%     { clip-path: inset(60% 0 20% 0); transform: translateX(-2px); opacity:0.4; }
  }
  @keyframes sweep-line {
    0%   { top: 0%; opacity:0.8; }
    100% { top: 100%; opacity:0; }
  }
  @keyframes status-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(0,212,255,0.4); }
    50%     { box-shadow: 0 0 0 5px rgba(0,212,255,0); }
  }
  @keyframes corner-flash {
    0%,100% { opacity:0.4; } 50% { opacity:1; }
  }
  @keyframes decode {
    0%  { opacity:0.3; filter: blur(1px); letter-spacing: 0.3em; }
    100%{ opacity:1;   filter: blur(0);   letter-spacing: normal; }
  }
  @keyframes progress-fill {
    0%   { width: 0%; }
    100% { width: 100%; }
  }
  @keyframes holo-flicker {
    0%,98%,100% { opacity:1; }
    99% { opacity:0.85; }
  }
  @keyframes typing-dot {
    0%,80%,100% { transform: scale(0.6); opacity:0.3; }
    40%         { transform: scale(1);   opacity:1; }
  }
`;

let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const el = document.createElement("style");
  el.textContent = STYLES;
  document.head.appendChild(el);
}

// ── Corner brackets decoration ────────────────────────────────────────────────
function Corners({ color = "#00d4ff", size = 10, thickness = 1.5, animated = false }) {
  const s = {
    position: "absolute", width: size, height: size,
    animation: animated ? "corner-flash 2s ease-in-out infinite" : "none",
  };
  const b = `${thickness}px solid ${color}`;
  return (
    <>
      <div style={{ ...s, top: -1, left: -1,  borderTop: b, borderLeft:  b }} />
      <div style={{ ...s, top: -1, right: -1, borderTop: b, borderRight: b }} />
      <div style={{ ...s, bottom: -1, left: -1,  borderBottom: b, borderLeft:  b }} />
      <div style={{ ...s, bottom: -1, right: -1, borderBottom: b, borderRight: b }} />
    </>
  );
}

// ── Scan sweep line ───────────────────────────────────────────────────────────
function SweepLine({ active }) {
  if (!active) return null;
  return (
    <div style={{
      position: "absolute", left: 0, right: 0, height: "1px",
      background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)",
      animation: "sweep-line 1.8s linear infinite",
      pointerEvents: "none", zIndex: 3,
    }} />
  );
}

// ── Glitch overlay ────────────────────────────────────────────────────────────
function GlitchOverlay({ text, active }) {
  if (!active || !text) return null;
  return (
    <>
      <div aria-hidden style={{
        position: "absolute", inset: 0, color: "#00ffff",
        fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: 1.7,
        padding: "14px 18px", pointerEvents: "none", zIndex: 4,
        animation: "glitch-1 4s steps(1) infinite",
        opacity: 0.4,
      }}>{text}</div>
      <div aria-hidden style={{
        position: "absolute", inset: 0, color: "#ff003c",
        fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: 1.7,
        padding: "14px 18px", pointerEvents: "none", zIndex: 4,
        animation: "glitch-2 4s steps(1) infinite",
        opacity: 0,
      }}>{text}</div>
    </>
  );
}

// ── Data stream header ────────────────────────────────────────────────────────
function MessageHeader({ streaming, done }) {
  const [seq,    setSeq]    = useState("00");
  const [pct,    setPct]    = useState(0);
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    if (!streaming && done) { setPct(100); return; }
    const iv = setInterval(() => {
      setSeq(String(Math.floor(Math.random() * 99)).padStart(2, "0"));
      setPct(p => Math.min(p + Math.random() * 8, 95));
      setUptime(u => u + 1);
    }, 180);
    return () => clearInterval(iv);
  }, [streaming, done]);

  const statusColor = done ? "#06d6a0" : "#00d4ff";
  const label = done ? "COMPLETE" : streaming ? "TRANSMITTING" : "STANDBY";

  return (
    <div style={{ marginBottom: "12px" }}>
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "7px" }}>
        {/* Status dot */}
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: statusColor,
          boxShadow: `0 0 10px ${statusColor}`,
          animation: streaming ? "status-pulse 1.2s infinite" : "none",
          flexShrink: 0,
        }} />

        {/* Label */}
        <span style={{
          fontFamily: "var(--font-display)", fontSize: "9px",
          letterSpacing: "0.28em", color: statusColor,
          textShadow: `0 0 10px ${statusColor}60`,
          animation: streaming ? "decode 0.4s ease-out" : "none",
        }}>
          J.A.R.V.I.S :: {label}
        </span>

        {/* Right metadata */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "rgba(0,212,255,0.3)", letterSpacing: "0.1em" }}>
            SEQ/{seq}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "rgba(0,212,255,0.3)", letterSpacing: "0.1em" }}>
            {new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: "2px", background: "rgba(0,212,255,0.06)", borderRadius: "1px", overflow: "hidden", position: "relative" }}>
        <div style={{
          height: "100%",
          width: done ? "100%" : `${pct}%`,
          background: done
            ? "linear-gradient(90deg, #06d6a060, #06d6a0)"
            : "linear-gradient(90deg, rgba(0,212,255,0.3), #00d4ff)",
          transition: done ? "width 0.4s ease-out" : "width 0.2s linear",
          boxShadow: `0 0 8px ${done ? "#06d6a0" : "#00d4ff"}60`,
        }} />
        {/* shimmer */}
        {streaming && (
          <div style={{
            position: "absolute", top: 0, right: 0, width: "30%", height: "100%",
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
            animation: "border-scan 1s linear infinite",
          }} />
        )}
      </div>
    </div>
  );
}

// ── Thinking animation ────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center", padding: "6px 0" }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "rgba(0,212,255,0.4)", letterSpacing: "0.15em", marginRight: "4px" }}>
        PROCESSING
      </span>
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{
          width: i % 2 === 0 ? 4 : 3,
          height: i % 2 === 0 ? 4 : 3,
          borderRadius: "50%",
          background: i < 3 ? "#00d4ff" : "rgba(0,212,255,0.3)",
          animation: `typing-dot 1.4s ease-in-out ${i * 0.12}s infinite`,
          boxShadow: i < 3 ? "0 0 6px rgba(0,212,255,0.6)" : "none",
        }} />
      ))}
    </div>
  );
}

// ── Action Button ─────────────────────────────────────────────────────────────
function ActionButton({ action, onOpen }) {
  const [hover, setHover] = useState(false);
  const isUrl = action.type === "OPEN_URL";
  const label = isUrl
    ? action.value.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]
    : action.value;

  return (
    <button
      onClick={() => onOpen(action)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        padding: "4px 10px",
        background: hover ? "rgba(0,212,255,0.12)" : "rgba(0,212,255,0.04)",
        border: `1px solid ${hover ? "#00d4ff" : "rgba(0,212,255,0.2)"}`,
        borderRadius: "2px",
        color: hover ? "#00d4ff" : "rgba(0,212,255,0.7)",
        fontSize: "10px", fontFamily: "var(--font-mono)",
        cursor: "pointer", transition: "all 0.15s",
        letterSpacing: "0.08em",
        boxShadow: hover ? "0 0 12px rgba(0,212,255,0.15)" : "none",
      }}
    >
      {isUrl ? <ExternalLink size={10} /> : <Search size={10} />}
      <span style={{ fontSize: "8px", color: "rgba(0,212,255,0.4)", marginRight: "-2px" }}>[</span>
      {label.toUpperCase()}
      <span style={{ fontSize: "8px", color: "rgba(0,212,255,0.4)", marginLeft: "-2px" }}>]</span>
    </button>
  );
}

// ── Copy Button ───────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: copied ? "#06d6a0" : "rgba(0,212,255,0.3)",
        padding: "2px 4px", transition: "color 0.2s", display: "flex", alignItems: "center", gap: "4px",
        fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.1em",
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      <span>{copied ? "COPIED" : "COPY"}</span>
    </button>
  );
}

// ── Main ChatMessage ──────────────────────────────────────────────────────────
const ChatMessage = memo(({ msg, onSpeak, onAction }) => {
  injectStyles();
  const isUser  = msg.role === "user";
  const isEmpty = !msg.content && msg.streaming;
  const isDone  = !msg.streaming && !!msg.content;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 20);
    return () => clearTimeout(t);
  }, []);

  // ── User message ────────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div style={{
        padding: "8px 24px",
        display: "flex", alignItems: "baseline", gap: "12px",
        animation: "user-entry 0.2s ease-out",
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.2s",
      }}>
        {/* Timestamp */}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "rgba(0,212,255,0.25)", letterSpacing: "0.1em", flexShrink: 0 }}>
          {new Date(msg.ts || Date.now()).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>

        {/* Prompt char */}
        <span style={{ color: "rgba(0,212,255,0.5)", fontFamily: "var(--font-mono)", fontSize: "14px", flexShrink: 0 }}>❯</span>

        {/* Content with decode animation */}
        <div style={{ position: "relative", flex: 1 }}>
          {/* Subtle left tick */}
          <div style={{
            position: "absolute", left: -10, top: "50%", transform: "translateY(-50%)",
            width: 4, height: 4, borderRadius: "50%",
            background: "rgba(0,212,255,0.3)",
          }} />
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "13px",
            color: "rgba(200,238,248,0.75)", letterSpacing: "0.03em",
            lineHeight: 1.6,
            animation: "decode 0.3s ease-out",
          }}>
            {msg.content}
          </span>
        </div>
      </div>
    );
  }

  // ── JARVIS response ─────────────────────────────────────────────────────────
  return (
    <div style={{
      margin: "14px 24px 18px",
      position: "relative",
      animation: "jarvis-entry 0.5s cubic-bezier(0.22,1,0.36,1) both",
      animation: mounted ? "jarvis-entry 0.5s cubic-bezier(0.22,1,0.36,1) both" : "none",
      opacity: mounted ? 1 : 0,
      transition: "opacity 0.1s",
    }}>
      {/* Vertical left rail — thicker, animated during stream */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: "2px",
        background: isDone
          ? "linear-gradient(180deg, #06d6a0, rgba(6,214,160,0.1))"
          : "linear-gradient(180deg, #00d4ff, rgba(0,212,255,0.1))",
        boxShadow: isDone
          ? "0 0 16px #06d6a040, 0 0 4px #06d6a0"
          : "0 0 20px rgba(0,212,255,0.5), 0 0 6px #00d4ff",
        transition: "all 0.6s ease",
      }} />

      {/* Main panel */}
      <div style={{
        marginLeft: "14px",
        background: "rgba(0,212,255,0.02)",
        border: "1px solid rgba(0,212,255,0.08)",
        borderLeft: "none",
        position: "relative",
        overflow: "hidden",
        animation: msg.streaming ? "holo-flicker 6s infinite" : "none",
      }}>
        {/* Corner brackets */}
        <Corners
          color={isDone ? "#06d6a0" : "#00d4ff"}
          animated={msg.streaming}
        />

        {/* Active sweep line */}
        <SweepLine active={msg.streaming} />

        {/* Glitch effect on streaming text */}
        <GlitchOverlay text={msg.streaming ? msg.content?.slice(-40) : null} active={msg.streaming} />

        {/* Scanline texture */}
        <div style={{
          position: "absolute", inset: 0,
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.008) 3px, rgba(0,212,255,0.008) 4px)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ padding: "14px 18px", position: "relative", zIndex: 2 }}>
          {/* Header */}
          <MessageHeader streaming={msg.streaming} done={isDone} />

          {/* Content */}
          <div style={{
            fontSize: "14px", lineHeight: 1.75,
            color: msg.streaming ? "#c8eef8" : "#ddf0f8",
            fontFamily: msg.streaming ? "var(--font-mono)" : "var(--font-body)",
            transition: "font-family 0.3s, color 0.3s",
            textShadow: msg.streaming ? "0 0 12px rgba(0,212,255,0.15)" : "none",
          }}>
            {isEmpty ? (
              <ThinkingDots />
            ) : msg.streaming ? (
              // Raw mono text while streaming
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {msg.content}
                <span style={{
                  display: "inline-block", width: "2px", height: "14px",
                  background: "#00d4ff", marginLeft: "2px", verticalAlign: "text-bottom",
                  boxShadow: "0 0 8px #00d4ff",
                  animation: "dot-blink 0.7s step-end infinite",
                }} />
              </div>
            ) : (
              // Rendered markdown when done
              <div className="md-content">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* Actions */}
          {isDone && msg.actions?.length > 0 && (
            <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
              {msg.actions.map((action, i) => (
                <ActionButton key={i} action={action} onOpen={onAction} />
              ))}
            </div>
          )}

          {/* Toolbar */}
          {isDone && msg.content && (
            <div style={{
              display: "flex", gap: "12px", marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid rgba(0,212,255,0.05)",
              alignItems: "center",
              opacity: 0.35, transition: "opacity 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "0.35"}
            >
              <CopyButton text={msg.content} />
              {onSpeak && (
                <button
                  onClick={() => onSpeak(msg.content)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(0,212,255,0.5)", padding: "2px 4px",
                    display: "flex", alignItems: "center", gap: "4px",
                    fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.1em",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "#00d4ff"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(0,212,255,0.5)"}
                >
                  <Volume2 size={11} /> <span>SPEAK</span>
                </button>
              )}

              {/* Byte count */}
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "9px", color: "rgba(0,212,255,0.2)", letterSpacing: "0.08em" }}>
                {msg.content.length} BYTES
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ChatMessage.displayName = "ChatMessage";
export default ChatMessage;