// Polyfills window.storage (normally provided by Claude's artifact runtime)
// by talking to the tiny local server in server.js instead. Same interface,
// so the game code itself never needs to know the difference.
window.storage = {
  async get(key, shared) {
    const res = await fetch(`/api/storage?key=${encodeURIComponent(key)}&shared=${!!shared}`);
    if (res.status === 404) throw new Error("not found");
    if (!res.ok) throw new Error("storage error");
    return res.json();
  },
  async set(key, value, shared) {
    const res = await fetch(`/api/storage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, shared: !!shared }),
    });
    if (!res.ok) return null;
    return res.json();
  },
  async delete(key, shared) {
    const res = await fetch(`/api/storage?key=${encodeURIComponent(key)}&shared=${!!shared}`, { method: "DELETE" });
    if (!res.ok) return null;
    return res.json();
  },
  async list(prefix, shared) {
    const res = await fetch(`/api/storage/list?prefix=${encodeURIComponent(prefix || "")}&shared=${!!shared}`);
    if (!res.ok) return null;
    return res.json();
  },
};
