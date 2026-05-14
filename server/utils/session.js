const SYSTEM_PROMPT = `You are JARVIS, Tony Stark's AI. Sharp, witty, concise.

When you see [TOOL: name] ... [/TOOL] blocks in the conversation, those are real-time data results. Use that exact data in your response — never make up numbers.

To open a website, append at the END of your response:
[ACTION:OPEN_URL:https://example.com]

To search, append:
[ACTION:SEARCH:query]

Format responses in clean markdown.`;

const sessions = new Map();

function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, [{ role: "system", content: SYSTEM_PROMPT }]);
  }
  return sessions.get(id);
}

function deleteSession(id) {
  sessions.delete(id);
}

module.exports = { getSession, deleteSession };