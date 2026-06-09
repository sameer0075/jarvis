const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const DIR_MAP = {
  home: os.homedir(),
  desktop: path.join(os.homedir(), "Desktop"),
  downloads: path.join(os.homedir(), "Downloads"),
  documents: path.join(os.homedir(), "Documents"),
  pictures: path.join(os.homedir(), "Pictures"),
  music: path.join(os.homedir(), "Music"),
  videos: path.join(os.homedir(), "Videos"),
};

function getIcon(name, isDir) {
  if (isDir) return "📁";
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = { pdf:"📄", doc:"📝", docx:"📝", txt:"📝", jpg:"🖼", jpeg:"🖼", png:"🖼", mp4:"🎬", mp3:"🎵", zip:"🗜", js:"💻", ts:"💻", py:"💻", xlsx:"📊", csv:"📊" };
  return map[ext] || "📎";
}

function mdfindSearch(query, searchDir = "home", limit = 15) {
  const targetDir = DIR_MAP[searchDir.toLowerCase()] || DIR_MAP.home;
  const safeQuery = query.replace(/"/g, '\\"');

  try {
    // EXACT: mdfind -name "pogo" — this is what you asked for
    const cmd = `mdfind -name "${safeQuery}" -onlyin "${targetDir}" 2>/dev/null | head -${limit}`;
    const out = execSync(cmd, { encoding: "utf-8", timeout: 3000 });
    
    return out.trim().split("\n").filter(Boolean).map(p => {
      try {
        const stat = fs.statSync(p);
        const isDir = stat.isDirectory();
        return {
          name: path.basename(p),
          path: p,
          isDirectory: isDir,
          icon: getIcon(path.basename(p), isDir),
        };
      } catch { return null; }
    }).filter(Boolean);
  } catch {
    return [];
  }
}

module.exports = { mdfindSearch, DIR_MAP };