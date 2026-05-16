const path = require("path");
const os = require("os");

const KNOWN_DIRS = {
  downloads: path.join(os.homedir(), "Downloads"),
  desktop: path.join(os.homedir(), "Desktop"),
  documents: path.join(os.homedir(), "Documents"),
  pictures: path.join(os.homedir(), "Pictures"),
  music: path.join(os.homedir(), "Music"),
  videos: path.join(os.homedir(), "Videos"),
  home: os.homedir(),
};

function resolvePath(input) {
  if (!input) return os.homedir();

  const lower = input.toLowerCase().trim();

  for (const [key, p] of Object.entries(KNOWN_DIRS)) {
    if (lower.includes(key)) return p;
  }

  if (path.isAbsolute(input)) return input;

  return path.join(os.homedir(), input);
}

module.exports = {
  resolvePath,
  KNOWN_DIRS,
};