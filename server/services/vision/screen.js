const screenshot = require("screenshot-desktop");
const crypto = require("crypto");

async function captureScreen() {
  return screenshot({ format: "png" });
}

function hashBuffer(buffer) {
  return crypto
    .createHash("md5")
    .update(buffer)
    .digest("hex");
}

module.exports = {
  captureScreen,
  hashBuffer,
};