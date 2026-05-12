import React from "react";

export default function ArcReactor({ size = 60, active = false, listening = false, speaking = false }) {
  const color = listening ? "#ff3b5c" : speaking ? "#ffd166" : "#00d4ff";
  const glowColor = listening ? "rgba(255,59,92,0.5)" : speaking ? "rgba(255,209,102,0.5)" : "rgba(0,212,255,0.4)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        filter: `drop-shadow(0 0 ${active ? 12 : 6}px ${glowColor})`,
        transition: "filter 0.3s ease",
      }}
    >
      {/* Outer ring */}
      <circle
        cx="50" cy="50" r="46"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray="4 3"
        style={{
          animation: "rotate 12s linear infinite",
          transformOrigin: "50px 50px",
          opacity: 0.6,
        }}
      />
      {/* Mid ring */}
      <circle
        cx="50" cy="50" r="36"
        fill="none"
        stroke={color}
        strokeWidth="1"
        strokeDasharray="8 4"
        style={{
          animation: "rotate 8s linear infinite reverse",
          transformOrigin: "50px 50px",
          opacity: 0.5,
        }}
      />
      {/* Inner ring solid */}
      <circle cx="50" cy="50" r="26" fill="rgba(0,0,0,0.7)" stroke={color} strokeWidth="1.5" />
      {/* Core segments */}
      {[0, 60, 120, 180, 240, 300].map((deg, i) => (
        <line
          key={i}
          x1="50" y1="26"
          x2="50" y2="32"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          transform={`rotate(${deg}, 50, 50)`}
          opacity={0.9}
        />
      ))}
      {/* Inner hex */}
      <polygon
        points="50,34 58,38.5 58,47.5 50,52 42,47.5 42,38.5"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        opacity={0.8}
      />
      {/* Core glow */}
      <circle
        cx="50" cy="43" r="7"
        fill={color}
        opacity={active ? 0.95 : 0.7}
        style={{
          animation: active ? "pulse 1.5s ease-in-out infinite" : undefined,
        }}
      />
      {/* Core inner */}
      <circle cx="50" cy="43" r="3.5" fill="white" opacity={0.9} />
    </svg>
  );
}
