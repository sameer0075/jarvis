const OLLAMA_CONFIG = {
  OLLAMA_HOST: "127.0.0.1",
  OLLAMA_PORT: 11434,
  DEFAULT_MODEL: process.env.OLLAMA_MODEL || "llama3.1:8b",
  LLM_OPTIONS: { num_predict: 300, num_ctx: 4096 },
};

// utils/config.js — add these
const MODELS = {
  // Tier 1 — always fast, no GPU pressure
  ORCHESTRATOR:  "llama3.2:3b",      // intent routing (already using this ✓)
  EMBEDDINGS:    "nomic-embed-text",  // semantic search (already using this ✓)
  SYSTEM:        "phi3:mini",         // system commands — small, fast, accurate enough

  // Tier 2 — everyday chat
  CHAT:          "llama3.1:8b",       // general conversation
  TOOLS:         "qwen3:8b",          // weather/news/filesystem synthesis

  // Tier 3 — only when needed
  // HEAVY:         "qwen3.5:9b",        // complex reasoning, long docs, code analysis
  HEAVY:            "llama3.1:8b"
};

// Keywords that escalate to Tier 3
const HEAVY_TRIGGERS = [
  "explain in detail", "analyze", "summarize this document", "write code",
  "debug", "compare", "pros and cons", "essay", "long", "detailed"
];

module.exports = { MODELS, HEAVY_TRIGGERS, ...OLLAMA_CONFIG };