import React, { useState, useEffect } from "react";
import { 
  Zap, Brain, Cloud, Clock, Newspaper, FolderOpen, Monitor, Eye, 
  MessageSquare, ChevronLeft, ChevronRight, Activity, Shield 
} from "lucide-react";

const AGENTS = [
  {
    id: "auto",
    name: "AUTO",
    fullName: "Auto Router",
    description: "Intelligent routing — JARVIS decides the best agent",
    icon: Brain,
    color: "#00d4ff",
    glowColor: "rgba(0,212,255,0.4)",
    bgColor: "rgba(0,212,255,0.08)",
    borderColor: "rgba(0,212,255,0.2)",
    activeBorder: "rgba(0,212,255,0.6)",
  },
  {
    id: "chat",
    name: "CHAT",
    fullName: "General Chat",
    description: "Open conversation on any topic",
    icon: MessageSquare,
    color: "#9e9e9e",
    glowColor: "rgba(158,158,158,0.3)",
    bgColor: "rgba(158,158,158,0.06)",
    borderColor: "rgba(158,158,158,0.15)",
    activeBorder: "rgba(158,158,158,0.5)",
  },
  {
    id: "weather",
    name: "WEATHER",
    fullName: "Weather Agent",
    description: "Forecasts, temperatures, conditions worldwide",
    icon: Cloud,
    color: "#4fc3f7",
    glowColor: "rgba(79,195,247,0.3)",
    bgColor: "rgba(79,195,247,0.06)",
    borderColor: "rgba(79,195,247,0.15)",
    activeBorder: "rgba(79,195,247,0.5)",
  },
  {
    id: "time",
    name: "TIME",
    fullName: "Time Agent",
    description: "World clocks, timezones, scheduling",
    icon: Clock,
    color: "#ab47bc",
    glowColor: "rgba(171,71,188,0.3)",
    bgColor: "rgba(171,71,188,0.06)",
    borderColor: "rgba(171,71,188,0.15)",
    activeBorder: "rgba(171,71,188,0.5)",
  },
  {
    id: "news",
    name: "NEWS",
    fullName: "News Agent",
    description: "Latest headlines and global events",
    icon: Newspaper,
    color: "#ffca28",
    glowColor: "rgba(255,202,40,0.3)",
    bgColor: "rgba(255,202,40,0.06)",
    borderColor: "rgba(255,202,40,0.15)",
    activeBorder: "rgba(255,202,40,0.5)",
  },
  {
    id: "filesystem",
    name: "FILES",
    fullName: "Filesystem Agent",
    description: "Search, browse, open files and folders",
    icon: FolderOpen,
    color: "#66bb6a",
    glowColor: "rgba(102,187,106,0.3)",
    bgColor: "rgba(102,187,106,0.06)",
    borderColor: "rgba(102,187,106,0.15)",
    activeBorder: "rgba(102,187,106,0.5)",
  },
  {
    id: "system",
    name: "SYSTEM",
    fullName: "System Agent",
    description: "Volume, brightness, apps, controls",
    icon: Monitor,
    color: "#ff7043",
    glowColor: "rgba(255,112,67,0.3)",
    bgColor: "rgba(255,112,67,0.06)",
    borderColor: "rgba(255,112,67,0.15)",
    activeBorder: "rgba(255,112,67,0.5)",
  }
];

