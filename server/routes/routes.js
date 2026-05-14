const { Router } = require("express");
const { getTags } = require("../services/ollama");
const { getSession, deleteSession } = require("../utils/session");
const { runChat } = require("../services/chat");
const { DEFAULT_MODEL } = require("../utils/config");
const { fetchTrendingNews, fetchQueryNews } = require("../services/tools/news");
const { fetchWeatherDetails } = require("../services/tools/weather");

const router = Router();

router.get("/status", async (req, res) => {
  try {
    const data = await getTags();
    res.json({ status: "online", model: DEFAULT_MODEL, models: data.models || [] });
  } catch {
    res.json({ status: "offline", model: DEFAULT_MODEL, models: [] });
  }
});

router.get("/models", async (req, res) => {
  try {
    const data = await getTags();
    res.json({ models: data.models || [] });
  } catch (e) {
    res.status(503).json({ error: e.message, models: [] });
  }
});

router.post("/clear", (req, res) => {
  deleteSession(req.body?.sessionId || "default");
  res.json({ ok: true });
});

router.post("/chat", async (req, res) => {
  const { message, sessionId = "default", model } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });

  const msgs    = getSession(sessionId);
  const userMsg = { role: "user", content: message };

  try {
    const result = await runChat([...msgs, userMsg], model, false);
    msgs.push(userMsg);
    msgs.push({ role: "assistant", content: result.raw });
    res.json({ reply: result.text, actions: result.actions, widgetData: result.widgetData, sessionId });
  } catch (e) {
    console.error("[REST]", e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get("/trending-news", async (req,res) => {
  try {
    const result = await fetchTrendingNews('bbc-news,cnn,al-jazeera-english,the-verge,reuters,associated-press')
    res.json(result);
  } catch (e) {
    console.error("[REST]", e.message);
    res.status(500).json({ error: e.message });
  }
})

router.get("/search-news/:query", async (req,res) => {
  try {
    const result = await fetchQueryNews(req.params.query)
    res.json(result);
  } catch (e) {
    console.error("[REST]", e.message);
    res.status(500).json({ error: e.message });
  }
})

router.get("/get-weather-details/:city", async (req,res) => {
  try {
    const result = await fetchWeatherDetails(req.params.city)
    res.json(result);
  } catch (e) {
    console.error("[REST]", e.message);
    res.status(500).json({ error: e.message });
  }
})

module.exports = router;