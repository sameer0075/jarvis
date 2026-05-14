module.exports = {
  OLLAMA_HOST: "127.0.0.1",
  OLLAMA_PORT: 11434,
  DEFAULT_MODEL: process.env.OLLAMA_MODEL || "qwen3.5:9b",
  LLM_OPTIONS: { num_predict: 300, num_ctx: 2048 },
};