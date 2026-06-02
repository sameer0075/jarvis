// const ollama = require("./ollama");
// const { extractEntities, buildIntents } = require("../utils/intent");
// const { executeToolsParallel, buildWidgetData } = require("./tools");
// const { DEFAULT_MODEL, LLM_OPTIONS } = require("../utils/config");
// const state = require("./vision/state");

// const STATUS_SEQUENCES = {
//   get_weather: [
//     (args) => `Connecting to live weather systems for ${args.city}...`,
//     (args) => `Analyzing atmospheric conditions in ${args.city}...`,
//     (args) => `Calculating forecast patterns for ${args.city}...`,
//     (args) => `Compiling real-time weather insights...`,
//   ],

//   get_time: [
//     (args) => `Synchronizing world clocks for ${args.city}...`,
//     (args) => `Retrieving current timezone data for ${args.city}...`,
//     (args) => `Calibrating temporal systems...`,
//   ],

//   get_news: [
//     (args) => `Scanning global news networks for "${args.query}"...`,
//     (args) => `Gathering latest headlines and reports...`,
//     (args) => `Filtering relevant developments for "${args.query}"...`,
//     (args) => `Analyzing media coverage and sources...`,
//   ],

//   fs_semantic: [
//     () => `Scanning indexed files and directories...`,
//     () => `Searching your workspace intelligently...`,
//     () => `Matching relevant documents and code...`,
//     () => `Analyzing filesystem context...`,
//   ],

//   system_control: [
//     () => `Interpreting system-level instruction...`,
//     () => `Preparing execution environment...`,
//     () => `Verifying command safety protocols...`,
//     () => `Initializing system operation...`,
//   ],

//   screen_analysis: [
//     () => `Capturing current screen context...`,
//     () => `Analyzing visible interface elements...`,
//     () => `Reading on-screen content and activity...`,
//     () => `Interpreting workspace state...`,
//   ],

//   code_analysis: [
//     () => `Inspecting source code structure...`,
//     () => `Analyzing logic and dependencies...`,
//     () => `Detecting potential issues and optimizations...`,
//     () => `Preparing development insights...`,
//   ],

//   browser_navigation: [
//     () => `Connecting to browser session...`,
//     () => `Inspecting active tabs and content...`,
//     () => `Analyzing web context...`,
//     () => `Preparing navigation response...`,
//   ],

//   memory_lookup: [
//     () => `Searching conversation memory...`,
//     () => `Retrieving relevant context...`,
//     () => `Cross-referencing previous interactions...`,
//     () => `Reconstructing contextual understanding...`,
//   ],

//   vision: [
//     () => `Processing visual input...`,
//     () => `Analyzing screen composition...`,
//     () => `Interpreting interface and text elements...`,
//     () => `Generating visual understanding...`,
//   ],

//   default: [
//     () => `Initializing cognitive systems...`,
//     () => `Analyzing your request...`,
//     () => `Reasoning through available context...`,
//     () => `Formulating an intelligent response...`,
//     () => `Optimizing final output...`,
//   ],
// };

// function buildStatusSequence(intents) {
//   // No intents = pure LLM call, use default sequence
//   if (!intents.length) return STATUS_SEQUENCES.default.map((fn) => fn());

//   const sequences = intents.map(({ tool, args }) => {
//     const seq = STATUS_SEQUENCES[tool] || STATUS_SEQUENCES.default;
//     return seq.map((fn) => fn(args));
//   });

//   // Round-robin interleave: [tool1[0], tool2[0], tool1[1], tool2[1], ...]
//   const result = [];
//   const maxLen = Math.max(...sequences.map((s) => s.length));
//   for (let i = 0; i < maxLen; i++) {
//     for (const seq of sequences) {
//       if (seq[i]) result.push(seq[i]);
//     }
//   }
//   return result;
// }

// function startStatusInterval(
//   sequence,
//   onPreResponse,
//   shouldStop,
//   intervalMs = 1800,
// ) {
//   if (!sequence.length || !onPreResponse) {
//     return () => {};
//   }

//   let idx = 0;

//   const timer = setInterval(() => {
//     // stop immediately once streaming starts
//     if (shouldStop()) {
//       clearInterval(timer);
//       return;
//     }

