require("dotenv").config();
const Parser = require("rss-parser");
const parser = new Parser();
const API_KEY = 'a9e145f998364e4488754faa0f8966f2';
const BASE_URL = "https://newsapi.org/v2";

async function fetchNews(query) {
  try {
    const url = `${BASE_URL}/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const d = await res.json();

    if (d.status !== "ok") return JSON.stringify({ error: d.message });

    const result = d.articles
      .map((a) => `• ${a.title} (${a.source.name}, ${new Date(a.publishedAt).toLocaleDateString()})`)
      .join("\n");

    return result;
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

async function fetchTrendingNews(sources) {
  try {
    const url = `${BASE_URL}/top-headlines?sources=${sources}&sortBy=publishedAt&pageSize=5&apiKey=${API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const d = await res.json();

    if (d.status !== "ok") return JSON.stringify({ error: d.message });

    return d.articles;
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

async function fetchQueryNews(query) {
  try {
    const url = `${BASE_URL}/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${API_KEY}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const d = await res.json();

    if (d.status !== "ok") return JSON.stringify({ error: d.message });

    return d.articles;
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

module.exports = { fetchNews, fetchTrendingNews, fetchQueryNews };