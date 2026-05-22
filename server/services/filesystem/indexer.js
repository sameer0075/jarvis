const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const FileIndex = require("../../models/FileIndex");
const { normalizeFile } = require("./utils");

const IGNORED = new Set([
  "node_modules", ".git", ".next", ".DS_Store",
  "Library", "Applications", "Caches", ".Trash",
  "__pycache__", ".venv", "dist", "build",
]);

const TARGET_DIRS = [
  "Desktop", "Downloads", "Documents", "Pictures", "Music", "Videos",
];

// Only index top-level entries in each target dir
// If entry is a folder → index the folder itself (not its contents)
// If entry is a file   → index the file
async function indexTopLevel(targetDir) {
  let entries;
  try {
    entries = await fs.readdir(targetDir, { withFileTypes: true });
  } catch (e) {
    return 0;
  }

  let count = 0;
  for (const entry of entries) {
    if (IGNORED.has(entry.name) || entry.name.startsWith(".")) continue;

    const fullPath = path.join(targetDir, entry.name);
    try {
      const stat = await fs.stat(fullPath);
      const normalized = normalizeFile(fullPath, stat);

      await FileIndex.findOneAndUpdate(
        { path: fullPath },
        normalized,
        { upsert: true, new: true }
      );
      count++;
    } catch (e) {
    }
  }
  return count;
}

async function buildFilesystemIndex() {
  const homeDir = os.homedir();

  let total = 0;
  const scannedPaths = new Set();

  for (const dirName of TARGET_DIRS) {
    const fullDir = path.join(homeDir, dirName);
    let entries;

    try {
      entries = await fs.readdir(fullDir, { withFileTypes: true });
    } catch (e) {
      continue;
    }

    for (const entry of entries) {
      if (IGNORED.has(entry.name) || entry.name.startsWith(".")) continue;

      const fullPath = path.join(fullDir, entry.name);

      try {
        const stat = await fs.stat(fullPath);

        scannedPaths.add(fullPath);

        const normalized = normalizeFile(fullPath, stat);

        // only insert/update if changed
        await FileIndex.updateOne(
          {
            path: fullPath,
            modifiedAt: stat.mtime,
          },
          {
            $setOnInsert: normalized,
          },
          {
            upsert: true,
          }
        );

        // if modified changed, update data
        await FileIndex.updateOne(
          {
            path: fullPath,
            modifiedAt: { $ne: stat.mtime },
          },
          {
            $set: normalized,
          }
        );

        total++;
      } catch (e) {
      }
    }
  }

  // remove deleted files only
  const allDbFiles = await FileIndex.find({}, { path: 1 });

  const deletedPaths = allDbFiles
    .map(f => f.path)
    .filter(p => !scannedPaths.has(p));

  if (deletedPaths.length) {
    await FileIndex.deleteMany({
      path: { $in: deletedPaths }
    });
  }
}

module.exports = { buildFilesystemIndex, indexTopLevel };