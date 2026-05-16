import React, { useState, useEffect, useCallback } from "react";
import { Folder, ArrowLeft, Search, X, ExternalLink, HardDrive, RefreshCw, FolderOpen } from "lucide-react";

const API_BASE = "http://localhost:3001";

const QUICK_DIRS = [
  { label: "Downloads", path: "downloads", icon: "⬇️" },
  { label: "Desktop",   path: "desktop",   icon: "🖥️" },
  { label: "Documents", path: "documents", icon: "📁" },
  { label: "Pictures",  path: "pictures",  icon: "🖼️" },
  { label: "Music",     path: "music",     icon: "🎵" },
  { label: "Videos",    path: "videos",    icon: "🎬" },
];

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatDate(dateVal) {
  if (!dateVal) return "—";
  try { return new Date(dateVal).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
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
  const [openingPath, setOpeningPath] = useState(null); // tracks which item is being opened
  const [viewTitle,   setViewTitle]   = useState(null); // "Search results for X"

  // Load from chat-triggered data (search results OR directory listing)
  useEffect(() => {
    if (!initialData) return;

    if (initialData.type === "search_files" && initialData.entries?.length > 0) {
      // Search results — show them with title, no currentPath (they're from multiple dirs)
      setEntries(normalizeEntries(initialData.entries));
      setCurrentPath(null);
      setViewTitle(`Search results for "${initialData.query}" (${initialData.count} found)`);
    } else if (initialData.ok && initialData.entries?.length > 0) {
      // Directory listing
      setCurrentPath(initialData.path);
      setEntries(normalizeEntries(initialData.entries));
      setViewTitle(null);
    }
  }, [initialData]);

  // Normalize entries from both search results and directory listings
  function normalizeEntries(raw) {
    return raw.map(e => ({
      name:        e.name,
      path:        e.path,
      type:        e.isDirectory !== undefined ? (e.isDirectory ? "folder" : "file") : e.type,
      icon:        e.icon || (e.isDirectory ? "📁" : "📎"),
      size:        e.size != null ? formatSize(e.size) : (e.sizeBytes != null ? formatSize(e.sizeBytes) : null),
      modified:    e.modified || formatDate(e.modifiedAt),
      ext:         e.extension || e.ext || null,
      score:       e.score,
    }));
  }

  const navigate = useCallback(async (dirPath) => {
    setLoading(true);
    setError(null);
    setSearchQuery("");
    setViewTitle(null);
    try {
      const res  = await fetch(`${API_BASE}/api/fs/list?path=${encodeURIComponent(dirPath)}`);
      const data = await res.json();
      if (data.ok) {
        if (currentPath) setHistory(h => [...h, currentPath]);
        setCurrentPath(data.path);
        setEntries(normalizeEntries(data.entries));
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
    setHistory(h => h.slice(0, -1));
    navigate(prev);
  }, [history, navigate]);

  // Open a file or folder
  const handleOpen = useCallback(async (entry) => {
    if (entry.type === "folder") {
      navigate(entry.path);
      return;
    }
    setOpeningPath(entry.path);
    try {
      const res  = await fetch(`${API_BASE}/api/fs/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: entry.path }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatusMsg(`✓ Opened: ${entry.name}`);
      } else {
        setError(`Failed to open: ${data.error}`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setOpeningPath(null);
      setTimeout(() => setStatusMsg(null), 3000);
    }
  }, [navigate]);

  // In-browser search using semanticSearch API
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/api/fs/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.ok && data.entries?.length > 0) {
        setEntries(normalizeEntries(data.entries));
        setViewTitle(`Search results for "${searchQuery}" (${data.count} found)`);
        setCurrentPath(null);
      } else if (data.ok) {
        setEntries([]);
        setViewTitle(`No results for "${searchQuery}"`);
      } else {
        setError(data.error);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery("");
    setViewTitle(null);
    if (currentPath) navigate(currentPath);
    else setEntries([]);
  };

  const isSearchResult = !!viewTitle;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: "800px", maxHeight: "82vh",
        background: "rgba(2,4,8,0.98)",
        border: "1px solid rgba(0,212,255,0.2)",
        borderRadius: "4px",
        display: "flex", flexDirection: "column",
        boxShadow: "0 0 60px rgba(0,212,255,0.08)",
        overflow: "hidden",
      }}>

        {/* ── Header ── */}
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

          {/* Breadcrumb or search title */}
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "10px",
            color: "rgba(0,212,255,0.4)", marginLeft: "4px",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "360px",
          }}>
            {viewTitle || currentPath || ""}
          </span>

          <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            {history.length > 0 && (
              <button onClick={goBack} style={iconBtnStyle} title="Back">
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

        {/* ── Quick dirs (only when no path and no results) ── */}
        {!currentPath && !isSearchResult && (
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(0,212,255,0.06)" }}>
            <div style={{ fontSize: "9px", color: "var(--arc-dim)", letterSpacing: "0.2em", fontFamily: "var(--font-mono)", marginBottom: "10px" }}>
              QUICK ACCESS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {QUICK_DIRS.map(d => (
                <button key={d.path} onClick={() => navigate(d.path)} style={quickDirStyle}>
                  <span style={{ fontSize: "18px" }}>{d.icon}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.1em" }}>{d.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Search bar (always visible) ── */}
        <form onSubmit={handleSearch} style={{
          display: "flex", gap: "8px", padding: "10px 20px",
          borderBottom: "1px solid rgba(0,212,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--arc-dim)" }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search files across all indexed folders..."
              style={{ width: "100%", paddingLeft: "32px", paddingRight: searchQuery ? "32px" : "10px", ...inputStyle, boxSizing: "border-box" }}
            />
            {searchQuery && (
              <button type="button" onClick={clearSearch} style={{
                position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--arc-dim)", display: "flex",
              }}>
                <X size={12} />
              </button>
            )}
          </div>
          <button type="submit" disabled={searching || !searchQuery.trim()} style={searchBtnStyle}>
            {searching ? "..." : "SEARCH"}
          </button>
        </form>

        {/* ── Status / error ── */}
        {(statusMsg || error) && (
          <div style={{
            padding: "7px 20px", fontFamily: "var(--font-mono)", fontSize: "11px",
            color: error ? "var(--red-alert)" : "var(--green-ok)",
            background: error ? "rgba(255,59,92,0.05)" : "rgba(6,214,160,0.05)",
            borderBottom: "1px solid rgba(0,212,255,0.06)",
            flexShrink: 0,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{error || statusMsg}</span>
            <button onClick={() => { setError(null); setStatusMsg(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}>
              <X size={11} />
            </button>
          </div>
        )}

        {/* ── File list ── */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={centerStyle}>
              <div style={{ width: 24, height: 24, border: "2px solid var(--arc-dim)", borderTopColor: "var(--arc-primary)", borderRadius: "50%", animation: "rotate 0.8s linear infinite" }} />
            </div>
          ) : entries.length === 0 ? (
            <div style={{ ...centerStyle, flexDirection: "column", gap: "10px" }}>
              <Folder size={40} color="var(--arc-dim)" />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--arc-dim)", letterSpacing: "0.1em" }}>
                {currentPath || isSearchResult ? "NO FILES FOUND" : "SELECT A FOLDER ABOVE"}
              </span>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.06)", position: "sticky", top: 0, background: "rgba(2,4,8,0.98)", zIndex: 1 }}>
                  {["NAME", "SIZE", "MODIFIED", ""].map((h, i) => (
                    <th key={i} style={{
                      padding: "8px 16px", textAlign: "left",
                      fontFamily: "var(--font-mono)", fontSize: "9px",
                      color: "var(--arc-dim)", letterSpacing: "0.15em", fontWeight: 400,
                      width: i === 3 ? "80px" : "auto",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, i) => {
                  const isOpening = openingPath === entry.path;
                  const isFolder  = entry.type === "folder";
                  return (
                    <tr
                      key={i}
                      onDoubleClick={() => handleOpen(entry)}
                      style={{
                        borderBottom: "1px solid rgba(0,212,255,0.03)",
                        cursor: "pointer", transition: "background 0.12s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(0,212,255,0.04)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {/* Name */}
                      <td style={{ padding: "9px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "15px", flexShrink: 0 }}>{entry.icon}</span>
                          <div>
                            <div style={{
                              fontFamily: "var(--font-mono)", fontSize: "12px",
                              color: isFolder ? "var(--arc-primary)" : "var(--text-primary)",
                              letterSpacing: "0.02em",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "340px",
                            }}>
                              {entry.name}
                            </div>
                            {/* Show path for search results */}
                            {isSearchResult && (
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "rgba(0,212,255,0.3)", marginTop: "2px",
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "340px" }}>
                                {entry.path}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Size */}
                      <td style={{ padding: "9px 16px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                        {isFolder ? "—" : entry.size || "—"}
                      </td>

                      {/* Modified */}
                      <td style={{ padding: "9px 16px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                        {entry.modified || "—"}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "9px 12px" }}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          {/* Open button */}
                          <button
                            onClick={e => { e.stopPropagation(); handleOpen(entry); }}
                            disabled={isOpening}
                            title={isFolder ? "Browse folder" : "Open file"}
                            style={{
                              background: isOpening ? "rgba(0,212,255,0.1)" : "none",
                              border: "1px solid rgba(0,212,255,0.15)",
                              borderRadius: "2px", cursor: isOpening ? "wait" : "pointer",
                              color: "var(--arc-dim)", display: "flex", padding: "4px 6px",
                              alignItems: "center", gap: "4px",
                              fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.08em",
                              transition: "all 0.15s",
                            }}
                            onMouseEnter={e => { if (!isOpening) { e.currentTarget.style.color = "var(--arc-primary)"; e.currentTarget.style.borderColor = "var(--arc-primary)"; }}}
                            onMouseLeave={e => { e.currentTarget.style.color = "var(--arc-dim)"; e.currentTarget.style.borderColor = "rgba(0,212,255,0.15)"; }}
                          >
                            {isOpening ? (
                              <div style={{ width: 10, height: 10, border: "1.5px solid var(--arc-dim)", borderTopColor: "var(--arc-primary)", borderRadius: "50%", animation: "rotate 0.8s linear infinite" }} />
                            ) : isFolder ? (
                              <FolderOpen size={11} />
                            ) : (
                              <ExternalLink size={11} />
                            )}
                            <span>{isFolder ? "BROWSE" : "OPEN"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Footer ── */}
        {entries.length > 0 && (
          <div style={{
            padding: "7px 20px", borderTop: "1px solid rgba(0,212,255,0.06)",
            fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--arc-dim)",
            letterSpacing: "0.1em", flexShrink: 0,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span>{entries.length} ITEMS</span>
            <span>DOUBLE-CLICK OR CLICK OPEN TO LAUNCH</span>
          </div>
        )}
      </div>
    </div>
  );
}

const iconBtnStyle = {
  background: "none", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "2px",
  color: "var(--arc-dim)", cursor: "pointer", padding: "5px",
  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
};
const quickDirStyle = {
  display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
  padding: "12px 8px",
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