//     onPreResponse(sequence[idx]);

//     idx++;

//     // loop continuously
//     if (idx >= sequence.length) {
//       idx = 0;
//     }
//   }, intervalMs);

//   return () => {
//     clearInterval(timer);
//   };
// }

// function parseActions(text) {
//   const actions = [];
//   let m;
//   const urlRe = /\[ACTION:OPEN_URL:([^\]]+)\]/gi;
//   const searchRe = /\[ACTION:SEARCH:([^\]]+)\]/gi;

//   while ((m = urlRe.exec(text))) {
//     let url = m[1].trim();
//     if (!url.startsWith("http")) url = "https://" + url;
//     actions.push({ type: "OPEN_URL", value: url });
//   }
//   while ((m = searchRe.exec(text))) {
//     actions.push({ type: "SEARCH", value: m[1].trim() });
//   }

//   return {
//     cleanText: text.replace(/\[ACTION:[^\]]+\]/gi, "").trim(),
//     actions,
//   };
// }

// function buildEnrichedMessage(originalMessage, toolResults) {
//   if (!toolResults.length) return originalMessage;
//   const toolBlock = toolResults
//     .map(({ tool, result }) => `[TOOL: ${tool}]\n${result}\n[/TOOL]`)
//     .join("\n\n");
//   return `${originalMessage}\n\n<tool_results>\n${toolBlock}\n</tool_results>\n\nAnswer using the tool results above.`;
// }

// function buildMessages(messages, lastUser, toolResults) {
//   const MAX_HISTORY = 6;
//   const systemMsg = messages.find((m) => m.role === "system");
//   const recent = messages
//     .filter((m) => m.role !== "system")
//     .slice(-MAX_HISTORY);
//   const trimmed = systemMsg ? [systemMsg, ...recent] : recent;

//   return trimmed.map((msg) => {
//     if (msg === lastUser && toolResults.length > 0) {
//       return {
//         ...msg,
//         content: buildEnrichedMessage(msg.content, toolResults),
//       };
//     }
//     return msg;
//   });
// }

// function needsScreenContext(userText) {
//   return /\b(screen|window|see|visible|open|showing|current|what is|whats)\b/i.test(
//     userText,
//   );
// }

// // onPreResponse(msg) — called immediately when tools start fetching
// async function runChat(
//   messages,
//   model,
//   stream = false,
//   onChunk = null,
//   onPreResponse = null,
// ) {
//   const modelName = model || DEFAULT_MODEL;
//   const lastUser = messages.findLast((m) => m.role === "user");
//   const userText = lastUser?.content || "";

//   // 1. Extract intents
//   const entities = extractEntities(userText);
//   const intents = buildIntents(entities);
//   console.log("intents", intents);

//   // 2. Start rotating status messages immediately (works for BOTH tool and default cases)
//   let hasStartedStreaming = false;

//   const shouldStopStatus = () => hasStartedStreaming;

//   let stopStatus = () => {};

  // if (onPreResponse) {
  //   const sequence = buildStatusSequence(intents);
  //   onPreResponse(sequence[0]);

  //   stopStatus = startStatusInterval(
  //     sequence,

  //     // emit status safely
  //     (msg) => {
  //       if (!hasStartedStreaming) {
  //         onPreResponse(msg);
  //       }
  //     },

  //     shouldStopStatus,

  //     // delay
  //     10000,
  //   );
  // }

//   // 3. Fetch tools in parallel if needed
//   let toolResults = [];
//   let widgetData = null;

//   if (intents.length > 0) {
//     const t0 = Date.now();

//     toolResults = await executeToolsParallel(intents);

//     // stopStatus();

//     widgetData = buildWidgetData(toolResults);
//   }
//   // Note: for no-tool (default) case, stopStatus() is called after LLM starts streaming below

//   // 4. Build enriched messages
//   const enrichedMessages = buildMessages(messages, lastUser, toolResults);

