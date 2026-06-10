const ollama = require("./ollama");
const { orchestrate } = require("./agents/orchestrator");
const { runAgents } = require("./agents/agents");
const { LLM_OPTIONS, HEAVY_TRIGGERS, MODELS } = require("../utils/config");
const https = require("https");
const dotenv = require("dotenv");
dotenv.config();

// ── Groq streaming ────────────────────────────────────────────────────────────
function streamGroq(messages, onChunk, onDone, onError) {
  const chatMsgs = messages.filter((m) => m.role !== "system");
  const systemMessage = {
    role: "system",
    content: `You are JARVIS,  Mr. Sameer's AI assistant. Sharp, witty, concise.

When you see [TOOL: name] ... [/TOOL] blocks in the conversation, those are real-time data results. Use that exact data in your response — never make up numbers.

FILESYSTEM: When a tool result contains file/folder listings, summarize what was found (e.g. "Found 24 files in your Downloads. Opening the browser now."). When open_file succeeds, confirm it was opened.

To open a website, append at the END of your response:
[ACTION:OPEN_URL:https://example.com]

To search, append:
[ACTION:SEARCH:query]

Format responses in clean markdown.`,
  };

  const body = JSON.stringify({
    model: "llama-3.1-8b-instant",
    messages: [systemMessage, ...chatMsgs],
    max_tokens: 250,
    stream: true,
    temperature: 0.7,
  });

  const req = https.request(
    {
      hostname: "api.groq.com",
      path: "/openai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_KEY}`,
        "Content-Length": Buffer.byteLength(body),
      },
    },
    (res) => {
      if (res.statusCode !== 200) {
        let err = "";
        res.on("data", (c) => (err += c));
        res.on("end", () =>
          onError(new Error(`Groq ${res.statusCode}: ${err.slice(0, 200)}`)),
        );
        return;
      }

      let buf = "",
        full = "",
        finished = false;

      res.on("data", (chunk) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const obj = JSON.parse(trimmed.slice(6));
            const token = obj.choices?.[0]?.delta?.content || "";
            if (token) {
              full += token;
              onChunk(token);
            }
            if (obj.choices?.[0]?.finish_reason) {
              finished = true;
              onDone(full);
            }
          } catch {}
        }
      });

      res.on("end", () => {
        if (!finished) onDone(full);
      });

      res.on("error", onError);
    },
  );

  req.on("error", onError);
  req.setTimeout(15000, () => {
    req.destroy();
    onError(new Error("Groq timeout"));
  });
  req.write(body);
  req.end();
}

// ── Final LLM call: Groq first, Ollama fallback ───────────────────────────────
function streamFinal(ollamaBody, finalMessages, onChunk, onDone, onError) {
  const key = process.env.GROQ_KEY;

  if (key) {
    console.log("[CHAT] Using Groq | key prefix:", key.slice(0, 8));
    let groqFailed = false;

    streamGroq(finalMessages, onChunk, onDone, (err) => {
      if (groqFailed) return;
      groqFailed = true;
      console.warn("[CHAT] Groq failed, falling back to Ollama:", err.message);
      ollama.stream(ollamaBody, onChunk, onDone, onError);
    });
  } else {
    console.log("[CHAT] No Groq key — using Ollama");
    ollama.stream(ollamaBody, onChunk, onDone, onError);
  }
}

function parseActions(text) {
  const actions = [];
  const urlRe = /\[ACTION:OPEN_URL:([^\]]+)\]/gi;
  const searchRe = /\[ACTION:SEARCH:([^\]]+)\]/gi;
  let m;
  while ((m = urlRe.exec(text))) {
    let u = m[1].trim();
    if (!u.startsWith("http")) u = "https://" + u;
    actions.push({ type: "OPEN_URL", value: u });
  }
  while ((m = searchRe.exec(text))) {
    actions.push({ type: "SEARCH", value: m[1].trim() });
  }
  return { cleanText: text.replace(/\[ACTION:[^\]]+\]/gi, "").trim(), actions };
}

function buildFinalPrompt(userMessage, agentResults, history, selectedAgent) {
  const toolBlocks = agentResults
    .filter((r) => r.result)
    .map((r) => `[AGENT: ${r.agent.toUpperCase()}]\n${r.result}\n[/AGENT]`)
    .join("\n\n");

  let content = toolBlocks
    ? `${userMessage}\n\n<agent_results>\n${toolBlocks}\n</agent_results>\n\nAnswer using the agent results above.`
    : userMessage;

  // CONTEXT LOCK: if user selected a specific agent, tell the LLM to stay in that mode
  if (selectedAgent && selectedAgent !== "auto" && selectedAgent !== "chat") {
    content += `\n\n[SYSTEM: You are in ${selectedAgent.toUpperCase()} mode. Only respond to queries related to ${selectedAgent}. If the user asks about something unrelated, politely decline and remind them you are currently in ${selectedAgent.toUpperCase()} mode. Suggest they switch to AUTO mode for general questions.]`;
  }

  return [...history.slice(-6), { role: "user", content }];
}

