import React, { useState } from "react";
import { X, RefreshCw, ExternalLink, ArrowLeft, ArrowRight, Globe } from "lucide-react";

export default function BrowserPanel({ url, onClose }) {
  const [currentUrl, setCurrentUrl] = useState(url);
  const [inputUrl, setInputUrl] = useState(url);
  const [loading, setLoading] = useState(true);

  const navigate = (u) => {
    let target = u.trim();
    if (!target.startsWith("http")) target = "https://" + target;
    setCurrentUrl(target);
    setInputUrl(target);
    setLoading(true);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      background: "var(--bg-panel)",
      borderLeft: "1px solid var(--border)",
    }}>
      {/* Browser chrome */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        background: "var(--bg-deep)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <Globe size={13} color="var(--arc-dim)" />

        {/* URL Bar */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "4px",
          padding: "0 8px",
          gap: "6px",
        }}>
          <input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && navigate(inputUrl)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              color: "var(--text-primary)",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              outline: "none",
              padding: "5px 0",
            }}
          />
        </div>

        {/* Controls */}
        <button
          onClick={() => navigate(currentUrl)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--arc-dim)", display: "flex" }}
          title="Reload"
        >
          <RefreshCw size={13} style={{ animation: loading ? "rotate 1s linear infinite" : "none" }} />
        </button>

        <a
          href={currentUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--arc-dim)", display: "flex" }}
          title="Open in new tab"
        >
          <ExternalLink size={13} />
        </a>

        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red-alert)", display: "flex" }}
          title="Close browser"
        >
          <X size={14} />
        </button>
      </div>

      {/* Header note */}
      <div style={{
        padding: "4px 12px",
        background: "rgba(0,212,255,0.04)",
        borderBottom: "1px solid var(--border)",
        fontSize: "10px",
        fontFamily: "var(--font-mono)",
        color: "var(--text-dim)",
        flexShrink: 0,
      }}>
        ⚠ Some sites block embedding. Use "Open in new tab" for those.
      </div>

      {/* iframe */}
      <iframe
        key={currentUrl}
        src={currentUrl}
        style={{
          flex: 1,
          border: "none",
          background: "#fff",
          opacity: loading ? 0.6 : 1,
          transition: "opacity 0.3s",
        }}
        onLoad={() => setLoading(false)}
        title="Jarvis Browser"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-navigation"
      />
    </div>
  );
}
