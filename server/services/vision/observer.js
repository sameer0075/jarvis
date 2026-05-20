const fs = require("fs");
const path = require("path");

const state = require("./state");
const { captureScreen, hashBuffer } = require("./screen");
const { runOCR } = require("./ocr");
const { getActiveWindow } = require("./windowTracker");

let running = false;

async function analyzeLoop() {
  if (running) return;

  running = true;

  console.log("[VISION] Observer started");

  while (true) {
    try {
      // 1. active window
      const active = await getActiveWindow();

      const title = active?.title || "";
      const app   = active?.owner?.name || "";

      const windowChanged =
        title !== state.activeWindow?.title;

      // 2. capture screen
      const buffer = await captureScreen();

      // 3. compare hashes
      const hash = hashBuffer(buffer);

      const screenChanged =
        hash !== state.lastScreenHash;

      // update hashes
      state.lastScreenHash = hash;
      state.activeWindow = active;

      // 4. only OCR when needed
      if (screenChanged || windowChanged) {
        console.log("[VISION] Change detected");

        const ocrText = await runOCR(buffer);

        state.lastOCR = ocrText;
        state.lastUpdate = Date.now();

        console.log("[VISION] OCR updated");
        console.log(ocrText.slice(0, 500));
      }

      // sleep
      await new Promise(r => setTimeout(r, 1200));

    } catch (e) {
      console.error("[VISION ERROR]", e);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

module.exports = {
  analyzeLoop,
  state,
};