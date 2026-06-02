const { fetchWeather }     = require("../tools/weather");
const { getTime }          = require("../tools/time");
const { fetchNews }        = require("../tools/news");
const { semanticSearch }   = require("../filesystem/semantic");
const { systemController } = require("../system/systemController");
const state                = require("../vision/state");
const { extractCity } = require("./regex");

// Each agent returns { agentName, result, widgetData }

async function weatherAgent(userMessage) {
  // Extract city from message
  const cityMatch = userMessage.match(
    /(?:in|for|at)\s+([A-Za-z\s]+?)(?:\?|$|,|\s+(?:today|now|weather))/i
  ) || userMessage.match(/weather\s+(?:in\s+)?([A-Za-z\s]+?)(?:\?|$)/i);

  const city = extractCity(userMessage);
  console.log("city",city)
  const result = await fetchWeather(city);

  let widgetData = null;
  try { widgetData = JSON.parse(result); } catch {}

  return {
    agent:      "weather",
    result,
    widgetData: { weather: widgetData },
    city
  };
}

async function timeAgent(userMessage) {
  const city = extractCity(userMessage);
  console.log("city",city)
  const result = await getTime(city);

  return {
    agent: "time",
    result,
    widgetData: null,
    city
  };
}

async function newsAgent(userMessage) {
  // Extract query topic
  const topicMatch = userMessage.match(
    /(?:news|headlines?)\s+(?:about|on|for|regarding)?\s*(.+?)(?:\?|$)/i
  );
  const query = topicMatch?.[1]?.trim() || userMessage;
  const result = await fetchNews(query);
  return { agent: "news", result, widgetData: null, query };
}

async function filesystemAgent(userMessage) {
  const result = await semanticSearch(userMessage);
  return {
    agent:      "filesystem",
    result:     JSON.stringify(result),
    widgetData: { filesystem: result },
  };
}

async function systemAgent(userMessage) {
  const result = await systemController(userMessage);
  return {
    agent:      "system",
    result:     JSON.stringify(result),
    widgetData: null,
  };
}

async function visionAgent(userMessage) {
  const context = [
    `ACTIVE APP: ${state.activeWindow?.owner?.name || "Unknown"}`,
    `WINDOW TITLE: ${state.activeWindow?.title || "Unknown"}`,
    `SCREEN CONTENT:\n${(state.lastOCR || "").slice(0, 3000)}`,
  ].join("\n");

  return {
    agent:      "vision",
    result:     context,
    widgetData: null,
  };
}

// Chat agent returns nothing — it's handled by the final LLM call
async function chatAgent(userMessage) {
  return { agent: "chat", result: null, widgetData: null };
}

const AGENT_MAP = {
  weather:    weatherAgent,
  time:       timeAgent,
  news:       newsAgent,
  filesystem: filesystemAgent,
  system:     systemAgent,
  vision:     visionAgent,
  chat:       chatAgent,
};

async function runAgents(agentNames, userMessage) {
  const tasks = agentNames.map(name => {
    const fn = AGENT_MAP[name];
    console.log("fnfn",fn)
    if (!fn) return Promise.resolve({ agent: name, result: null, widgetData: null });
    return fn(userMessage).catch(e => {
      console.error(`[AGENT:${name}] Error:`, e.message);
      return { agent: name, result: `Error: ${e.message}`, widgetData: null };
    });
  });

  return Promise.all(tasks);
}

module.exports = { runAgents };