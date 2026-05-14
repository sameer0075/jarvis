const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/api/chat/stream" });

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

const OLLAMA_HOST = "127.0.0.1";
const OLLAMA_PORT = 11434;
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "qwen3.5:9b";

// ─── Simple TTL Cache ──────────────────────────────────────────────────────────
const cache = new Map();
function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) { cache.delete(key); return null; }
  return entry.value;
}
function cacheSet(key, value, ttlMs) {
  cache.set(key, { value, ts: Date.now(), ttl: ttlMs });
}

// ─── Pure regex entity extraction — no LLM, instant ──────────────────────────
function extractEntities(message) {
  const msg = message.toLowerCase().trim();
  const result = { city: null, newsQuery: null, hasWeather: false, hasTime: false, hasNews: false };

  result.hasWeather = /\bweather\b/.test(msg);
  result.hasTime    = /\b(time|clock|what time)\b/.test(msg);
  result.hasNews    = /\b(news|headlines?|latest|breaking)\b/.test(msg);

  if (result.hasWeather || result.hasTime) {
    // Strip all non-city words, what's left is the city
    const city = msg
      .replace(/\b(tell|me|show|what|is|are|the|weather|time|of|in|at|for|today|now|current|currently|please|can|you|give|get|about|clock|right|how|whats|what's|latest|a|an|do|does|i|want|need|check|look|up|find|jarvis|hey|hi|hello|forecast|temperature|temp|outside|like|its|it's|going|gonna)\b/g, " ")
      .replace(/[?.,!'"]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (city.length > 1) {
      result.city = city.split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  if (result.hasNews) {
    const m = msg.match(/(?:news|latest|headlines?)\s+(?:about|on|for|regarding)?\s*(.+?)(?:\?|$)/);
    if (m) {
      result.newsQuery = m[1].trim();
    } else {
      result.newsQuery = msg
        .replace(/\b(news|latest|headlines?|give|me|show|tell|about|get|the|what|is|are)\b/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  console.log("[ENTITY]", result);
  return result;
}

function regexFallback(message) {
  const msg = message.toLowerCase();
  const result = { city: null, newsQuery: null, hasWeather: false, hasTime: false, hasNews: false };

  result.hasWeather = /weather/.test(msg);
  result.hasTime = /\b(time|clock|what time)\b/.test(msg);
  result.hasNews = /\b(news|headline|latest|breaking)\b/.test(msg);

  if (result.hasWeather || result.hasTime) {
    const stripped = msg
      .replace(/\b(tell|me|show|what|is|the|weather|time|of|in|at|for|today|now|current|currently|please|can|you|give|get|about|clock|right|how|whats|latest|a|an)\b/g, " ")
      .replace(/[?.,!]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (stripped.length > 1) {
      result.city = stripped.split(" ")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }
  }

  if (result.hasNews) {
    const m = msg.match(/(?:news|latest|headlines?)\s+(?:about|on|for|regarding)?\s*(.+?)(?:\?|$)/);
    result.newsQuery = m ? m[1].trim() : msg.replace(/\b(news|latest|headlines?|give|me|show|tell|about|get)\b/g, "").trim();
  }

  console.log("[ENTITY FALLBACK]", result);
  return result;
}

// ─── System Prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are JARVIS, Tony Stark's AI. Sharp, witty, concise.

When you see [TOOL: name] ... [/TOOL] blocks in the conversation, those are real-time data results. Use that exact data in your response — never make up numbers.

To open a website, append at the END of your response:
[ACTION:OPEN_URL:https://example.com]

To search, append:
[ACTION:SEARCH:query]

Format responses in clean markdown.`;

const sessions = new Map();
function getSession(id) {
  if (!sessions.has(id)) sessions.set(id, [{ role: "system", content: SYSTEM_PROMPT }]);
  return sessions.get(id);
}

// ─── Action Parser ─────────────────────────────────────────────────────────────
function parseActions(text) {
  const actions = [];
  let m;
  const urlRe = /\[ACTION:OPEN_URL:([^\]]+)\]/gi;
  const searchRe = /\[ACTION:SEARCH:([^\]]+)\]/gi;
  while ((m = urlRe.exec(text))) {
    let url = m[1].trim();
    if (!url.startsWith("http")) url = "https://" + url;
    actions.push({ type: "OPEN_URL", value: url });
  }
  while ((m = searchRe.exec(text))) actions.push({ type: "SEARCH", value: m[1].trim() });
  return { cleanText: text.replace(/\[ACTION:[^\]]+\]/gi, "").trim(), actions };
}

// ─── Tool Implementations ──────────────────────────────────────────────────────
async function fetchWeather(city) {
  const API_KEY = process.env.OPENWEATHER_API_KEY || "ab6b0d793b99c916055d6beeadc44e9e";
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=metric`,
      { signal: AbortSignal.timeout(6000) }
    );
    const d = await res.json();
    if (d.cod !== 200) return JSON.stringify({ error: d.message });
    const result = JSON.stringify({
      city: d.name, country: d.sys.country,
      temp: Math.round(d.main.temp),
      feels_like: Math.round(d.main.feels_like),
      humidity: d.main.humidity,
      wind_kph: Math.round(d.wind.speed * 3.6),
      description: d.weather[0].description,
      icon: d.weather[0].icon,
    });
    console.log(":result weather",result)
    return result;
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

function getTime(city) {
  const tzMap = {
    tokyo: "Asia/Tokyo", london: "Europe/London", paris: "Europe/Paris",
    "new york": "America/New_York", "los angeles": "America/Los_Angeles",
    dubai: "Asia/Dubai", sydney: "Australia/Sydney", berlin: "Europe/Berlin",
    singapore: "Asia/Singapore", chicago: "America/Chicago", moscow: "Europe/Moscow",
    beijing: "Asia/Shanghai", mumbai: "Asia/Kolkata", karachi: "Asia/Karachi",
    istanbul: "Europe/Istanbul", toronto: "America/Toronto", lahore: "Asia/Karachi",
    delhi: "Asia/Kolkata", dhaka: "Asia/Dhaka",
  };
  const key = city.toLowerCase();
  const tz = Object.entries(tzMap).find(([k]) => key.includes(k))?.[1];
  if (!tz) return `Unknown city: "${city}"`;
  return new Date().toLocaleString("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "medium" }) + ` (${tz})`;
}

async function fetchNews(query) {
  const key = `news:${query.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) { console.log(`[CACHE] News hit: ${query}`); return cached; }

  const API_KEY = process.env.NEWS_API_KEY || "a9e145f998364e4488754faa0f8966f2";
  try {
    const res = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${API_KEY}`,
      { signal: AbortSignal.timeout(6000) }
    );
    const d = await res.json();
    if (d.status !== "ok") return JSON.stringify({ error: d.message });
    const result = d.articles
      .map(a => `• ${a.title} (${a.source.name}, ${new Date(a.publishedAt).toLocaleDateString()})`)
      .join("\n");
    cacheSet(key, result, 10 * 60 * 1000); // 10 min cache
    return result;
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

// ─── Execute tools in PARALLEL ────────────────────────────────────────────────
async function executeToolsParallel(intents) {
  const results = await Promise.all(
    intents.map(async ({ tool, args }) => {
      console.log(`[TOOL] Executing: ${tool}`, args);
      let result;
      if (tool === "get_weather") result = await fetchWeather(args.city);
      else if (tool === "get_time") result = getTime(args.city);
      else if (tool === "get_news") result = await fetchNews(args.query);
      else result = JSON.stringify({ error: `Unknown tool: ${tool}` });
      console.log(`[TOOL] Done: ${tool} → ${result.slice(0, 80)}`);
      return { tool, args, result };
    })
  );
  return results;
}

// ─── Build widget data from results ───────────────────────────────────────────
function buildWidgetData(toolResults) {
  const widgetData = { weather: null, news: null };
  for (const { tool, result } of toolResults) {
    if (tool === "get_weather") {
      try { widgetData.weather = JSON.parse(result); } catch {}
    }
    if (tool === "get_news") {
      widgetData.news = result.split("\n").filter(Boolean).map(line => {
        const m = line.match(/•\s(.+?)\s\((.+?),\s(.+?)\)/);
        return m ? { title: m[1], source: m[2], time: m[3] } : null;
      }).filter(Boolean);
    }
  }
  return widgetData;
}

// ─── Build tool-injected user message ─────────────────────────────────────────
function buildEnrichedMessage(originalMessage, toolResults) {
  if (!toolResults.length) return originalMessage;
  const toolBlock = toolResults.map(({ tool, result }) =>
    `[TOOL: ${tool}]\n${result}\n[/TOOL]`
  ).join("\n\n");
  return `${originalMessage}\n\n<tool_results>\n${toolBlock}\n</tool_results>\n\nAnswer using the tool results above.`;
}

// ─── Ollama helpers ────────────────────────────────────────────────────────────
function ollamaPost(bodyObj) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(bodyObj);
    const req = http.request(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: "/api/chat", method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) } },
      (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error("Bad JSON: " + data.slice(0, 200))); }
        });
      }
    );
    req.on("error", e => reject(new Error("Ollama unreachable: " + e.message)));
    req.setTimeout(180000, () => { req.destroy(); reject(new Error("POST timeout")); });
    req.write(bodyStr);
    req.end();
  });
}

