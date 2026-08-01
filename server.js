// Secret Himmler — cloud-hosted server (Glitch / Render / Railway, etc.)
// No setup needed by players — just deploy this once and share the URL.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

// In-memory store, persisted to a JSON file so it survives the free-tier
// "sleep and wake up" cycle most hosts use. Not a heavyweight database —
// just enough durability for an evening of games.
let store = new Map();
try {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  const obj = JSON.parse(raw);
  store = new Map(Object.entries(obj));
} catch (e) { /* no existing file yet, start empty */ }

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const obj = Object.fromEntries(store);
    fs.writeFile(DATA_FILE, JSON.stringify(obj), () => {});
  }, 200);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
  res.end(body);
}

const MIME = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json" };

function serveStatic(req, res, urlPath) {
  const filePath = path.join(__dirname, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  if (u.pathname === "/api/storage" && req.method === "GET") {
    const key = u.searchParams.get("key");
    if (!store.has(key)) { sendJson(res, 404, { error: "not found" }); return; }
    sendJson(res, 200, store.get(key));
    return;
  }

  if (u.pathname === "/api/storage" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { key, value, shared } = JSON.parse(body);
        const record = { key, value, shared: !!shared };
        store.set(key, record);
        persist();
        sendJson(res, 200, record);
      } catch (e) {
        sendJson(res, 400, { error: "bad request" });
      }
    });
    return;
  }

  if (u.pathname === "/api/storage" && req.method === "DELETE") {
    const key = u.searchParams.get("key");
    const existed = store.delete(key);
    persist();
    sendJson(res, 200, { key, deleted: existed });
    return;
  }

  if (u.pathname === "/api/storage/list" && req.method === "GET") {
    const prefix = u.searchParams.get("prefix") || "";
    const keys = Array.from(store.keys()).filter((k) => k.startsWith(prefix));
    sendJson(res, 200, { keys });
    return;
  }

  serveStatic(req, res, u.pathname);
});

server.listen(PORT, () => {
  console.log(`Secret Himmler server running on port ${PORT}`);
});
