const store = new Map();

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) { store.delete(key); return null; }
  return entry.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, ts: Date.now(), ttl: ttlMs });
}

module.exports = { get, set };