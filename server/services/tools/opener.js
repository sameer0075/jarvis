const { exec } = require("child_process");

function openPath(targetPath) {
  return new Promise((resolve, reject) => {
    const command = process.platform === "darwin"
      ? `open "${targetPath}"`
      : process.platform === "win32"
      ? `start "" "${targetPath}"`
      : `xdg-open "${targetPath}"`;

    exec(command, (err) => {
      if (err) return reject(err);
      resolve({ success: true, path: targetPath });
    });
  });
}

module.exports = { openPath };