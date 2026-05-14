import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Trash2 } from "lucide-react";
import ArcReactor from "./components/ArcReactor.jsx";
import StatusBar from "./components/StatusBar.jsx";
import ChatMessage from "./components/ChatMessage.jsx";
import VoiceButton from "./components/VoiceButton.jsx";
import { useJarvis } from "./hooks/useJarvis.js";
import { useVoice } from "./hooks/useVoice.js";
import JarvisWidgets from "./components/JarvisWidgets.jsx";

const GridBg = () => (
  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none" }} preserveAspectRatio="none">
    <defs>
      <pattern id="grid" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M 64 0 L 0 0 0 64" fill="none" stroke="#00d4ff" strokeWidth="0.5" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);

const ScanLine = () => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
    <div style={{
      position: "absolute", left: 0, right: 0, height: "2px",
      background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.12), transparent)",
      animation: "scan 8s linear infinite",
    }} />
  </div>
);

const HexDecoration = () => (
  <svg style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: "600px", height: "600px", opacity: 0.03, pointerEvents: "none", zIndex: 0 }} viewBox="0 0 100 100">
    <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill="none" stroke="#00d4ff" strokeWidth="0.3" />
    <polygon points="50,20 80,35 80,65 50,80 20,65 20,35" fill="none" stroke="#00d4ff" strokeWidth="0.2" />
    <circle cx="50" cy="50" r="45" fill="none" stroke="#00d4ff" strokeWidth="0.15" strokeDasharray="2 4" />
  </svg>
);

