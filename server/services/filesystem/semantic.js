const { searchFiles, findBestMatch } = require("./search");
const { routeFileIntent } = require("./router");
const { listDirectory, openFile } = require("../tools/filesystem");
const { openPath } = require("../tools/opener");

async function semanticSearch(userQuery) {
  // Step 1: LLM routes the intent
  const route = await routeFileIntent(userQuery);
  console.log("[SEMANTIC] Route:", route);
  console.log("route",route)

  if (!route) {
    // Fallback: plain fuzzy search across home
    const result = await searchFiles({ query: userQuery, searchDir: "home" });
    return formatSearchResult(result);
  }

  const { tool, args } = route;
  console.log("tooltool",tool)

  // Step 2: Execute the routed tool
  switch (tool) {
    case "list_dir": {
      const result = await listDirectory(args.path || "home");
      console.log("resultlist_dir",result)

      return { ok: result.ok, type: "list_dir", path: result.path, entries: result.entries, error: result.error };
    }

    case "search_files": {
      const result = await searchFiles({
        query:     args.query || userQuery,
        searchDir: args.searchDir || "home",
      });
      console.log("resultsearch_files",result)
      return formatSearchResult(result);
    }

    case "find_and_open": {
      const best = await findBestMatch(args.query || userQuery, args.searchDir || "home");
      if (!best) {
        return { ok: false, type: "find_and_open", error: `No file matching "${args.query}" found` };
      }
      console.log("bestfind_and_open",best)
      try {
        await openPath(best.path);
        return {
          ok:   true,
          type: "find_and_open",
          name: best.name,
          path: best.path,
          score: best.score,
          message: `Opened ${best.name}`,
        };
      } catch (e) {
        return { ok: false, type: "find_and_open", error: e.message };
      }
    }

    default:
      return { ok: false, error: `Unknown tool: ${tool}` };
  }
}

function formatSearchResult(result) {
  if (!result.ok) return result;
  return {
    ok:        true,
    type:      "search_files",
    query:     result.query,
    searchDir: result.searchDir,
    count:     result.count,
    entries:   result.results.map(r => ({
      name:        r.name,
      path:        r.path,
      isDirectory: r.isDirectory,
      extension:   r.extension,
      size:        r.size,
      modifiedAt:  r.modifiedAt,
      icon:        getIcon(r.name, r.isDirectory),
      score:       r.score,
    })),
  };
}

function getIcon(name, isDir) {
  if (isDir) return "📁";
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    pdf:"📄", doc:"📝", docx:"📝", txt:"📝",
    jpg:"🖼", jpeg:"🖼", png:"🖼", gif:"🖼", webp:"🖼",
    mp4:"🎬", mkv:"🎬", mov:"🎬", avi:"🎬",
    mp3:"🎵", wav:"🎵", flac:"🎵",
    zip:"🗜", rar:"🗜",
    js:"💻", ts:"💻", py:"💻", java:"💻",
    xlsx:"📊", csv:"📊", xls:"📊",
    ppt:"📋", pptx:"📋",
  };
  return map[ext] || "📎";
}

module.exports = { semanticSearch };