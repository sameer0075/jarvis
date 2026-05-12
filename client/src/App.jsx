import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Trash2, Terminal, X } from "lucide-react";
import ArcReactor from "./components/ArcReactor.jsx";
import StatusBar from "./components/StatusBar.jsx";
import ChatMessage from "./components/ChatMessage.jsx";
import VoiceButton from "./components/VoiceButton.jsx";
import BrowserPanel from "./components/BrowserPanel.jsx";
import { useJarvis } from "./hooks/useJarvis.js";
import { useVoice } from "./hooks/useVoice.js";

// ─── Decorative grid lines ────────────────────────────────────────────────────
const GridBg = () => (
  <svg
    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none" }}
    preserveAspectRatio="none"
  >
    <defs>
      <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#00d4ff" strokeWidth="0.5" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);

// ─── Corner decorations ───────────────────────────────────────────────────────
const Corner = ({ pos }) => {
  const top = pos.includes("top");
  const left = pos.includes("left");
  return (
    <div style={{
      position: "absolute",
      [top ? "top" : "bottom"]: 12,
      [left ? "left" : "right"]: 12,
      width: 20, height: 20,
      borderTop: top ? "2px solid rgba(0,212,255,0.4)" : "none",
      borderBottom: !top ? "2px solid rgba(0,212,255,0.4)" : "none",
      borderLeft: left ? "2px solid rgba(0,212,255,0.4)" : "none",
      borderRight: !left ? "2px solid rgba(0,212,255,0.4)" : "none",
      pointerEvents: "none",
    }} />
  );
};

// ─── Scan line overlay ────────────────────────────────────────────────────────
const ScanLine = () => (
  <div style={{
    position: "absolute",
    inset: 0,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: 0,
  }}>
    <div style={{
      position: "absolute",
      left: 0, right: 0,
      height: "2px",
      background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.12), transparent)",
      animation: "scan 8s linear infinite",
    }} />
  </div>
);

