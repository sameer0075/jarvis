import React, { useState, useEffect, useRef } from "react";
import {
  Cloud, CloudRain, Sun, Snowflake, CloudLightning,
  Newspaper, Clock, Cpu, Activity, Wifi, Terminal, Radio,
  Maximize2, Minimize2, ChevronDown, ChevronUp,
  HardDrive as HardDriveIcon,
} from "lucide-react";

const formatTime = (tz) => new Date().toLocaleTimeString("en-GB", {
  timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
});

const WeatherIcon = ({ condition, size = 48 }) => {
  const props = { size, color: "#00d4ff", strokeWidth: 1.5 };
  if (!condition) return <Cloud {...props} />;
  const c = condition.toLowerCase();
  if (c.includes("rain"))    return <CloudRain {...props} />;
  if (c.includes("snow"))    return <Snowflake {...props} />;
  if (c.includes("thunder")) return <CloudLightning {...props} />;
  if (c.includes("clear") || c.includes("sun")) return <Sun {...props} />;
  return <Cloud {...props} />;
};

const RadialGauge = ({ value, max = 100, size = 80, stroke = 6, color = "#00d4ff", label, suffix = "" }) => {
  const r    = (size - stroke) / 2;
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
        <div style={{ fontSize: "14px", fontWeight: 700, color, fontFamily: "var(--font-mono)", textShadow: `0 0 10px ${color}60` }}>
          {Math.round(value)}{suffix}
        </div>
        <div style={{ fontSize: "8px", color: "var(--arc-dim)", letterSpacing: "0.12em", marginTop: "1px" }}>{label}</div>
      </div>
    </div>
  );
};

// ── Collapsible + Scrollable + Fullscreen Panel ───────────────────────────────
function HoloPanel({ children, title, icon: Icon, accent = "#00d4ff", live = false, maxHeight = 280, defaultOpen = true }) {
  const [open,       setOpen]       = useState(defaultOpen);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [fullscreen]);

  const contentStyle = fullscreen
    ? { maxHeight: "calc(100vh - 120px)", overflowY: "auto", padding: "18px" }
    : { maxHeight: open ? `${maxHeight}px` : "0px", overflow: open ? "auto" : "hidden",
        transition: "max-height 0.35s cubic-bezier(0.4,0,0.2,1)", padding: open ? "18px" : "0 18px" };

  const panelStyle = fullscreen ? {
    position: "fixed", inset: 0, zIndex: 200,
    background: "rgba(2,4,8,0.98)",
    border: `1px solid ${accent}30`,
    display: "flex", flexDirection: "column",
    boxShadow: `0 0 80px ${accent}10`,
  } : {
    background: "linear-gradient(135deg, rgba(0,212,255,0.03) 0%, rgba(0,212,255,0.005) 100%)",
    border: `1px solid ${accent}15`,
    borderRadius: "3px",
    position: "relative",
    overflow: "hidden",
    marginBottom: "16px",
    boxShadow: `0 0 24px ${accent}04`,
    flexShrink: 0,
  };

  return (
    <div style={panelStyle}>
      {/* Corner brackets — hide in fullscreen */}
      {!fullscreen && <>
        <div style={{ position: "absolute", top: -1, left: -1,  width: 16, height: 16, borderTop: `2px solid ${accent}`, borderLeft:  `2px solid ${accent}`, opacity: 0.5 }} />
        <div style={{ position: "absolute", top: -1, right: -1, width: 16, height: 16, borderTop: `2px solid ${accent}`, borderRight: `2px solid ${accent}`, opacity: 0.5 }} />
        <div style={{ position: "absolute", bottom: -1, left: -1,  width: 16, height: 16, borderBottom: `2px solid ${accent}`, borderLeft:  `2px solid ${accent}`, opacity: 0.5 }} />
        <div style={{ position: "absolute", bottom: -1, right: -1, width: 16, height: 16, borderBottom: `2px solid ${accent}`, borderRight: `2px solid ${accent}`, opacity: 0.5 }} />
      </>}

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "12px 16px",
        borderBottom: open || fullscreen ? `1px solid ${accent}10` : "none",
        background: `${accent}05`,
        cursor: "pointer", userSelect: "none", flexShrink: 0,
      }}>
        {/* Collapse toggle */}
        <div onClick={() => !fullscreen && setOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
          {Icon && <Icon size={14} color={accent} style={{ filter: `drop-shadow(0 0 8px ${accent})`, flexShrink: 0 }} />}
          <span style={{ fontFamily: "var(--font-display)", fontSize: "10px", letterSpacing: "0.22em", color: accent, textShadow: `0 0 12px ${accent}40` }}>
            {title}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {live && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontSize: "8px", color: "var(--red-alert)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>LIVE</span>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red-alert)", boxShadow: "0 0 8px var(--red-alert)", animation: "pulse 1.5s infinite" }} />
            </div>
          )}

          {/* Fullscreen toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setFullscreen(v => !v); if (!open) setOpen(true); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: `${accent}60`, padding: "2px", display: "flex", transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = accent}
            onMouseLeave={e => e.currentTarget.style.color = `${accent}60`}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>

          {/* Collapse toggle arrow */}
          {!fullscreen && (
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: `${accent}60`, padding: "2px", display: "flex", transition: "color 0.2s, transform 0.3s" }}
              onMouseEnter={e => e.currentTarget.style.color = accent}
              onMouseLeave={e => e.currentTarget.style.color = `${accent}60`}
            >
              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* Content with scrollbar */}
      <div style={contentStyle} className="holo-scroll">
        {children}
      </div>

      {/* Fullscreen close overlay hint */}
      {fullscreen && (
        <div style={{
          position: "absolute", bottom: "16px", right: "16px",
          fontFamily: "var(--font-mono)", fontSize: "9px",
          color: `${accent}40`, letterSpacing: "0.1em",
        }}>
          ESC or ⤢ to exit
        </div>
      )}
    </div>
  );
}

