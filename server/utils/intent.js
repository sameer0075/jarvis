const STRIP_WORDS = /\b(tell|me|show|what|is|are|the|weather|time|of|in|at|for|today|now|current|currently|please|can|you|give|get|about|clock|right|how|whats|what's|latest|a|an|do|does|i|want|need|check|look|up|find|jarvis|hey|hi|hello|forecast|temperature|temp|outside|like|its|it's|going|gonna)\b/g;

function extractCity(msg) {
  const city = msg.replace(STRIP_WORDS, " ").replace(/[?.,!'"]/g, " ").replace(/\s+/g, " ").trim();
  if (city.length < 2) return null;
  return city.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function extractNewsQuery(msg) {
  const m = msg.match(/(?:news|latest|headlines?)\s+(?:about|on|for|regarding)?\s*(.+?)(?:\?|$)/);
  if (m) return m[1].trim();
  return msg.replace(/\b(news|latest|headlines?|give|me|show|tell|about|get|the|what|is|are)\b/g, "").replace(/\s+/g, " ").trim() || null;
}

function isFileSystemIntent(msg) {
  // Any of these signals = filesystem request
  const fsVerbs    = /\b(open|find|search|look\s+for|show|list|browse|launch|where\s+is)\b/.test(msg);
  const fsNouns    = /\b(file|folder|document|directory|downloads|desktop|documents|pictures|music|videos|home)\b/.test(msg);
  const hasExt     = /\b[\w\s-]+\.[a-z0-9]{1,5}\b/.test(msg);
  const isUrl      = /https?:\/\//.test(msg) || /\w+\.(com|org|net|io|dev|co|app|ai|uk|edu)\b/.test(msg);

  return !isUrl && (fsNouns || (fsVerbs && hasExt) || (fsVerbs && fsNouns));
}

function extractEntities(message) {
  const msg = message.toLowerCase().trim();

  const hasWeather = /\bweather\b/.test(msg);
  const hasTime    = /\b(time|clock|what time)\b/.test(msg);
  const hasNews    = /\b(news|headlines?|latest|breaking)\b/.test(msg);
  const hasFs      = isFileSystemIntent(msg) && !hasWeather && !hasTime && !hasNews;

  const city      = (hasWeather || hasTime) ? extractCity(msg) : null;
  const newsQuery = hasNews ? extractNewsQuery(msg) : null;

  const entities = { city, newsQuery, hasWeather, hasTime, hasNews, hasFs, rawMessage: message };
  console.log("[INTENT]", { hasWeather, hasTime, hasNews, hasFs });
  return entities;
}

function buildIntents(entities) {
  const intents = [];
  if (entities.hasWeather && entities.city)
    intents.push({ tool: "get_weather", args: { city: entities.city } });
  if (entities.hasTime && entities.city)
    intents.push({ tool: "get_time",    args: { city: entities.city } });
  if (entities.hasNews && entities.newsQuery)
    intents.push({ tool: "get_news",    args: { query: entities.newsQuery } });
  if (entities.hasFs)
    // Pass the full raw message to the LLM router — it decides search/list/open
    intents.push({ tool: "fs_semantic", args: { userQuery: entities.rawMessage } });
  return intents;
}

module.exports = { extractEntities, buildIntents };