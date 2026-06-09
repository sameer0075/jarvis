// services/preWarm.js
const ollama = require("../services/ollama");

const WARM_MODELS = [
  { model: "llama3.2:3b", keep_alive: "10m" },
  { model: "llama3.1:8b", keep_alive: "5m"  },
//   { model: "phi3:mini",   keep_alive: "5m"  },
];

async function preWarmModels() {
  console.log("[PREWARM] Starting model warm-up...");
  for (const { model, keep_alive } of WARM_MODELS) {
    try {
      await ollama.post({
        model,
        keep_alive,
        messages: [{ role: "user", content: "hi" }],
        stream:   false,
        options:  { num_predict: 1, num_ctx: 512 },
      });
      console.log(`[PREWARM] ✓ ${model}`);
    } catch (e) {
      console.warn(`[PREWARM] ✗ ${model}: ${e.message}`);
    }
  }
  console.log("[PREWARM] Done");
}

module.exports = { preWarmModels };
