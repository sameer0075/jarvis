const ollama = require("../ollama");
const FILE_SYSTEM_PROMPT = `You are a FILE INTELLIGENCE ROUTER for a desktop assistant.

AVAILABLE TOOLS:
- search_files  → search/find files or folders by name or description, also used when user wants to "show contents" or "list files matching a name"
- list_dir      → list ALL contents of a known folder (downloads, desktop, documents etc) with no filter
- find_and_open → find a file/folder by name and open it

RULES:
1. NEVER reduce the query to a single word. Preserve full meaning.
2. "Search Pogo folder from Desktop" → search_files with query "pogo" and searchDir "desktop"
3. "Show downloads folder" → list_dir with path "downloads"
4. "Open my resume" → find_and_open with query "resume"
5. searchDir must be one of: home, downloads, desktop, documents, pictures, music, videos
6. If user says "show list" or "show contents" of a NAMED thing (not just the folder), use search_files.
7. OUTPUT ONLY RAW JSON — no explanation, no markdown, no backticks.

Examples:
{"tool":"search_files","args":{"query":"pogo","searchDir":"desktop"}}
{"tool":"list_dir","args":{"path":"downloads"}}
{"tool":"find_and_open","args":{"query":"resume","searchDir":"home"}}
{"tool":"search_files","args":{"query":"budget spreadsheet","searchDir":"documents"}}`;

async function routeFileIntent(userMessage) {
  try {
    const data = await ollama.post({
      model:   'llama3.2:3b',
      messages: [
        { role: "system", content: FILE_SYSTEM_PROMPT },
        { role: "user",   content: userMessage },
      ],
      stream:  false,
      format:  "json",
      options: { temperature: 0, num_predict: 150, num_thread: 4, num_ctx: 1024, keep_alive: -1 },
      think: false
    });

    const raw = (data.message?.content || "").trim();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) { console.warn("[FILE ROUTER] No JSON found"); return null; }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.tool || !parsed.args) { console.warn("[FILE ROUTER] Missing tool/args"); return null; }

    return parsed;
  } catch (e) {
    console.warn("[FILE ROUTER] Failed:", e.message);
    return null;
  }
}

module.exports = { routeFileIntent };