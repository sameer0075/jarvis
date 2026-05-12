const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/api/chat/stream" });

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

// ─── Config ───────────────────────────────────────────────────────────────────
const OLLAMA_HOST = "127.0.0.1";
const OLLAMA_PORT = 11434;
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  🤖 JARVIS SERVER STARTING");
console.log(`  Ollama: http://${OLLAMA_HOST}:${OLLAMA_PORT}`);
console.log(`  Model:  ${DEFAULT_MODEL}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// ─── Sessions ─────────────────────────────────────────────────────────────────
const sessions = new Map();

const SYSTEM_PROMPT = `You are Jarvis, a highly intelligent AI assistant inspired by Iron Man's JARVIS.
You are sharp, witty, and concise. You speak with calm confidence.

ACTION RULES — ONLY add action tags when the user EXPLICITLY asks to open, visit, browse, or go to a website:
1. If the user explicitly asks to open a specific website (e.g., "open Google Maps", "open github", "visit youtube"), add at the VERY END of your reply:
   [ACTION:OPEN_URL:https://maps.google.com]
   CRITICAL: Use the EXACT real URL for the site requested. Do NOT substitute with google.com or a search link.
   Examples:
   - "open Google Maps" → [ACTION:OPEN_URL:https://maps.google.com]
   - "open GitHub" → [ACTION:OPEN_URL:https://github.com]
   - "open YouTube" → [ACTION:OPEN_URL:https://youtube.com]
   - "open Wikipedia" → [ACTION:OPEN_URL:https://wikipedia.org]
2. If the user explicitly says "search" or "look up", add at the END:
   [ACTION:SEARCH:user's exact query]
3. If the user did NOT ask to open a site or search, do NOT add any action tags.
4. Use markdown formatting when helpful.`;

function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, [{ role: "system", content: SYSTEM_PROMPT }]);
    console.log(`[SESSION] Created new session: ${id}`);
  }
  return sessions.get(id);
}

// ─── Parse Actions ────────────────────────────────────────────────────────────
function parseActions(text) {
  const actions = [];
  const urlRe = /\[ACTION:OPEN_URL:([^\]]+)\]/g;
  const searchRe = /\[ACTION:SEARCH:([^\]]+)\]/g;
  let m;
  while ((m = urlRe.exec(text))) {
    let url = m[1].trim();
    if (!url.startsWith("http")) url = "https://" + url;
    actions.push({ type: "OPEN_URL", value: url });
  }
  while ((m = searchRe.exec(text))) actions.push({ type: "SEARCH", value: m[1].trim() });
  const cleanText = text.replace(/\[ACTION:[^\]]+\]/g, "").trim();
  return { cleanText, actions };
}

// ─── Ollama GET helper ────────────────────────────────────────────────────────
function ollamaGet(path) {
  return new Promise((resolve, reject) => {
    console.log(`[OLLAMA GET] ${path}`);
    const req = http.request(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path, method: "GET" },
      (res) => {
        let data = "";
        console.log(`[OLLAMA GET] ${path} → status ${res.statusCode}`);
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error("Bad JSON: " + data.slice(0, 100))); }
        });
      }
    );
    req.on("error", (e) => {
      console.error(`[OLLAMA GET ERROR] ${path}:`, e.message);
      reject(e);
    });
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("Ollama GET timeout"));
    });
    req.end();
  });
}

// ─── Ollama POST non-streaming ────────────────────────────────────────────────
function ollamaPost(bodyObj) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(bodyObj);
    console.log(`[OLLAMA POST] model=${bodyObj.model} messages=${bodyObj.messages.length} stream=false`);

    const req = http.request(
      {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: "/api/chat",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyStr),
        },
      },
      (res) => {
        let data = "";
        console.log(`[OLLAMA POST] response status: ${res.statusCode}`);
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          console.log(`[OLLAMA POST] response received, length=${data.length}`);
          try { resolve(JSON.parse(data)); }
          catch (e) {
            console.error("[OLLAMA POST] JSON parse error:", data.slice(0, 300));
            reject(new Error("Bad JSON from Ollama"));
          }
        });
      }
    );

    req.on("error", (e) => {
      console.error("[OLLAMA POST ERROR]", e.message);
      reject(new Error("Ollama unreachable: " + e.message));
    });
    req.setTimeout(180000, () => {
      req.destroy();
      reject(new Error("Ollama POST timed out (180s)"));
    });
    req.write(bodyStr);
    req.end();
  });
}

// ─── Ollama POST streaming ────────────────────────────────────────────────────
function ollamaStream(bodyObj, onChunk, onDone, onError) {
  const bodyStr = JSON.stringify(bodyObj);
  console.log(`[STREAM] Starting stream: model=${bodyObj.model} messages=${bodyObj.messages.length}`);

  const req = http.request(
    {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    },
    (res) => {
      console.log(`[STREAM] Ollama response status: ${res.statusCode}`);
      let buf = "";
      let full = "";
      let finished = false;
      let chunkCount = 0;

      function processLines(lines) {
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);

      // ─── FIX: Handle Ollama error responses in stream ───
      if (obj.error) {
        console.error(`[STREAM] Ollama error: ${obj.error}`);
        if (!finished) {
          finished = true;
          onError(new Error(obj.error));
        }
        return; // stop processing further lines
      }

      const content = obj.message?.content || "";
      if (content) {
        full += content;
        chunkCount++;
        if (chunkCount <= 3 || chunkCount % 20 === 0) {
          console.log(`[STREAM] chunk #${chunkCount}: "${content.slice(0, 30)}"`);
        }
        onChunk(content);
      }
      if (obj.done) {
        console.log(`[STREAM] ✅ done=true received. Total chunks: ${chunkCount}, text length: ${full.length}`);
        if (!finished) {
          finished = true;
          onDone(full);
        }
      }
    } catch (e) {
      if (line.trim()) console.warn(`[STREAM] JSON parse fail: ${line.slice(0, 80)}`);
    }
  }
}

      res.on("data", (chunk) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop(); // keep incomplete last line
        processLines(lines);
      });

      res.on("end", () => {
        console.log(`[STREAM] Response ended. buf remaining: "${buf.slice(0,80)}" finished=${finished}`);
        if (buf.trim()) processLines([buf]);
        buf = "";
        if (!finished) {
          console.log(`[STREAM] ⚠️ done never received — forcing completion. full.length=${full.length}`);
          finished = true;
          onDone(full);
        }
      });

      res.on("error", (e) => {
        console.error("[STREAM] Response error:", e.message);
        onError(e);
      });
    }
  );

  req.on("error", (e) => {
    console.error("[STREAM] Request error:", e.message);
    onError(new Error("Ollama unreachable: " + e.message));
  });
  req.setTimeout(180000, () => {
    req.destroy();
    console.error("[STREAM] ⏰ Timed out after 180s");
    onError(new Error("Ollama stream timed out (180s)"));
  });
  req.write(bodyStr);
  req.end();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get("/api/status", async (req, res) => {
  console.log("[API] GET /api/status");
  try {
    const data = await ollamaGet("/api/tags");
    const models = data.models || [];
    console.log(`[API] status: online, ${models.length} models found:`, models.map(m => m.name));
    res.json({ status: "online", model: DEFAULT_MODEL, ollamaUrl: `http://${OLLAMA_HOST}:${OLLAMA_PORT}`, models });
  } catch (e) {
    console.error("[API] status: offline -", e.message);
    res.json({ status: "offline", model: DEFAULT_MODEL, ollamaUrl: `http://${OLLAMA_HOST}:${OLLAMA_PORT}`, models: [] });
  }
});

