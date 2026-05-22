const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const routes = require("./routes/routes");
const { getSession } = require("./utils/session");
const { runChat } = require("./services/chat");
const { buildFilesystemIndex } = require("./services/filesystem/indexer");
const { startFilesystemWatcher } = require("./services/filesystem/watcher");
const { analyzeLoop } = require("./services/vision/observer");

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log("MongoDB Connected");
  // (async () => {
  // buildFilesystemIndex()
  //     .then(() => startFilesystemWatcher())
  //     .catch(e => console.error("[INDEXER] Error:", e.message));
  // })();
});

analyzeLoop();

function createServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server, path: "/api/chat/stream" });

  app.use(cors({ origin: "*" }));
  app.use(express.json({ limit: "50mb" }));
  app.use("/api", routes);

  // ── WebSocket ──────────────────────────────────────────────────────────────
  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        return ws.send(
          JSON.stringify({ type: "error", error: "Invalid JSON" }),
        );
      }

      const { message, sessionId = "default", model } = payload;
      if (!message)
        return ws.send(
          JSON.stringify({ type: "error", error: "message required" }),
        );

      const msgs = getSession(sessionId);
      const userMsg = { role: "user", content: message };

      const send = (data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
      };

      try {
        const result = await runChat(
          [...msgs, userMsg],
          model,
          true,
          (chunk) => send({ type: "chunk", content: chunk }),
          (preMessage) => send({ type: "chunk", content: preMessage }),
        );
        msgs.push(userMsg);
        msgs.push({ role: "assistant", content: result.raw });
        send({
          type: "done",
          actions: result.actions,
          fullText: result.text,
          widgetData: result.widgetData,
        });
      } catch (err) {
        console.error("[WS]", err.message);
        send({ type: "error", error: err.message });
      }
    });

    ws.on("close", () => console.log("[WS] Disconnected"));
    ws.on("error", (e) => console.error("[WS] Error:", e.message));
  });

  // Keepalive ping
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);
  wss.on("close", () => clearInterval(pingInterval));

  return server;
}

module.exports = { createServer };