function ollamaStream(bodyObj, onChunk, onDone, onError) {
  const bodyStr = JSON.stringify(bodyObj);
  let finished = false;
  const req = http.request(
    { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: "/api/chat", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) } },
    (res) => {
      let buf = "", full = "";
      function processLines(lines) {
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.error) { if (!finished) { finished = true; onError(new Error(obj.error)); } return; }
            const content = obj.message?.content || "";
            if (content) { full += content; onChunk(content); }
            if (obj.done) { if (!finished) { finished = true; onDone(full); } }
          } catch {}
        }
      }
      res.on("data", chunk => { buf += chunk.toString(); const lines = buf.split("\n"); buf = lines.pop(); processLines(lines); });
      res.on("end", () => { if (buf.trim()) processLines([buf]); if (!finished) { finished = true; onDone(full); } });
    }
  );
  req.on("error", e => { if (!finished) { finished = true; onError(new Error("Ollama unreachable: " + e.message)); } });
  req.setTimeout(180000, () => { req.destroy(); if (!finished) { finished = true; onError(new Error("Stream timeout")); } });
  req.write(bodyStr);
  req.end();
}

function ollamaGet(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path, method: "GET" },
      (res) => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error("Bad JSON")); } });
      }
    );
    req.on("error", e => reject(e));
    req.setTimeout(5000, () => { req.destroy(); reject(new Error("GET timeout")); });
    req.end();
  });
}

