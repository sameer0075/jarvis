const ollama = require("../ollama");
const { DEFAULT_MODEL, LLM_OPTIONS } = require("../../utils/config");

const ORCHESTRATOR_PROMPT = `You are an intent router for JARVIS, an AI assistant.

Given a user message, decide which agents to call. Return ONLY valid JSON.

AVAILABLE AGENTS:
- chat          → general conversation, questions, explanations (always include unless another agent handles fully)
- weather       → weather, temperature, forecast queries  
- time          → time, timezone, clock queries
- news          → news, headlines, latest events
- filesystem    → file/folder search, open files, list directories
- system        → volume, brightness, apps, screenshots, wifi, sleep, lock screen
- vision        → questions about current screen, visible content, active app

RULES:
1. Always include "chat" unless the query is PURE system control with no conversational element
2. Multiple agents can run in parallel
3. For "open Chrome and tell me about it" → ["system", "chat"]
4. For "what's the weather in Lahore" → ["weather", "chat"]
5. For "set brightness to 50" → ["system"] only (no chat needed for pure commands)
6. For "find my resume and summarize it" → ["filesystem", "chat"]

Return format:
{"agents": ["agent1", "agent2"], "reasoning": "brief why"}

Examples:
"set volume to 30"          → {"agents": ["system"]}
"what's the weather?"       → {"agents": ["weather", "chat"]}  
"find pogo folder"          → {"agents": ["filesystem", "chat"]}
"hey how are you"           → {"agents": ["chat"]}
"open spotify and play music" → {"agents": ["system", "chat"]}
"what's on my screen?"      → {"agents": ["vision", "chat"]}`;

async function orchestrate(userMessage) {
  try {
    const data = await ollama.post({
      model:   'llama3.2:3b',
      messages: [
        { role: "system", content: ORCHESTRATOR_PROMPT },
        { role: "user",   content: userMessage },
      ],
      stream:  false,
      format:  "json",
      think:   false,
      options: { temperature: 0, num_predict: 100, num_thread: 4, num_ctx: 1024, keep_alive: -1 },
    });

    const raw  = (data.message?.content || "").trim();
    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!json) throw new Error("No JSON");

    const parsed = JSON.parse(json);
    const agents = parsed.agents || ["chat"];
    console.log("agents",parsed)
    console.log(`[ORCHESTRATOR] Agents: [${agents.join(", ")}] — ${parsed.reasoning || ""}`);
    return agents;
  } catch (e) {
    console.warn("[ORCHESTRATOR] Failed, defaulting to chat:", e.message);
    return ["chat"];
  }
}

module.exports = { orchestrate };
