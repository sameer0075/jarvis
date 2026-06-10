import { useState, useRef, useCallback, useEffect } from "react";

const SESSION_ID = `jarvis_${Date.now()}`;
const API_BASE = "http://localhost:3001";
const WS_BASE = "ws://localhost:3001";

export function useJarvis() {
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Good day. I am **JARVIS** — Just A Rather Very Intelligent System.\n\nSelect an agent from the left panel, or keep AUTO mode for intelligent routing. How may I assist you today?",
      actions: [],
      ts: Date.now(),
      activeAgents: ["auto"],
    },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [model, setModel] = useState("llama3.2");
  const [models, setModels] = useState([]);
  const [status, setStatus] = useState("checking");
  const [selectedAgent, setSelectedAgent] = useState("auto");

  useEffect(() => {
    checkStatus();
    fetchModels();
  }, []);

  const checkStatus = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/status`);
      const d = await r.json();
      setStatus(d.status);
      if (d.model) setModel(d.model);
    } catch {
      setStatus("offline");
    }
  };

  const fetchModels = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/models`);
      const d = await r.json();
      if (d.models?.length) {
        setModels(d.models.map((m) => m.name));
        setModel(d.models[0].name);
      }
    } catch {}
  };

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: `${Date.now()}_${Math.random()}`, ...msg }]);
  }, []);

  const sendMessage = useCallback(
    async (text, agentMode = "auto") => {
      if (!text.trim() || isThinking) return;

      const userMsg = { 
        id: `u_${Date.now()}`, 
        role: "user", 
        content: text, 
        actions: [], 
        ts: Date.now(),
        activeAgents: [agentMode],
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);

      const streamId = `s_${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: streamId, role: "assistant", content: "", actions: [], ts: Date.now(), streaming: true, activeAgents: [] },
      ]);

      let wsSuccess = false;
      try {
        await new Promise((resolve, reject) => {
          const ws = new WebSocket(`${WS_BASE}/api/chat/stream`);

          const timeout = setTimeout(() => {
            ws.close();
            reject(new Error("WS connection timeout"));
          }, 5000);

          ws.onopen = () => {
            clearTimeout(timeout);
            wsSuccess = true;
            ws.send(JSON.stringify({ 
              message: text, 
              sessionId: SESSION_ID, 
              model,
              selectedAgent: agentMode,
            }));
          };

          ws.onmessage = (e) => {
            const data = JSON.parse(e.data);

            if (data.type === "status") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamId
                    ? { ...m, content: data.content, streaming: true, isStatus: true }
                    : m
                )
              );
              return;
            }

            if (data.type === "chunk") {
              setMessages((prev) =>
                prev.map((m) => (m.id === streamId ? { ...m, content: m.content + data.content } : m))
              );
            } else if (data.type === "done") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamId
                    ? {
                        ...m,
                        content: data.fullText,
                        actions: data.actions || [],
                        widgetData: data.widgetData || null,
                        streaming: false,
                        activeAgents: data.activeAgents || [],
                      }
                    : m
                )
              );
              setIsThinking(false);
              ws.close();
              resolve();
            } else if (data.type === "error") {
              ws.close();
              reject(new Error(data.error));
            }
          };

          ws.onerror = () => {
            clearTimeout(timeout);
            reject(new Error("WebSocket failed"));
          };

          ws.onclose = (e) => {
            if (!wsSuccess) reject(new Error("WS closed before connecting"));
          };
        });
      } catch (wsErr) {
        console.warn("WS failed, falling back to HTTP:", wsErr.message);

        try {
          const r = await fetch(`${API_BASE}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              message: text, 
              sessionId: SESSION_ID, 
              model,
              selectedAgent: agentMode,
            }),
          });

          if (!r.ok) {
            const errData = await r.json().catch(() => ({}));
            throw new Error(errData.error || `Server error ${r.status}`);
          }

          const d = await r.json();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId
                ? { 
                    ...m, 
                    content: d.reply, 
                    actions: d.actions || [],
                    widgetData: d.widgetData || null, 
                    streaming: false,
                    activeAgents: d.activeAgents || [],
                  }
                : m
            )
          );
        } catch (httpErr) {
          const errMsg =
            httpErr.message.includes("fetch") || httpErr.message.includes("Failed")
              ? "⚠️ Cannot reach Jarvis server.\n\n**Make sure the server is running:**\n```\nnpm run server\n```\nOr check that Ollama is running: `ollama serve`"
              : `⚠️ ${httpErr.message}`;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamId ? { ...m, content: errMsg, actions: [], streaming: false } : m
            )
          );
        } finally {
          setIsThinking(false);
        }
      }
    },
    [isThinking, model]
  );

  const clearChat = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: SESSION_ID }),
      });
    } catch {}
    setMessages([
      {
        id: `w_${Date.now()}`,
        role: "assistant",
        content: "Memory cleared. Ready for a fresh session, sir.",
        actions: [],
        widgetData: null,
        ts: Date.now(),
        activeAgents: ["auto"],
      },
    ]);
  }, []);

  return { messages, isThinking, model, models, status, selectedAgent, setModel, setSelectedAgent, sendMessage, clearChat, checkStatus };
}