app.get("/api/models", async (req, res) => {
  console.log("[API] GET /api/models");
  try {
    const data = await ollamaGet("/api/tags");
    const models = data.models || [];
    console.log("[API] models:", models.map(m => m.name));
    res.json({ models });
  } catch (e) {
    console.error("[API] models error:", e.message);
    res.status(503).json({ error: e.message, models: [] });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message, sessionId = "default", model } = req.body;
  console.log(`[API] POST /api/chat session=${sessionId} model=${model} msg="${message?.slice(0,50)}"`);

  if (!message) return res.status(400).json({ error: "message is required" });

  const msgs = getSession(sessionId);
  msgs.push({ role: "user", content: message });
  console.log(`[API] Session has ${msgs.length} messages`);

  try {
    const data = await ollamaPost({ model: model || DEFAULT_MODEL, messages: msgs, stream: false });
    if (data.error) throw new Error(data.error); // add this line
    const rawText = data.message?.content || data.response || "";
    console.log(`[API] Got reply, length=${rawText.length}, first 80: "${rawText.slice(0,80)}"`);
    const { cleanText, actions } = parseActions(rawText);
    msgs.push({ role: "assistant", content: rawText });
    res.json({ reply: cleanText, actions, model: data.model || model, sessionId });
  } catch (e) {
    msgs.pop();
    console.error("[API] chat error:", e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/clear", (req, res) => {
  const id = req.body?.sessionId || "default";
  sessions.delete(id);
  console.log(`[API] Cleared session: ${id}`);
  res.json({ ok: true });
});

// ─── WebSocket ────────────────────────────────────────────────────────────────
wss.on("connection", (ws, req) => {
  console.log(`[WS] New connection from ${req.socket.remoteAddress}`);
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", (raw) => {
    let payload;
    try { payload = JSON.parse(raw.toString()); }
    catch { ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" })); return; }

    const { message, sessionId = "default", model } = payload;
    console.log(`[WS] Message: session=${sessionId} model=${model} msg="${message?.slice(0,50)}"`);

    if (!message) { ws.send(JSON.stringify({ type: "error", error: "message required" })); return; }

    const msgs = getSession(sessionId);
    msgs.push({ role: "user", content: message });

    let doneCalled = false;

    ollamaStream(
      { model: model || DEFAULT_MODEL, messages: msgs, stream: true, think: false },
      (chunk) => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: "chunk", content: chunk }));
      },
      (fullText) => {
        if (doneCalled) return;
        doneCalled = true;
        const { cleanText, actions } = parseActions(fullText);
        msgs.push({ role: "assistant", content: fullText });
        console.log(`[WS] Sending done to client. actions=${actions.length} textLen=${cleanText.length}`);
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: "done", actions, fullText: cleanText }));
      },
      (err) => {
        msgs.pop();
        console.error("[WS] Stream error:", err.message);
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: "error", error: err.message }));
      }
    );
  });

  ws.on("close", (code, reason) => {
    console.log(`[WS] Connection closed: code=${code} reason=${reason}`);
  });
  ws.on("error", (e) => console.error("[WS] Socket error:", e.message));
});

// Keepalive ping
const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) { console.log("[WS] Terminating dead connection"); ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);
wss.on("close", () => clearInterval(pingInterval));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n✅ Jarvis listening on http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}/api/chat/stream\n`);

  // Test Ollama on startup
  ollamaGet("/api/tags")
    .then((d) => {
      const names = (d.models || []).map(m => m.name);
      console.log(`✅ Ollama connected! Models available: ${names.join(", ") || "(none)"}`);
      if (!names.length) {
        console.warn("⚠️  No models found! Run: ollama pull llama3.2");
      }
    })
    .catch((e) => {
      console.error(`❌ Cannot reach Ollama: ${e.message}`);
      console.error("   → Run: ollama serve");
    });
});