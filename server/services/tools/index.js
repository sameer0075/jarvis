const { fetchWeather } = require("./weather");
const { fetchNews } = require("./news");
const { getTime } = require("./time");

async function executeTool(tool, args) {
  console.log("args args",args)
  switch (tool) {
    case "get_weather": return fetchWeather(args.city);
    case "get_time":    return getTime(args.city);
    // case "get_news":    return fetchNews(args.query);
    default:            return JSON.stringify({ error: `Unknown tool: ${tool}` });
  }
}

async function executeToolsParallel(intents) {
  return Promise.all(
    intents.map(async ({ tool, args }) => {
      console.log(`[TOOL] Executing: ${tool}`, args);
      const result = await executeTool(tool, args);
      console.log(`[TOOL] Done: ${tool} → ${result.slice(0, 80)}`);
      return { tool, args, result };
    })
  );
}

function buildWidgetData(toolResults) {
  const widgetData = { weather: null, news: null };
  for (const { tool, result } of toolResults) {
    if (tool === "get_weather") {
      try { widgetData.weather = JSON.parse(result); } catch { /* malformed */ }
    }
    if (tool === "get_news") {
      widgetData.news = result
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const m = line.match(/•\s(.+?)\s\((.+?),\s(.+?)\)/);
          return m ? { title: m[1], source: m[2], time: m[3] } : null;
        })
        .filter(Boolean);
    }
  }
  return widgetData;
}

module.exports = { executeToolsParallel, buildWidgetData };