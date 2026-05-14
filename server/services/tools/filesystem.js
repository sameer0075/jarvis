const fs   = require("fs").promises;
const path = require("path");
const os   = require("os");
const { exec } = require("child_process");

// Map friendly names to real paths
const KNOWN_DIRS = {
  downloads:  path.join(os.homedir(), "Downloads"),
  desktop:    path.join(os.homedir(), "Desktop"),
  documents:  path.join(os.homedir(), "Documents"),
  pictures:   path.join(os.homedir(), "Pictures"),
  music:      path.join(os.homedir(), "Music"),
  videos:     path.join(os.homedir(), "Videos"),
  home:       os.homedir(),
};

const FILE_ICONS = {
  pdf: "📄", doc: "📝", docx: "📝", txt: "📝",
  jpg: "🖼", jpeg: "🖼", png: "🖼", gif: "🖼", webp: "🖼",
  mp4: "🎬", mkv: "🎬", avi: "🎬", mov: "🎬",
  mp3: "🎵", wav: "🎵", flac: "🎵",
  zip: "🗜", rar: "🗜", "7z": "🗜",
  js: "💻", ts: "💻", py: "💻", java: "💻", cpp: "💻",
  exe: "⚙️", msi: "⚙️",
  folder: "📁",
};

function getIcon(name, isDir) {
  if (isDir) return FILE_ICONS.folder;
  const ext = name.split(".").pop()?.toLowerCase();
  return FILE_ICONS[ext] || "📎";
}

function formatSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function resolvePath(input) {
  const lower = input.toLowerCase().trim();

  // Match known friendly names
  for (const [key, p] of Object.entries(KNOWN_DIRS)) {
    if (lower.includes(key)) return p;
  }

  // Absolute path given
  if (path.isAbsolute(input)) return input;

  // Relative to home
  return path.join(os.homedir(), input);
}

async function listDirectory(dirPath) {
  try {
    const resolved = resolvePath(dirPath);
    const entries  = await fs.readdir(resolved, { withFileTypes: true });

    const files = await Promise.all(
      entries.map(async (e) => {
        try {
          const fullPath = path.join(resolved, e.name);
          const stat     = await fs.stat(fullPath);
          return {
            name:     e.name,
            type:     e.isDirectory() ? "folder" : "file",
            icon:     getIcon(e.name, e.isDirectory()),
            size:     e.isDirectory() ? null : formatSize(stat.size),
            sizeBytes: e.isDirectory() ? null : stat.size,
            modified: stat.mtime.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            path:     fullPath,
            ext:      e.isDirectory() ? null : e.name.split(".").pop()?.toLowerCase(),
          };
        } catch {
          return null;
        }
      })
    );

    const sorted = files
      .filter(Boolean)
      .sort((a, b) => {
        // Folders first, then by name
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    return { ok: true, path: resolved, entries: sorted };
  } catch (e) {
    return { ok: false, error: e.message, path: dirPath };
  }
}

async function openFile(filePath) {
  return new Promise((resolve) => {
    // Sanitize — reject any path that looks like a URL
    if (filePath.startsWith("http") || filePath.startsWith("file:///")) {
      resolve({ ok: false, error: "Invalid path — expected a filesystem path, not a URL" });
      return;
    }

    const cmd = process.platform === "win32"  ? `start "" "${filePath}"`
              : process.platform === "darwin" ? `open "${filePath}"`
              : `xdg-open "${filePath}"`;

    console.log(`[FS] Opening: ${cmd}`);
    exec(cmd, (err) => {
      if (err) resolve({ ok: false, error: err.message });
      else     resolve({ ok: true, path: filePath });
    });
  });
}

async function searchFiles(dirPath, query) {
  try {
    const resolved = resolvePath(dirPath);
    const results  = [];
    const lower    = query.toLowerCase();

    async function walk(dir, depth = 0) {
      if (depth > 3) return; // limit depth
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const e of entries) {
        if (e.name.startsWith(".")) continue; // skip hidden
        const fullPath = path.join(dir, e.name);
        if (e.name.toLowerCase().includes(lower)) {
          const stat = await fs.stat(fullPath).catch(() => null);
          results.push({
            name:     e.name,
            type:     e.isDirectory() ? "folder" : "file",
            icon:     getIcon(e.name, e.isDirectory()),
            size:     stat && !e.isDirectory() ? formatSize(stat.size) : null,
            modified: stat ? stat.mtime.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null,
            path:     fullPath,
            ext:      e.isDirectory() ? null : e.name.split(".").pop()?.toLowerCase(),
          });
        }
        if (e.isDirectory() && results.length < 50) {
          await walk(fullPath, depth + 1);
        }
      }
    }

    await walk(resolved);
    return { ok: true, path: resolved, query, entries: results.slice(0, 30) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { listDirectory, openFile, searchFiles, resolvePath, KNOWN_DIRS };