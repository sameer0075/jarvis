const tesseract = require("node-tesseract-ocr");
const fs = require("fs");
const os = require("os");
const path = require("path");

async function runOCR(imageBuffer) {
  const tmp = path.join(os.tmpdir(), `jarvis-${Date.now()}.png`);

  fs.writeFileSync(tmp, imageBuffer);

  try {
    const text = await tesseract.recognize(tmp, {
      lang: "eng",
      oem: 1,
      psm: 6,
    });

    return text;
  } catch (e) {
    return "";
  } finally {
    fs.unlinkSync(tmp);
  }
}

module.exports = { runOCR };