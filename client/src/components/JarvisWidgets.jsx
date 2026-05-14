import React, { useState, useEffect } from "react";
import { 
  Cloud, CloudRain, Sun, Wind, Droplets, Thermometer, Snowflake, CloudLightning,
  Newspaper, Clock, Cpu, Activity, Wifi, Terminal, Radio
} from "lucide-react";

/* ─── Helpers ─── */
const formatTime = (tz) => new Date().toLocaleTimeString("en-GB", {
  timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
});

const WeatherIcon = ({ condition, size = 48 }) => {
  const props = { size, color: "#00d4ff", strokeWidth: 1.5 };
  if (!condition) return <Cloud {...props} />;
  const c = condition.toLowerCase();
  if (c.includes("rain")) return <CloudRain {...props} />;
  if (c.includes("snow")) return <Snowflake {...props} />;
  if (c.includes("thunder")) return <CloudLightning {...props} />;
  if (c.includes("clear") || c.includes("sun")) return <Sun {...props} />;
  return <Cloud {...props} />;
};

/* ─── Radial Gauge ─── */
const RadialGauge = ({ value, max = 100, size = 90, stroke = 6, color = "#00d4ff", label, suffix = "" }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (Math.min(value, max) / max);
  
  return (
    <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`${color}12`} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}80)`, transition: "stroke-dasharray 1.5s ease-out" }} />
      </svg>
      <div style={{ position: "absolute", textAlign: "center" }}>
        <div style={{ fontSize: "16px", fontWeight: 700, color, fontFamily: "var(--font-mono)", textShadow: `0 0 10px ${color}60` }}>
          {Math.round(value)}{suffix}
        </div>
        <div style={{ fontSize: "9px", color: "var(--arc-dim)", letterSpacing: "0.15em", marginTop: "2px" }}>{label}</div>
      </div>
    </div>
  );
};

/* ─── Holographic Panel Wrapper ─── */
const HoloPanel = ({ children, title, icon: Icon, accent = "#00d4ff", live = false }) => (
  <div style={{
    background: "linear-gradient(135deg, rgba(0,212,255,0.03) 0%, rgba(0,212,255,0.005) 100%)",
    border: `1px solid ${accent}15`,
    borderRadius: "3px",
    position: "relative",
    overflow: "hidden",
    marginBottom: "20px",
    boxShadow: `0 0 24px ${accent}04`,
  }}>
    {/* Corner brackets */}
    <div style={{ position: "absolute", top: -1, left: -1, width: "18px", height: "18px", borderTop: `2px solid ${accent}`, borderLeft: `2px solid ${accent}`, opacity: 0.5 }} />
    <div style={{ position: "absolute", top: -1, right: -1, width: "18px", height: "18px", borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}`, opacity: 0.5 }} />
    <div style={{ position: "absolute", bottom: -1, left: -1, width: "18px", height: "18px", borderBottom: `2px solid ${accent}`, borderLeft: `2px solid ${accent}`, opacity: 0.5 }} />
    <div style={{ position: "absolute", bottom: -1, right: -1, width: "18px", height: "18px", borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}`, opacity: 0.5 }} />
    
    {/* Subtle scanline overlay */}
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(0,212,255,0.015) 50%)", backgroundSize: "100% 4px", pointerEvents: "none", opacity: 0.4 }} />
    
    {/* Header */}
    <div style={{
      display: "flex", alignItems: "center", gap: "10px",
      padding: "14px 18px",
      borderBottom: `1px solid ${accent}10`,
      background: `${accent}05`,
    }}>
      {Icon && <Icon size={15} color={accent} style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />}
      <span style={{
        fontFamily: "var(--font-display)",
        fontSize: "11px",
        letterSpacing: "0.25em",
        color: accent,
        textShadow: `0 0 12px ${accent}40`,
      }}>
        {title}
      </span>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
        {live && (
          <>
            <span style={{ fontSize: "9px", color: "var(--red-alert)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>LIVE</span>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--red-alert)", boxShadow: "0 0 10px var(--red-alert)", animation: "pulse 1.5s infinite" }} />
          </>
        )}
        <div style={{ width: "24px", height: "1px", background: `${accent}25` }} />
      </div>
    </div>
    
    <div style={{ padding: "18px" }}>
      {children}
    </div>
  </div>
);

/* ─── System Diagnostics ─── */
function SystemDiagnostics({statsData}) {

  const [stats, setStats] = useState({ cpu: statsData.cpu, ram: statsData.ram, net: statsData.net });
  
  useEffect(() => {
    const iv = setInterval(() => {
      setStats(prev => ({
        cpu: Math.min(100, Math.max(10, prev.cpu + (Math.random() - 0.5) * 20)),
        ram: Math.min(100, Math.max(20, prev.ram + (Math.random() - 0.5) * 12)),
        net: Math.min(100, Math.max(30, prev.net + (Math.random() - 0.5) * 25)),
      }));
    }, 2500);
    return () => clearInterval(iv);
  }, []);
  
  const bars = [
    { label: "CPU CORE", value: Math.round(statsData.cpu), color: "#00d4ff", icon: Cpu },
    { label: "MEMORY", value: Math.round(statsData.ram), color: "#00d4ff", icon: Activity },
    { label: "NETWORK", value: Math.round(statsData.net), color: "var(--green-ok)", icon: Wifi },
  ];
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {bars.map(({ label, value, color, icon: I }) => (
        <div key={label}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <I size={12} color={color} />
              <span style={{ fontSize: "10px", color: "var(--arc-dim)", letterSpacing: "0.15em", fontFamily: "var(--font-mono)" }}>{label}</span>
            </div>
            <span style={{ fontSize: "12px", color, fontFamily: "var(--font-mono)", fontWeight: 700, textShadow: `0 0 8px ${color}60` }}>
              {value}%
            </span>
          </div>
          <div style={{ height: "5px", background: "rgba(0,212,255,0.05)", borderRadius: "1px", overflow: "hidden", position: "relative" }}>
            {/* Segmented grid overlay */}
            <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "space-evenly", zIndex: 2 }}>
              {[1,2,3,4].map(i => <div key={i} style={{ width: "1px", background: "rgba(0,0,0,0.4)", height: "100%" }} />)}
            </div>
            <div style={{
              height: "100%", width: `${value}%`, background: `linear-gradient(90deg, ${color}30, ${color})`,
              borderRadius: "1px", transition: "width 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: `0 0 12px ${color}50`, position: "relative", zIndex: 1,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Weather Widget ─── */
function WeatherWidget({ data }) {
  if (!data) return (
    <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
      <Cloud size={48} color="var(--arc-dim)" style={{ marginBottom: "14px", opacity: 0.4 }} />
      <div style={{ letterSpacing: "0.15em", fontSize: "11px" }}>NO ATMOSPHERIC DATA</div>
      <div style={{ fontSize: "10px", marginTop: "8px", opacity: 0.5 }}>Query: "weather in [city]"</div>
    </div>
  );
  
  return (
    <div>
      {/* Main display */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <div style={{
            fontSize: "10px", color: "var(--arc-dim)", letterSpacing: "0.2em", marginBottom: "6px",
            fontFamily: "var(--font-mono)",
          }}>
            {data.city?.toUpperCase()}, {data.country}
          </div>
          <div style={{
            fontSize: "56px", fontWeight: 300, color: "#c8eef8", lineHeight: 1,
            fontFamily: "var(--font-display)", letterSpacing: "-0.02em",
            textShadow: "0 0 30px rgba(0,212,255,0.3)",
          }}>
            {data.temp}<span style={{ fontSize: "24px", opacity: 0.5, verticalAlign: "top", marginLeft: "2px" }}>°C</span>
          </div>
          <div style={{
            fontSize: "11px", color: "var(--arc-primary)", letterSpacing: "0.2em", marginTop: "8px",
            textTransform: "uppercase", fontFamily: "var(--font-mono)",
          }}>
            {data.description}
          </div>
        </div>
        <div style={{ filter: "drop-shadow(0 0 20px rgba(0,212,255,0.35))" }}>
          <WeatherIcon condition={data.description} size={72} />
        </div>
      </div>
      
      {/* Gauges row */}
      <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", paddingTop: "14px", borderTop: "1px solid rgba(0,212,255,0.08)" }}>
        <RadialGauge value={data.humidity || 0} label="HUMIDITY" suffix="%" color="#00d4ff" />
        <RadialGauge value={data.wind_kph || 0} max={50} label="WIND" suffix="kph" color="#00d4ff" />
        <RadialGauge value={data.feels_like || data.temp || 0} max={50} label="FEELS" suffix="°" color="#ffd166" />
      </div>
    </div>
  );
}

/* ─── World Clock ─── */
const CITIES = [
  { id: "t-tokyo", label: "TYO", tz: "Asia/Tokyo", offset: "+9" },
  { id: "t-london", label: "LON", tz: "Europe/London", offset: "+1" },
  { id: "t-ny", label: "NYC", tz: "America/New_York", offset: "-4" },
  { id: "t-dubai", label: "DXB", tz: "Asia/Dubai", offset: "+4" },
];

function WorldClock() {
  const [times, setTimes] = useState({});
  const [tick, setTick] = useState(false);
  
  useEffect(() => {
    const update = () => {
      const t = {};
      CITIES.forEach(c => { t[c.id] = formatTime(c.tz); });
      setTimes(t);
      setTick(v => !v);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);
  
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
      {CITIES.map(c => (
        <div key={c.id} style={{
          background: "rgba(0,212,255,0.02)",
          border: "1px solid rgba(0,212,255,0.06)",
          borderRadius: "2px",
          padding: "14px",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "10px", color: "var(--arc-dim)", letterSpacing: "0.15em", fontFamily: "var(--font-mono)" }}>{c.label}</span>
            <span style={{ fontSize: "9px", color: "var(--arc-dim)", fontFamily: "var(--font-mono)" }}>UTC{c.offset}</span>
          </div>
          <div style={{
            fontSize: "24px", color: "var(--arc-primary)", fontFamily: "var(--font-mono)",
            fontWeight: 500, letterSpacing: "0.05em", textShadow: "0 0 12px rgba(0,212,255,0.2)",
          }}>
            {times[c.id]?.slice(0, 5) || "--:--"}
            <span style={{ 
              fontSize: "14px", opacity: 0.6, marginLeft: "2px",
              color: tick ? "var(--arc-primary)" : "var(--arc-dim)", transition: "color 0.3s"
            }}>
              {times[c.id]?.slice(5, 8) || ""}
            </span>
          </div>
          <div style={{ fontSize: "10px", color: "var(--arc-dim)", marginTop: "4px", fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}>
            {times[c.id]?.slice(9) || ""}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Intel Feed ─── */
function IntelFeed({ articles }) {
  if (!articles?.length) return (
    <div style={{ textAlign: "center", padding: "28px 10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
      <Radio size={36} color="var(--arc-dim)" style={{ marginBottom: "12px", opacity: 0.4 }} />
      <div style={{ fontSize: "11px", letterSpacing: "0.15em" }}>NO INTEL DATA STREAM</div>
      <div style={{ fontSize: "10px", marginTop: "6px", opacity: 0.5 }}>Query: "latest [topic] news"</div>
    </div>
  );
  
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {articles.map((a, i) => (
        <div key={i} onClick={() => window.open(a.url, "_blank")} style={{
          position: "relative",
          padding: "14px 14px 14px 16px",
          background: "rgba(0,212,255,0.015)",
          border: "1px solid rgba(0,212,255,0.05)",
          borderLeft: "2px solid var(--arc-dim)",
          borderRadius: "2px",
          cursor: "pointer",
          transition: "all 0.3s ease",
        }}
          onMouseEnter={e => {
            e.currentTarget.style.borderLeftColor = "var(--arc-primary)";
            e.currentTarget.style.background = "rgba(0,212,255,0.04)";
            e.currentTarget.style.boxShadow = "0 0 24px rgba(0,212,255,0.06)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderLeftColor = "var(--arc-dim)";
            e.currentTarget.style.background = "rgba(0,212,255,0.015)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <div style={{
            fontSize: "13px", color: "#c8eef8", lineHeight: 1.5, marginBottom: "8px",
            fontFamily: "var(--font-body)", fontWeight: 500,
          }}>
            {a.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{
              fontSize: "9px", color: "var(--arc-primary)", fontFamily: "var(--font-mono)",
              letterSpacing: "0.1em", padding: "2px 6px", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "1px",
            }}>
              {typeof a.source == 'string' ? a.source?.toUpperCase() : a.source?.name?.toUpperCase()}
            </span>
            <span style={{ fontSize: "9px", color: "var(--arc-dim)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
              {a.time}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Main Export ─── */
export default function JarvisWidgets({ weatherData, newsData, statsData }) {
  return (
    <div style={{
      width: "420px", flexShrink: 0,
      borderLeft: "1px solid rgba(0,212,255,0.1)",
      background: "linear-gradient(180deg, rgba(0,212,255,0.02) 0%, transparent 40%)",
      overflowY: "auto",
      display: "flex", flexDirection: "column",
      padding: "20px",
      position: "relative",
    }}>
      {/* Micro grid background */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(0,212,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.025) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        pointerEvents: "none", opacity: 0.6,
      }} />
      
      <HoloPanel title="ATMOSPHERIC CONDITIONS" icon={Cloud} accent="#00d4ff">
        <WeatherWidget data={weatherData} />
      </HoloPanel>
      
      <HoloPanel title="SYSTEM DIAGNOSTICS" icon={Terminal} accent="var(--green-ok)">
        <SystemDiagnostics statsData={statsData}/>
      </HoloPanel>
      
      <HoloPanel title="GLOBAL CHRONOMETER" icon={Clock} accent="#00d4ff">
        <WorldClock />
      </HoloPanel>
      
      <HoloPanel title="INTEL FEED" icon={Newspaper} accent="var(--red-alert)" live>
        <IntelFeed articles={newsData} />
      </HoloPanel>
    </div>
  );
}