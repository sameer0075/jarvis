import React, { useState, useEffect, useCallback } from "react";
import { Folder, File, ArrowLeft, Search, X, ExternalLink, HardDrive, RefreshCw } from "lucide-react";

const API_BASE = "http://localhost:3001";

const QUICK_DIRS = [
  { label: "Downloads", path: "downloads", icon: "⬇️" },
  { label: "Desktop",   path: "desktop",   icon: "🖥️" },
  { label: "Documents", path: "documents", icon: "📁" },
  { label: "Pictures",  path: "pictures",  icon: "🖼️" },
  { label: "Music",     path: "music",     icon: "🎵" },
  { label: "Videos",    path: "videos",    icon: "🎬" },
];

function formatSize(size) {
  return size || "—";
}

export default function FileBrowser({ initialData, onClose }) {
  const [currentPath, setCurrentPath] = useState(null);
  const [entries,     setEntries]     = useState([]);
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching,   setSearching]   = useState(false);
  const [statusMsg,   setStatusMsg]   = useState(null);

  // Load from chat-triggered data
  useEffect(() => {
    if (initialData?.ok && initialData?.entries) {
      setCurrentPath(initialData.path);
      setEntries(initialData.entries);
    }
  }, [initialData]);

  const navigate = useCallback(async (dirPath) => {
    setLoading(true);
    setError(null);
    setSearchQuery("");
    try {
      const res  = await fetch(`${API_BASE}/api/fs/list?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      if (data.ok) {
        if (currentPath) setHistory((h) => [...h, currentPath]);
        setCurrentPath(data.path);
        setEntries(data.entries);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [currentPath]);

  const goBack = useCallback(() => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    navigate(prev);
  }, [history, navigate]);

  const handleOpen = useCallback(async (entry) => {
    console.log("[FS] Opening entry:", entry); 
    if (entry.type === "folder") {
      navigate(entry.path);
      return;
    }
    try {
      const res  = await fetch(`${API_BASE}/api/fs/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: entry.path }),
      });
      const data = await res.json();
      setStatusMsg(data.ok ? `Opened ${entry.name}` : `Error: ${data.error}`);
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (e) {
      setStatusMsg(`Error: ${e.message}`);
    }
  }, []);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res  = await fetch(
        `${API_BASE}/api/fs/search?path=${encodeURIComponent(currentPath || "home")}&query=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      if (data.ok) {
        setEntries(data.entries);
        setStatusMsg(`Found ${data.entries.length} results for "${searchQuery}"`);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, currentPath]);

  const clearSearch = () => {
    setSearchQuery("");
    if (currentPath) navigate(currentPath);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: "760px", maxHeight: "80vh",
        background: "rgba(2,4,8,0.98)",
        border: "1px solid rgba(0,212,255,0.2)",
        borderRadius: "4px",
        display: "flex", flexDirection: "column",
        boxShadow: "0 0 60px rgba(0,212,255,0.08)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "14px 20px",
          borderBottom: "1px solid rgba(0,212,255,0.1)",
          background: "rgba(0,212,255,0.03)",
          flexShrink: 0,
        }}>
          <HardDrive size={16} color="var(--arc-primary)" />
          <span style={{ fontFamily: "var(--font-display)", fontSize: "11px", letterSpacing: "0.2em", color: "var(--arc-primary)" }}>
            FILE SYSTEM
          </span>

          {/* Path breadcrumb */}
          {currentPath && (
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "11px",
              color: "rgba(0,212,255,0.4)", marginLeft: "8px",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "300px",
            }}>
              {currentPath}
            </span>
          )}

          <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            {history.length > 0 && (
              <button onClick={goBack} style={iconBtnStyle}>
                <ArrowLeft size={14} />
              </button>
            )}
            {currentPath && (
              <button onClick={() => navigate(currentPath)} style={iconBtnStyle} title="Refresh">
                <RefreshCw size={14} />
              </button>
            )}
            <button onClick={onClose} style={{ ...iconBtnStyle, color: "var(--red-alert)" }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Quick nav */}
        {!currentPath && (
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,212,255,0.06)" }}>
            <div style={{ fontSize: "9px", color: "var(--arc-dim)", letterSpacing: "0.2em", fontFamily: "var(--font-mono)", marginBottom: "12px" }}>
              QUICK ACCESS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {QUICK_DIRS.map((d) => (
                <button key={d.path} onClick={() => navigate(d.path)} style={quickDirStyle}>
                  <span style={{ fontSize: "20px" }}>{d.icon}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.1em" }}>{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search bar */}
        {currentPath && (
          <form onSubmit={handleSearch} style={{
            display: "flex", gap: "8px", padding: "12px 20px",
            borderBottom: "1px solid rgba(0,212,255,0.06)",
            flexShrink: 0,
          }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--arc-dim)" }} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                style={{
                  width: "100%", paddingLeft: "32px", paddingRight: searchQuery ? "32px" : "10px",
                  ...inputStyle,
                }}
              />
              {searchQuery && (
                <button type="button" onClick={clearSearch} style={{
                  position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", color: "var(--arc-dim)",
                  display: "flex",
                }}>
                  <X size={12} />
                </button>
              )}
            </div>
            <button type="submit" disabled={searching || !searchQuery.trim()} style={searchBtnStyle}>
              {searching ? "..." : "SEARCH"}
            </button>
          </form>
        )}

        {/* Status / error */}
        {(statusMsg || error) && (
          <div style={{
            padding: "8px 20px", fontFamily: "var(--font-mono)", fontSize: "11px",
            color: error ? "var(--red-alert)" : "var(--green-ok)",
            background: error ? "rgba(255,59,92,0.05)" : "rgba(6,214,160,0.05)",
            borderBottom: "1px solid rgba(0,212,255,0.06)",
            flexShrink: 0,
          }}>
            {error || statusMsg}
          </div>
        )}

        {/* File list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={centerStyle}>
              <div style={{ width: 24, height: 24, border: "2px solid var(--arc-dim)", borderTopColor: "var(--arc-primary)", borderRadius: "50%", animation: "rotate 0.8s linear infinite" }} />
            </div>
          ) : entries.length === 0 ? (
            <div style={{ ...centerStyle, flexDirection: "column", gap: "10px" }}>
              <Folder size={40} color="var(--arc-dim)" />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--arc-dim)", letterSpacing: "0.1em" }}>
                EMPTY DIRECTORY
              </span>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.06)" }}>
                  {["NAME", "SIZE", "MODIFIED"].map((h) => (
                    <th key={h} style={{
                      padding: "8px 20px", textAlign: "left",
                      fontFamily: "var(--font-mono)", fontSize: "9px",
                      color: "var(--arc-dim)", letterSpacing: "0.15em",
                      fontWeight: 400,
                    }}>{h}</th>
                  ))}
                  <th style={{ width: "40px" }} />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => (
                  <tr
                    key={i}
                    onDoubleClick={() => handleOpen(entry)}
                    style={{
                      borderBottom: "1px solid rgba(0,212,255,0.03)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgba(0,212,255,0.04)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "10px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "16px", flexShrink: 0 }}>{entry.icon}</span>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: "12px",
                          color: entry.type === "folder" ? "var(--arc-primary)" : "var(--text-primary)",
                          letterSpacing: "0.02em",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "300px",
                        }}>
                          {entry.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 20px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                      {formatSize(entry.size)}
                    </td>
                    <td style={{ padding: "10px 20px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                      {entry.modified}
                    </td>
                    <td style={{ padding: "10px 16px" }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpen(entry); }}
                        title={entry.type === "folder" ? "Open folder" : "Open file"}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--arc-dim)", display: "flex", padding: "4px" }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "var(--arc-primary)"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "var(--arc-dim)"}
                      >
                        {entry.type === "folder" ? <Folder size={13} /> : <ExternalLink size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div style={{
            padding: "8px 20px", borderTop: "1px solid rgba(0,212,255,0.06)",
            fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--arc-dim)",
            letterSpacing: "0.1em", flexShrink: 0,
          }}>
            {entries.length} ITEMS · DOUBLE-CLICK TO OPEN
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const iconBtnStyle = {
  background: "none", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "2px",
  color: "var(--arc-dim)", cursor: "pointer", padding: "5px",
  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
};

const quickDirStyle = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
  padding: "14px 10px",
  background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.08)",
  borderRadius: "3px", cursor: "pointer", color: "var(--text-dim)",
  transition: "all 0.2s", fontFamily: "var(--font-mono)",
};

const inputStyle = {
  background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.12)",
  borderRadius: "2px", color: "var(--text-primary)", fontFamily: "var(--font-mono)",
  fontSize: "12px", padding: "7px 10px", outline: "none", width: "100%",
};

const searchBtnStyle = {
  background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)",
  borderRadius: "2px", color: "var(--arc-primary)", fontFamily: "var(--font-mono)",
  fontSize: "10px", letterSpacing: "0.1em", padding: "7px 14px", cursor: "pointer",
  whiteSpace: "nowrap", transition: "all 0.2s",
};

const centerStyle = {
  display: "flex", alignItems: "center", justifyContent: "center",
  height: "200px", color: "var(--arc-dim)",
};