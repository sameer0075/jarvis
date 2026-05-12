import React from "react";
import { Mic, MicOff, VolumeX } from "lucide-react";

export default function VoiceButton({ isListening, isSpeaking, transcript, onStart, onStop, onStopSpeaking, supported }) {
  if (!supported.stt) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {/* Stop speaking */}
      {isSpeaking && (
        <button
          onClick={onStopSpeaking}
          title="Stop speaking"
          style={{
            background: "rgba(255,209,102,0.1)",
            border: "1px solid rgba(255,209,102,0.4)",
            borderRadius: "6px",
            color: "var(--gold)",
            cursor: "pointer",
            padding: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
          }}
        >
          <VolumeX size={16} />
        </button>
      )}

      {/* Mic button */}
      <button
        onClick={isListening ? onStop : onStart}
        title={isListening ? "Stop listening" : "Start voice input"}
        style={{
          position: "relative",
          background: isListening
            ? "rgba(255,59,92,0.15)"
            : "rgba(0,212,255,0.08)",
          border: `1px solid ${isListening ? "rgba(255,59,92,0.6)" : "rgba(0,212,255,0.3)"}`,
          borderRadius: "6px",
          color: isListening ? "var(--red-alert)" : "var(--arc-primary)",
          cursor: "pointer",
          padding: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
          boxShadow: isListening
            ? "0 0 12px rgba(255,59,92,0.4)"
            : "none",
        }}
      >
        {/* Ripple effect when listening */}
        {isListening && (
          <>
            {[0, 0.4, 0.8].map((delay, i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "6px",
                  border: "1px solid rgba(255,59,92,0.5)",
                  animation: `ripple 1.6s ${delay}s ease-out infinite`,
                }}
              />
            ))}
          </>
        )}
        {isListening ? <MicOff size={16} /> : <Mic size={16} />}
      </button>

      {/* Transcript preview */}
      {isListening && transcript && (
        <span style={{
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
          color: "var(--red-alert)",
          maxWidth: "140px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          animation: "pulse 1s infinite",
        }}>
          {transcript}
        </span>
      )}
    </div>
  );
}