//   const visionContext = needsScreenContext(userText)
//     ? `ACTIVE APP: ${state.activeWindow?.owner?.name || "Unknown"}\nWINDOW TITLE: ${state.activeWindow?.title || "Unknown"}\nVISIBLE SCREEN OCR: ${(state.lastOCR || "").slice(0, 2000)}`
//     : `ACTIVE APP: ${state.activeWindow?.owner?.name || "Unknown"}`;

//   const finalMessages = enrichedMessages.map((msg, index) => {
//     if (msg.role === "user" && index === enrichedMessages.length - 1) {
//       return {
//         ...msg,
//         content: `${msg.content}\n\n<screen_context>\n${visionContext}\n</screen_context>`,
//       };
//     }
//     return msg;
//   });

//   const ollamaBody = {
//     model: modelName,
//     messages: finalMessages,
//     think: false,
//     options: LLM_OPTIONS,
//   };

//   // 5. Single LLM call — stop status interval the moment first chunk arrives
//   if (stream && onChunk) {
//     return new Promise((resolve, reject) => {
//       let statusStopped = false;
//       ollama.stream(
//         { ...ollamaBody, stream: true },
//         (chunk) => {
//           // Kill status messages the instant the LLM starts responding
//           if (!hasStartedStreaming) {
//             hasStartedStreaming = true;
//             stopStatus();
//           }
//           onChunk(chunk);
//         },
//         (fullText) => {
//           stopStatus(); // Safety: ensure stopped even if no chunks came
//           const { cleanText, actions } = parseActions(fullText);
//           resolve({ text: cleanText, raw: fullText, actions, widgetData });
//         },
//         (err) => {
//           stopStatus();
//           reject(err);
//         },
//       );
//     });
//   }
// }

// module.exports = { runChat };


const ollama       = require("./ollama");
const { orchestrate } = require("./agents/orchestrator");
const { runAgents }   = require("./agents/agents");
const { DEFAULT_MODEL, LLM_OPTIONS } = require("../utils/config");


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

async function runChat(messages, model, stream = false, onChunk = null, onPreResponse = null) {
  const modelName = model || DEFAULT_MODEL;
  const lastUser  = messages.findLast(m => m.role === "user");
  const userText  = lastUser?.content || "";
  const history   = messages.filter(m => m.role !== "user" || m !== lastUser);

  // 1. Orchestrate — decide which agents to run
  const agents = await orchestrate(userText);
  console.log("agents", agents);

  // 2. Start status messages EARLY (before agents run) so they display
  //    during both agent execution and LLM startup.
  let stopStatus = () => {};
  let hasStartedStreaming = false;
  const shouldStopStatus = () => hasStartedStreaming;

  const agentType = agents[0] || "default";
  const sequenceFns = STATUS_SEQUENCES[agentType] || STATUS_SEQUENCES.default;

  // Mutable args: updated after agents finish so later ticks use real data
  const statusArgs = { agent: agentType };
  const sequence = sequenceFns.map(fn => () => {
    // Guard against "undefined" in templates while agents are still running
    const args = { city: "", query: "", ...statusArgs };
    return fn(args);
  });

  if (onPreResponse && sequence.length) {
    // Send first message immediately
    onPreResponse(sequence[0]());

    // Start cycling at index 1, every 10 seconds
    stopStatus = startStatusInterval(
      sequence,
      (msg) => {
        if (!hasStartedStreaming) onPreResponse(msg);
      },
      shouldStopStatus,
      10000  // 10 seconds as requested
    );
  }

  // 3. Run agents in parallel
  let agentResults = [];
  try {
    agentResults = await runAgents(agents, userText);
    console.log("agentResults", agentResults);

    // Enrich status args with actual results for subsequent interval ticks
    if (agentResults[0]) {
      Object.assign(statusArgs, agentResults[0]);
    }
  } catch (e) {
    console.error("[AGENTS] Error:", e.message);
  }

  // 4. Build final messages for LLM
  const finalMessages = [
    messages.find(m => m.role === "system") || { role: "system", content: require("../utils/session").getSession("_sys")?.[0]?.content || "" },
    ...buildFinalPrompt(userText, agentResults, history.filter(m => m.role !== "system")),
  ];

  const widgetData = mergeWidgetData(agentResults);
  const ollamaBody = {
    model:   modelName,
    messages: finalMessages,
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