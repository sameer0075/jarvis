const ollama       = require("./ollama");
const { orchestrate } = require("./agents/orchestrator");
const { runAgents }   = require("./agents/agents");
const { LLM_OPTIONS, HEAVY_TRIGGERS, MODELS } = require("../utils/config");


const STATUS_SEQUENCES = {
  weather: [
    (args) => `Connecting to live weather systems for ${args.city}...`,
    (args) => `Analyzing atmospheric conditions in ${args.city}...`,
    (args) => `Calculating forecast patterns for ${args.city}...`,
    (args) => `Compiling real-time weather insights...`,
  ],

  time: [
    (args) => `Synchronizing world clocks for ${args.city}...`,
    (args) => `Retrieving current timezone data for ${args.city}...`,
    (args) => `Calibrating temporal systems...`,
  ],

  news: [
    (args) => `Scanning global news networks for "${args.query}"...`,
    (args) => `Gathering latest headlines and reports...`,
    (args) => `Filtering relevant developments for "${args.query}"...`,
    (args) => `Analyzing media coverage and sources...`,
  ],

  filesystem: [
    () => `Scanning indexed files and directories...`,
    () => `Searching your workspace intelligently...`,
    () => `Matching relevant documents and code...`,
    () => `Analyzing filesystem context...`,
  ],

  system: [
    () => `Interpreting system-level instruction...`,
    () => `Preparing execution environment...`,
    () => `Verifying command safety protocols...`,
    () => `Initializing system operation...`,
  ],
  vision: [
    () => `Processing visual input...`,
    () => `Analyzing screen composition...`,
    () => `Interpreting interface and text elements...`,
    () => `Generating visual understanding...`,
  ],

  chat: [
    () => `Initializing cognitive systems...`,
    () => `Analyzing your request...`,
    () => `Reasoning through available context...`,
    () => `Formulating an intelligent response...`,
    () => `Optimizing final output...`,
  ],

  default: [
    () => `Initializing cognitive systems...`,
    () => `Analyzing your request...`,
    () => `Reasoning through available context...`,
    () => `Formulating an intelligent response...`,
    () => `Optimizing final output...`,
  ],
};

function startStatusInterval(sequence, onPreResponse, shouldStop, intervalMs = 3000) {
  if (!sequence?.length || !onPreResponse) return () => {};

  // Start at index 1 since index 0 was already sent manually
  let idx = 1;

  const timer = setInterval(() => {
    if (shouldStop()) {
      clearInterval(timer);
      return;
    }
    onPreResponse(sequence[idx]());
    idx = (idx + 1) % sequence.length;
  }, intervalMs);

  return () => clearInterval(timer);
}

function parseActions(text) {
  const actions = [];
  const urlRe    = /\[ACTION:OPEN_URL:([^\]]+)\]/gi;
  const searchRe = /\[ACTION:SEARCH:([^\]]+)\]/gi;
  let m;
  while ((m = urlRe.exec(text)))    { let u = m[1].trim(); if (!u.startsWith("http")) u = "https://" + u; actions.push({ type: "OPEN_URL", value: u }); }
  while ((m = searchRe.exec(text))) { actions.push({ type: "SEARCH", value: m[1].trim() }); }
  return { cleanText: text.replace(/\[ACTION:[^\]]+\]/gi, "").trim(), actions };
}

function buildFinalPrompt(userMessage, agentResults, history) {
  const toolBlocks = agentResults
    .filter(r => r.result)
    .map(r => `[AGENT: ${r.agent.toUpperCase()}]\n${r.result}\n[/AGENT]`)
    .join("\n\n");

  const content = toolBlocks
    ? `${userMessage}\n\n<agent_results>\n${toolBlocks}\n</agent_results>\n\nAnswer using the agent results above.`
    : userMessage;

  const MAX_HISTORY = 6;
  const recent = history.slice(-MAX_HISTORY);

  return [...recent, { role: "user", content }];
}

function mergeWidgetData(agentResults) {
  const widgetData = { weather: null, news: null, filesystem: null };
  for (const { widgetData: wd } of agentResults) {
    if (!wd) continue;
    if (wd.weather)    widgetData.weather    = wd.weather;
    if (wd.news)       widgetData.news       = wd.news;
    if (wd.time)       widgetData.time       = wd.time;
    if (wd.filesystem) widgetData.filesystem = wd.filesystem;
    if (wd.system) widgetData.system = wd.system;
    if (wd.vision) widgetData.vision = wd.vision;
  }
  return widgetData;
}

