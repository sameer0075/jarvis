const { fetchWeather }  = require("./weather");
const { fetchNews }     = require("./news");
const { getTime }       = require("./time");
const { listDirectory, openFile } = require("./filesystem");
const { semanticSearch } = require("../filesystem/semantic");
const { systemController } = require("../system/systemController");

async function executeTool(tool, args) {
  switch (tool) {
    case "get_weather":    return fetchWeather(args.city);
    case "get_time":       return getTime(args.city);
    case "get_news":       return fetchNews(args.query);

    // Filesystem — all routed through semanticSearch or direct
    case "list_dir":
      return JSON.stringify(await listDirectory(args.path));

    case "fs_semantic":
      // Full intent: query → LLM router → Fuse → result
      return JSON.stringify(await semanticSearch(args.userQuery));

    case "open_file":
      // Direct open by exact path (from FileBrowser UI clicks)
      return JSON.stringify(await openFile(args.path));
    case "system_control":
      return JSON.stringify(await systemController(args.userQuery));

    default:
      return JSON.stringify({ error: `Unknown tool: ${tool}` });
  }
}

async function executeToolsParallel(intents) {
  return Promise.all(
    intents.map(async ({ tool, args }) => {
      console.log(`[TOOL] Executing: ${tool}`, args);
      const result = await executeTool(tool, args);
      console.log(`[TOOL] Done: ${tool} →`, String(result).slice(0, 100));
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
      widgetData.news = result.split("\n").filter(Boolean).map(line => {
        const m = line.match(/•\s(.+?)\s\((.+?),\s(.+?)\)/);
        return m ? { title: m[1], source: m[2], time: m[3] } : null;
      }).filter(Boolean);
    }
    if (["list_dir", "fs_semantic", "open_file"].includes(tool)) {
      try { widgetData.filesystem = JSON.parse(result); } catch {}
    }
  }
  return widgetData;
}

module.exports = { executeToolsParallel, buildWidgetData };