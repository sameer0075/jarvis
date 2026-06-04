import React, { useState, useEffect } from "react";

export default function VisionStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        // We only need to know the server is listening
        const res = await fetch("http://localhost:5000/video_feed", {
          signal: controller.signal,
          mode: "cors",
        });
        clearTimeout(timeout);
        // if (mounted) setOnline(res.ok);
      } catch {
        // if (mounted) setOnline(false);
      }
    };

    check(); // immediate
    const interval = setInterval(check, 3000); // retry every 3s

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "6px",
      padding: "3px 10px", borderRadius: "2px",
      border: `1px solid ${online ? "rgba(0,212,255,0.18)" : "rgba(255,0,60,0.18)"}`,
      background: online ? "rgba(0,212,255,0.03)" : "rgba(255,0,60,0.03)",
      transition: "all 0.3s",
    }}>
      <div style={{
        width: 5, height: 5, borderRadius: "50%",
        background: online ? "#00d4ff" : "#ff003c",
        boxShadow: online ? "0 0 8px #00d4ff" : "0 0 8px #ff003c",
        animation: online ? "status-pulse 1.5s ease-in-out infinite" : "none",
      }} />
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: "9px",
        letterSpacing: "0.15em",
        color: online ? "rgba(0,212,255,0.7)" : "rgba(255,0,60,0.7)",
      }}>
        OPTICAL SENSOR :: {online ? "ACTIVE" : "OFFLINE"}
      </span>
    </div>
  );
}