const ollama = require("./ollama");
const { extractEntities, buildIntents } = require("../utils/intent");
const { executeToolsParallel, buildWidgetData } = require("./tools");
const { DEFAULT_MODEL, LLM_OPTIONS } = require("../utils/config");

function parseActions(text) {
  const actions = [];
  let m;
  const urlRe    = /\[ACTION:OPEN_URL:([^\]]+)\]/gi;
  const searchRe = /\[ACTION:SEARCH:([^\]]+)\]/gi;

  while ((m = urlRe.exec(text))) {
    let url = m[1].trim();
    if (!url.startsWith("http")) url = "https://" + url;
    actions.push({ type: "OPEN_URL", value: url });
  }
  while ((m = searchRe.exec(text))) {
    actions.push({ type: "SEARCH", value: m[1].trim() });
  }

  return {
    cleanText: text.replace(/\[ACTION:[^\]]+\]/gi, "").trim(),
    actions,
  };
}

function buildEnrichedMessage(originalMessage, toolResults) {
  if (!toolResults.length) return originalMessage;
  const toolBlock = toolResults
    .map(({ tool, result }) => `[TOOL: ${tool}]\n${result}\n[/TOOL]`)
    .join("\n\n");
  return `${originalMessage}\n\n<tool_results>\n${toolBlock}\n</tool_results>\n\nAnswer using the tool results above.`;
}

function buildMessages(messages, lastUser, toolResults) {
  const MAX_HISTORY = 6;
  const systemMsg = messages.find((m) => m.role === "system");
  const recent = messages.filter((m) => m.role !== "system").slice(-MAX_HISTORY);
  const trimmed = systemMsg ? [systemMsg, ...recent] : recent;

  return trimmed.map((msg) => {
    if (msg === lastUser && toolResults.length > 0) {
      return { ...msg, content: buildEnrichedMessage(msg.content, toolResults) };
    }
    return msg;
  });
}

async function runChat(messages, model, stream = false, onChunk = null) {
  const modelName = model || DEFAULT_MODEL;
  const lastUser  = messages.findLast((m) => m.role === "user");
  const userText  = lastUser?.content || "";

  // 1. Extract intents (instant, regex-based)
  const entities = extractEntities(userText);
  const intents  = buildIntents(entities);

  // 2. Fetch tools in parallel
  let toolResults = [];
  let widgetData  = null;

  if (intents.length > 0) {
    const t0 = Date.now();
    toolResults = await executeToolsParallel(intents);
    widgetData  = buildWidgetData(toolResults);
    console.log(`[TOOLS] fetched in ${Date.now() - t0}ms`);
  }

  // 3. Build enriched message history
  const enrichedMessages = buildMessages(messages, lastUser, toolResults);
  const ollamaBody = {
    model: modelName,
    messages: enrichedMessages,
    think: false,
    options: LLM_OPTIONS,
  };

  // 4. Single LLM call
  if (stream && onChunk) {
    return new Promise((resolve, reject) => {
      ollama.stream(
        { ...ollamaBody, stream: true },
        onChunk,
        (fullText) => {
          const { cleanText, actions } = parseActions(fullText);
          resolve({ text: cleanText, raw: fullText, actions, widgetData });
        },
        reject
      );
    });
  }

  const data = await ollama.post({ ...ollamaBody, stream: false });
  if (data.error) throw new Error(data.error);
  const fullText = data.message?.content || "";
  const { cleanText, actions } = parseActions(fullText);
  return { text: cleanText, raw: fullText, actions, widgetData };
}

module.exports = { runChat };