function pickModel(userMessage, agents) {
  const msg = userMessage.toLowerCase();
  const needsHeavy = (HEAVY_TRIGGERS || []).some(t => msg.includes(t));
  const hasToolAgents = agents.some(a => !["chat", "system"].includes(a));

  if (needsHeavy)     return MODELS.HEAVY;
  if (hasToolAgents)  return MODELS.TOOLS;
  return MODELS.CHAT;
}

async function runChat(messages, model, stream = false, onChunk = null, onPreResponse = null) {
  const lastUser  = messages.findLast(m => m.role === "user");
  const userText  = lastUser?.content || "";
  const history   = messages.filter(m => m.role !== "user" || m !== lastUser);

  // 1. Orchestrate — decide which agents to run
  const agents = await orchestrate(userText);
  const runningModal = pickModel(userText, agents);
  console.log("pickmodal",runningModal)
  console.log("agents", agents);

  // 2. Start status messages EARLY (before agents run) so they display
  //    during both agent execution and LLM startup.
  let stopStatus = () => {};
  let hasStartedStreaming = false;
  // const shouldStopStatus = () => hasStartedStreaming;

  // const agentType = agents[0] || "default";
  // const sequenceFns = STATUS_SEQUENCES[agentType] || STATUS_SEQUENCES.default;

  // Mutable args: updated after agents finish so later ticks use real data
  // const statusArgs = { agent: agentType };
  // const sequence = sequenceFns.map(fn => () => {
  //   // Guard against "undefined" in templates while agents are still running
  //   const args = { city: "", query: "", ...statusArgs };
  //   return fn(args);
  // });

  // if (onPreResponse && sequence.length) {
  //   // Send first message immediately
  //   onPreResponse(sequence[0]());

  //   // Start cycling at index 1, every 10 seconds
  //   stopStatus = startStatusInterval(
  //     sequence,
  //     (msg) => {
  //       if (!hasStartedStreaming) onPreResponse(msg);
  //     },
  //     shouldStopStatus,
  //     10000  // 10 seconds as requested
  //   );
  // }

  // 3. Run agents in parallel
  let agentResults = [];
  try {
    agentResults = await runAgents(agents, userText);
    console.log("agentResults", agentResults);

    // Enrich status args with actual results for subsequent interval ticks
    // if (agentResults[0]) {
    //   Object.assign(statusArgs, agentResults[0]);
    // }
  } catch (e) {
    console.error("[AGENTS] Error:", e.message);
  }

  // 4. Build final messages for LLM
  const finalMessages = [
    messages.find(m => m.role === "system") || { role: "system", content: require("../utils/session").getSession("_sys")?.[0]?.content || "" },
    ...buildFinalPrompt(userText, agentResults, history.filter(m => m.role !== "system")),
  ];

  const widgetData = mergeWidgetData(agentResults);
  const KEEP_ALIVE = {
    "llama3.1:8b":  -1,
    "llama3.2:3b": -1,
    "qwen3:8b":     "3m",
    "qwen3.5:9b":   "0",
    "nomic-embed-text": "10m"
  };
  const ollamaBody = {
    model:   runningModal,
    messages: finalMessages,
    keep_alive: KEEP_ALIVE[runningModal] ?? "5m",
    think:   false,
    stream: true,
    options: LLM_OPTIONS,
  };

  // 5. Stream LLM response
  if (stream && onChunk) {
    return new Promise((resolve, reject) => {
      ollama.stream(
        { ...ollamaBody, stream: true },
        (chunk) => {
          if (!hasStartedStreaming) {
            hasStartedStreaming = true;
            stopStatus();
          }
          onChunk(chunk);
        },
        (fullText) => {
          stopStatus();
          const { cleanText, actions } = parseActions(fullText);
          resolve({ text: cleanText, raw: fullText, actions, widgetData });
        },
        (err) => { stopStatus(); reject(err); }
      );
    });
  }
}

module.exports = { runChat };
