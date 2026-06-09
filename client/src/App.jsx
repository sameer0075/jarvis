import React, { useState, useEffect, useRef } from "react";
import { Radio, Mic, MicOff } from "lucide-react";
import ArcReactor from "./components/ArcReactor.jsx";
import StatusBar from "./components/StatusBar.jsx";
import VisionStatus from "./components/VisionStatus.jsx";
import { useJarvis } from "./hooks/useJarvis.js";
import { useVoice } from "./hooks/useVoice.js";
import FileBrowser from "./components/FileBrowser.jsx";

/* ── Background Grid ── */
const GridBg = () => (
  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.03, pointerEvents: "none" }} preserveAspectRatio="none">
    <defs>
      <pattern id="vgrid" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#00d4ff" strokeWidth="0.5" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#vgrid)" />
  </svg>
);

/* ── Orbital Ring ── */
function OrbitalRing({ size, duration, color, delay = 0, reverse = false, thickness = 1, opacity = 0.3 }) {
  return (
    <div style={{
      position: "absolute", top: "50%", left: "50%",
      width: size, height: size,
      marginLeft: -size / 2, marginTop: -size / 2,
      borderRadius: "50%", border: `${thickness}px solid ${color}`, opacity,
      animation: `rotate ${duration}s linear ${delay}s infinite ${reverse ? "reverse" : ""}`,
      pointerEvents: "none",
    }} />
  );
}

/* ── Speaking Waveform ── */
function VoiceWaveform({ active, color = "#ffd166" }) {
  const bars = 28;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "3px", height: "44px", justifyContent: "center" }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{
          width: "3px",
          height: `${18 + Math.abs(Math.sin(i * 0.73 + 1.1)) * 34}%`,
          background: color, borderRadius: "2px", transformOrigin: "center",
          opacity: active ? 0.85 : 0.2,
          animation: active
            ? `speak-bar ${(0.55 + (Math.sin(i * 0.44) * 0.5 + 0.5) * 0.55).toFixed(2)}s ease-in-out ${((Math.sin(i * 0.31) * 0.5 + 0.5) * 0.9).toFixed(2)}s infinite alternate`
            : "none",
          transition: "opacity 0.4s",
        }} />
      ))}
    </div>
  );
}