export default function App() {
  const [input, setInput] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [weatherState, setWeatherState] = useState(false);
  const [newsState, setNewsState] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatPanelRef = useRef(null);
  const voiceTurnRef = useRef(false);
  const lastSpokenLenRef = useRef(0);
  const ttsBufferRef = useRef("");
  const processedActionsRef = useRef(new Set());

  const API_BASE = "http://localhost:3001";

  const { messages, isThinking, model, models, status, setModel, sendMessage, clearChat, checkStatus } = useJarvis();
  const lastAssistant = messages.filter(m => m.role === "assistant").pop();
  // const weatherState = lastAssistant?.widgetData?.weather || null;
  // const newsState = lastAssistant?.widgetData?.news || null;
  const handleAction = useCallback((action) => {
    if (action.type === "OPEN_URL") window.open(action.value, "_blank", "noopener,noreferrer");
  }, []);

  const handleSend = useCallback((text, opts = {}) => {
    const msg = (text || input).trim();
    if (!msg) return;
    fetchQueryNews(msg)
    setInput("");
    if (opts.fromVoice) voiceTurnRef.current = true;
    sendMessage(msg);
  }, [input, sendMessage]);

  const {
    isListening, isSpeaking, transcript, supported,
    handsFreeActive, speak, speakQueue, stopSpeaking,
    startListening, stopListening, toggleHandsFree,
  } = useVoice({
    onTranscript: (text) => handleSend(text, { fromVoice: true }),
    onEnd: () => {},
  });

  const fetchTrendingNews = async() => {
    const result = await fetch(`${API_BASE}/api/trending-news`);
    const data = await result.json()
    setNewsState(data)
  }

  const fetchQueryNews = async(query) => {
    const result = await fetch(`${API_BASE}/api/search-news/${query}`);
    const data = await result.json()
    setNewsState(data)
  }

  const fetchCityFromIp = async () => {
    const response = await fetch("https://ipinfo.io/json")
    const data = await response.json()
    console.log("response",data)
    const result = await fetch(`${API_BASE}/api/get-weather-details/${data.city}`);
    const weather = await result.json()
    console.log("weather",weather)
    setWeatherState(weather)
  }

  // Auto-open URLs
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.actions?.length) return;
    if (processedActionsRef.current.has(last.id)) return;
    processedActionsRef.current.add(last.id);
    for (const action of last.actions) {
      if (action.type === "OPEN_URL") window.open(action.value, "_blank", "noopener,noreferrer");
    }
  }, [messages]);

  useEffect(() => {
    if(lastAssistant) {
        const weatherData = lastAssistant?.widgetData?.weather || null;
        const newsData = lastAssistant?.widgetData?.news || null;
        if(!newsState) {
          setNewsState(newsData)
        }
        setWeatherState(weatherData)
    }
  },[lastAssistant])

  useEffect(() => {
    fetchCityFromIp()
  },[])

  // Streaming TTS
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
      let m, sentences = [], lastMatchEnd = 0;
      while ((m = sentenceRegex.exec(ttsBufferRef.current)) !== null) {
        sentences.push(m[0].trim());
        lastMatchEnd = sentenceRegex.lastIndex;
      }
      if (sentences.length) {
        ttsBufferRef.current = ttsBufferRef.current.slice(lastMatchEnd);
        for (const s of sentences) {
          const clean = s.replace(/\[ACTION:[^\]]+\]/g, "").replace(/[#*`_~]/g, "").trim();
          if (clean.length > 2) speakQueue(clean);
        }
      }
    } else {
      const remaining = ttsBufferRef.current.replace(/\[ACTION:[^\]]+\]/g, "").replace(/[#*`_~]/g, "").trim();
      if (remaining.length > 2) speakQueue(remaining);
      ttsBufferRef.current = "";
      lastSpokenLenRef.current = 0;
      voiceTurnRef.current = false;
    }
  }, [messages, autoSpeak, speak, speakQueue]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(()=>{
    fetchTrendingNews()
  },[])
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-void)", position: "relative", overflow: "hidden" }}>
      <ScanLine />
      <GridBg />
      <HexDecoration />

      {/* Central background Arc Reactor */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 0, opacity: isThinking || isSpeaking ? 0.08 : 0.04, transition: "opacity 1s" }}>
        <ArcReactor size={320} active={isThinking || isSpeaking} listening={isListening} speaking={isSpeaking} />
      </div>

      {/* ── Header ── */}
      <header style={{
        display: "flex", alignItems: "center", gap: "16px",
        padding: "10px 24px",
        background: "rgba(2,4,8,0.85)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
        position: "relative", zIndex: 10, flexShrink: 0,
      }}>
        <ArcReactor size={40} active={isThinking || isSpeaking} listening={isListening} speaking={isSpeaking} />
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "16px", letterSpacing: "0.3em", color: "var(--arc-primary)", lineHeight: 1, textShadow: "0 0 20px rgba(0,212,255,0.4)" }}>
            J.A.R.V.I.S
          </h1>
          <p style={{ fontSize: "9px", fontFamily: "var(--font-mono)", color: "var(--arc-dim)", letterSpacing: "0.2em", marginTop: "3px" }}>
            JUST A RATHER VERY INTELLIGENT SYSTEM
          </p>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
          {supported.stt && (
            <button onClick={toggleHandsFree} style={{
              padding: "5px 12px", borderRadius: "2px",
              border: `1px solid ${handsFreeActive ? "var(--arc-primary)" : "var(--border)"}`,
              background: handsFreeActive ? "rgba(0,212,255,0.1)" : "transparent",
              color: handsFreeActive ? "var(--arc-primary)" : "var(--text-dim)",
              fontFamily: "var(--font-mono)", fontSize: "10px", cursor: "pointer",
              letterSpacing: "0.1em", transition: "all 0.2s",
            }}>
              {handsFreeActive ? "● HANDS-FREE" : "HANDS-FREE"}
            </button>
          )}
          {supported.tts && (
            <button onClick={() => setAutoSpeak(v => !v)} style={{
              padding: "5px 10px", borderRadius: "2px",
              border: `1px solid ${autoSpeak ? "var(--arc-primary)" : "var(--border)"}`,
              background: autoSpeak ? "rgba(0,212,255,0.1)" : "transparent",
              color: autoSpeak ? "var(--arc-primary)" : "var(--text-dim)",
              fontFamily: "var(--font-mono)", fontSize: "10px", cursor: "pointer",
              letterSpacing: "0.1em", transition: "all 0.2s",
            }}>
              {autoSpeak ? "TTS: ON" : "TTS: OFF"}
            </button>
          )}
          <button onClick={clearChat} style={{
            background: "none", border: "1px solid var(--border)", borderRadius: "2px",
            color: "var(--text-dim)", cursor: "pointer", padding: "5px 8px",
            display: "flex", alignItems: "center", gap: "5px",
            fontFamily: "var(--font-mono)", fontSize: "10px", transition: "all 0.2s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red-alert)"; e.currentTarget.style.borderColor = "var(--red-alert)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            <Trash2 size={12} /> CLEAR
          </button>
        </div>
      </header>

      <StatusBar status={status} model={model} models={models} onModelChange={setModel} onRefresh={checkStatus} />

      {/* ── Main Viewport ── */}
      <main style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative", zIndex: 1 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* System Log */}
          <div ref={chatPanelRef} style={{ flex: 1, overflowY: "auto", paddingTop: "16px", paddingBottom: "8px" }}>
            {/* Welcome header in log */}
            {messages.length <= 1 && (
              <div style={{ padding: "0 24px 20px", borderBottom: "1px solid var(--border)", marginBottom: "16px" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "11px", color: "var(--arc-primary)", letterSpacing: "0.2em", marginBottom: "8px" }}>
                  SYSTEM INITIALIZED
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                  <span style={{ color: "var(--arc-dim)" }}>STATUS:</span> ONLINE<br />
                  <span style={{ color: "var(--arc-dim)" }}>MODEL:</span> {model}<br />
                  <span style={{ color: "var(--arc-dim)" }}>VOICE:</span> {supported.tts ? "ENABLED" : "DISABLED"}<br />
                  <span style={{ color: "var(--arc-dim)" }}>STT:</span> {supported.stt ? "ENABLED" : "DISABLED"}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg} onSpeak={supported.tts ? speak : null} onAction={handleAction} />
            ))}

            {/* Suggestions as terminal commands */}
            {messages.length === 1 && (
              <div style={{ padding: "12px 24px", marginTop: "8px" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--arc-dim)", letterSpacing: "0.15em", marginBottom: "10px" }}>
                  // AVAILABLE PROTOCOLS
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    "Open wikipedia.org and summarize it",
                    "Search for latest AI news",
                    "What can you do?",
                    "Open github.com",
                  ].map((p, i) => (
                    <div key={i} onClick={() => handleSend(p)} style={{
                      cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "12px",
                      color: "var(--text-dim)", transition: "color 0.2s",
                    }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "var(--arc-primary)"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
                    >
                      <span style={{ color: "var(--arc-dim)" }}>{`[CMD_${String(i + 1).padStart(2, "0")}]`}</span> {p}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
                  {/* ── Terminal Input ── */}
        <div style={{
            borderTop: "1px solid var(--border)",
            background: "rgba(2,4,8,0.92)",
            backdropFilter: "blur(16px)",
            position: "relative",
            flexShrink: 0,
        }}>
          {/* Top accent line */}
          <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, var(--arc-primary), transparent)", opacity: 0.3 }} />

          <div style={{ display: "flex", alignItems: "flex-end", gap: "12px", padding: "14px 24px" }}>
            <span style={{
              color: "var(--arc-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: "16px",
              paddingBottom: "10px",
              textShadow: "0 0 10px var(--arc-primary)",
            }}>❯</span>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : handsFreeActive ? "Hands-free active. Speak or type command..." : "Enter command..."}
              rows={1}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: "14px",
                padding: "8px 0",
                outline: "none",
                resize: "none",
                lineHeight: 1.6,
                caretColor: "var(--arc-primary)",
              }}
              disabled={isListening}
            />

            <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "4px" }}>
              <VoiceButton
                isListening={isListening} isSpeaking={isSpeaking}
                transcript={transcript} onStart={startListening}
                onStop={stopListening} onStopSpeaking={stopSpeaking} supported={supported}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isThinking}
                style={{
                  background: input.trim() && !isThinking ? "rgba(0,212,255,0.12)" : "transparent",
                  border: `1px solid ${input.trim() && !isThinking ? "var(--arc-primary)" : "var(--border)"}`,
                  borderRadius: "2px",
                  color: input.trim() && !isThinking ? "var(--arc-primary)" : "var(--text-dim)",
                  cursor: input.trim() && !isThinking ? "pointer" : "not-allowed",
                  padding: "7px 14px",
                  display: "flex", alignItems: "center", gap: "6px",
                  fontFamily: "var(--font-mono)", fontSize: "10px",
                  letterSpacing: "0.15em", transition: "all 0.2s",
                }}
              >
                {isThinking ? (
                  <div style={{ width: 12, height: 12, border: "2px solid var(--arc-dim)", borderTopColor: "var(--arc-primary)", borderRadius: "50%", animation: "rotate 0.8s linear infinite" }} />
                ) : <Send size={12} />}
                EXECUTE
              </button>
            </div>
          </div>
        </div>
        </div>
        <JarvisWidgets weatherData={weatherState} newsData={newsState} />
      </main>
    </div>
  );
}