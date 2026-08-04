#!/usr/bin/env node
/**
 * Miro Web — local server for the Miro Personal Agent browser UI.
 *
 * Spawns the Miro engine (`--mode rpc`) as the backend, then bridges the
 * browser to the RPC JSONL protocol:
 *
 *   POST /api/command    client -> engine (correlated via `id`, response awaited)
 *   GET  /api/events     engine -> client (Server-Sent Events stream)
 *   GET  /api/sessions   list saved sessions (read from the session dir)
 *   GET  /api/git        read-only git data for the web panel (?op=status|log|diff|branch)
 *   GET  /api/tasks      task board: registry + git metadata
 *   GET  /               the web UI (public/)
 *   GET  /vendor/*       vendored frontend libs (marked, highlight.js)
 *
 * Pure Node.js — no npm dependencies at runtime beyond the vendored libs.
 *
 * Usage:
 *   node server.mjs [--port 5175] [--host 127.0.0.1] [--pi <engine>]
 *                   [--provider <name>] [--model <pattern>] [--name <name>]
 *                   [--session-dir <path>] [--cwd <path>] [--open] [--no-session]
 */

import http from "node:http";
import { execFile, spawn } from "node:child_process";
import { readFile, readdir, stat, writeFile, rename } from "node:fs/promises";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, resolve, basename, extname, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { StringDecoder } from "node:string_decoder";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "public");
const HOME = os.homedir();
const MIRO_HOME = process.env.MIRO_HOME || join(HOME, ".miro");
const AGENT_DIR = process.env.MIRO_CODING_AGENT_DIR || join(MIRO_HOME, "agent");
const AUTH_FILE = join(AGENT_DIR, "auth.json");
const TASKS_DIR = join(AGENT_DIR, "tasks");
// Cache-bust version for /app.js and /style.css: derived from the stylesheet
// mtime so edits are picked up automatically without a manual bump.
const ASSET_VERSION = (() => {
  try {
    return String(Math.round(statSync(join(PUBLIC_DIR, "style.css")).mtimeMs));
  } catch {
    return Date.now();
  }
})();

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

// The Miro engine binary: prefer the launcher-provided MIRO_CORE_BIN, then the
// white-labeled core inside MIRO_HOME, finally fall back to "pi" on PATH.
function defaultEngineBinary() {
  if (process.env.MIRO_CORE_BIN) return process.env.MIRO_CORE_BIN;
  const core = join(MIRO_HOME, "core", "node_modules", ".bin", "pi");
  return existsSync(core) ? core : "pi";
}

