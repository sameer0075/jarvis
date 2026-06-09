// agents/fastRouter.js
const FAST_ROUTES = [
  { pattern: /\b(set|turn|increase|decrease|mute|unmute|volume|brightness|wifi|bluetooth|screenshot|lock|sleep|open app|close app)\b/i, agents: ["system"] },
  { pattern: /\bweather\b/i, agents: ["weather", "chat"] },
  { pattern: /\b(time|clock|timezone)\b/i, agents: ["time", "chat"] },
  { pattern: /\b(news|headlines?|latest)\b/i, agents: ["news", "chat"] },
  { pattern: /\b(find|search|open|show|list|display)\b.{0,40}\b(file|folder|director|desktop|downloads|documents)\b/i, agents: ["filesystem", "chat"] },
  { pattern: /\bscreen\b|\bwhat.*visible\b|\bwhat.*open\b/i, agents: ["vision", "chat"] },
];

function fastRoute(userMessage) {
  for (const { pattern, agents } of FAST_ROUTES) {
    if (pattern.test(userMessage)) return agents;
  }
  return null; // fall through to LLM orchestrator
}

module.exports = { fastRoute };