require("dotenv").config();
const Parser = require("rss-parser");

const parser = new Parser({
  timeout: 6000,
});

function formatArticle(item) {
  return {
    title: item.title || "No title",
    url: item.link || "",
    source:
      item.source?.title ||
      item.creator ||
      item.author ||
      "Google News",
    time: item.pubDate
      ? new Date(item.pubDate).toLocaleString()
      : "Unknown",
    publishedAt: item.pubDate || new Date().toISOString(),
  };
}

/* ──────────────────────────────────────────────
   SEARCH NEWS
────────────────────────────────────────────── */
async function fetchNews(query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      query
    )}&hl=en-US&gl=US&ceid=US:en`;

    const feed = await parser.parseURL(url);

    const articles = (feed.items || [])
      .slice(0, 5)
      .map(formatArticle);

    const result = articles
      .map(
        (a) =>
          `• ${a.title} (${a.source}, ${new Date(
            a.publishedAt
          ).toLocaleDateString()})`
      )
      .join("\n");

    return result;
  } catch (e) {
    console.log("fetchNews error", e);
    return JSON.stringify({ error: e.message });
  }
}

/* ──────────────────────────────────────────────
   TRENDING NEWS
────────────────────────────────────────────── */
async function fetchTrendingNews() {
  try {
    const url =
      "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en";

    const feed = await parser.parseURL(url);

    const articles = (feed.items || [])
      .slice(0, 10)
      .map(formatArticle);

    return articles;
  } catch (e) {
    console.log("fetchTrendingNews error", e);
    return [];
  }
}

/* ──────────────────────────────────────────────
   QUERY NEWS
────────────────────────────────────────────── */
async function fetchQueryNews(query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      query
    )}&hl=en-US&gl=US&ceid=US:en`;

    const feed = await parser.parseURL(url);

    const articles = (feed.items || [])
      .slice(0, 10)
      .map(formatArticle);

    return articles;
  } catch (e) {
    console.log("fetchQueryNews error", e);
    return [];
  }
}

module.exports = {
  fetchNews,
  fetchTrendingNews,
  fetchQueryNews,
};