function AgentCard({ agent, isSelected, isActive, onClick, index }) {
  const Icon = agent.icon;
  const [hovered, setHovered] = useState(false);
  const [pulsePhase, setPulsePhase] = useState(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setPulsePhase(p => (p + 1) % 4);
    }, 600);
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div
      onClick={() => onClick(agent.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        padding: "14px 16px",
        marginBottom: "8px",
        borderRadius: "4px",
        border: `1px solid ${isSelected ? agent.activeBorder : agent.borderColor}`,
        background: isSelected ? agent.bgColor : "rgba(2,4,8,0.6)",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)",
        transform: isSelected ? "translateX(4px)" : "translateX(0)",
        boxShadow: isSelected 
          ? `0 0 20px ${agent.glowColor}, inset 0 0 20px ${agent.glowColor}` 
          : hovered ? `0 0 12px ${agent.glowColor}` : "none",
        overflow: "hidden",
        animation: `agent-slide-in 0.4s ${index * 0.06}s ease-out both`,
      }}
    >
      {isSelected && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: "3px",
          background: agent.color,
          boxShadow: `0 0 10px ${agent.color}`,
        }} />
      )}

      {isActive && (
        <div style={{
          position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
          display: "flex", alignItems: "center", gap: "3px",
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 3, height: 3, borderRadius: "50%",
              background: agent.color,
              opacity: pulsePhase === i ? 1 : 0.3,
              transition: "opacity 0.2s",
              boxShadow: pulsePhase === i ? `0 0 4px ${agent.color}` : "none",
            }} />
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          width: 36, height: 36, borderRadius: "8px",
          background: isSelected ? `${agent.color}15` : "rgba(0,212,255,0.03)",
          border: `1px solid ${isSelected ? `${agent.color}40` : "rgba(0,212,255,0.08)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.3s",
          flexShrink: 0,
        }}>
          <Icon size={16} color={agent.color} style={{
            filter: isSelected ? `drop-shadow(0 0 4px ${agent.color})` : "none",
            transition: "filter 0.3s",
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-display)", fontSize: "11px",
            letterSpacing: "0.15em", color: isSelected ? agent.color : "var(--text-primary)",
            lineHeight: 1.3,
            transition: "color 0.3s",
            display: "flex", alignItems: "center", gap: "6px",
          }}>
            {agent.name}
            {agent.id === "auto" && (
              <Zap size={10} color={agent.color} style={{ opacity: 0.7 }} />
            )}
          </div>
          <div style={{
            fontFamily: "var(--font-mono)", fontSize: "9px",
            color: "var(--text-dim)", letterSpacing: "0.05em",
            marginTop: "3px", lineHeight: 1.4,
            opacity: hovered || isSelected ? 0.9 : 0.5,
            transition: "opacity 0.3s",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {agent.description}
          </div>
        </div>
      </div>

      {isSelected && (
        <div style={{
          position: "absolute", inset: 0,
          background: `linear-gradient(90deg, transparent, ${agent.glowColor}, transparent)`,
          opacity: 0.1,
          animation: "sweep 2s ease-in-out infinite",
          pointerEvents: "none",
        }} />
      )}
    </div>
  );
}

export default function AgentPanel({ selectedAgent, onSelectAgent, isOpen, onToggle, activeAgents = [] }) {
  const selectedAgentData = AGENTS.find(a => a.id === selectedAgent) || AGENTS[0];

  return (
    <>
      {!isOpen && (
        <button
          onClick={onToggle}
          style={{
            position: "absolute", left: "16px", top: "16px", zIndex: 20,
            background: "rgba(2,4,8,0.9)",
            border: "1px solid rgba(0,212,255,0.15)",
            borderRadius: "3px",
            padding: "8px 12px",
            color: "var(--arc-primary)",
            fontFamily: "var(--font-mono)", fontSize: "10px",
            letterSpacing: "0.1em",
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
            backdropFilter: "blur(8px)",
            transition: "all 0.2s",
          }}
        >
          <Shield size={12} />
          AGENTS
          <ChevronRight size={10} />
        </button>
      )}

      <div style={{
        width: isOpen ? "280px" : "0px",
        minWidth: isOpen ? "280px" : "0px",
        background: "rgba(2,4,8,0.92)",
        borderRight: isOpen ? "1px solid var(--border)" : "none",
        backdropFilter: "blur(16px)",
        display: "flex", flexDirection: "column",
        transition: "width 0.4s cubic-bezier(0.22,1,0.36,1), min-width 0.4s cubic-bezier(0.22,1,0.36,1)",
        overflow: "hidden",
        position: "relative", zIndex: 15,
      }}>
        {isOpen && (
          <>
            <div style={{
              padding: "16px 20px 12px",
              borderBottom: "1px solid rgba(0,212,255,0.08)",
              flexShrink: 0,
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: "12px",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                }}>
                  <Activity size={14} color="var(--arc-primary)" />
                  <span style={{
                    fontFamily: "var(--font-display)", fontSize: "12px",
                    letterSpacing: "0.2em", color: "var(--arc-primary)",
                  }}>
                    AGENT SELECTOR
                  </span>
                </div>
                <button
                  onClick={onToggle}
                  style={{
                    background: "none", border: "none",
                    color: "var(--text-dim)", cursor: "pointer",
                    padding: "4px", display: "flex",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--arc-primary)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--text-dim)"}
                >
                  <ChevronLeft size={14} />
                </button>
              </div>

              <div style={{
                padding: "10px 12px",
                borderRadius: "3px",
                border: `1px solid ${selectedAgentData.borderColor}`,
                background: selectedAgentData.bgColor,
                display: "flex", alignItems: "center", gap: "10px",
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: selectedAgentData.color,
                  boxShadow: `0 0 8px ${selectedAgentData.color}`,
                  animation: selectedAgent === "auto" ? "pulse 2s infinite" : "none",
                }} />
                <div>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: "10px",
                    color: selectedAgentData.color, letterSpacing: "0.1em",
                  }}>
                    {selectedAgentData.fullName.toUpperCase()}
                  </div>
                  <div style={{
                    fontFamily: "var(--font-mono)", fontSize: "8px",
                    color: "var(--text-dim)", marginTop: "2px",
                    letterSpacing: "0.05em",
                  }}>
                    {selectedAgent === "auto" 
                      ? "INTELLIGENT ROUTING ACTIVE" 
                      : `CONTEXT LOCKED TO ${selectedAgentData.name}`}
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              flex: 1, overflowY: "auto",
              padding: "12px 16px",
            }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "8px",
                color: "var(--arc-dim)", letterSpacing: "0.2em",
                marginBottom: "10px", paddingLeft: "4px",
              }}>
                SELECT MODE
              </div>

              {AGENTS.map((agent, i) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isSelected={selectedAgent === agent.id}
                  isActive={activeAgents.includes(agent.id)}
                  onClick={onSelectAgent}
                  index={i}
                />
              ))}
            </div>

            <div style={{
              padding: "12px 16px",
              borderTop: "1px solid rgba(0,212,255,0.06)",
              flexShrink: 0,
            }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: "8px",
                color: "var(--text-dim)", letterSpacing: "0.1em",
                lineHeight: 1.6, opacity: 0.6,
              }}>
                {selectedAgent === "auto" 
                  ? "JARVIS analyzes intent and routes to the most appropriate agent automatically."
                  : `Only ${selectedAgentData.name}-related queries will be processed. Other topics will be politely declined.`}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}