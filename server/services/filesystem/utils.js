const path = require("path");
const mime = require("mime-types");

function tokenize(filename) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeFile(filePath, stat) {
  const ext = path.extname(filePath).replace(".", "").toLowerCase();

  return {
    name: path.basename(filePath),
    lowerName: path.basename(filePath).toLowerCase(),
    path: filePath,
    extension: ext,
    directory: path.dirname(filePath),
    size: stat.size,
    mime: mime.lookup(filePath) || null,
    modifiedAt: stat.mtime,
    createdAtFs: stat.birthtime,
    isDirectory: stat.isDirectory(),
    tokens: tokenize(path.basename(filePath)),
  };
}

module.exports = {
  tokenize,
  normalizeFile,
};