const args = {
  port: Number(process.env.MIRO_PORT) || 5175,
  host: "127.0.0.1",
  pi: defaultEngineBinary(),
  provider: undefined,
  model: undefined,
  name: undefined,
  sessionDir: undefined,
  cwd: process.cwd(),
  open: false,
  noSession: false,
  token: undefined,
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
      case "--token": args.token = take(i++); break;
      case "--cwd": args.cwd = take(i++); break;
      case "--open": args.open = true; break;
      case "--no-session": args.noSession = true; break;
      case "--help": case "-h":
        console.log(`Miro Web server

Usage: node server.mjs [options]

Options:
  --port <n>          Port to listen on (default $MIRO_PORT or 5175)
  --host <host>       Bind address (default 127.0.0.1; use 0.0.0.0 for LAN)
  --pi <path>         Path to the engine binary (default: $MIRO_CORE_BIN, then
                      ~/.miro/core/node_modules/.bin/pi, then "pi" from PATH)
  --provider <name>   Pass --provider to the engine (e.g. anthropic, openai)
  --model <pattern>   Pass --model to the engine (e.g. anthropic/claude-*, or model:thinking)
  --name <name>       Session display name
  --session-dir <p>   Session storage directory (default: ~/.miro/agent/sessions)
  --cwd <path>        Working directory for the agent
  --open              Open the browser automatically
  --no-session        Ephemeral mode (do not persist sessions)
  --token <t>         Access token required by /api/* (default: auto-generated;
                      also honored via $MIRO_WEB_TOKEN)
  -h, --help          Show this help`);
        process.exit(0);
      default:
        console.warn(`[miro-web] ignoring unknown arg: ${a}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Access token (--token / $MIRO_WEB_TOKEN, else auto-generated)
// ---------------------------------------------------------------------------

const WEB_TOKEN = (args.token || process.env.MIRO_WEB_TOKEN || "").trim() || crypto.randomBytes(24).toString("hex");

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
console.log(`[miro-web] spawning: ${args.pi} ${piArgs.join(" ")}`);
console.log(`[miro-web] cwd: ${args.cwd}`);

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
    console.error(`[miro-web] failed to spawn engine: ${err.message}`);
    broadcast({ type: "server_error", message: `Failed to start engine: ${err.message}` });
    failAllPending(err.message);
  });

  me.on("exit", (code, signal) => {
    if (pi !== me) return; // stale instance — a newer engine has replaced us
    piAlive = false;
    console.error(`[miro-web] engine exited (code=${code} signal=${signal})`);
    broadcast({ type: "engine_exit", code, signal });
    failAllPending(`engine exited (code=${code} signal=${signal})`);
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
    process.stderr.write(`[miro-engine] ${text}`);
    broadcast({ type: "engine_stderr", text });
  });
}

// Restart the engine subprocess (e.g. after writing auth.json so new credentials apply).
function restartPi() {
  console.log("[miro-web] restarting engine subprocess");
  startPi();
  setTimeout(() => {
    broadcast({ type: "engine_restarted" });
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
  process.stderr.write(`[miro-engine] ${text}`);
  broadcast({ type: "engine_stderr", text });
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
// Session dir resolution (flag > env > settings > default)
// ---------------------------------------------------------------------------

function expandPath(p, base) {
  if (p.startsWith("~")) p = join(HOME, p.slice(1));
  if (!isAbsolute(p)) p = resolve(base ?? process.cwd(), p);
  return p;
}

async function resolveSessionDir() {
  if (args.sessionDir) return expandPath(args.sessionDir);
  if (process.env.MIRO_CODING_AGENT_DIR) return expandPath(join(process.env.MIRO_CODING_AGENT_DIR, "sessions"));
  for (const settingsFile of [join(AGENT_DIR, "settings.json"), join(args.cwd, ".miro", "settings.json")]) {
    try {
      const s = JSON.parse(await readFile(settingsFile, "utf8"));
      if (typeof s.sessionDir === "string") return expandPath(s.sessionDir);
    } catch {
      /* no settings */
    }
  }
  return join(AGENT_DIR, "sessions");
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
 * Auth / config endpoints (credential management, /login)
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
  sendJSON(res, 200, { providers });
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
  for (const f of [join(AGENT_DIR, "settings.json"), join(args.cwd, ".miro", "settings.json")]) {
    try {
      Object.assign(settings, JSON.parse(await readFile(f, "utf8")));
    } catch {
      /* ignore */
    }
  }
  sendJSON(res, 200, { settings });
}

// ---------------------------------------------------------------------------
// Git read-only endpoints (live data for the web git panel — no LLM involved)
// ---------------------------------------------------------------------------

const GIT_FLAGS = ["--no-pager", "-c", "color.ui=false", "-c", "core.quotepath=false"];

function execGit(cwd, args) {
  return new Promise((resolve) => {
    execFile(
      "git",
      [...GIT_FLAGS, ...args],
      { cwd, timeout: 20000, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        const code = err ? (typeof err.code === "number" ? err.code : 1) : 0;
        resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
      },
    );
  });
}

function parseGitStatus(out) {
  let branch = "";
  let ahead = 0;
  let behind = 0;
  const staged = [];
  const unstaged = [];
  const untracked = [];
  for (const line of out.split("\n")) {
    if (line.startsWith("## ")) {
      const head = line.slice(3);
      branch = head.split("...")[0];
      const m = /\[ahead (\d+)(?:, behind (\d+))?\]/.exec(head);
      if (m) {
        ahead = Number(m[1]);
        behind = m[2] ? Number(m[2]) : 0;
      } else {
        const b = /\[behind (\d+)\]/.exec(head);
        if (b) behind = Number(b[1]);
      }
      continue;
    }
    if (line.length < 3) continue;
    const x = line[0];
    const y = line[1];
    const path = line.slice(3).trim();
    if (x === "?" && y === "?") untracked.push({ status: "??", path });
    else if (x !== " " && y !== " ") staged.push({ status: x, path });
    else if (x !== " " && y === " ") staged.push({ status: x, path });
    else if (x === " " && y !== " ") unstaged.push({ status: y, path });
  }
  return { branch, ahead, behind, staged, unstaged, untracked };
}

async function handleGit(req, res, url) {
  const sub = url.searchParams.get("op") || "status";
  const cwd = url.searchParams.get("cwd") || args.cwd;
  let gitArgs;
  if (sub === "status") {
    gitArgs = ["status", "--porcelain=v1", "-b"];
  } else if (sub === "log") {
    const n = String(Math.min(100, Math.max(1, Number(url.searchParams.get("n")) || 15)));
    gitArgs = ["log", "--format=%h|%ad|%an|%s", "--date=short", ...(url.searchParams.get("all") === "1" ? ["--all"] : []), "-n", n];
  } else if (sub === "diff") {
    const path = url.searchParams.get("path");
    gitArgs = ["diff", "--no-ext-diff"];
    if (url.searchParams.get("staged") === "1") gitArgs.push("--cached");
    if (url.searchParams.get("stat") === "1") gitArgs.push("--stat");
    if (path) gitArgs.push("--", path);
  } else if (sub === "branch") {
    gitArgs = ["branch", "-a"];
  } else {
    return sendJSON(res, 400, { error: "unknown op" });
  }
  const r = await execGit(cwd, gitArgs);
  if (r.code !== 0) {
    return sendJSON(res, 200, { ok: false, error: (r.stderr || r.stdout).trim(), code: r.code, cwd });
  }
  if (sub === "status") return sendJSON(res, 200, { ok: true, cwd, data: parseGitStatus(r.stdout) });
  if (sub === "log")
    return sendJSON(
      res,
      200,
      {
        ok: true,
        cwd,
        data: r.stdout
          .split("\n")
          .filter(Boolean)
          .map((l) => {
            const [hash, date, author, ...rest] = l.split("|");
            return { hash, date, author, subject: rest.join("|") };
          }),
      },
    );
  if (sub === "diff") return sendJSON(res, 200, { ok: true, cwd, data: { text: r.stdout } });
  if (sub === "branch")
    return sendJSON(
      res,
      200,
      {
        ok: true,
        cwd,
        data: r.stdout
          .split("\n")
          .filter(Boolean)
          .map((l) => ({ current: l.startsWith("*"), name: l.replace(/^[* ] /, "").trim() })),
      },
    );
  return sendJSON(res, 400, { error: "unhandled op" });
}

// ---------------------------------------------------------------------------
// Task board read endpoint (registry + git metadata for the web kanban)
// ---------------------------------------------------------------------------

async function gitInfoForTask(task, cwd) {
  const info = { branch: task.branch || null, checkedOut: false, commitCount: 0, lastCommit: null, uncommittedCount: 0, ahead: 0, behind: 0, main: null };
  if (!task.branch) return info;
  const head = await execGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  info.checkedOut = head.code === 0 && head.stdout.trim() === task.branch;
  const cnt = await execGit(cwd, ["rev-list", "--count", task.branch]);
  if (cnt.code === 0) info.commitCount = Number(cnt.stdout.trim()) || 0;
  const last = await execGit(cwd, ["log", "-1", "--format=%h|%ad|%s", "--date=short", task.branch]);
  if (last.code === 0 && last.stdout.trim()) {
    const [hash, date, ...rest] = last.stdout.trim().split("|");
    info.lastCommit = { hash, date, subject: rest.join("|") };
  }
  if (info.checkedOut) {
    const st = await execGit(cwd, ["status", "--porcelain"]);
    if (st.code === 0) info.uncommittedCount = st.stdout.trim() ? st.stdout.trim().split("\n").filter(Boolean).length : 0;
  }
  for (const main of ["main", "master"]) {
    const m = await execGit(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${main}`]);
    if (m.code === 0) {
      const a = await execGit(cwd, ["rev-list", "--count", `${main}..${task.branch}`]);
      const b = await execGit(cwd, ["rev-list", "--count", `${task.branch}..${main}`]);
      info.ahead = a.code === 0 ? Number(a.stdout.trim()) || 0 : 0;
      info.behind = b.code === 0 ? Number(b.stdout.trim()) || 0 : 0;
      info.main = main;
      break;
    }
  }
  return info;
}