// ─── FAST Chat Handler ────────────────────────────────────────────────────────
// Strategy:
//   1. Detect tool intents from message text (no round-1 LLM call)
//   2. Fetch all tools IN PARALLEL
//   3. Inject results into the single Ollama call
//   Total: max(tool_fetch_time, ~0) + one_llm_call  (vs old: llm_call + tool_fetch + llm_call)
async function runChat(messages, model, stream = false, onChunk = null) {
  const modelName = model || DEFAULT_MODEL;
  const lastUser = messages.findLast(m => m.role === "user");
  const userText = lastUser?.content || "";

  // Instant — no await needed
  const entities = extractEntities(userText);

  const intents = [];
  if (entities.hasWeather && entities.city)
    intents.push({ tool: "get_weather", args: { city: entities.city } });
  if (entities.hasTime && entities.city)
    intents.push({ tool: "get_time", args: { city: entities.city } });
  if (entities.hasNews && entities.newsQuery)
    intents.push({ tool: "get_news", args: { query: entities.newsQuery } });

  // Fetch all tools in parallel
  let toolResults = [];
  let widgetData = null;

  if (intents.length > 0) {
    const t0 = Date.now();
    toolResults = await executeToolsParallel(intents);
    console.log(`[TOOLS] fetched in ${Date.now() - t0}ms`);
    widgetData = buildWidgetData(toolResults);
  }

  const enrichedMessages = messages.map((msg) => {
    if (msg === lastUser && toolResults.length > 0) {
      return { ...msg, content: buildEnrichedMessage(msg.content, toolResults) };
    }
    return msg;
  });

  if (stream && onChunk) {
    return new Promise((resolve, reject) => {
      ollamaStream(
        { model: modelName, messages: enrichedMessages, stream: true, think: false, options: { 
      num_predict: 300,   // max tokens to generate
      num_ctx: 2048,      // smaller context window = faster
    } },
        onChunk,
        (fullText) => {
          const { cleanText, actions } = parseActions(fullText);
          resolve({ text: cleanText, raw: fullText, actions, widgetData });
        },
        reject
      );
    });
  } else {
    const data = await ollamaPost({ model: modelName, messages: enrichedMessages, stream: false });
    if (data.error) throw new Error(data.error);
    const fullText = data.message?.content || "";
    const { cleanText, actions } = parseActions(fullText);
    return { text: cleanText, raw: fullText, actions, widgetData };
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/api/status", async (req, res) => {
  try {
    const data = await ollamaGet("/api/tags");
    res.json({ status: "online", model: DEFAULT_MODEL, models: data.models || [] });
  } catch {
    res.json({ status: "offline", model: DEFAULT_MODEL, models: [] });
  }
});