export default function App() {
  const [init, setInit] = useState(false);
  const [fileBrowser, setFileBrowser] = useState({ open: false, data: null });
  const greetedRef = useRef(false);

  const { messages, isThinking, model, models, status, setModel, sendMessage, checkStatus } = useJarvis();
  const lastAssistant = messages.filter(m => m.role === "assistant").pop();
  const {
    isListening, isSpeaking, transcript, supported,
    handsFreeActive, speak, speakQueue, stopSpeaking,
    startListening, stopListening, toggleHandsFree,
  } = useVoice({
    onTranscript: (text) => sendMessage(text),
    onEnd: () => {},
  });

  const lastSpokenLenRef = useRef(0);
  const ttsBufferRef = useRef("");

  /* ── Auto-greet on first load ── */
  useEffect(() => {
    if (!init || greetedRef.current) return;
    greetedRef.current = true;
    const t = setTimeout(() => speak("How is your day going, sir?"), 1200);
    return () => clearTimeout(t);
  }, [init, speak]);

  /* ── Always speak assistant replies (streaming TTS) ── */
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;

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
    }
  }, [messages, speakQueue]);

  useEffect(() => {
    console.log("lastAssistant",lastAssistant, lastAssistant?.widgetData?.filesystem)
    if (lastAssistant?.widgetData?.filesystem) {
      const fsData = lastAssistant.widgetData.filesystem;
      if (fsData.ok && fsData.entries?.length > 0) {
        setFileBrowser({ open: true, data: fsData });
      }
    }
  }, [lastAssistant]);

  /* ── Visual state ── */
  const vState = isListening ? "listening" : isSpeaking ? "speaking" : isThinking ? "thinking" : "idle";
  const vColor = { idle: "#00d4ff", listening: "#ff3b5c", thinking: "#00d4ff", speaking: "#ffd166" }[vState];
  const vLabel = { idle: "STANDBY", listening: "LISTENING", thinking: "PROCESSING", speaking: "SPEAKING" }[vState];

  /* ── Manual mic trigger (when not hands-free) ── */
  const handleCenterClick = () => {
    if (handsFreeActive) return;
    if (isListening) stopListening();
    else if (!isSpeaking && !isThinking) startListening();
  };

  /* ── Initialization screen (required for browser audio policy) ── */
  if (!init) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "var(--bg-void)", gap: "32px", cursor: "pointer",
      }} onClick={() => setInit(true)}>
        <div style={{ filter: "drop-shadow(0 0 30px rgba(0,212,255,0.3))" }}>
          <ArcReactor size={140} active={true} />
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: "14px", letterSpacing: "0.4em",
          color: "var(--arc-primary)", textShadow: "0 0 20px rgba(0,212,255,0.4)",
          animation: "decode 0.6s ease-out",
        }}>
          INITIALIZE SYSTEM
        </div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-dim)", letterSpacing: "0.15em",
        }}>
          CLICK ANYWHERE TO ACTIVATE
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", background: "var(--bg-void)",
      position: "relative", overflow: "hidden",
    }}>
      <GridBg />

      {/* Scanline */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{
          position: "absolute", left: 0, right: 0, height: "2px",
          background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.12), transparent)",
          animation: "scan 8s linear infinite",
        }} />
      </div>

      {/* ── Header ── */}
      <header style={{
        display: "flex", alignItems: "center", gap: "16px",
        padding: "12px 24px",
        background: "rgba(2,4,8,0.85)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
        position: "relative", zIndex: 10, flexShrink: 0,
      }}>
        <ArcReactor size={32} active={true} listening={isListening} speaking={isSpeaking} />
        <div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: "14px", letterSpacing: "0.3em",
            color: "var(--arc-primary)", lineHeight: 1,
            textShadow: "0 0 20px rgba(0,212,255,0.4)",
          }}>
            J.A.R.V.I.S
          </h1>
        </div>

        <VisionStatus />

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: status === "online" ? "var(--green-ok)" : "var(--red-alert)",
              boxShadow: status === "online" ? "0 0 8px var(--green-ok)" : "0 0 8px var(--red-alert)",
            }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-dim)", letterSpacing: "0.1em" }}>
              {status === "online" ? "ONLINE" : "OFFLINE"}
            </span>
          </div>

          {supported.stt && (
            <button onClick={toggleHandsFree} style={{
              padding: "6px 14px", borderRadius: "2px",
              border: `1px solid ${handsFreeActive ? "var(--arc-primary)" : "var(--border)"}`,
              background: handsFreeActive ? "rgba(0,212,255,0.1)" : "transparent",
              color: handsFreeActive ? "var(--arc-primary)" : "var(--text-dim)",
              fontFamily: "var(--font-mono)", fontSize: "10px", cursor: "pointer",
              letterSpacing: "0.1em", transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              {handsFreeActive ? <Radio size={11} /> : <MicOff size={11} />}
              {handsFreeActive ? "HANDS-FREE ON" : "HANDS-FREE OFF"}
            </button>
          )}

          {supported.tts && isSpeaking && (
            <button onClick={stopSpeaking} style={{
              padding: "6px 12px", borderRadius: "2px",
              border: "1px solid rgba(255,209,102,0.3)",
              background: "rgba(255,209,102,0.08)",
              color: "#ffd166", fontFamily: "var(--font-mono)",
              fontSize: "10px", cursor: "pointer", letterSpacing: "0.1em",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <MicOff size={11} /> STOP
            </button>
          )}
        </div>
      </header>

      <StatusBar status={status} model={model} models={models} onModelChange={setModel} onRefresh={checkStatus} />

      {/* ── Main Stage ── */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        position: "relative", zIndex: 1,
      }}>
        {/* Orbital rings */}
        <div style={{ position: "absolute", width: 420, height: 420, pointerEvents: "none" }}>
          <OrbitalRing size={280} duration={18} color={vColor} opacity={vState === "idle" ? 0.12 : 0.35} thickness={1} />
          <OrbitalRing size={340} duration={24} color={vColor} opacity={vState === "idle" ? 0.06 : 0.2} thickness={1} reverse delay={2} />
          <OrbitalRing size={400} duration={30} color={vColor} opacity={vState === "idle" ? 0.04 : 0.12} thickness={0.5} delay={1} />

          {vState !== "idle" && (
            <>
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                width: 280, height: 280, marginLeft: -140, marginTop: -140,
                borderRadius: "50%", border: `1px solid ${vColor}`,
                animation: "ripple 2.2s ease-out infinite", opacity: 0.25,
              }} />
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                width: 280, height: 280, marginLeft: -140, marginTop: -140,
                borderRadius: "50%", border: `1px solid ${vColor}`,
                animation: "ripple 2.2s ease-out 0.7s infinite", opacity: 0.15,
              }} />
            </>
          )}
        </div>

        {/* Central Reactor — clickable for manual push-to-talk */}
        <div
          onClick={handleCenterClick}
          style={{
            position: "relative", cursor: handsFreeActive ? "default" : "pointer",
            filter: `drop-shadow(0 0 ${vState === "idle" ? 24 : 60}px ${vColor}50)`,
            transform: `scale(${vState === "speaking" ? 1.08 : 1})`,
            transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1), filter 0.6s ease",
            zIndex: 2,
          }}
          title={handsFreeActive ? "" : "Click to speak"}
        >
          <ArcReactor size={240} active={true} listening={isListening} speaking={isSpeaking} />

          {/* Inner pulse ring when listening */}
          {isListening && (
            <div style={{
              position: "absolute", inset: -20, borderRadius: "50%",
              border: "2px solid rgba(255,59,92,0.3)",
              animation: "ripple 1.4s ease-out infinite",
            }} />
          )}
        </div>

        {/* Status Text */}
        <div style={{ marginTop: "48px", textAlign: "center", zIndex: 2, minHeight: "90px" }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "11px", letterSpacing: "0.4em",
            color: vColor, textShadow: `0 0 20px ${vColor}60`, marginBottom: "18px",
            animation: "decode 0.4s ease-out",
          }}>
            J.A.R.V.I.S :: {vLabel}
          </div>

          {isListening && transcript && (
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: "15px", color: "var(--red-alert)",
              maxWidth: "520px", textAlign: "center", lineHeight: 1.5,
              animation: "decode 0.2s ease-out", textShadow: "0 0 12px rgba(255,59,92,0.3)",
            }}>
              {transcript}
            </div>
          )}

          {isSpeaking && (
            <div style={{ width: "260px", margin: "0 auto" }}>
              <VoiceWaveform active={true} color={vColor} />
            </div>
          )}

          {isThinking && (
            <div style={{ display: "flex", gap: "6px", justifyContent: "center", alignItems: "center", height: "44px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "rgba(0,212,255,0.4)", letterSpacing: "0.15em", marginRight: "6px" }}>
                PROCESSING
              </span>
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} style={{
                  width: 4, height: 4, borderRadius: "50%", background: "var(--arc-primary)",
                  animation: `typing-dot 1.4s ${i * 0.12}s ease-in-out infinite`,
                  boxShadow: i < 3 ? "0 0 6px rgba(0,212,255,0.6)" : "none",
                }} />
              ))}
            </div>
          )}

          {!handsFreeActive && !isListening && !isSpeaking && !isThinking && (
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-dim)",
              letterSpacing: "0.15em", marginTop: "8px", opacity: 0.6,
            }}>
              CLICK REACTOR TO SPEAK · OR ENABLE HANDS-FREE
            </div>
          )}
        </div>
        {fileBrowser.open && <FileBrowser
          initialData={fileBrowser.data}
          onClose={() => setFileBrowser({ open: false, data: null })}
        />}
      </main>

      {/* Bottom hint */}
      <div style={{
        position: "absolute", bottom: "24px", left: 0, right: 0,
        textAlign: "center", zIndex: 5, pointerEvents: "none",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "9px",
          color: "var(--text-dim)", letterSpacing: "0.15em", opacity: 0.4,
        }}>
          {handsFreeActive ? "CONTINUOUS VOICE INTERFACE ACTIVE" : "STARK INDUSTRIES · LOCAL AI SYSTEM"}
        </span>
      </div>
    </div>
  );
}