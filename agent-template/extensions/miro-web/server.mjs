#!/usr/bin/env node
/**
 * Miro Web — local server for the Miro Personal Agent browser UI.
 *
 * Spawns `pi --mode rpc` as the backend, then bridges the browser to the RPC
 * JSONL protocol:
 *
 *   POST /api/command    client -> pi (correlated via `id`, response awaited)
 *   GET  /api/events     pi -> client (Server-Sent Events stream)
 *   GET  /api/sessions   list saved sessions (read from the session dir)
 *   GET  /               the web UI (public/)
 *   GET  /vendor/*       vendored frontend libs (marked, highlight.js)
 *
 * Pure Node.js — no npm dependencies at runtime beyond the vendored libs.
 *
 * Usage:
 *   node server.mjs [--port 5175] [--host 127.0.0.1] [--pi pi]
 *                   [--provider <name>] [--model <pattern>] [--name <name>]
 *                   [--session-dir <path>] [--cwd <path>] [--open] [--no-session]
 */

import http from "node:http";
import { spawn } from "node:child_process";
import { readFile, readdir, stat, writeFile, rename } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { join, dirname, resolve, basename, extname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { StringDecoder } from "node:string_decoder";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const HOME = os.homedir();
const AUTH_FILE = join(HOME, ".pi", "agent", "auth.json");
// bump to invalidate browser caches for /app.js and /style.css
const ASSET_VERSION = "3";

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

const args = {
  port: Number(process.env.MIRO_PORT) || 5175,
  host: "127.0.0.1",
  pi: "pi",
  provider: undefined,
  model: undefined,
  name: undefined,
  sessionDir: undefined,
  cwd: process.cwd(),
  open: false,
  noSession: false,
};

{
  const argv = process.argv.slice(2);
  const take = (i) => argv[i + 1];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--port": args.port = Number(take(i++)); break;
      case "--host": args.host = take(i++); break;
      case "--pi": args.pi = take(i++); break;
      case "--provider": args.provider = take(i++); break;
      case "--model": args.model = take(i++); break;
      case "--name": case "-n": args.name = take(i++); break;
      case "--session-dir": args.sessionDir = take(i++); break;
      case "--cwd": args.cwd = take(i++); break;
      case "--open": args.open = true; break;
      case "--no-session": args.noSession = true; break;
      case "--help": case "-h":
        console.log(`Miro Web server

Usage: node server.mjs [options]

Options:
  --port <n>          Port to listen on (default $MIRO_PORT or 5175)
  --host <host>       Bind address (default 127.0.0.1; use 0.0.0.0 for LAN)
  --pi <path>         Path to the pi binary (default: "pi" from PATH)
  --provider <name>   Pass --provider to pi (e.g. anthropic, openai)
  --model <pattern>   Pass --model to pi (e.g. anthropic/claude-*, or model:thinking)
  --name <name>       Session display name
  --session-dir <p>   Session storage directory (default: ~/.pi/agent/sessions)
  --cwd <path>        Working directory for the agent
  --open              Open the browser automatically
  --no-session        Ephemeral mode (do not persist sessions)
  -h, --help          Show this help`);
        process.exit(0);
      default:
        console.warn(`[pi-web] ignoring unknown arg: ${a}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Spawn pi in RPC mode
// ---------------------------------------------------------------------------

function buildPiArgs() {
  const out = ["--mode", "rpc"];
  if (args.provider) out.push("--provider", args.provider);
  if (args.model) out.push("--model", args.model);
  if (args.name) out.push("--name", args.name);
  if (args.sessionDir) out.push("--session-dir", args.sessionDir);
  if (args.noSession) out.push("--no-session");
  return out;
}

const piArgs = buildPiArgs();
console.log(`[pi-web] spawning: ${args.pi} ${piArgs.join(" ")}`);
console.log(`[pi-web] cwd: ${args.cwd}`);

let pi = null;
let piAlive = false;

function startPi() {
  if (pi) {
    try {
      pi.stdin.end();
    } catch { /* ignore */ }
  }
  const me = spawn(args.pi, piArgs, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: args.cwd,
    env: { ...process.env },
  });
  pi = me;
  piAlive = true;

  me.on("error", (err) => {
    if (pi !== me) return; // stale instance
    piAlive = false;
    console.error(`[pi-web] failed to spawn pi: ${err.message}`);
    broadcast({ type: "server_error", message: `Failed to start pi: ${err.message}` });
    failAllPending(err.message);
  });

  me.on("exit", (code, signal) => {
    if (pi !== me) return; // stale instance — a newer pi has replaced us
    piAlive = false;
    console.error(`[pi-web] pi exited (code=${code} signal=${signal})`);
    broadcast({ type: "pi_exit", code, signal });
    failAllPending(`pi exited (code=${code} signal=${signal})`);
  });

  attachJsonlReader(me.stdout, (msg) => {
    if (msg && msg.type === "response" && msg.id != null && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(p.timer);
      p.resolve(msg);
      return;
    }
    broadcast(msg);
  });

  me.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    process.stderr.write(`[pi] ${text}`);
    broadcast({ type: "pi_stderr", text });
  });
}

// Restart the pi subprocess (e.g. after writing auth.json so new credentials apply).
function restartPi() {
  console.log("[pi-web] restarting pi subprocess");
  startPi();
  setTimeout(() => {
    broadcast({ type: "pi_restarted" });
  }, 500);
}

startPi();

// ---------------------------------------------------------------------------
// JSONL reader. NOTE: must split on "\n" only — Node readline is NOT
// protocol-compliant for RPC mode (it also splits on U+2028/U+2029).
// ---------------------------------------------------------------------------

const pending = new Map(); // id -> { resolve, reject, timer }
const sseClients = new Set(); // { res }

function attachJsonlReader(stream, onLine) {
  const decoder = new StringDecoder("utf8");
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += decoder.write(chunk);
    let idx;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.trim()) {
        try {
          onLine(JSON.parse(line));
        } catch {
          // non-JSON line — ignore (e.g. stray output)
        }
      }
    }
  });
  stream.on("end", () => {
    buffer += decoder.end();
    if (buffer.trim()) {
      try {
        onLine(JSON.parse(buffer.trim()));
      } catch {
        /* ignore */
      }
    }
  });
}

pi.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  process.stderr.write(`[pi] ${text}`);
  broadcast({ type: "pi_stderr", text });
});

function failAllPending(message) {
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new Error(message));
  }
  pending.clear();
}

// ---------------------------------------------------------------------------
// SSE broadcast
// ---------------------------------------------------------------------------

function broadcast(msg) {
  const frame = `data: ${JSON.stringify(msg)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(frame);
    } catch {
      /* client gone */
    }
  }
}

// ---------------------------------------------------------------------------
// Session dir resolution (same precedence as pi: flag > env > settings > default)
// ---------------------------------------------------------------------------

function expandPath(p, base) {
  if (p.startsWith("~")) p = join(HOME, p.slice(1));
  if (!isAbsolute(p)) p = resolve(base ?? process.cwd(), p);
  return p;
}

async function resolveSessionDir() {
  if (args.sessionDir) return expandPath(args.sessionDir);
  if (process.env.PI_CODING_AGENT_SESSION_DIR) return expandPath(process.env.PI_CODING_AGENT_SESSION_DIR);
  for (const settingsFile of [join(HOME, ".pi", "settings.json"), join(args.cwd, ".pi", "settings.json")]) {
    try {
      const s = JSON.parse(await readFile(settingsFile, "utf8"));
      if (typeof s.sessionDir === "string") return expandPath(s.sessionDir);
    } catch {
      /* no settings */
    }
  }
  return join(HOME, ".pi", "agent", "sessions");
}

// ---------------------------------------------------------------------------
// Session listing (parse jsonl headers for cwd/id/name/preview)
// ---------------------------------------------------------------------------

async function readSessionInfo(file) {
  try {
    const st = await stat(file);
    const content = await readFile(file, "utf8");
    let header = null;
    let name = null;
    let preview = "";
    let count = 0;
    for (const line of content.split("\n")) {
      if (!line.trim()) continue;
      let obj;
      try {
        obj = JSON.parse(line);
      } catch {
        continue;
      }
      count++;
      if (!header && obj.type === "session") header = obj;
      if (obj.type === "session_info" && obj.name) name = obj.name;
      if (!preview && obj.type === "message" && obj.message?.role === "user") {
        const c = obj.message.content;
        if (typeof c === "string") preview = c;
        else if (Array.isArray(c)) preview = c.filter((b) => b.type === "text").map((b) => b.text).join(" ");
      }
    }
    if (!header) return null;
    return {
      file,
      basename: basename(file),
      id: header.id ?? "",
      cwd: header.cwd ?? "",
      name,
      preview: preview.slice(0, 140),
      mtime: st.mtimeMs,
      messageCount: count,
    };
  } catch {
    return null;
  }
}

async function listSessions() {
  const dir = await resolveSessionDir();
  const results = [];
  async function walk(d) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith(".jsonl")) {
        const info = await readSessionInfo(p);
        if (info) results.push(info);
      }
    }
  }
  await walk(dir);
  results.sort((a, b) => b.mtime - a.mtime);
  return results;
}

