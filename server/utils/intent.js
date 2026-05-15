const STRIP_WORDS = /\b(tell|me|show|what|is|are|the|weather|time|of|in|at|for|today|now|current|currently|please|can|you|give|get|about|clock|right|how|whats|what's|latest|a|an|do|does|i|want|need|check|look|up|find|jarvis|hey|hi|hello|forecast|temperature|temp|outside|like|its|it's|going|gonna)\b/g;

function extractCity(msg) {
  const city = msg.replace(STRIP_WORDS, " ").replace(/[?.,!'"]/g, " ").replace(/\s+/g, " ").trim();
  if (city.length < 2) return null;
  return city.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function extractNewsQuery(msg) {
  const m = msg.match(/(?:news|latest|headlines?)\s+(?:about|on|for|regarding)?\s*(.+?)(?:\?|$)/);
  if (m) return m[1].trim();
  return msg.replace(/\b(news|latest|headlines?|give|me|show|tell|about|get|the|what|is|are)\b/g, "").replace(/\s+/g, " ").trim() || null;
}

function extractFsTarget(msg) {
  // Known folder names first
  const folderMatch = msg.match(/\b(downloads|desktop|documents|pictures|music|videos|home)\b/);
  if (folderMatch) return folderMatch[1];

  // Filename with extension (e.g. "resume.pdf", "notes.txt")
  const fileMatch = msg.match(/\b([\w\s-]+\.[a-z0-9]{1,5})\b/i);
  if (fileMatch) return fileMatch[1].trim();

  // After spatial prepositions: "in my documents", "inside downloads"
  const prepMatch = msg.match(/(?:in|from|inside|of)\s+(?:my\s+)?([a-z][a-z\s]{1,20}?)(?:\s+folder|\s+directory|$|\?)/);
  if (prepMatch) return prepMatch[1].trim();

  return null;
}

function extractEntities(message) {
  const msg = message.toLowerCase().trim();

  const hasWeather    = /\bweather\b/.test(msg);
  const hasTime       = /\b(time|clock|what time)\b/.test(msg);
  const hasNews       = /\b(news|headlines?|latest|breaking)\b/.test(msg);
  const hasListDir = /\b(show|list|browse|open)\b/.test(msg)
                && /\b(folder|directory|downloads|desktop|documents|pictures|music|videos|home)\b/.test(msg)
                && !/https?:\/\//.test(msg)           // not a URL
                && !/\w+\.(com|org|net|io|dev|co|app|ai|uk|edu)\b/.test(msg);
  const hasOpenFile = /\b(open|launch|run|start)\b/.test(msg)
                 && /\.[a-z0-9]{1,5}\b/.test(msg)
                 && !/https?:\/\//.test(msg)          // not a URL
                 && !/\.(com|org|net|io|dev|co|app|ai)\b/.test(msg);
  const hasSearchFile = /\b(find|search|look for)\b/.test(msg)
                   && /\b(file|folder|document)\b/.test(msg);

  const city       = (hasWeather || hasTime) ? extractCity(msg) : null;
  const newsQuery  = hasNews ? extractNewsQuery(msg) : null;
  const fsTarget   = (hasListDir || hasOpenFile || hasSearchFile) ? extractFsTarget(msg) : null;

  // Extract search query for file search
  let fsQuery = null;
  if (hasSearchFile) {
    const m = msg.match(/(?:find|search for|look for)\s+(.+?)(?:\s+in\s+|\s+inside\s+|$)/);
    fsQuery = m ? m[1].trim() : fsTarget;
  }

  const entities = {
    city, newsQuery,
    hasWeather, hasTime, hasNews,
    hasListDir, hasOpenFile, hasSearchFile,
    fsTarget, fsQuery,
  };

  console.log("[INTENT]", entities);
  return entities;
}

function buildIntents(entities) {
  const intents = [];
  if (entities.hasWeather && entities.city)
    intents.push({ tool: "get_weather",   args: { city: entities.city } });
  if (entities.hasTime && entities.city)
    intents.push({ tool: "get_time",      args: { city: entities.city } });
  if (entities.hasNews && entities.newsQuery)
    intents.push({ tool: "get_news",      args: { query: entities.newsQuery } });
  if (entities.hasListDir && entities.fsTarget)
    intents.push({ tool: "list_dir",      args: { path: entities.fsTarget } });
  if (entities.hasOpenFile && entities.fsTarget)
    intents.push({ tool: "open_file",     args: { path: entities.fsTarget } });
  if (entities.hasSearchFile && entities.fsQuery)
    intents.push({ tool: "search_files",  args: { path: entities.fsTarget || "home", query: entities.fsQuery } });
  return intents;
}

module.exports = { extractEntities, buildIntents };