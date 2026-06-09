const { mdfindSearch } = require("./mdfind");
const Fuse = require("fuse.js");
const FileIndex = require("../../models/FileIndex");
const { resolvePath } = require("../tools/filesystem");
const path = require("path");
const os = require("os");

const TARGET_DIRS = [
  "Desktop",
  "Downloads",
  "Documents",
  "Pictures",
  "Music",
  "Videos",
];

function resolveSearchDir(searchDir) {
  if (!searchDir || searchDir === "home") return null;
  const homeDir = os.homedir();
  const match = TARGET_DIRS.find(
    (d) => d.toLowerCase() === searchDir.toLowerCase(),
  );
  if (match) return path.join(homeDir, match);
  return resolvePath(searchDir);
}

async function searchFiles({
  query,
  searchDir = "home",
  onlyFolders = false,
  onlyFiles = false,
  limit = 15,
}) {
  if (process.platform === "darwin") {
    let results = mdfindSearch(query, searchDir, limit);

    if (onlyFolders) results = results.filter((r) => r.isDirectory);
    if (onlyFiles) results = results.filter((r) => !r.isDirectory);

    return {
      ok: true,
      query,
      searchDir: searchDir.toLowerCase(),
      count: results.length,
      results,
    };
  }
  const resolvedDir = resolveSearchDir(searchDir);
  const dbFilter = resolvedDir
    ? {
        path: {
          $regex: `^${resolvedDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        },
      }
    : {};

  const docs = await FileIndex.find(dbFilter).lean();
  if (!docs.length) {
    return {
      ok: false,
      error: "No indexed files found. Run buildFilesystemIndex() first.",
      results: [],
    };
  }

  const fuse = new Fuse(docs, {
    keys: [
      { name: "name", weight: 0.7 },
      { name: "lowerName", weight: 0.2 },
      { name: "tokens", weight: 0.1 },
    ],
    threshold: 0.3,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
    distance: 100,
  });

  let results = fuse.search(query).map((r) => ({
    score: r.score,
    name: r.item.name,
    path: r.item.path,
    directory: r.item.directory,
    extension: r.item.extension,
    isDirectory: r.item.isDirectory,
    size: r.item.size,
    modifiedAt: r.item.modifiedAt,
    icon: r.item.icon,
  }));

  if (onlyFolders) results = results.filter((r) => r.isDirectory);
  if (onlyFiles) results = results.filter((r) => !r.isDirectory);

  results.sort((a, b) => {
    const scoreDiff = a.score - b.score;
    if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return scoreDiff;
  });

  results = results.filter((r) => r.score < 0.4);

  return {
    ok: true,
    query,
    searchDir: resolvedDir || "all",
    count: results.length,
    results: results.slice(0, limit),
  };
}

async function findBestMatch(query, searchDir = "home") {
  const result = await searchFiles({ query, searchDir, limit: 5 });
  if (!result.ok || !result.results.length) return null;
  return result.results[0];
}

module.exports = { searchFiles, findBestMatch };