/* ---------------------------------------------------------------------------
 * Auth / config endpoints (credential management, pi.dev-style /login)
 * --------------------------------------------------------------------------- */

async function readAuth() {
  try {
    return JSON.parse(await readFile(AUTH_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function writeAuth(auth) {
  const tmp = AUTH_FILE + ".tmp";
  await writeFile(tmp, JSON.stringify(auth, null, 2) + "\n", { mode: 0o600 });
  await rename(tmp, AUTH_FILE);
}

function maskKey(key) {
  if (!key) return "";
  const s = String(key);
  if (s.startsWith("$") || s.startsWith("!")) return s; // env/command reference — show as-is
  if (s.length <= 8) return "••••";
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}

async function handleGetAuth(res) {
  const auth = await readAuth();
  const providers = Object.entries(auth).map(([name, cfg]) => ({
    name,
    type: cfg?.type ?? "api_key",
    configured: true,
    keyPreview: maskKey(cfg?.key),
  }));
  providers.sort((a, b) => a.name.localeCompare(b.name));
  sendJSON(res, 200, { providers, authFile: AUTH_FILE });
}

async function handlePutAuth(req, res) {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return sendJSON(res, 400, { error: "Invalid JSON" });
    }
    const provider = String(data.provider ?? "").trim();
    const key = String(data.key ?? "").trim();
    if (!provider) return sendJSON(res, 400, { error: "provider is required" });
    if (!key) return sendJSON(res, 400, { error: "key is required" });
    if (!/^[a-zA-Z0-9._-]+$/.test(provider)) return sendJSON(res, 400, { error: "invalid provider name" });
    try {
      const auth = await readAuth();
      auth[provider] = { type: "api_key", key };
      await writeAuth(auth);
      restartPi();
      sendJSON(res, 200, { ok: true, provider, keyPreview: maskKey(key) });
    } catch (e) {
      sendJSON(res, 500, { error: e.message });
    }
  });
}

async function handleDeleteAuth(req, res) {
  const provider = String(new URL(req.url, "http://x").searchParams.get("provider") ?? "").trim();
  if (!provider) return sendJSON(res, 400, { error: "provider is required" });
  try {
    const auth = await readAuth();
    if (!(provider in auth)) return sendJSON(res, 404, { error: `no credentials for ${provider}` });
    delete auth[provider];
    await writeAuth(auth);
    restartPi();
    sendJSON(res, 200, { ok: true, provider });
  } catch (e) {
    sendJSON(res, 500, { error: e.message });
  }
}

async function handleGetSettings(res) {
  const settings = {};
  for (const f of [join(HOME, ".pi", "settings.json"), join(args.cwd, ".pi", "settings.json")]) {
    try {
      Object.assign(settings, JSON.parse(await readFile(f, "utf8")));
    } catch {
      /* ignore */
    }
  }
  sendJSON(res, 200, { settings });
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function serveFile(res, file, cache = "no-store") {
  createReadStream(file)
    .on("error", () => {
      if (!res.headersSent) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found");
      }
    })
    .pipe(
      res.writeHead(200, {
        "Content-Type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": cache,
      }),
    );
}

// ---------------------------------------------------------------------------
// Command handler (client -> pi)
// ---------------------------------------------------------------------------

function handleCommand(req, res) {
  let body = "";
  req.on("data", (c) => {
    body += c;
    if (body.length > 50 * 1024 * 1024) req.destroy(); // image uploads: 50MB cap
  });
  req.on("end", () => {
    let cmd;
    try {
      cmd = JSON.parse(body);
    } catch {
      return sendJSON(res, 400, { type: "response", command: "parse", success: false, error: "Invalid JSON body" });
    }
    if (!piAlive) {
      return sendJSON(res, 503, { type: "response", command: cmd.type, success: false, error: "pi is not running" });
    }
    if (!cmd.id) cmd.id = crypto.randomUUID();

    // extension_ui_response is fire-and-forget: pi consumes it without replying.
    if (cmd.type === "extension_ui_response") {
      pi.stdin.write(JSON.stringify(cmd) + "\n", (err) => {
        if (err) return sendJSON(res, 500, { type: "response", command: cmd.type, success: false, error: err.message });
        sendJSON(res, 200, { type: "response", command: cmd.type, success: true, id: cmd.id });
      });
      return;
    }

    const promise = new Promise((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => {
        pending.delete(cmd.id);
        rejectPromise(new Error(`Timeout waiting for response to "${cmd.type}"`));
      }, 10 * 60 * 1000); // 10 min — bash commands can run long
      pending.set(cmd.id, { resolve: resolvePromise, reject: rejectPromise, timer });
    });

    pi.stdin.write(JSON.stringify(cmd) + "\n", (err) => {
      if (err) {
        const p = pending.get(cmd.id);
        if (p) {
          pending.delete(cmd.id);
          clearTimeout(p.timer);
          p.reject(err);
        }
      }
    });

    promise
      .then((r) => sendJSON(res, 200, r))
      .catch((e) => sendJSON(res, 500, { type: "response", command: cmd.type, success: false, error: e.message }));
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  if (req.method === "POST" && path === "/api/command") return handleCommand(req, res);

  if (req.method === "GET" && path === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(": connected\n\n");
    const client = { res };
    sseClients.add(client);
    const heartbeat = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        /* ignore */
      }
    }, 25000);
    req.on("close", () => {
      sseClients.delete(client);
      clearInterval(heartbeat);
    });
    return;
  }

  if (req.method === "GET" && path === "/api/sessions") {
    try {
      const sessions = await listSessions();
      return sendJSON(res, 200, { sessions });
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  if (path === "/api/auth") {
    if (req.method === "GET") return handleGetAuth(res);
    if (req.method === "PUT") return handlePutAuth(req, res);
    if (req.method === "DELETE") return handleDeleteAuth(req, res);
  }

  if (req.method === "GET" && path === "/api/settings") {
    return handleGetSettings(res);
  }

  if (req.method === "POST" && path === "/api/restart") {
    restartPi();
    return sendJSON(res, 200, { ok: true });
  }

  // Download a local file (e.g. /export output). Local tool — trust the user.
  if (req.method === "GET" && path === "/api/file") {
    const target = url.searchParams.get("path");
    if (!target) return sendJSON(res, 400, { error: "path is required" });
    try {
      const st = await stat(target);
      if (!st.isFile()) throw new Error("not a file");
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${basename(target)}"`,
        "Content-Length": st.size,
      });
      createReadStream(target).pipe(res);
    } catch (e) {
      sendJSON(res, 404, { error: e.message });
    }
    return;
  }

  if (req.method === "GET" && path === "/api/health") {
    return sendJSON(res, 200, { ok: true, piAlive, pid: pi.pid });
  }

  if (path === "/" || path === "/index.html") {
    // inject the current cache-bust version into asset URLs
    try {
      let html = await readFile(join(PUBLIC_DIR, "index.html"), "utf8");
      html = html
        .replace(/\/style\.css\?v=\d+/, `/style.css?v=${ASSET_VERSION}`)
        .replace(/\/app\.js\?v=\d+/, `/app.js?v=${ASSET_VERSION}`);
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(html);
    } catch (e) {
      sendJSON(res, 500, { error: e.message });
    }
    return;
  }

  // cache-busted app assets
  if (path === "/app.js" || path === "/style.css") {
    return serveFile(res, join(PUBLIC_DIR, path.slice(1)));
  }

  if (path.startsWith("/vendor/")) {
    const name = path.slice("/vendor/".length);
    const map = {
      "marked.min.js": join(__dirname, "node_modules", "marked", "marked.min.js"),
      "hljs-theme.css": join(__dirname, "node_modules", "highlight.js", "styles", "github-dark.min.css"),
    };
    const file = map[name] ?? join(PUBLIC_DIR, "vendor", name);
    try {
      const st = await stat(file);
      if (st.isFile()) return serveFile(res, file, "public, max-age=3600");
    } catch {
      /* fall through to 404 */
    }
    return sendJSON(res, 404, { error: "vendor not found" });
  }

  // Static files from public/ (path traversal guarded)
  const safe = resolve(join(PUBLIC_DIR, "." + path));
  if (safe.startsWith(PUBLIC_DIR)) {
    try {
      const st = await stat(safe);
      if (st.isFile()) return serveFile(res, safe);
    } catch {
      /* fall through */
    }
  }
  return sendJSON(res, 404, { error: "not found" });
});

server.listen(args.port, args.host, () => {
  const url = `http://${args.host === "0.0.0.0" ? "localhost" : args.host}:${args.port}`;
  console.log(`[pi-web] serving at ${url}`);
  if (args.open) openBrowser(url);
});

function openBrowser(url) {
  const cmd =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", url]
        : ["xdg-open", url];
  const child = spawn(cmd[0], cmd.slice(1), { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}

function shutdown() {
  console.log("[pi-web] shutting down");
  try {
    pi.stdin.end();
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    try {
      pi.kill("SIGTERM");
    } catch {
      /* ignore */
    }
    process.exit(0);
  }, 300).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGHUP", shutdown);
