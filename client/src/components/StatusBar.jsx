import React from "react";
import { Wifi, WifiOff, RefreshCw, Cpu } from "lucide-react";

export default function StatusBar({ status, model, models, onModelChange, onRefresh }) {
  const online = status === "online";

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "6px 16px",
      background: "var(--bg-panel)",
      borderBottom: "1px solid var(--border)",
      fontSize: "11px",
      fontFamily: "var(--font-mono)",
      color: "var(--text-secondary)",
    }}>
      {/* Status dot */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <div style={{
          width: 7, height: 7,
          borderRadius: "50%",
          background: online ? "var(--green-ok)" : "var(--red-alert)",
          boxShadow: online ? "0 0 6px var(--green-ok)" : "0 0 6px var(--red-alert)",
          animation: online ? "pulse 2s infinite" : undefined,
        }} />
        <span style={{ color: online ? "var(--green-ok)" : "var(--red-alert)" }}>
          {online ? "OLLAMA ONLINE" : "OLLAMA OFFLINE"}
        </span>
      </div>

      <span style={{ color: "var(--border-bright)" }}>|</span>

      {/* Model selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Cpu size={11} color="var(--arc-dim)" />
        {models.length > 0 ? (
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--arc-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            {models.map((m) => (
              <option key={m} value={m} style={{ background: "var(--bg-panel)", color: "var(--text-primary)" }}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ color: "var(--arc-primary)" }}>{model}</span>
        )}
      </div>

      <span style={{ color: "var(--border-bright)" }}>|</span>

      {/* Refresh */}
      <button
        onClick={onRefresh}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-dim)",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 4px",
          borderRadius: "2px",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = "var(--arc-primary)"}
        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
      >
        <RefreshCw size={10} />
        <span>REFRESH</span>
      </button>

      {/* Right side */}
      <div style={{ marginLeft: "auto", color: "var(--text-dim)", letterSpacing: "0.1em" }}>
        STARK INDUSTRIES · LOCAL AI SYSTEM
      </div>
    </div>
  );
}