async function handleTasks(req, res, url) {
  const cwd = url.searchParams.get("cwd") || args.cwd;
  const all = url.searchParams.get("all") === "1";  let tasks = [];
  try {
    const files = await readdir(TASKS_DIR);
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        tasks.push(JSON.parse(await readFile(join(TASKS_DIR, f), "utf8")));
      } catch {
        /* skip malformed */
      }
    }
  } catch {
    /* no tasks dir yet */
  }
  const rows = [];
  for (const t of tasks) {
    if (!t || !t.id) continue;
    if (!all && t.cwd && t.cwd !== cwd) continue;
    rows.push({
      id: t.id,
      title: t.title,
      description: t.description || "",
      stage: t.stage,
      branch: t.branch || null,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      git: await gitInfoForTask(t, t.cwd || cwd),
    });
  }
  rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  sendJSON(res, 200, { ok: true, cwd, tasks: rows });
}

// Project picker: distinct git-repository directories derived from saved
// sessions' cwds, enriched with branch / dirty / remote / last-used hints so
// the UI can show context instead of bare paths.
async function handleProjects(req, res, url) {
  const sessions = await listSessions();
  const byCwd = new Map();
  for (const s of sessions) {
    if (!s.cwd) continue;
    const cur = byCwd.get(s.cwd);
    if (!cur || s.mtime > cur.mtime) byCwd.set(s.cwd, s);
  }
  const projects = [];
  for (const [cwd, s] of byCwd) {
    const top = await execGit(cwd, ["rev-parse", "--show-toplevel"]);
    if (top.code !== 0) continue; // not a git repo
    const root = top.stdout.trim();
    const branchR = await execGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const status = await execGit(cwd, ["status", "--porcelain"]);
    const remoteR = await execGit(cwd, ["config", "--get", "remote.origin.url"]);
    const dirty = status.code === 0 && status.stdout.trim() ? status.stdout.trim().split("\n").filter(Boolean).length : 0;
    projects.push({
      cwd: root,
      basename: basename(root),
      branch: branchR.code === 0 ? branchR.stdout.trim() : "",
      dirty,
      remote: remoteR.code === 0 ? remoteR.stdout.trim() : "",
      lastUsed: s.mtime,
    });
  }
  projects.sort((a, b) => b.lastUsed - a.lastUsed);
  sendJSON(res, 200, { ok: true, projects });
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

// /api/* routes require a token: via the `Authorization: Bearer <token>`
// header, or a `?token=` query parameter (EventSource and <a download>
// cannot set headers).
function checkToken(req, url) {
  const auth = req.headers.authorization || "";
  const q = url?.searchParams?.get("token") || "";
  return auth === `Bearer ${WEB_TOKEN}` || q === WEB_TOKEN;
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
      return sendJSON(res, 503, { type: "response", command: cmd.type, success: false, error: "engine is not running" });
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

  // protect all /api/* routes except health (the frontend sends the token)
  if (path.startsWith("/api/") && path !== "/api/health") {
    if (!checkToken(req, url)) return sendJSON(res, 401, { error: "unauthorized" });
  }

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

  if (req.method === "GET" && path === "/api/git") {
    try {
      return await handleGit(req, res, url);
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  if (req.method === "GET" && path === "/api/tasks") {
    try {
      return await handleTasks(req, res, url);
    } catch (e) {
      return sendJSON(res, 500, { error: e.message });
    }
  }

  if (req.method === "GET" && path === "/api/projects") {
    try {
      return await handleProjects(req, res, url);
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

  // Enter a project (or scratch) directory: restart the engine with a new cwd
  // so new sessions and git operations land in the chosen directory.
  if (req.method === "POST" && path === "/api/enter-project") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let data;
      try {
        data = JSON.parse(body);
      } catch {
        return sendJSON(res, 400, { error: "Invalid JSON" });
      }
      const cwd = expandPath(String(data.cwd ?? "").trim());
      if (!cwd) return sendJSON(res, 400, { error: "cwd is required" });
      try {
        mkdirSync(cwd, { recursive: true }); // ensure scratch dirs exist
      } catch (e) {
        return sendJSON(res, 500, { error: e.message });
      }
      args.cwd = cwd;
      restartPi();
      return sendJSON(res, 200, { ok: true, cwd });
    });
    return;
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
    // inject the cache-bust version and the access token into the page
    try {
      let html = await readFile(join(PUBLIC_DIR, "index.html"), "utf8");
      html = html
        .replace(/\/style\.css\?v=\d+/, `/style.css?v=${ASSET_VERSION}`)
        .replace(/\/app\.js\?v=\d+/, `/app.js?v=${ASSET_VERSION}`)
        .replace(/__MIRO_TOKEN_VALUE__/g, WEB_TOKEN);
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
  console.log(`[miro-web] serving at ${url}`);
  if (args.host !== "127.0.0.1" && args.host !== "localhost") {
    console.log(`[miro-web] access token (Authorization: Bearer or ?token=): ${WEB_TOKEN}`);
  }
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
  console.log("[miro-web] shutting down");
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
