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
});

analyzeLoop();

const getGreeting = () => {
  const hour = new Date().getHours();
  const day = new Date().getDay();

  const isWeekend = day === 0 || day === 6;

  const morningGreetings = [
    "Good morning, sir. The systems are fully operational.",
    "Morning, sir. What's the Agenda for Today.",
  ];

  const afternoonGreetings = [
    "Good afternoon, sir. All systems are stable.",
    "Welcome back, sir. Shall we continue today's work?",
    "Everything is online, sir. Ready when you are.",
  ];

  const eveningGreetings = [
    "Good evening, sir. I've been expecting you.",
  ];

  const nightGreetings = [
    "Working late again, sir? I'll remain online for as long as needed.",
  ];

  const weekendGreetings = [
    "Happy weekend, sir. Shall we build something extraordinary?",
  ];

  let pool = [];

  if (isWeekend) {
    pool = weekendGreetings;
  } else if (hour >= 5 && hour < 12) {
    pool = morningGreetings;
  } else if (hour >= 12 && hour < 18) {
    pool = afternoonGreetings;
  } else if (hour >= 18 && hour < 23) {
    pool = eveningGreetings;
  } else {
    pool = nightGreetings;
  }

  return pool[Math.floor(Math.random() * pool.length)];
};

function createServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server, path: "/api/chat/stream" });

  app.use(cors({ origin: "*" }));
  app.use(express.json({ limit: "50mb" }));
  app.use("/api", routes);

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => { ws.isAlive = true; });

    ws.on("message", async (raw) => {
      let payload;
      try {
        payload = JSON.parse(raw.toString());
      } catch {
        return ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      }

      const { message, sessionId = "default", model, type } = payload;
      const send = (data) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
      };

      // ── DOUBLE CLAP WAKE ── Instant, no LLM, no thinking
      if (type === "greet") {
        const greetings = getGreeting()
        const greeting = greetings[Math.floor(Math.random() * greetings.length)];
        const msgs = getSession(sessionId);
        msgs.push({ role: "assistant", content: greeting });
        send({ type: "greet", content: greeting });
        return;
      }

      // ── NORMAL CHAT ──
      if (!message) {
        return ws.send(JSON.stringify({ type: "error", error: "message required" }));
      }

      const msgs = getSession(sessionId);
      const userMsg = { role: "user", content: message };

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