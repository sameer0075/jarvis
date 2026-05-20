const activeWin = require("active-win");

async function getActiveWindow() {
  try {
    return await activeWin();
  } catch {
    return null;
  }
}

module.exports = { getActiveWindow };