app.get("/api/models", async (req, res) => {
  try {
    const data = await ollamaGet("/api/tags");
    res.json({ models: data.models || [] });
  } catch (e) {
    res.status(503).json({ error: e.message, models: [] });
  }
});

app.post("/api/clear", (req, res) => {
  sessions.delete(req.body?.sessionId || "default");
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const { message, sessionId = "default", model } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });

  const msgs = getSession(sessionId);
  const userMsg = { role: "user", content: message };
  const conversation = [...msgs, userMsg];

  try {
    const result = await runChat(conversation, model, false);
    msgs.push(userMsg);
    msgs.push({ role: "assistant", content: result.raw });
    res.json({ reply: result.text, actions: result.actions, widgetData: result.widgetData, sessionId });
  } catch (e) {
    console.error("[API]", e.message);
    res.status(500).json({ error: e.message });
  }
});

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  ws.on("message", async (raw) => {
    let payload;
    try { payload = JSON.parse(raw.toString()); }
    catch { ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" })); return; }

    const { message, sessionId = "default", model } = payload;
    if (!message) { ws.send(JSON.stringify({ type: "error", error: "message required" })); return; }

    const msgs = getSession(sessionId);
    const userMsg = { role: "user", content: message };
    const conversation = [...msgs, userMsg];

    try {
      const result = await runChat(
        conversation, model, true,
        (chunk) => {
          if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: "chunk", content: chunk }));
        }
      );
      msgs.push(userMsg);
      msgs.push({ role: "assistant", content: result.raw });
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: "done", actions: result.actions, fullText: result.text, widgetData: result.widgetData }));
    } catch (err) {
      console.error("[WS]", err.message);
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: "error", error: err.message }));
    }
  });

  ws.on("close", () => console.log("[WS] Disconnected"));
});

setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); });
}, 30000);

server.listen(process.env.PORT || 3001, () => {
  console.log(`\n✅ JARVIS ready on :${process.env.PORT || 3001} (fast mode)\n`);
});