export default function App() {
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatPanelRef = useRef(null);
  const voiceTurnRef = useRef(false);
  const lastSpokenLenRef = useRef(0);
  const ttsBufferRef = useRef("");
  const processedActionsRef = useRef(new Set());

  const { messages, isThinking, model, models, status, setModel, sendMessage, clearChat, checkStatus } = useJarvis();
    const handleAction = useCallback((action) => {
    if (action.type === "OPEN_URL") {
      window.open(action.value, "_blank", "noopener,noreferrer");
      // DON'T call setBrowserUrl here — open externally only
    }
  }, []);

  const handleSend = useCallback(
    (text, opts = {}) => {
      const msg = (text || input).trim();
      if (!msg) return;
      setInput("");
      if (opts.fromVoice) {
        voiceTurnRef.current = true;
      }
      sendMessage(msg);
    },
    [input, sendMessage]
  );

  // Voice
  const { isListening, isSpeaking, transcript, supported, speak,speakQueue, stopSpeaking, startListening, stopListening } =
    useVoice({
      onTranscript: (text) => handleSend(text, { fromVoice: true }),
      onEnd: () => {},
    });

      // ─── Auto-open URLs when assistant message arrives ───
    useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.actions?.length) return;
    if (processedActionsRef.current.has(last.id)) return;

    processedActionsRef.current.add(last.id);

    for (const action of last.actions) {
      if (action.type === "OPEN_URL") {
        window.open(action.value, "_blank", "noopener,noreferrer");
        // DON'T setBrowserUrl — external tab only
      }
    }
  }, [messages]);

    useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;

    const shouldSpeak = autoSpeak || voiceTurnRef.current;
    if (!shouldSpeak) return;

    if (last.streaming) {
      const newText = last.content.slice(lastSpokenLenRef.current);
      if (!newText) return;
      
      ttsBufferRef.current += newText;
      lastSpokenLenRef.current = last.content.length;

      const sentenceRegex = /[^.!?]*[.!?]+(?:\s+|\n|$)/g;
      let m;
      const sentences = [];
      let lastMatchEnd = 0;  // ← track manually
      while ((m = sentenceRegex.exec(ttsBufferRef.current)) !== null) {
        sentences.push(m[0].trim());
        lastMatchEnd = sentenceRegex.lastIndex;  // ← capture before exec resets it
      }

      if (sentences.length) {
        ttsBufferRef.current = ttsBufferRef.current.slice(lastMatchEnd);

        for (const sentence of sentences) {
          const clean = sentence
            .replace(/\[ACTION:[^\]]+\]/g, "")
            .replace(/[#*`_~]/g, "")
            .trim();
          if (clean.length > 2) {
            speakQueue(clean);
          }
        }
      }
    } else {
      const remaining = ttsBufferRef.current
        .replace(/\[ACTION:[^\]]+\]/g, "")
        .replace(/[#*`_~]/g, "")
        .trim();
      if (remaining.length > 2) {
        speakQueue(remaining);  // ← also use speakQueue here, not speak()
      }
      ttsBufferRef.current = "";
      lastSpokenLenRef.current = 0;
      voiceTurnRef.current = false;
    }
  }, [messages, autoSpeak, speak, speakQueue]);  // ← add speakQueue to deps

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedPrompts = [
    "Open wikipedia.org and summarize it",
    "Search for latest AI news",
    "What can you do?",
    "Open github.com",
  ];

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "var(--bg-void)",
      position: "relative",
      overflow: "hidden",
    }}>
      <ScanLine />
      <GridBg />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "10px 20px",
        background: "rgba(6,13,26,0.95)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(10px)",
        position: "relative",
        zIndex: 10,
        flexShrink: 0,
      }}>
        <ArcReactor
          size={44}
          active={isThinking || isSpeaking}
          listening={isListening}
          speaking={isSpeaking}
        />

        <div>
          <h1 style={{
            fontFamily: "var(--font-display)",
            fontSize: "18px",
            letterSpacing: "0.25em",
            color: "var(--arc-primary)",
            lineHeight: 1,
            textShadow: "0 0 20px rgba(0,212,255,0.5)",
          }}>
            J.A.R.V.I.S
          </h1>
          <p style={{
            fontSize: "9px",
            fontFamily: "var(--font-mono)",
            color: "var(--text-dim)",
            letterSpacing: "0.15em",
            marginTop: "2px",
          }}>
            JUST A RATHER VERY INTELLIGENT SYSTEM
          </p>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Auto-speak toggle */}
          {supported.tts && (
            <button
              onClick={() => setAutoSpeak((v) => !v)}
              title={autoSpeak ? "Disable auto-speak" : "Enable auto-speak"}
              style={{
                padding: "5px 10px",
                borderRadius: "4px",
                border: `1px solid ${autoSpeak ? "var(--arc-primary)" : "var(--border)"}`,
                background: autoSpeak ? "rgba(0,212,255,0.12)" : "transparent",
                color: autoSpeak ? "var(--arc-primary)" : "var(--text-dim)",
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                cursor: "pointer",
                letterSpacing: "0.08em",
                transition: "all 0.2s",
              }}
            >
              {autoSpeak ? "🔊 AUTO-SPEAK ON" : "🔈 AUTO-SPEAK OFF"}
            </button>
          )}

          {/* Clear */}
          <button
            onClick={clearChat}
            title="Clear conversation"
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              color: "var(--text-dim)",
              cursor: "pointer",
              padding: "5px 8px",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red-alert)"; e.currentTarget.style.borderColor = "var(--red-alert)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            <Trash2 size={12} />
            CLEAR
          </button>
        </div>
      </header>

      {/* ── Status Bar ─────────────────────────────────────────────── */}
      <StatusBar
        status={status}
        model={model}
        models={models}
        onModelChange={setModel}
        onRefresh={checkStatus}
      />

      {/* ── Main Area ──────────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        display: "flex",
        overflow: "hidden",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Chat Panel */}
        <div style={{
          flex: "1",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "flex 0.3s ease",
          minWidth: 0,
        }}>
          {/* Messages */}
          <div
            ref={chatPanelRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 0",
            }}
          >
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                msg={msg}
                onSpeak={supported.tts ? speak : null}
                onAction={handleAction}
              />
            ))}

            {/* Suggestions when only welcome message */}
            {messages.length === 1 && (
              <div style={{ padding: "8px 16px 0" }}>
                <p style={{
                  fontSize: "10px",
                  fontFamily: "var(--font-mono)",
                  color: "var(--text-dim)",
                  letterSpacing: "0.1em",
                  marginBottom: "8px",
                }}>
                  SUGGESTED COMMANDS
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {suggestedPrompts.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(p)}
                      style={{
                        background: "var(--arc-faint)",
                        border: "1px solid var(--border)",
                        borderRadius: "4px",
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-body)",
                        fontSize: "12px",
                        cursor: "pointer",
                        padding: "5px 10px",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--arc-primary)"; e.currentTarget.style.color = "var(--arc-primary)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input Area ────────────────────────────────────────── */}
          <div style={{
            padding: "12px 16px",
            background: "rgba(6,13,26,0.8)",
            borderTop: "1px solid var(--border)",
            backdropFilter: "blur(10px)",
            position: "relative",
          }}>
            {/* Corner accents */}
            {["top-left", "top-right", "bottom-left", "bottom-right"].map((c) => <Corner key={c} pos={c} />)}

            <div style={{
              display: "flex",
              gap: "10px",
              alignItems: "flex-end",
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening..." : "Command Jarvis... (Enter to send, Shift+Enter for new line)"}
                rows={2}
                style={{
                  flex: 1,
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  padding: "10px 14px",
                  outline: "none",
                  resize: "none",
                  lineHeight: 1.5,
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--arc-primary)";
                  e.target.style.boxShadow = "0 0 0 1px rgba(0,212,255,0.2)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border)";
                  e.target.style.boxShadow = "none";
                }}
                disabled={isListening}
              />

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {/* Voice */}
                <VoiceButton
                  isListening={isListening}
                  isSpeaking={isSpeaking}
                  transcript={transcript}
                  onStart={startListening}
                  onStop={stopListening}
                  onStopSpeaking={stopSpeaking}
                  supported={supported}
                />

                {/* Send */}
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isThinking}
                  style={{
                    background: input.trim() && !isThinking
                      ? "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,170,255,0.15))"
                      : "var(--bg-card)",
                    border: `1px solid ${input.trim() && !isThinking ? "var(--arc-primary)" : "var(--border)"}`,
                    borderRadius: "6px",
                    color: input.trim() && !isThinking ? "var(--arc-primary)" : "var(--text-dim)",
                    cursor: input.trim() && !isThinking ? "pointer" : "not-allowed",
                    padding: "8px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    fontFamily: "var(--font-display)",
                    fontSize: "11px",
                    letterSpacing: "0.1em",
                    transition: "all 0.2s",
                    boxShadow: input.trim() && !isThinking ? "0 0 10px rgba(0,212,255,0.2)" : "none",
                    animation: input.trim() && !isThinking ? "glowPulse 2s infinite" : "none",
                  }}
                >
                  {isThinking ? (
                    <div style={{
                      width: 14, height: 14,
                      border: "2px solid var(--arc-dim)",
                      borderTopColor: "var(--arc-primary)",
                      borderRadius: "50%",
                      animation: "rotate 0.8s linear infinite",
                    }} />
                  ) : (
                    <Send size={14} />
                  )}
                  SEND
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}