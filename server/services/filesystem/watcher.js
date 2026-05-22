const chokidar = require("chokidar");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const FileIndex = require("../../models/FileIndex");
const { normalizeFile } = require("./utils");

const TARGET_DIRS = [
  "Desktop", "Downloads", "Documents", "Pictures", "Music", "Videos",
];

function getTopLevelPath(filePath, homeDir) {
  // Returns the top-level item path if filePath is directly inside a target dir
  // e.g. /Users/x/Desktop/pogo_web_app/src/index.js → /Users/x/Desktop/pogo_web_app
  for (const dir of TARGET_DIRS) {
    const base = path.join(homeDir, dir);
    if (filePath.startsWith(base + path.sep)) {
      const relative = filePath.slice(base.length + 1);
      const topName  = relative.split(path.sep)[0];
      if (topName) return path.join(base, topName);
    }
  }
  return null;
}

async function indexSingle(filePath) {
  const homeDir = os.homedir();
  const topPath = getTopLevelPath(filePath, homeDir);
  if (!topPath) return; // not in a tracked dir

  try {
    const stat = await fs.stat(topPath);
    const normalized = normalizeFile(topPath, stat);
    await FileIndex.findOneAndUpdate(
      { path: topPath },
      normalized,
      { upsert: true }
    );
  } catch {
    // Top-level item was deleted
    await FileIndex.deleteOne({ path: topPath });
  }
}

async function removeSingle(filePath) {
  const homeDir = os.homedir();
  const topPath = getTopLevelPath(filePath, homeDir);
  if (!topPath) return;

  // Only remove from index if the top-level item itself is gone
  try {
    await fs.stat(topPath); // still exists, don't remove
  } catch {
    await FileIndex.deleteOne({ path: topPath });
  }
}

function startFilesystemWatcher() {
  const homeDir = os.homedir();
  const watchPaths = TARGET_DIRS.map(d => path.join(homeDir, d));

  const watcher = chokidar.watch(watchPaths, {
    ignored:         /(^|[\/\\])\../,
    persistent:      true,
    ignoreInitial:   true,
    depth:           5, // watch nested changes but only update top-level index
  });

  watcher.on("add",    indexSingle);
  watcher.on("addDir", indexSingle);
  watcher.on("change", indexSingle);
  watcher.on("unlink", removeSingle);
  watcher.on("unlinkDir", removeSingle);
}

module.exports = { startFilesystemWatcher };