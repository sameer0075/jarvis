require("dotenv").config();
const API_KEY = 'a9e145f998364e4488754faa0f8966f2';
const BASE_URL = "https://newsapi.org/v2/everything";

async function fetchNews(query) {
  try {
    const url = `${BASE_URL}?q=${encodeURIComponent(query)}&sortBy=publishedAt&pageSize=5&apiKey=${API_KEY}`;
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

module.exports = { fetchNews };