import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, VolumeX } from "lucide-react";

// ── Inject keyframes once ──────────────────────────────────────────────────────
const VOICE_STYLES = `
  @keyframes ripple {
    0%   { transform: scale(0.9); opacity: 0.8; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes speak-bar {
    0%, 100% { transform: scaleY(0.15); }
    50%       { transform: scaleY(1); }
  }
  @keyframes speak-ring-spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes speak-ring-spin-rev {
    from { transform: rotate(0deg); }
    to   { transform: rotate(-360deg); }
  }
  @keyframes speak-pulse-ring {
    0%   { transform: scale(0.85); opacity: 0.9; }
    100% { transform: scale(2.0);  opacity: 0; }
  }
  @keyframes speak-core-glow {
    0%,100% { box-shadow: 0 0 10px rgba(255,209,102,0.6), 0 0 30px rgba(255,209,102,0.2); }
    50%     { box-shadow: 0 0 22px rgba(255,209,102,0.9), 0 0 60px rgba(255,209,102,0.4); }
  }
  @keyframes speak-panel-in {
    0%   { opacity: 0; transform: translateY(6px) scaleY(0.96); }
    100% { opacity: 1; transform: translateY(0)   scaleY(1); }
  }
  @keyframes speak-scan {
    0%   { top: 0%;   opacity: 0.7; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes speak-ticker {
    0%   { background-position: 0% 50%; }
    100% { background-position: 100% 50%; }
  }
  @keyframes corner-blink {
    0%,100% { opacity: 0.5; }
    50%     { opacity: 1; }
  }
`;

let voiceStylesInjected = false;
function injectVoiceStyles() {
  if (voiceStylesInjected) return;
  voiceStylesInjected = true;
  const el = document.createElement("style");
  el.textContent = VOICE_STYLES;
  document.head.appendChild(el);
}

// ── Animated waveform bars ────────────────────────────────────────────────────
// Heights are randomized per-bar so they look like a real audio signal
const BAR_COUNT = 28;
const BAR_DELAYS = Array.from({ length: BAR_COUNT }, (_, i) =>
  ((Math.sin(i * 0.7) * 0.5 + 0.5) * 0.8).toFixed(2)
);
const BAR_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) =>
  (Math.abs(Math.sin(i * 1.3 + 0.5)) * 0.7 + 0.3).toFixed(2)
);

function Waveform({ color = "#ffd166", active = true }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "3px",
      height: "40px", flex: 1,
    }}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div key={i} style={{
          width: "3px",
          height: `${BAR_HEIGHTS[i] * 100}%`,
          background: color,
          borderRadius: "2px",
          transformOrigin: "center",
          opacity: active ? 0.85 : 0.2,
          animation: active
            ? `speak-bar ${0.6 + parseFloat(BAR_DELAYS[i]) * 0.8}s ease-in-out ${BAR_DELAYS[i]}s infinite`
            : "none",
          transition: "opacity 0.3s",
        }} />
      ))}
    </div>
  );
}