function mergeWidgetData(agentResults) {
  const widgetData = {
    weather: null,
    news: null,
    filesystem: null,
    time: null,
    system: null,
    vision: null,
  };
  for (const { widgetData: wd } of agentResults) {
    if (!wd) continue;
    for (const key of Object.keys(widgetData)) {
      if (wd[key]) widgetData[key] = wd[key];
    }
  }
  return widgetData;
}

function pickModel(userMessage, agents) {
  const msg = userMessage.toLowerCase();
  const needsHeavy = (HEAVY_TRIGGERS || []).some((t) => msg.includes(t));
  const hasToolAgents = agents.some((a) => !["chat", "system"].includes(a));
  if (needsHeavy) return MODELS.HEAVY;
  if (hasToolAgents) return MODELS.TOOLS;
  return MODELS.CHAT;
}

async function runChat(
  messages,
  model,
  stream = false,
  onChunk = null,
  onPreResponse = null,
  selectedAgent = "auto",   // ← NEW: accepts agent lock from frontend
) {
  const lastUser = messages.findLast((m) => m.role === "user");
  const userText = lastUser?.content || "";
  const history = messages.filter((m) => m !== lastUser);

  // 1. Orchestrate OR use locked agent
  let agents;
  if (selectedAgent && selectedAgent !== "auto") {
    // LOCKED MODE: skip orchestrator, force specific agent + chat fallback
    agents = selectedAgent === "chat" ? ["chat"] : [selectedAgent, "chat"];
    console.log(`[CHAT] Agent mode LOCKED: [${agents.join(", ")}]`);
  } else {
    // AUTO MODE: let orchestrator decide
    agents = await orchestrate(userText);
  }

  const runningModal = pickModel(userText, agents);
  console.log("[CHAT] model:", runningModal, "agents:", agents);

  let hasStartedStreaming = false;

  // 2. Run agents
  let agentResults = [];
  try {
    agentResults = await runAgents(agents, userText);

    // Short-circuit: list_dir needs no LLM
    const fsResult = agentResults.find((r) => r.agent === "filesystem");
    if (fsResult) {
      try {
        const parsed = JSON.parse(fsResult.result);
        if (parsed.type === "list_dir") {
          const count = parsed.entries?.length || 0;
          const dirName = parsed.path?.split("/").pop() || "folder";
          const reply = `Here are the contents of your ${dirName} folder — ${count} items found.`;
          const wd = mergeWidgetData(agentResults);
          if (stream && onChunk) {
            onChunk(reply);
          }
          return { text: reply, raw: reply, actions: [], widgetData: wd, activeAgents: agents };
        }
      } catch {}
    }
  } catch (e) {
    console.error("[AGENTS] Error:", e.message);
  }

  // 3. Build messages for LLM
  const systemMsg = messages.find((m) => m.role === "system") || {
    role: "system",
    content: require("../utils/session").getSession("_sys")?.[0]?.content || "",
  };

  const finalMessages = [
    systemMsg,
    ...buildFinalPrompt(
      userText,
      agentResults,
      history.filter((m) => m.role !== "system"),
      selectedAgent,   // ← pass through for context lock
    ),
  ];

  const widgetData = mergeWidgetData(agentResults);

  const isChatOnly = agents.length === 1 && agents[0] === "chat";
  const hasLargeCtx = agents.some((a) => ["filesystem", "news"].includes(a));

  const KEEP_ALIVE = {
    "llama3.1:8b": -1,
    "llama3.2:3b": -1,
    "qwen3:8b": "3m",
    "qwen3.5:9b": "0",
  };

  const ollamaBody = {
    model: runningModal,
    keep_alive: KEEP_ALIVE[runningModal] ?? -1,
    messages: finalMessages,
    think: false,
    options: {
      num_predict: isChatOnly ? 150 : 250,
      num_ctx: isChatOnly ? 512 : hasLargeCtx ? 3000 : 1024,
    },
  };

  // 4. Stream — Groq first, Ollama fallback
  if (stream && onChunk) {
    return new Promise((resolve, reject) => {
      streamFinal(
        ollamaBody,
        finalMessages,
        (chunk) => {
          hasStartedStreaming = true;
          onChunk(chunk);
        },
        (fullText) => {
          const { cleanText, actions } = parseActions(fullText);
          resolve({ text: cleanText, raw: fullText, actions, widgetData, activeAgents: agents });
        },
        reject,
      );
    });
  }

  // Non-streaming fallback (HTTP)
  return new Promise((resolve, reject) => {
    let fullText = "";
    streamFinal(
      ollamaBody,
      finalMessages,
      (chunk) => { fullText += chunk; },
      (text) => {
        const { cleanText, actions } = parseActions(text || fullText);
        resolve({ text: cleanText, raw: text || fullText, actions, widgetData, activeAgents: agents });
      },
      reject,
    );
  });
}

module.exports = { runChat };