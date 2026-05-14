const { fetchWeather } = require("./weather");
const { fetchNews } = require("./news");
const { getTime } = require("./time");
const { listDirectory, openFile, searchFiles } = require("./filesystem");

async function executeTool(tool, args) {
  console.log("args args",args)
  switch (tool) {
    case "get_weather": return fetchWeather(args.city);
    case "get_time":    return getTime(args.city);
    case "list_dir":      return JSON.stringify(await listDirectory(args.path));
    case "open_file":     return JSON.stringify(await openFile(args.path));
    case "search_files":  return JSON.stringify(await searchFiles(args.path, args.query));
    // case "get_news":    return fetchNews(args.query);
    default:            return JSON.stringify({ error: `Unknown tool: ${tool}` });
  }
}

async function executeToolsParallel(intents) {
  return Promise.all(
    intents.map(async ({ tool, args }) => {
      console.log(`[TOOL] Executing: ${tool}`, args);
      const result = await executeTool(tool, args);
      console.log(`[TOOL] Done: ${tool} → ${String(result).slice(0, 80)}`);
      return { tool, args, result };
    })
  );
}

function buildWidgetData(toolResults) {
  const widgetData = { weather: null, news: null, filesystem: null };
  for (const { tool, result } of toolResults) {
    if (tool === "get_weather") {
      try { widgetData.weather = JSON.parse(result); } catch {}
    }
    if (tool === "get_news") {
      widgetData.news = result.split("\n").filter(Boolean).map((line) => {
        const m = line.match(/•\s(.+?)\s\((.+?),\s(.+?)\)/);
        return m ? { title: m[1], source: m[2], time: m[3] } : null;
      }).filter(Boolean);
    }
    if (["list_dir", "search_files", "open_file"].includes(tool)) {
      try { widgetData.filesystem = { type: tool, ...JSON.parse(result) }; } catch {}
    }
  }
  return widgetData;
}

module.exports = { executeToolsParallel, buildWidgetData };