// ── System Diagnostics ────────────────────────────────────────────────────────
function SystemDiagnostics({ statsData }) {
  const [stats, setStats] = useState(statsData || {});

  // Poll fresh stats every 15 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const res  = await fetch("http://localhost:3001/api/get-system-stats");
        const data = await res.json();
        setStats(data);
      } catch {}
    };
    poll(); // immediate first fetch
    const iv = setInterval(poll, 15000);
    return () => clearInterval(iv);
  }, []);

  // Sync when parent passes initial data
  useEffect(() => {
    if (statsData) setStats(statsData);
  }, [statsData]);

  const bars = [
    { label: "CPU",     value: stats.cpu  || 0, color: "#00d4ff",        icon: Cpu,      suffix: "%",    sub: stats.temp ? `${stats.temp}°C` : null },
    { label: "MEMORY",  value: stats.ram  || 0, color: "#00d4ff",        icon: Activity, suffix: "%",    sub: stats.ramUsed != null ? `${stats.ramUsed}/${stats.ramTotal} GB` : null },
    { label: "DISK",    value: stats.disk || 0, color: "#ffd166",        icon: HardDriveIcon, suffix: "%", sub: stats.diskUsed != null ? `${stats.diskUsed}/${stats.diskSize} GB` : null },
    { label: "NET ↓",   value: Math.min(stats.net  || 0, 100), color: "var(--green-ok)", icon: Wifi, suffix: "", sub: stats.net  != null ? `${stats.net} KB/s`  : null },
    { label: "NET ↑",   value: Math.min(stats.netTx|| 0, 100), color: "var(--green-ok)", icon: Wifi, suffix: "", sub: stats.netTx!= null ? `${stats.netTx} KB/s` : null },
    ...(stats.swap > 0 ? [{ label: "SWAP", value: stats.swap, color: "#ff9f43", icon: Activity, suffix: "%", sub: null }] : []),
    ...(stats.battery ? [{
    label: stats.battery.charging ? "BATTERY ⚡" : "BATTERY 🔋",
    value: stats.battery.percent,
    color: stats.battery.charging ? "var(--green-ok)"
         : stats.battery.percent < 20 ? "var(--red-alert)"
         : stats.battery.percent < 50 ? "#ffd166"
         : "var(--green-ok)",
    icon: Activity,
    suffix: "%",
    sub: stats.battery.remaining && stats.battery.remaining > 0
         ? `${Math.floor(stats.battery.remaining / 60)}h ${stats.battery.remaining % 60}m left`
         : null,
  }] : [])
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Process count + battery row */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {stats.processes != null && (
          <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--arc-dim)", padding: "3px 8px", border: "1px solid rgba(0,212,255,0.1)", borderRadius: "2px" }}>
            <span style={{ color: "var(--arc-primary)" }}>{stats.processes}</span> PROCS
          </div>
        )}
        {stats.battery && (
          <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--arc-dim)", padding: "3px 8px", border: "1px solid rgba(0,212,255,0.1)", borderRadius: "2px" }}>
            <span style={{ color: stats.battery.charging ? "var(--green-ok)" : "var(--arc-primary)" }}>
              {stats.battery.charging ? "⚡" : "🔋"} {stats.battery.percent}%
            </span>
          </div>
        )}
        {stats.temp && (
          <div style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color: "var(--arc-dim)", padding: "3px 8px", border: "1px solid rgba(0,212,255,0.1)", borderRadius: "2px" }}>
            <span style={{ color: stats.temp > 80 ? "var(--red-alert)" : stats.temp > 60 ? "#ffd166" : "var(--green-ok)" }}>
              {stats.temp}°C
            </span> CPU TEMP
          </div>
        )}
      </div>

      {/* Bars */}
      {bars.map(({ label, value, color, icon: I, suffix, sub }) => (
        <div key={label}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <I size={11} color={color} />
              <span style={{ fontSize: "10px", color: "var(--arc-dim)", letterSpacing: "0.15em", fontFamily: "var(--font-mono)" }}>{label}</span>
              {sub && <span style={{ fontSize: "9px", color: "rgba(0,212,255,0.35)", fontFamily: "var(--font-mono)" }}>{sub}</span>}
            </div>
            <span style={{ fontSize: "11px", color, fontFamily: "var(--font-mono)", fontWeight: 700, textShadow: `0 0 8px ${color}60` }}>
              {Math.round(value)}{suffix}
            </span>
          </div>
          <div style={{ height: "4px", background: "rgba(0,212,255,0.05)", borderRadius: "1px", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "space-evenly", zIndex: 2 }}>
              {[1,2,3,4].map(i => <div key={i} style={{ width: "1px", background: "rgba(0,0,0,0.4)", height: "100%" }} />)}
            </div>
            <div style={{
              height: "100%", width: `${Math.min(value, 100)}%`,
              background: `linear-gradient(90deg, ${color}30, ${color})`,
              borderRadius: "1px",
              transition: "width 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: `0 0 10px ${color}50`,
              position: "relative", zIndex: 1,
            }} />
          </div>
        </div>
      ))}

      {/* Per-core CPU breakdown if available */}
      {stats.cpuCores?.length > 0 && (
        <div>
          <div style={{ fontSize: "9px", color: "var(--arc-dim)", letterSpacing: "0.15em", fontFamily: "var(--font-mono)", marginBottom: "8px" }}>
            CORE BREAKDOWN
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
            {stats.cpuCores.slice(0, 16).map(({ core, load }) => (
              <div key={core} style={{ textAlign: "center" }}>
                <div style={{ height: "32px", background: "rgba(0,212,255,0.04)", borderRadius: "2px", overflow: "hidden", display: "flex", alignItems: "flex-end" }}>
                  <div style={{
                    width: "100%", height: `${load}%`,
                    background: load > 80 ? "var(--red-alert)" : load > 60 ? "#ffd166" : "#00d4ff",
                    transition: "height 1.5s ease",
                    boxShadow: load > 80 ? "0 0 6px rgba(255,59,92,0.5)" : "0 0 6px rgba(0,212,255,0.3)",
                  }} />
                </div>
                <div style={{ fontSize: "8px", color: "var(--arc-dim)", fontFamily: "var(--font-mono)", marginTop: "3px" }}>
                  C{core}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Weather Widget ────────────────────────────────────────────────────────────
function WeatherWidget({ data }) {
  if (!data) return (
    <div style={{ textAlign: "center", padding: "24px 10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
      <Cloud size={40} color="var(--arc-dim)" style={{ marginBottom: "12px", opacity: 0.4 }} />
      <div style={{ letterSpacing: "0.15em", fontSize: "11px" }}>NO ATMOSPHERIC DATA</div>
      <div style={{ fontSize: "10px", marginTop: "6px", opacity: 0.5 }}>Say "weather in [city]"</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "10px", color: "var(--arc-dim)", letterSpacing: "0.2em", marginBottom: "4px", fontFamily: "var(--font-mono)" }}>
            {data.city?.toUpperCase()}, {data.country}
          </div>
          <div style={{ fontSize: "48px", fontWeight: 300, color: "#c8eef8", lineHeight: 1, fontFamily: "var(--font-display)", textShadow: "0 0 30px rgba(0,212,255,0.3)" }}>
            {data.temp}<span style={{ fontSize: "20px", opacity: 0.5, verticalAlign: "top", marginLeft: "2px" }}>°C</span>
          </div>
          <div style={{ fontSize: "10px", color: "var(--arc-primary)", letterSpacing: "0.2em", marginTop: "6px", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
            {data.description}
          </div>
        </div>
        <div style={{ filter: "drop-shadow(0 0 16px rgba(0,212,255,0.35))" }}>
          <WeatherIcon condition={data.description} size={60} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", paddingTop: "12px", borderTop: "1px solid rgba(0,212,255,0.08)" }}>
        <RadialGauge value={data.humidity   || 0}        label="HUMIDITY" suffix="%" color="#00d4ff" />
        <RadialGauge value={data.wind_kph   || 0} max={50} label="WIND"    suffix="kph" color="#00d4ff" />
        <RadialGauge value={data.feels_like || 0} max={50} label="FEELS"   suffix="°"   color="#ffd166" />
      </div>
    </div>
  );
}

// ── World Clock ───────────────────────────────────────────────────────────────
const CLOCK_CITIES = [
  { id: "t-lahore",   label: "LHE", tz: "Asia/Karachi",       offset: "+5",  city: "Lahore"      },
  { id: "t-tokyo",    label: "TYO", tz: "Asia/Tokyo",          offset: "+9",  city: "Tokyo"       },
  { id: "t-london",   label: "LON", tz: "Europe/London",       offset: "+1",  city: "London"      },
  { id: "t-ny",       label: "NYC", tz: "America/New_York",    offset: "-4",  city: "New York"    },
  { id: "t-dubai",    label: "DXB", tz: "Asia/Dubai",          offset: "+4",  city: "Dubai"       },
  { id: "t-sg",       label: "SGP", tz: "Asia/Singapore",      offset: "+8",  city: "Singapore"   },
  { id: "t-sydney",   label: "SYD", tz: "Australia/Sydney",    offset: "+10", city: "Sydney"      },
  { id: "t-paris",    label: "PAR", tz: "Europe/Paris",        offset: "+2",  city: "Paris"       },
  { id: "t-berlin",   label: "BER", tz: "Europe/Berlin",       offset: "+2",  city: "Berlin"      },
  { id: "t-moscow",   label: "MSK", tz: "Europe/Moscow",       offset: "+3",  city: "Moscow"      },
  { id: "t-beijing",  label: "BJG", tz: "Asia/Shanghai",       offset: "+8",  city: "Beijing"     },
  { id: "t-mumbai",   label: "BOM", tz: "Asia/Kolkata",        offset: "+5",  city: "Mumbai"      },
  { id: "t-istanbul", label: "IST", tz: "Europe/Istanbul",     offset: "+3",  city: "Istanbul"    },
  { id: "t-toronto",  label: "YYZ", tz: "America/Toronto",     offset: "-4",  city: "Toronto"     },
  { id: "t-la",       label: "LAX", tz: "America/Los_Angeles", offset: "-7",  city: "Los Angeles" },
  { id: "t-chicago",  label: "ORD", tz: "America/Chicago",     offset: "-5",  city: "Chicago"     },
  { id: "t-cairo",    label: "CAI", tz: "Africa/Cairo",        offset: "+2",  city: "Cairo"       },
  { id: "t-riyadh",   label: "RUH", tz: "Asia/Riyadh",         offset: "+3",  city: "Riyadh"      },
  { id: "t-dhaka",    label: "DAC", tz: "Asia/Dhaka",          offset: "+6",  city: "Dhaka"       },
  { id: "t-jakarta",  label: "JKT", tz: "Asia/Jakarta",        offset: "+7",  city: "Jakarta"     },
  { id: "t-seoul",    label: "SEL", tz: "Asia/Seoul",          offset: "+9",  city: "Seoul"       },
  { id: "t-hk",       label: "HKG", tz: "Asia/Hong_Kong",      offset: "+8",  city: "Hong Kong"   },
  { id: "t-amsterdam",label: "AMS", tz: "Europe/Amsterdam",    offset: "+2",  city: "Amsterdam"   },
  { id: "t-saopaulo", label: "GRU", tz: "America/Sao_Paulo",   offset: "-3",  city: "São Paulo"   },
];

function WorldClock() {
  const [times,  setTimes]  = useState({});
  const [tick,   setTick]   = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const update = () => {
      const t = {};
      CLOCK_CITIES.forEach(c => { t[c.id] = formatTime(c.tz); });
      setTimes(t);
      setTick(v => !v);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  const filtered = CLOCK_CITIES.filter(c =>
    !search || c.city.toLowerCase().includes(search.toLowerCase()) || c.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Filter cities..."
        style={{
          width: "100%", marginBottom: "12px",
          background: "rgba(0,212,255,0.04)",
          border: "1px solid rgba(0,212,255,0.12)",
          borderRadius: "2px", color: "var(--text-primary)",
          fontFamily: "var(--font-mono)", fontSize: "11px",
          padding: "6px 10px", outline: "none",
          boxSizing: "border-box",
        }}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {filtered.map(c => (
          <div key={c.id} style={{
            background: "rgba(0,212,255,0.02)",
            border: c.id === "t-lahore" ? "1px solid rgba(0,212,255,0.2)" : "1px solid rgba(0,212,255,0.06)",
            borderRadius: "2px", padding: "10px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span style={{ fontSize: "9px", color: c.id === "t-lahore" ? "var(--arc-primary)" : "var(--arc-dim)", letterSpacing: "0.15em", fontFamily: "var(--font-mono)" }}>
                {c.city}
              </span>
              <span style={{ fontSize: "8px", color: "var(--arc-dim)", fontFamily: "var(--font-mono)" }}>UTC{c.offset}</span>
            </div>
            <div style={{ fontSize: "18px", color: c.id === "t-lahore" ? "var(--arc-primary)" : "#c8eef8", fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: "0.05em" }}>
              {times[c.id]?.slice(0, 5) || "--:--"}
              <span style={{ fontSize: "11px", opacity: 0.5, marginLeft: "1px", color: tick ? "inherit" : "var(--arc-dim)", transition: "color 0.3s" }}>
                {times[c.id]?.slice(5, 8) || ""}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Intel Feed ────────────────────────────────────────────────────────────────
function IntelFeed({ articles }) {
  if (!articles?.length) return (
    <div style={{ textAlign: "center", padding: "24px 10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
      <Radio size={32} color="var(--arc-dim)" style={{ marginBottom: "10px", opacity: 0.4 }} />
      <div style={{ fontSize: "11px", letterSpacing: "0.15em" }}>NO INTEL DATA STREAM</div>
      <div style={{ fontSize: "10px", marginTop: "6px", opacity: 0.5 }}>Say "latest [topic] news"</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {articles.map((a, i) => (
        <div key={i} onClick={() => window.open(a.url, "_blank")} style={{
          padding: "12px 12px 12px 14px",
          background: "rgba(0,212,255,0.015)",
          border: "1px solid rgba(0,212,255,0.05)",
          borderLeft: "2px solid var(--arc-dim)",
          borderRadius: "2px", cursor: "pointer", transition: "all 0.25s",
        }}
          onMouseEnter={e => { e.currentTarget.style.borderLeftColor = "var(--arc-primary)"; e.currentTarget.style.background = "rgba(0,212,255,0.04)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderLeftColor = "var(--arc-dim)";     e.currentTarget.style.background = "rgba(0,212,255,0.015)"; }}
        >
          <div style={{ fontSize: "12px", color: "#c8eef8", lineHeight: 1.5, marginBottom: "6px", fontFamily: "var(--font-body)", fontWeight: 500 }}>
            {a.title}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "9px", color: "var(--arc-primary)", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", padding: "2px 5px", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "1px" }}>
              {typeof a.source === "string" ? a.source?.toUpperCase() : a.source?.name?.toUpperCase()}
            </span>
            <span style={{ fontSize: "9px", color: "var(--arc-dim)", fontFamily: "var(--font-mono)" }}>{a.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────
export default function JarvisWidgets({ weatherData, newsData, statsData }) {
  return (
    <>
      {/* Custom scrollbar styles injected once */}
      <style>{`
        .holo-scroll::-webkit-scrollbar { width: 4px; }
        .holo-scroll::-webkit-scrollbar-track { background: rgba(0,212,255,0.03); }
        .holo-scroll::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.2); border-radius: 2px; }
        .holo-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,212,255,0.4); }
      `}</style>

      <div style={{
        width: "380px", flexShrink: 0,
        borderLeft: "1px solid rgba(0,212,255,0.1)",
        background: "linear-gradient(180deg, rgba(0,212,255,0.02) 0%, transparent 40%)",
        overflowY: "auto",
        display: "flex", flexDirection: "column",
        padding: "16px",
        position: "relative",
        gap: "0px",
      }} className="holo-scroll">
        {/* Micro grid */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(0,212,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.02) 1px, transparent 1px)",
          backgroundSize: "24px 24px", opacity: 0.6,
        }} />

        <HoloPanel title="ATMOSPHERIC CONDITIONS" icon={Cloud}     accent="#00d4ff"         maxHeight={320} defaultOpen={true}>
          <WeatherWidget data={weatherData} />
        </HoloPanel>

        <HoloPanel title="SYSTEM DIAGNOSTICS"     icon={Terminal}  accent="var(--green-ok)" maxHeight={220} defaultOpen={true}>
          <SystemDiagnostics statsData={statsData || { cpu: 0, ram: 0, net: 0 }} />
        </HoloPanel>

        <HoloPanel title="GLOBAL CHRONOMETER"     icon={Clock}     accent="#00d4ff"         maxHeight={260} defaultOpen={true}>
          <WorldClock />
        </HoloPanel>

        <HoloPanel title="INTEL FEED"             icon={Newspaper} accent="var(--red-alert)" maxHeight={400} defaultOpen={true} live>
          <IntelFeed articles={newsData} />
        </HoloPanel>
      </div>
    </>
  );
}