// ── Arc reactor ring (SVG, mimics ArcReactor component) ───────────────────────
function SpeakingReactor({ size = 72 }) {
  const color = "#ffd166";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {/* Pulse rings */}
      {[0, 0.5, 1.0].map((delay, i) => (
        <div key={i} style={{
          position: "absolute",
          inset: -i * 6,
          borderRadius: "50%",
          border: `1px solid rgba(255,209,102,${0.5 - i * 0.15})`,
          animation: `speak-pulse-ring 2s ${delay}s ease-out infinite`,
          pointerEvents: "none",
        }} />
      ))}

      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{ filter: "drop-shadow(0 0 12px rgba(255,209,102,0.6))", position: "relative", zIndex: 1 }}>
        {/* Outer dashed ring — spinning */}
        <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="1.5"
          strokeDasharray="4 3" opacity="0.7"
          style={{ animation: "speak-ring-spin 8s linear infinite", transformOrigin: "50px 50px" }} />

        {/* Mid ring — counter-spin */}
        <circle cx="50" cy="50" r="36" fill="none" stroke={color} strokeWidth="1"
          strokeDasharray="8 4" opacity="0.5"
          style={{ animation: "speak-ring-spin-rev 5s linear infinite", transformOrigin: "50px 50px" }} />

        {/* Solid inner ring */}
        <circle cx="50" cy="50" r="26" fill="rgba(0,0,0,0.7)" stroke={color} strokeWidth="1.5" />

        {/* Tick marks */}
        {[0, 60, 120, 180, 240, 300].map((deg, i) => (
          <line key={i} x1="50" y1="26" x2="50" y2="32"
            stroke={color} strokeWidth="2.5" strokeLinecap="round"
            transform={`rotate(${deg}, 50, 50)`} opacity="0.9" />
        ))}

        {/* Hex */}
        <polygon points="50,34 58,38.5 58,47.5 50,52 42,47.5 42,38.5"
          fill="none" stroke={color} strokeWidth="1.2" opacity="0.8" />

        {/* Core */}
        <circle cx="50" cy="43" r="7" fill={color} opacity="0.95"
          style={{ animation: "speak-core-glow 1.2s ease-in-out infinite" }} />
        <circle cx="50" cy="43" r="3.5" fill="white" opacity="0.95" />
      </svg>
    </div>
  );
}

// ── Corner bracket decoration ─────────────────────────────────────────────────
function Bracket({ top, left, size = 10 }) {
  const color = "rgba(255,209,102,0.6)";
  const border = `1.5px solid ${color}`;
  return (
    <div style={{
      position: "absolute",
      [top ? "top" : "bottom"]: -1,
      [left ? "left" : "right"]: -1,
      width: size, height: size,
      borderTop:    top    ? border : "none",
      borderBottom: !top   ? border : "none",
      borderLeft:   left   ? border : "none",
      borderRight:  !left  ? border : "none",
      animation: "corner-blink 2s ease-in-out infinite",
      pointerEvents: "none",
    }} />
  );
}

// ── Full Speaking Panel ───────────────────────────────────────────────────────
function SpeakingPanel({ onStop }) {
  const [seconds, setSeconds] = useState(0);
  const [label, setLabel] = useState("TRANSMITTING");
  const labels = ["TRANSMITTING", "VOCALIZING", "AUDIO OUT", "SPEAKING"];
  const labelIdx = useRef(0);

  useEffect(() => {
    const tick = setInterval(() => setSeconds(s => s + 1), 1000);
    const cycle = setInterval(() => {
      labelIdx.current = (labelIdx.current + 1) % labels.length;
      setLabel(labels[labelIdx.current]);
    }, 1800);
    return () => { clearInterval(tick); clearInterval(cycle); };
  }, []);

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  return (
    <div style={{
      position: "relative",
      display: "flex", alignItems: "center", gap: "14px",
      padding: "10px 14px",
      background: "rgba(255,209,102,0.04)",
      border: "1px solid rgba(255,209,102,0.25)",
      borderRadius: "3px",
      animation: "speak-panel-in 0.3s cubic-bezier(0.22,1,0.36,1)",
      overflow: "hidden",
      minWidth: 0, flex: 1,
    }}>
      {/* Corner brackets */}
      <Bracket top left />
      <Bracket top left={false} />
      <Bracket top={false} left />
      <Bracket top={false} left={false} />

      {/* Scan line */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(255,209,102,0.5), transparent)",
        animation: "speak-scan 2.5s linear infinite",
        pointerEvents: "none", zIndex: 0,
      }} />

      {/* Ticker bar at bottom */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "2px",
        background: "linear-gradient(90deg, transparent, rgba(255,209,102,0.4), rgba(255,209,102,0.6), rgba(255,209,102,0.4), transparent)",
        backgroundSize: "200% 100%",
        animation: "speak-ticker 1.5s linear infinite",
        pointerEvents: "none",
      }} />

      {/* Arc reactor */}
      <SpeakingReactor size={64} />

      {/* Center: label + waveform */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", minWidth: 0, zIndex: 1 }}>
        {/* Status row */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#ffd166",
            boxShadow: "0 0 8px rgba(255,209,102,0.9)",
            animation: "speak-core-glow 1s ease-in-out infinite",
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: "9px",
            letterSpacing: "0.25em",
            color: "#ffd166",
            textShadow: "0 0 10px rgba(255,209,102,0.5)",
          }}>
            J.A.R.V.I.S :: {label}
          </span>
          <span style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            color: "rgba(255,209,102,0.4)",
            letterSpacing: "0.1em",
          }}>
            {mins}:{secs}
          </span>
        </div>

        {/* Waveform */}
        <Waveform color="#ffd166" active />
      </div>

      {/* Stop button */}
      <button onClick={onStop} title="Stop speaking" style={{
        flexShrink: 0,
        background: "rgba(255,209,102,0.08)",
        border: "1px solid rgba(255,209,102,0.3)",
        borderRadius: "2px",
        color: "#ffd166",
        cursor: "pointer",
        padding: "7px 12px",
        display: "flex", alignItems: "center", gap: "6px",
        fontFamily: "var(--font-mono)", fontSize: "9px",
        letterSpacing: "0.12em",
        transition: "all 0.2s",
        zIndex: 1,
      }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "rgba(255,209,102,0.18)";
          e.currentTarget.style.borderColor = "#ffd166";
          e.currentTarget.style.boxShadow = "0 0 12px rgba(255,209,102,0.25)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "rgba(255,209,102,0.08)";
          e.currentTarget.style.borderColor = "rgba(255,209,102,0.3)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <VolumeX size={12} />
        <span>STOP</span>
      </button>
    </div>
  );
}

