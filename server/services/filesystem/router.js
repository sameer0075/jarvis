const ollama = require("../ollama");

const PROMPT = `Extract the file or folder name the user wants to find, and the location.
Return ONLY JSON: {"query":"name","location":"desktop|downloads|documents|pictures|music|videos|home"}

Rules:
- query = the exact target name only (1-3 words). Strip greetings, assistant names, "folder", "file", "find", "search", "show", "my", "the".
- location = where to look. Default "home" if not mentioned.

Examples:
"hey jarvis find pogo folder on desktop" → {"query":"pogo","location":"desktop"}
"where is my resume" → {"query":"resume","location":"home"}
"show downloads" → {"query":"","location":"downloads"}
"find budget spreadsheet in documents" → {"query":"budget spreadsheet","location":"documents"}
"open chrome app" → {"query":"chrome","location":"home"}

User: `;

function deterministicRoute(msg) {
  const lower = msg.toLowerCase();
  const LOCATIONS = "desktop|downloads|documents|pictures|music|videos|home";

  // ── Generic list: "show desktop", "list downloads folder" ─────────────────
  const listMatch = lower.match(
    new RegExp(`(?:show|list|display)\\s+(?:all\\s+)?(?:my\\s+)?(${LOCATIONS})\\s*(?:folder)?`)
  );
  if (listMatch) return { tool: "list_dir", args: { path: listMatch[1] } };

  // ── Generic list with "in": "list all folders and files in desktop" ────────
  // Must come BEFORE namedSearch — more specific pattern
  const listInMatch = lower.match(
    new RegExp(
      `(?:list(?:\\s+down)?|show|show\\s+me|display|tell\\s+me|what(?:'s|\\s+is|\\s+are))` +
      `\\s+(?:all\\s+)?` +
      `(?:(?:folders?|files?|items?|contents?)(?:\\s+(?:and|&|or)\\s+(?:folders?|files?|items?|contents?))?\\s+)?` +
      `(?:in|inside|on|from|of)\\s+(${LOCATIONS})`
    )
  );
  if (listInMatch) return { tool: "list_dir", args: { path: listInMatch[1] } };

  // ── Named search + optional location: "show me pogo in desktop" ───────────
  const namedSearch = lower.match(
    /(?:show(?:\s+me)?|find|search(?:\s+for)?|where(?:\s+is)?|locate)\s+(?:my\s+)?(.+?)(?:\s+(?:in|on|from|at)\s+(desktop|downloads|documents|pictures|music|videos|home))?$/
  );
  if (namedSearch) {
    let query = namedSearch[1].trim();
    const location = namedSearch[2] || "home";

    query = query
      .replace(/\b(folder|folders|file|files|the|my|a|an)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (query.length >= 2) {
      return { tool: "search_files", args: { query, searchDir: location } };
    }
  }

  // ── Open by name: "open pogo-backend" ─────────────────────────────────────
  const openMatch = lower.match(/^open\s+(.+?)(?:\s+(?:folder|file|app))?$/);
  if (openMatch) {
    return { tool: "find_and_open", args: { query: openMatch[1].trim(), searchDir: "home" } };
  }

  return null;
}

async function routeFileIntent(userMessage) {
  try {
    const fast = deterministicRoute(userMessage);
    console.log("fast",fast)
    if (fast) {
      console.log("[ROUTER] Deterministic:", fast.tool);
      return fast;
    }
    const data = await ollama.post({
      model: 'llama3.2:3b',
      keep_alive: -1,
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: userMessage },
      ],
      stream: false,
      format: "json",
      options: { temperature: 0, num_predict: 80, num_ctx: 1024 },
      think: false
    });

    const raw = (data.message?.content || "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    
    // Safety strip
    if (parsed.query) {
      parsed.query = parsed.query
        .replace(/\b(folder|folders|file|files|directory|directories|app|application)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    // If no query, it's a list_dir request
    if (!parsed.query) {
      return { tool: "list_dir", args: { path: parsed.location || "home" } };
    }

    return { tool: "search_files", args: { query: parsed.query, searchDir: parsed.location || "home" } };
  } catch (e) {
    console.warn("[ROUTER] Failed:", e.message);
    return null;
  }
}

module.exports = { routeFileIntent };