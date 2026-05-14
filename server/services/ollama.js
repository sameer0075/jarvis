const http = require("http");
const { OLLAMA_HOST, OLLAMA_PORT } = require("../utils/config");

function request(path, method = "GET", body = null) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const options = {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (bodyStr) options.headers["Content-Length"] = Buffer.byteLength(bodyStr);

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error("Bad JSON from Ollama: " + data.slice(0, 200))); }
      });
    });

    req.on("error", (e) => reject(new Error("Ollama unreachable: " + e.message)));
    req.setTimeout(method === "GET" ? 5000 : 180000, () => {
      req.destroy();
      reject(new Error(`Ollama ${method} timeout`));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function stream(body, onChunk, onDone, onError) {
  const bodyStr = JSON.stringify(body);
  let finished = false;

  const req = http.request(
    {
      hostname: OLLAMA_HOST,
      port: OLLAMA_PORT,
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
      },
    },
    (res) => {
      let buf = "", full = "", filtered = "", lastSentLen = 0;

      function processLines(lines) {
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.error) {
              if (!finished) { finished = true; onError(new Error(obj.error)); }
              return;
            }
            const content = obj.message?.content || "";
            if (content) {
              full += content;
              filtered += content;
              // Strip <think> blocks (qwen reasoning tokens)
              const cleaned = filtered
                .replace(/<think>[\s\S]*?<\/think>/g, "")
                .replace(/<think>[\s\S]*/g, "");
              const toSend = cleaned.slice(lastSentLen);
              if (toSend) { onChunk(toSend); lastSentLen = cleaned.length; }
            }
            if (obj.done && !finished) {
              finished = true;
              onDone(full.replace(/<think>[\s\S]*?<\/think>/g, "").trim());
            }
          } catch { /* skip malformed lines */ }
        }
      }

      res.on("data", (chunk) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop();
        processLines(lines);
      });
      res.on("end", () => {
        if (buf.trim()) processLines([buf]);
        if (!finished) {
          finished = true;
          onDone(full.replace(/<think>[\s\S]*?<\/think>/g, "").trim());
        }
      });
      res.on("error", (e) => {
        if (!finished) { finished = true; onError(e); }
      });
    }
  );

  req.on("error", (e) => {
    if (!finished) { finished = true; onError(new Error("Ollama unreachable: " + e.message)); }
  });
  req.setTimeout(180000, () => {
    req.destroy();
    if (!finished) { finished = true; onError(new Error("Stream timeout")); }
  });

  req.write(bodyStr);
  req.end();
}

async function post(body) {
  return request("/api/chat", "POST", body);
}

async function getTags() {
  return request("/api/tags", "GET");
}

module.exports = { post, getTags, stream };