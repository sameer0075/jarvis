import React from "react";
import { Mic, MicOff, VolumeX } from "lucide-react";

export default function VoiceButton({ isListening, isSpeaking, transcript, onStart, onStop, onStopSpeaking, supported }) {
  if (!supported.stt) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      {isSpeaking && (
        <button onClick={onStopSpeaking} title="Stop speaking" style={{
          background: "none", border: "1px solid rgba(255,209,102,0.3)", borderRadius: "2px",
          color: "var(--gold)", cursor: "pointer", padding: "6px",
          display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
        }}>
          <VolumeX size={14} />
        </button>
      )}

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
        {isListening && (
          <>
            {[0, 0.4, 0.8].map((delay, i) => (
              <span key={i} style={{
                position: "absolute", inset: 0, borderRadius: "2px",
                border: "1px solid rgba(255,59,92,0.4)",
                animation: `ripple 1.6s ${delay}s ease-out infinite`,
              }} />
            ))}
          </>
        )}
        {isListening ? <MicOff size={14} /> : <Mic size={14} />}
      </button>

      {isListening && transcript && (
        <span style={{
          fontSize: "11px", fontFamily: "var(--font-mono)",
          color: "var(--red-alert)", maxWidth: "120px",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {transcript}
        </span>
      )}
    </div>
  );
}