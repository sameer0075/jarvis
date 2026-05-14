const STRIP_WORDS = /\b(tell|me|show|what|is|are|the|weather|time|of|in|at|for|today|now|current|currently|please|can|you|give|get|about|clock|right|how|whats|what's|latest|a|an|do|does|i|want|need|check|look|up|find|jarvis|hey|hi|hello|forecast|temperature|temp|outside|like|its|it's|going|gonna)\b/g;

function extractCity(msg) {
  const city = msg
    .replace(STRIP_WORDS, " ")
    .replace(/[?.,!'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (city.length < 2) return null;
  return city.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function extractNewsQuery(msg) {
  const m = msg.match(/(?:news|latest|headlines?)\s+(?:about|on|for|regarding)?\s*(.+?)(?:\?|$)/);
  if (m) return m[1].trim();
  return msg
    .replace(/\b(news|latest|headlines?|give|me|show|tell|about|get|the|what|is|are)\b/g, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

function extractEntities(message) {
  const msg = message.toLowerCase().trim();

  const hasWeather = /\bweather\b/.test(msg);
  const hasTime    = /\b(time|clock|what time)\b/.test(msg);
  const hasNews    = /\b(news|headlines?|latest|breaking)\b/.test(msg);

  const city = (hasWeather || hasTime) ? extractCity(msg) : null;
  const newsQuery = hasNews ? extractNewsQuery(msg) : null;

  const entities = { city, newsQuery, hasWeather, hasTime, hasNews };
  console.log("[INTENT]", entities);
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
  return intents;
}

module.exports = { extractEntities, buildIntents };