// ── Mic Button ────────────────────────────────────────────────────────────────
function MicButton({ isListening, transcript, onStart, onStop }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <button
        onClick={isListening ? onStop : onStart}
        title={isListening ? "Stop listening" : "Start voice input"}
        style={{
          position: "relative",
          background: isListening ? "rgba(255,59,92,0.1)" : "rgba(0,212,255,0.05)",
          border: `1px solid ${isListening ? "rgba(255,59,92,0.5)" : "rgba(0,212,255,0.2)"}`,
          borderRadius: "2px",
          color: isListening ? "var(--red-alert)" : "var(--arc-primary)",
          cursor: "pointer",
          padding: "6px",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
          boxShadow: isListening ? "0 0 10px rgba(255,59,92,0.3)" : "none",
        }}
      >
        {isListening && [0, 0.4, 0.8].map((delay, i) => (
          <span key={i} style={{
            position: "absolute", inset: 0, borderRadius: "2px",
            border: "1px solid rgba(255,59,92,0.4)",
            animation: `ripple 1.6s ${delay}s ease-out infinite`,
          }} />
        ))}
        {isListening ? <MicOff size={14} /> : <Mic size={14} />}
      </button>

      {isListening && transcript && (
        <span style={{
          fontSize: "11px", fontFamily: "var(--font-mono)",
          color: "var(--red-alert)", maxWidth: "140px",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          animation: "decode 0.2s ease-out",
        }}>
          {transcript}
        </span>
      )}
    </div>
  );
}

// ── Main VoiceButton export ───────────────────────────────────────────────────
export default function VoiceButton({
  isListening, isSpeaking, transcript,
  onStart, onStop, onStopSpeaking, supported,
}) {
  injectVoiceStyles();
  if (!supported.stt && !supported.tts) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: isSpeaking ? 1 : "none", minWidth: 0 }}>
      {/* Speaking panel takes full width when active */}
      {isSpeaking ? (
        <SpeakingPanel onStop={onStopSpeaking} />
      ) : (
        supported.stt && (
          <MicButton
            isListening={isListening}
            transcript={transcript}
            onStart={onStart}
            onStop={onStop}
          />
        )
      )}
    </div>
  );
}