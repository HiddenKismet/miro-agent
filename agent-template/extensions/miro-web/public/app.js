/**
 * Miro Web — frontend (Miro Personal Agent).
 *
 * Connects to the local server via:
 *   - EventSource (SSE)  /api/events   engine events -> UI
 *   - fetch (POST)       /api/command  UI actions -> engine (RPC JSONL)
 *   - fetch (GET)        /api/sessions saved session list
 *   - fetch (REST)       /api/auth     credential management (like /login)
 */

/* ==========================================================================
   i18n (zh / en)
   ========================================================================== */

const I18N = {
  zh: {
    newChat: "＋ 新对话",
    sessions: "会话",
    noSessions: "暂无会话",
    connecting: "连接中…",
    connected: "已连接",
    reconnecting: "重连中…",
    working: "工作中…",
    stop: "■ 停止",
    send: "发送",
    attach: "附加图片",
    inputPlaceholder: "给 Miro 发送消息…  输入 / 打开命令面板",
    hint: "Enter 发送 · Shift+Enter 换行\nEsc 停止 · Ctrl+K 命令面板",
    renameSession: "点击重命名会话",
    thinking: "思考",
    running: "运行中…",
    done: "完成",
    error: "出错",
    cancel: "取消",
    ok: "确定",
    yes: "是",
    no: "否",
    welcomeTitle: "Miro",
    welcomeSub: "让 Miro 梳理你的思绪：捕捉碎片、推演思考、落地成事",
    scratchSession: "临时会话",
    enterProject: "进入项目",
    projectPickerTitle: "选择项目",
    manualPath: "手动输入路径",
    projectPathPlaceholder: "项目路径…",
    noProjectMatches: "无匹配 — Enter 将按输入路径进入",
    enteredProject: "已进入",
    settings: "设置",
    appearance: "外观",
    theme: "主题",
    themeLight: "浅色",
    themeDark: "深色",
    themeSystem: "跟随系统",
    language: "语言",
    credentials: "凭据",
    credentialsNote: "等价于 /login：API key 保存到 ~/.miro/agent/auth.json。OAuth 登录请使用终端里的 /login。",
    provider: "provider",
    apiKey: "API key (sk-…)",
    save: "保存",
    delete: "删除",
    agent: "代理",
    autoCompaction: "自动压缩",
    autoRetry: "自动重试",
    restartAgent: "重启 agent 进程",
    restart: "重启",
    sessionInfo: "会话信息",
    tokens: "Token",
    cost: "费用",
    context: "上下文",
    messages: "消息",
    commands: "命令",
    paletteHint: "选择命令执行：↑↓ 导航 / Enter 执行 / Esc 关闭",
    queued: "排队中",
    retrying: "自动重试中",
    compacting: "正在压缩上下文…",
    compacted: "上下文已压缩",
    aborting: "已停止",
    sendFailed: "发送失败",
    commandFailed: "命令失败",
    connectionLost: "与服务器的连接中断",
    savedCredential: "已保存凭据，agent 已重启",
    deletedCredential: "已删除凭据，agent 已重启",
    noCredentials: "尚未配置任何凭据",
    restarting: "正在重启 agent 进程…",
    restarted: "agent 进程已重启",
    exportDone: "已导出会话",
    copyDone: "已复制最后一条助手消息",
    treeTitle: "会话树",
    treeHint: "点击用户消息可从该处分支（fork）",
    forkDone: "已从该消息分支，创建新会话",
    forkFailed: "分支失败",
    modelPickerTitle: "选择模型",
    userLabel: "我",
    assistantLabel: "Miro",
    commandsList: "命令列表",
    skipToContent: "跳到内容",
    copyCode: "复制",
    copied: "已复制",
    git: "Git",
    gitClean: "干净",
    gitChanges: "改动",
    gitCommits: "最近提交",
    gitDiff: "Diff",
    gitNoRepo: "当前目录不是 git 仓库",
    gitCommit: "提交",
    gitPush: "推送",
    gitRelease: "发布",
    gitLoading: "加载中…",
    kanban: "看板",
    kanbanTitle: "创作看板",
    stageProposed: "提出",
    stageInProgress: "进行中",
    stagePendingReview: "待审核",
    stageDone: "已完成",
    taskNew: "＋ 新任务",
    refresh: "刷新",
    backToChat: "回到对话",
    taskStart: "开始",
    taskCommit: "提交",
    taskRequestReview: "请求审核",
    taskApprove: "确认完成",
    taskResume: "继续修改",
    taskDetail: "详情",
    taskEmpty: "暂无任务",
    taskNewTitle: "新任务",
    taskNewPlaceholder: "任务标题…",
    taskUncommitted: "未提交",
    taskAhead: "领先",
    taskNoRepo: "当前目录不是 git 仓库，任务看板不可用",
    reviewHint: "待你审核",
  },
  en: {
    newChat: "＋ New Chat",
    sessions: "Sessions",
    noSessions: "No sessions yet",
    connecting: "Connecting…",
    connected: "Connected",
    reconnecting: "Reconnecting…",
    working: "Working…",
    stop: "■ Stop",
    send: "Send",
    attach: "Attach image",
    inputPlaceholder: "Message Miro…  type / for commands",
    hint: "Enter to send · Shift+Enter newline\nEsc to stop · Ctrl+K commands",
    renameSession: "Click to rename session",
    thinking: "Thinking",
    running: "Running…",
    done: "Done",
    error: "Error",
    cancel: "Cancel",
    ok: "OK",
    yes: "Yes",
    no: "No",
    welcomeTitle: "Miro",
    welcomeSub: "Let Miro sort your mind.",
    scratchSession: "Scratch session",
    enterProject: "Enter project",
    projectPickerTitle: "Choose a project",
    manualPath: "Enter a path",
    projectPathPlaceholder: "Project path…",
    noProjectMatches: "no matches — Enter uses the typed path",
    enteredProject: "Entered",
    settings: "Settings",
    appearance: "Appearance",
    theme: "Theme",
    themeLight: "Light",
    themeDark: "Dark",
    themeSystem: "System",
    language: "Language",
    credentials: "Credentials",
    credentialsNote: "Like /login: API keys are stored in ~/.miro/agent/auth.json. For OAuth, use /login in the terminal.",
    provider: "provider",
    apiKey: "API key (sk-…)",
    save: "Save",
    delete: "Delete",
    agent: "Agent",
    autoCompaction: "Auto-compaction",
    autoRetry: "Auto-retry",
    restartAgent: "Restart agent process",
    restart: "Restart",
    sessionInfo: "Session info",
    tokens: "Tokens",
    cost: "Cost",
    context: "Context",
    messages: "Messages",
    commands: "Commands",
    paletteHint: "Pick a command: ↑↓ navigate / Enter run / Esc close",
    queued: "queued",
    retrying: "Auto-retrying",
    compacting: "Compacting context…",
    compacted: "Context compacted",
    aborting: "Aborted",
    sendFailed: "Send failed",
    commandFailed: "Command failed",
    connectionLost: "Connection to server lost",
    savedCredential: "Credential saved, agent restarted",
    deletedCredential: "Credential deleted, agent restarted",
    noCredentials: "No credentials configured yet",
    restarting: "Restarting agent process…",
    restarted: "Agent process restarted",
    exportDone: "Session exported",
    copyDone: "Last assistant message copied",
    treeTitle: "Session tree",
    treeHint: "Click a user message to fork from that point",
    forkDone: "Forked from that message into a new session",
    forkFailed: "Fork failed",
    modelPickerTitle: "Choose model",
    userLabel: "You",
    assistantLabel: "Miro",
    commandsList: "Command list",
    skipToContent: "Skip to content",
    copyCode: "Copy",
    copied: "Copied",
    git: "Git",
    gitClean: "Clean",
    gitChanges: "Changes",
    gitCommits: "Recent commits",
    gitDiff: "Diff",
    gitNoRepo: "Not a git repository",
    gitCommit: "Commit",
    gitPush: "Push",
    gitRelease: "Release",
    gitLoading: "Loading…",
    kanban: "Board",
    kanbanTitle: "Task board",
    stageProposed: "Proposed",
    stageInProgress: "In progress",
    stagePendingReview: "Review",
    stageDone: "Done",
    taskNew: "＋ New task",
    refresh: "Refresh",
    backToChat: "Back to chat",
    taskStart: "Start",
    taskCommit: "Commit",
    taskRequestReview: "Request review",
    taskApprove: "Approve",
    taskResume: "Keep editing",
    taskDetail: "Detail",
    taskEmpty: "No tasks",
    taskNewTitle: "New task",
    taskNewPlaceholder: "Task title…",
    taskUncommitted: "uncommitted",
    taskAhead: "ahead",
    taskNoRepo: "Not a git repository — task board unavailable",
    reviewHint: "awaiting review",
  },
};

let lang = localStorage.getItem("miro-web-lang") || (navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en");

function t(key) {
  return (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
}

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
}

/* ==========================================================================
   DOM helpers
   ========================================================================== */

const $ = (id) => document.getElementById(id);
const el = (tag, cls) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
};

const messagesEl = $("messages");
const inputEl = $("input");
const welcomeEl = $("welcome");
const modelSelect = $("model-select");
const thinkingSelect = $("thinking-select");
const connDot = $("conn-status");
const connText = $("conn-text");
const streamingIndicator = $("streaming-indicator");
const ctxUsageEl = $("ctx-usage");
const sessionNameEl = $("session-name");
const queuedBadge = $("queued-badge");
const sendBtn = $("btn-send");
const abortBtn = $("btn-abort");
const attachBtn = $("btn-attach");
const fileInput = $("file-input");
const attachmentsEl = $("attachments");
const sessionListEl = $("session-list");
const sessionListEmpty = $("session-list-empty");
const cmdMenu = $("cmd-menu");
const settingsPanel = $("settings-panel");
const gitPanel = $("git-panel");
const gitChipText = $("git-chip-text");
const kanbanEl = $("kanban");
const kanbanReviewBadge = $("kanban-review-badge");
const kanbanRepoEl = $("kanban-repo");

/* ==========================================================================
   State
   ========================================================================== */

const state = {
  messages: [],
  byId: new Map(),
  toolBlocks: new Map(),
  streaming: false,
  lastAssistant: null,
  sessionFile: null,
  sessionId: null,
  sessionName: null,
  currentModel: null,
  models: [],
  thinkingLevels: [],
  currentThinking: "medium",
  attachedImages: [],
  renderTimers: new Map(),
  commands: [], // from get_commands (extension / prompt / skill)
  autoCompaction: null,
  autoRetry: null,
  sessions: [], // sidebar session list
  cmdMenu: null, // { mode: "commands" | "sessions", items, index }
  activeGroup: null, // turn-content element of the current non-user turn group
  gitCwd: "",
};

/* ==========================================================================
   Theme
   ========================================================================== */

function setTheme(mode) {
  localStorage.setItem("miro-web-theme", mode);
  document.documentElement.dataset.themeMode = mode;
  const theme = mode === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : mode;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  applyHljsTheme(theme);
  syncThemeSeg();
}

/* match the code-highlight palette to the app theme (Claude-style) */
function applyHljsTheme(theme) {
  const link = $("hljs-theme");
  if (link) link.href = theme === "dark" ? "/vendor/hljs-theme.css" : "/vendor/hljs-light.css";
}

function syncThemeSeg() {
  const mode = document.documentElement.dataset.themeMode || "system";
  document.querySelectorAll("#theme-seg button").forEach((b) => {
    b.classList.toggle("active", b.dataset.themeMode === mode);
  });
}

/* ==========================================================================
   Server communication
   ========================================================================== */

let cmdSeq = 0;

const WEB_TOKEN = window.__MIRO_WEB_TOKEN__ || "";
function apiHeaders(extra = {}) {
  return WEB_TOKEN ? { ...extra, Authorization: `Bearer ${WEB_TOKEN}` } : extra;
}

function send(cmd) {
  // Preserve an existing id: extension_ui_response carries the engine's dialog
  // request UUID, which must reach the engine unchanged to resolve the pending
  // dialog. Only assign our own sequence id to fresh commands.
  if (!cmd.id) cmd.id = `w${++cmdSeq}`;
  return fetch("/api/command", {
    method: "POST",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(cmd),
  }).then(async (r) => {
    // token rotated (server restarted) — reload to pick up the new one
    if (r.status === 401) {
      location.reload();
      return { success: false };
    }
    return r.json();
  });
}

function sendNoWait(cmd) {
  send(cmd).catch(() => {});
}

let es = null;

function openEventStream() {
  es = new EventSource(WEB_TOKEN ? `/api/events?token=${encodeURIComponent(WEB_TOKEN)}` : "/api/events");
  es.onopen = () => {
    connDot.className = "conn-dot conn-on";
    connText.textContent = t("connected");
    reloadAll();
  };
  es.onerror = () => {
    connDot.className = "conn-dot conn-connecting";
    connText.textContent = t("reconnecting");
  };
  es.onmessage = (e) => {
    let evt;
    try {
      evt = JSON.parse(e.data);
    } catch {
      return;
    }
    handleEvent(evt);
  };
}

/* ==========================================================================
   Initial load / reload
   ========================================================================== */

let bootstrapping = false;

async function reloadAll() {
  if (bootstrapping) return;
  bootstrapping = true;
  try {
    const [stateResp, msgsResp] = await Promise.all([
      send({ type: "get_state" }),
      send({ type: "get_messages" }),
    ]);
    if (stateResp.success) applyState(stateResp.data);
    if (msgsResp.success && Array.isArray(msgsResp.data?.messages)) {
      renderMessages(msgsResp.data.messages);
    }
    refreshSessions();
    refreshStats();
    loadModels();
    loadThinkingLevels();
    loadCommands();
    refreshGit();
    refreshTasks();
  } finally {
    bootstrapping = false;
  }
}

function applyState(s) {
  state.sessionFile = s.sessionFile ?? state.sessionFile;
  state.sessionId = s.sessionId ?? state.sessionId;
  state.sessionName = s.sessionName ?? state.sessionName;
  state.currentModel = s.model ?? state.currentModel;
  state.currentThinking = s.thinkingLevel ?? state.currentThinking;
  state.streaming = !!s.isStreaming;
  state.autoCompaction = s.autoCompactionEnabled ?? state.autoCompaction;

  sessionNameEl.textContent = state.sessionName || "-";
  $("auto-compaction").checked = !!state.autoCompaction;
  updateStreamingIndicator();
  highlightActiveSession();
}

async function refreshStats() {
  try {
    const resp = await send({ type: "get_session_stats" });
    if (resp.success && resp.data) {
      const d = resp.data;
      const cu = d.contextUsage;
      const tokens = d.tokens?.total != null ? fmtTokens(d.tokens.total) : "-";
      const win = cu?.contextWindow ? fmtTokens(cu.contextWindow) : "";
      const pct = cu?.percent != null ? ` (${Math.round(cu.percent)}%)` : "";
      ctxUsageEl.textContent = win ? `${tokens} / ${win}${pct}` : `${tokens}${pct}`;
      const cost = d.cost != null ? `$${d.cost.toFixed(4)}` : "-";
      renderSessionStats({
        tokens,
        cost,
        context: cu ? `${fmtTokens(cu.tokens ?? 0)} / ${win}${pct}` : "-",
        messages: String(d.totalMessages ?? 0),
        sessionFile: d.sessionFile ?? "",
      });
    } else {
      ctxUsageEl.textContent = "";
    }
  } catch {
    /* ignore */
  }
}

function fmtTokens(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function renderSessionStats({ tokens, cost, context, messages, sessionFile }) {
  const wrap = $("session-stats");
  wrap.innerHTML = "";
  const cards = [
    [t("tokens"), tokens],
    [t("cost"), cost],
    [t("context"), context],
    [t("messages"), messages],
  ];
  for (const [label, value] of cards) {
    const c = el("div", "stat-card");
    const l = el("div", "stat-label");
    l.textContent = label;
    const v = el("div", "stat-value");
    v.textContent = value;
    c.append(l, v);
    wrap.appendChild(c);
  }
  if (sessionFile) {
    const c = el("div", "stat-card");
    c.style.gridColumn = "1 / -1";
    const l = el("div", "stat-label");
    l.textContent = "file";
    const v = el("div", "stat-value");
    v.style.fontSize = "11px";
    v.style.wordBreak = "break-all";
    v.textContent = sessionFile;
    c.append(l, v);
    wrap.appendChild(c);
  }
}

async function loadModels() {
  try {
    const resp = await send({ type: "get_available_models" });
    if (!resp.success) return;
    state.models = resp.data?.models ?? [];
    syncModelSelect();
  } catch { /* ignore */ }
}

function syncModelSelect() {
  modelSelect.innerHTML = "";
  for (const m of state.models) {
    const opt = document.createElement("option");
    opt.value = `${m.provider}/${m.id}`;
    opt.textContent = `${m.name} · ${m.provider}`;
    modelSelect.appendChild(opt);
  }
  if (state.currentModel) {
    modelSelect.value = `${state.currentModel.provider}/${state.currentModel.id}`;
  }
  modelSelect.disabled = state.models.length === 0;
}

async function loadThinkingLevels() {
  try {
    const resp = await send({ type: "get_available_thinking_levels" });
    if (!resp.success) return;
    state.thinkingLevels = resp.data?.levels ?? [];
    thinkingSelect.innerHTML = "";
    for (const lv of state.thinkingLevels) {
      const opt = document.createElement("option");
      opt.value = lv;
      opt.textContent = lv;
      thinkingSelect.appendChild(opt);
    }
    thinkingSelect.value = state.thinkingLevels.includes(state.currentThinking) ? state.currentThinking : thinkingSelect.value;
    thinkingSelect.disabled = state.thinkingLevels.length <= 1;
  } catch { /* ignore */ }
}

async function loadCommands() {
  try {
    const resp = await send({ type: "get_commands" });
    if (resp.success) state.commands = resp.data?.commands ?? [];
  } catch { /* ignore */ }
}

/* ==========================================================================
   Session list (sidebar)
   ========================================================================== */

async function refreshSessions() {
  let sessions = [];
  try {
    const resp = await fetch("/api/sessions", { headers: apiHeaders() });
    const data = await resp.json();
    sessions = data.sessions ?? [];
  } catch { /* ignore */ }
  state.sessions = sessions;
  sessionListEl.querySelectorAll(".session-item").forEach((n) => n.remove());
  sessionListEmpty.style.display = sessions.length ? "none" : "";
  for (const s of sessions) {
    const item = el("div", "session-item");
    const title = el("div", "s-title");
    title.textContent = s.name || s.preview || s.basename || "-";
    const preview = el("div", "s-preview");
    preview.textContent = s.name ? s.preview : "";
    const meta = el("div", "s-meta");
    const when = new Date(s.mtime).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    meta.textContent = `${when} · ${s.messageCount} msg`;
    item.append(title, preview, meta);
    item.dataset.file = s.file;
    item.addEventListener("click", () => switchSession(s.file));
    sessionListEl.appendChild(item);
  }
  highlightActiveSession();
}

function highlightActiveSession() {
  if (!state.sessionFile) return;
  sessionListEl.querySelectorAll(".session-item").forEach((n) => {
    n.classList.toggle("active", n.dataset.file === state.sessionFile);
  });
}

async function switchSession(file) {
  if (file === state.sessionFile) return;
  const resp = await send({ type: "switch_session", sessionPath: file });
  if (!resp.success) {
    showToast(resp.error || t("commandFailed"), "error");
    return;
  }
  if (resp.data?.cancelled) {
    showToast("切换被取消", "warning");
    return;
  }
  await reloadAll();
}

async function newSession() {
  const resp = await send({ type: "new_session" });
  if (!resp.success) {
    showToast(resp.error || t("commandFailed"), "error");
    return;
  }
  await reloadAll();
}

/* ==========================================================================
   Message rendering (unchanged core)
   ========================================================================== */

function clearMessages() {
  for (const v of state.messages) {
    const timer = state.renderTimers.get(v);
    if (timer) clearTimeout(timer);
  }
  state.messages = [];
  state.byId.clear();
  state.toolBlocks.clear();
  state.lastAssistant = null;
  state.activeGroup = null;
  messagesEl.querySelectorAll(".msg").forEach((n) => n.remove());
  welcomeEl.hidden = false;
}

function isContinuation() {
  // a non-user view that follows another non-user view continues the same turn
  const prev = state.messages[state.messages.length - 1];
  return !!prev && prev.role !== "user";
}

function addView(view) {
  const continuation = view.role !== "user" && isContinuation();
  if (continuation && state.activeGroup) {
    // merge into the current turn group: only the blocks container is moved,
    // so the avatar / "Miro" header stays single at the top of the group
    state.activeGroup.appendChild(view.bodyEl);
  } else if (view.role === "user") {
    state.activeGroup = null;
    messagesEl.appendChild(view.el);
  } else {
    state.activeGroup = view.turnContentEl;
    messagesEl.appendChild(view.el);
  }
  state.messages.push(view);
  if (view.id) state.byId.set(view.id, view);
  welcomeEl.hidden = true;
}

function buildMsgEl(view) {
  const wrap = el("div", `msg msg-${view.role}`);
  const avatar = el("div", "msg-avatar");
  avatar.textContent = view.role === "user" ? t("userLabel").slice(0, 1) : "✦";
  const body = el("div", "msg-body");
  if (view.role === "user") {
    wrap.append(avatar, body);
    view.el = wrap;
    view.bodyEl = body;
    view.blockEls = [];
    return wrap;
  }
  // assistant / system → turn-group container:
  // one avatar + "Miro" label at top, steps stacked vertically below
  wrap.classList.add("agent-group");
  const label = el("div", "msg-role-label");
  label.textContent = t("assistantLabel");
  const turnContent = el("div", "turn-content");
  const turnBlocks = el("div", "turn-blocks");
  turnContent.appendChild(turnBlocks);
  body.append(label, turnContent);
  wrap.append(avatar, body);
  view.el = wrap;
  view.bodyEl = turnBlocks;
  view.turnContentEl = turnContent;
  view.blockEls = [];
  return wrap;
}

function blockFromContent(c) {
  if (c.type === "text") return { type: "text", text: c.text ?? "" };
  if (c.type === "thinking") return { type: "thinking", thinking: c.thinking ?? "" };
  if (c.type === "toolCall")
    return {
      type: "toolCall",
      id: c.id,
      name: c.name ?? "tool",
      argumentsText: c.arguments ? safeJson(c.arguments) : "",
      status: "done",
      outputText: "",
      isError: false,
    };
  if (c.type === "image") return { type: "image", data: c.data ?? "", mimeType: c.mimeType };
  return { type: "text", text: JSON.stringify(c) };
}

function contentToBlocks(content) {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (!Array.isArray(content)) return [];
  return content.map(blockFromContent);
}

function makeBlockEl(view, block) {
  let node;
  switch (block.type) {
    case "text": {
      node = el("div", "block block-text md");
      block.el = node;
      break;
    }
    case "thinking": {
      const details = el("details", "block block-thinking");
      const summary = el("summary");
      const chevron = el("span", "thinking-chevron");
      chevron.textContent = "▸";
      const label = el("span", "thinking-label");
      label.textContent = t("thinking");
      const meta = el("span", "thinking-meta");
      const content = el("div", "thinking-content");
      summary.append(chevron, label, meta);
      details.append(summary, content);
      block.el = details;
      block.labelEl = label;
      block.metaEl = meta;
      block.contentEl = content;
      node = details;
      break;
    }
    case "toolCall": {
      node = renderToolCard(block);
      break;
    }
    case "image": {
      node = el("div", "block block-image");
      const img = document.createElement("img");
      img.src = dataUrl(block.data, block.mimeType);
      img.loading = "lazy";
      node.appendChild(img);
      break;
    }
    default:
      node = el("div", "block");
  }
  view.blockEls.push(node);
  view.bodyEl.appendChild(node);
  return node;
}

function appendBlock(view, block) {
  view.blocks.push(block);
  makeBlockEl(view, block);
  if (block.type === "toolCall") state.toolBlocks.set(block.id, block);
  return block;
}

function renderTextBlock(block) {
  if (!block.el) return;
  block.el.innerHTML = renderMarkdown(block.text ?? "");
  applyHighlight(block.el);
  wrapCodeBlocks(block.el);
}

function updateThinkingBlock(block) {
  if (!block.el) return;
  const text = block.thinking ?? "";
  if (block.labelEl) block.labelEl.textContent = t("thinking");
  if (block.metaEl) block.metaEl.textContent = text ? `${text.length} ${lang === "zh" ? "字" : "chars"}` : "…";
  block.contentEl.textContent = text;
  if (block.live) block.el.open = true;
}

/* ---------- Tool cards ---------- */

function renderToolCard(block) {
  const card = el("div", "tool-card collapsed");
  const head = el("div", "tool-head");
  head.innerHTML = `<span class="tool-icon"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg></span><span class="tool-name"></span><span class="tool-status"></span><span class="tool-chevron">▾</span>`;
  head.querySelector(".tool-name").textContent = block.name;
  const statusEl = head.querySelector(".tool-status");

  const detail = el("div", "tool-detail");
  const argsLabel = el("div", "tool-section-label");
  argsLabel.textContent = "Arguments";
  const argsPre = el("pre", "tool-args");
  const outLabel = el("div", "tool-section-label");
  outLabel.textContent = "Output";
  const outPre = el("pre", "tool-output");
  detail.append(argsLabel, argsPre, outLabel, outPre);

  card.append(head, detail);
  head.addEventListener("click", () => card.classList.toggle("collapsed"));

  block.el = card;
  block.statusEl = statusEl;
  block.argsEl = argsPre;
  block.outputEl = outPre;
  block.collapsedByDefault = true;

  setToolArgs(block);
  setToolOutput(block);
  setToolStatus(block, block.status ?? "done", block.status ?? "done");
  return card;
}

function setToolArgs(block) {
  if (block.argsEl) block.argsEl.textContent = block.argumentsText || "{}";
}

function setToolOutput(block) {
  if (!block.outputEl) return;
  block.outputEl.textContent = block.outputText || "";
  block.outputEl.classList.toggle("error", !!block.isError);
  if (block.outputEl.scrollHeight > block.outputEl.clientHeight + 40) {
    block.outputEl.scrollTop = block.outputEl.scrollHeight;
  }
}

function setToolStatus(block, status, text) {
  block.status = status;
  if (!block.statusEl) return;
  block.statusEl.className = "tool-status";
  if (status === "running" || status === "pending") {
    block.statusEl.classList.add("running");
    block.statusEl.innerHTML = `<span class="spinner" style="width:10px;height:10px"></span>${text || status}`;
  } else {
    block.statusEl.innerHTML = `${text || status}`;
    block.statusEl.classList.add(status === "error" ? "error" : "ok");
  }
  if (status === "done" && block.collapsedByDefault && !block.isError) {
    block.el.classList.add("collapsed");
  } else if (status === "running") {
    block.el.classList.remove("collapsed");
  }
}

function findToolBlock(toolCallId) {
  return state.toolBlocks.get(toolCallId);
}

/* ---------- Markdown ---------- */

function renderMarkdown(text) {
  if (!text) return "";
  try {
    return window.marked ? window.marked.parse(text) : escapeHtml(text).replace(/\n/g, "<br>");
  } catch {
    return escapeHtml(text).replace(/\n/g, "<br>");
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function applyHighlight(container) {
  container.querySelectorAll("pre code").forEach((code) => {
    if (!code.dataset.hljs) {
      try {
        hljs.highlightElement(code);
      } catch { /* ignore */ }
      code.dataset.hljs = "1";
    }
  });
}

/* Claude-style code block wrapper: language label + copy button in a header bar */
function wrapCodeBlocks(container) {
  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.closest(".code-block")) return;
    const code = pre.querySelector("code");
    const langMatch = code?.className?.match(/language-([\w+-]+)/);
    const wrap = el("div", "code-block");
    const head = el("div", "code-block-head");
    const langEl = el("span", "code-lang");
    langEl.textContent = langMatch ? langMatch[1] : "text";
    const btn = el("button", "code-copy");
    btn.textContent = t("copyCode");
    btn.addEventListener("click", () => {
      const text = (code ? code.textContent : pre.textContent) ?? "";
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = t("copied");
        setTimeout(() => (btn.textContent = t("copyCode")), 1200);
      });
    });
    head.append(langEl, btn);
    pre.parentNode.insertBefore(wrap, pre);
    wrap.append(head, pre);
  });
}

/* ---------- Image helpers ---------- */

function guessMime(data) {
  if (!data) return "image/png";
  if (data.startsWith("/9j/")) return "image/jpeg";
  if (data.startsWith("iVBOR")) return "image/png";
  if (data.startsWith("UklGR")) return "image/webp";
  if (data.startsWith("R0lGOD")) return "image/gif";
  if (data.startsWith("PHN2Zy")) return "image/svg+xml";
  return "image/png";
}

function dataUrl(data, mime) {
  return `data:${mime || guessMime(data)};base64,${data}`;
}

function safeJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function extractText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");
}

/* ==========================================================================
   View construction from history
   ========================================================================== */

function renderMessages(messages) {
  clearMessages();
  const toolResults = new Map();
  for (const m of messages) {
    if (m.role === "toolResult") toolResults.set(m.toolCallId, m);
  }

  for (const m of messages) {
    if (m.role === "user") {
      const view = { id: m.id, role: "user", blocks: contentToBlocks(m.content) };
      buildMsgEl(view);
      view.blocks.forEach((b) => makeBlockEl(view, b));
      view.blocks.forEach((b) => {
        if (b.type === "text") renderTextBlock(b);
        if (b.type === "thinking") updateThinkingBlock(b);
      });
      addView(view);
    } else if (m.role === "assistant") {
      const view = {
        id: m.id,
        role: "assistant",
        blocks: contentToBlocks(m.content),
        meta: m.model ? `${m.model}` : "",
      };
      buildMsgEl(view);
      view.blocks.forEach((b) => {
        if (b.type === "toolCall") {
          const tr = toolResults.get(b.id);
          if (tr) {
            b.outputText = extractText(tr.content);
            b.isError = !!tr.isError;
          }
        }
        makeBlockEl(view, b);
      });
      view.blocks.forEach((b) => {
        if (b.type === "text") renderTextBlock(b);
        if (b.type === "thinking") updateThinkingBlock(b);
      });
      state.lastAssistant = view;
      addView(view);
    } else if (m.role === "bashExecution") {
      const view = { id: m.id, role: "system", blocks: [], bashOutput: m.output ?? "" };
      buildMsgEl(view);
      const pre = el("pre", "block-bash");
      pre.textContent = `$ ${m.command ?? ""}\n${view.bashOutput}`;
      view.bodyEl.appendChild(pre);
      addView(view);
    } else if (m.role === "custom") {
      if (m.display === false) continue;
      const view = { id: m.id, role: "system", blocks: [] };
      buildMsgEl(view);
      const div = el("div", "block-text");
      div.textContent = extractText(m.content ?? "");
      view.bodyEl.appendChild(div);
      addView(view);
    }
  }
  scrollBottom();
}

/* ==========================================================================
   Event handling (unchanged core)
   ========================================================================== */

function handleEvent(evt) {
  switch (evt.type) {
    case "agent_start":
      state.streaming = true;
      updateStreamingIndicator();
      break;
    case "agent_settled":
      state.streaming = false;
      updateStreamingIndicator();
      refreshRepoThrottled();
      break;
    case "message_start":
      onMessageStart(evt.message);
      break;
    case "message_update":
      onMessageUpdate(evt);
      break;
    case "message_end":
      onMessageEnd(evt.message);
      break;
    case "tool_execution_start":
      onToolStart(evt);
      break;
    case "tool_execution_update":
      onToolUpdate(evt);
      break;
    case "tool_execution_end":
      onToolEnd(evt);
      break;
    case "queue_update": {
      const total = (evt.steering?.length ?? 0) + (evt.followUp?.length ?? 0);
      queuedBadge.hidden = total === 0;
      queuedBadge.textContent = `${total} ${t("queued")}`;
      break;
    }
    case "compaction_start":
      showToast(t("compacting"), "info");
      break;
    case "compaction_end":
      showToast(`${t("compacted")}: ${(evt.result?.summary ?? "").slice(0, 120)}`, "info");
      refreshStats();
      break;
    case "auto_retry_start":
      showToast(`${t("retrying")} (${evt.attempt}/${evt.maxAttempts})…`, "warning");
      break;
    case "auto_retry_end":
      if (!evt.success) showToast(`Retry failed: ${evt.finalError ?? ""}`, "error");
      break;
    case "extension_error":
      showToast(`Extension error: ${evt.error ?? ""}`, "error");
      break;
    case "extension_ui_request":
      handleUiRequest(evt);
      break;
    case "engine_exit":
      showToast(t("connectionLost"), "error");
      break;
    case "engine_restarted":
      showToast(t("restarted"), "info");
      break;
    case "server_error":
      showToast(evt.message ?? "Server error", "error");
      break;
    default:
      break;
  }
}

/* ---------- message lifecycle ---------- */

function onMessageStart(message) {
  if (!message) return;
  if (message.role === "user") {
    const text = extractText(message.content);
    const last = state.messages[state.messages.length - 1];
    if (last && last.role === "user" && !last.id && last.blocks[0]?.text === text) {
      last.id = message.id;
      state.byId.set(message.id, last);
      return;
    }
    const view = { id: message.id, role: "user", blocks: contentToBlocks(message.content) };
    buildMsgEl(view);
    view.blocks.forEach((b) => makeBlockEl(view, b));
    view.blocks.forEach((b) => {
      if (b.type === "text") renderTextBlock(b);
    });
    addView(view);
    scrollBottom();
    return;
  }
  if (message.role === "assistant") {
    const view = {
      id: message.id,
      role: "assistant",
      blocks: contentToBlocks(message.content),
      streaming: true,
      meta: message.model ?? "",
    };
    buildMsgEl(view);
    view.blocks.forEach((b) => {
      if (b.type === "toolCall") {
        b.status = "pending";
        b.collapsedByDefault = false;
        state.toolBlocks.set(b.id, b);
      }
      makeBlockEl(view, b);
    });
    view.blocks.forEach((b) => {
      if (b.type === "text") renderTextBlock(b);
      if (b.type === "thinking") {
        b.live = true;
        updateThinkingBlock(b);
      }
    });
    state.lastAssistant = view;
    addView(view);
    scrollBottom();
  }
}

function findOrCreateAssistantView(message) {
  if (message.id && state.byId.has(message.id)) return state.byId.get(message.id);
  if (state.lastAssistant) return state.lastAssistant;
  const view = { id: message.id, role: "assistant", blocks: [], streaming: true, meta: message.model ?? "" };
  buildMsgEl(view);
  state.lastAssistant = view;
  addView(view);
  return view;
}

function syncBlocksFromMessage(view, message) {
  const content = Array.isArray(message.content) ? message.content : [];
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    const existing = view.blocks[i];
    if (!existing) {
      const block = blockFromContent(c);
      if (block.type === "toolCall") {
        block.status = "pending";
        block.collapsedByDefault = false;
        block.argumentsText = "";
      }
      appendBlock(view, block);
      if (block.type === "text") renderTextBlock(block);
      if (block.type === "thinking") {
        block.live = true;
        updateThinkingBlock(block);
      }
    } else if (c.type === "text" && existing.type === "text") {
      existing.text = c.text ?? "";
      scheduleRender(view);
    } else if (c.type === "thinking" && existing.type === "thinking") {
      existing.thinking = c.thinking ?? "";
      updateThinkingBlock(existing);
    } else if (c.type === "toolCall" && existing.type === "toolCall") {
      existing.name = c.name ?? existing.name;
    }
  }
}

function onMessageUpdate(evt) {
  const message = evt.message;
  if (!message) return;
  const ae = evt.assistantMessageEvent;

  if (message.role === "assistant") {
    const view = findOrCreateAssistantView(message);
    view.streaming = true;
    syncBlocksFromMessage(view, message);

    if (ae?.type === "toolcall_delta") {
      const block = view.blocks[ae.contentIndex];
      if (block && block.type === "toolCall") {
        block.argumentsText += ae.delta ?? "";
        setToolArgs(block);
      }
    }
    if (ae?.type === "toolcall_end") {
      const block = view.blocks[ae.contentIndex] ?? findToolBlock(ae.toolCall?.id);
      if (block && block.type === "toolCall") {
        block.argumentsText = safeJson(ae.toolCall?.arguments ?? {});
        setToolArgs(block);
      }
    }
    scrollIfNearBottom();
    return;
  }
}

function scheduleRender(view) {
  const prev = state.renderTimers.get(view);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => {
    state.renderTimers.delete(view);
    for (const block of view.blocks) {
      if (block.type === "text") renderTextBlock(block);
      if (block.type === "thinking") updateThinkingBlock(block);
    }
    scrollIfNearBottom();
  }, 60);
  state.renderTimers.set(view, timer);
}

function onMessageEnd(message) {
  if (!message) return;
  if (message.role === "assistant") {
    const view = state.byId.get(message.id) ?? state.lastAssistant;
    if (view && view.role === "assistant") {
      view.streaming = false;
      view.meta = message.model ?? view.meta;
      syncBlocksFromMessage(view, message);
      for (const block of view.blocks) {
        if (block.type === "text") renderTextBlock(block);
        if (block.type === "thinking") {
          block.live = false;
          updateThinkingBlock(block);
          block.el.open = false; // Claude: finished thinking collapses
        }
      }
      const timer = state.renderTimers.get(view);
      if (timer) clearTimeout(timer);
      state.renderTimers.delete(view);
    }
    refreshStats();
  }
}

/* ---------- tool execution ---------- */

function onToolStart(evt) {
  let block = findToolBlock(evt.toolCallId);
  if (!block) {
    const view = state.lastAssistant;
    if (view && view.role === "assistant") {
      block = appendBlock(view, {
        type: "toolCall",
        id: evt.toolCallId,
        name: evt.toolName,
        argumentsText: evt.args ? safeJson(evt.args) : "",
        status: "running",
        outputText: "",
        isError: false,
        collapsedByDefault: false,
      });
    } else {
      const view = { id: undefined, role: "assistant", blocks: [] };
      buildMsgEl(view);
      state.lastAssistant = view;
      addView(view);
      block = appendBlock(view, {
        type: "toolCall",
        id: evt.toolCallId,
        name: evt.toolName,
        argumentsText: evt.args ? safeJson(evt.args) : "",
        status: "running",
        outputText: "",
        isError: false,
        collapsedByDefault: false,
      });
    }
  }
  setToolStatus(block, "running", t("running"));
  scrollIfNearBottom();
}

function onToolUpdate(evt) {
  const block = findToolBlock(evt.toolCallId);
  if (!block) return;
  block.outputText = extractText(evt.partialResult?.content);
  setToolOutput(block);
  scrollIfNearBottom();
}

function onToolEnd(evt) {
  const block = findToolBlock(evt.toolCallId);
  if (!block) return;
  block.outputText = extractText(evt.result?.content);
  block.isError = !!evt.isError;
  setToolOutput(block);
  setToolStatus(block, evt.isError ? "error" : "done", evt.isError ? t("error") : t("done"));
  scrollIfNearBottom();
}

/* ---------- extension UI requests ---------- */

// hide low-value startup notices from the goal/loop package so the welcome
// screen stays clean (informational only, nothing the user must act on).
function isNoiseNotify(text) {
  return (
    text.startsWith("pi-goal-list-loop-audit: session provider") ||
    text.startsWith("glla: pi has not loaded a conversation yet")
  );
}

function handleUiRequest(req) {
  const { id, method } = req;
  const respond = (payload) => sendNoWait({ type: "extension_ui_response", id, ...payload });

  switch (method) {
    case "select": {
      const body = el("div", "modal-options");
      const opts = req.options ?? [];
      for (const o of opts) {
        const b = el("button", "modal-option");
        b.textContent = o;
        b.addEventListener("click", () => respond({ value: o }));
        body.appendChild(b);
      }
      showModal({
        title: req.title ?? "Select",
        body,
        actions: [{ label: t("cancel"), onClick: () => respond({ cancelled: true }) }],
        onCancel: () => respond({ cancelled: true }),
      });
      break;
    }
    case "confirm": {
      showModal({
        title: req.title ?? "Confirm",
        message: req.message ?? "",
        actions: [
          { label: t("yes"), primary: true, onClick: () => respond({ confirmed: true }) },
          { label: t("no"), onClick: () => respond({ confirmed: false }) },
        ],
        onCancel: () => respond({ confirmed: false }),
      });
      break;
    }
    case "input": {
      const inp = document.createElement("input");
      inp.placeholder = req.placeholder ?? "";
      const submit = () => respond({ value: inp.value });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
      showModal({
        title: req.title ?? "Input",
        body: inp,
        actions: [
          { label: t("ok"), primary: true, onClick: submit },
          { label: t("cancel"), onClick: () => respond({ cancelled: true }) },
        ],
        onCancel: () => respond({ cancelled: true }),
      });
      setTimeout(() => inp.focus(), 60);
      break;
    }
    case "editor": {
      const ta = document.createElement("textarea");
      ta.value = req.prefill ?? "";
      showModal({
        title: req.title ?? "Editor",
        body: ta,
        actions: [
          { label: t("ok"), primary: true, onClick: () => respond({ value: ta.value }) },
          { label: t("cancel"), onClick: () => respond({ cancelled: true }) },
        ],
        onCancel: () => respond({ cancelled: true }),
      });
      setTimeout(() => ta.focus(), 60);
      break;
    }
    case "notify":
      if (!isNoiseNotify(req.message ?? "")) {
        showToast(req.message, req.notifyType ?? "info");
      }
      break;
    case "setStatus":
    case "setWidget":
      break;
    case "set_editor_text":
      inputEl.value = req.text ?? "";
      autoGrow();
      break;
    default:
      break;
  }
}

/* ==========================================================================
   Modal
   ========================================================================== */

function showModal({ title, message, body, actions, onCancel }) {
  const overlay = el("div", "modal-overlay");
  const modal = el("div", "modal");
  if (title) {
    const tEl = el("div", "modal-title");
    tEl.textContent = title;
    modal.appendChild(tEl);
  }
  if (message) {
    const mEl = el("div", "modal-message");
    mEl.textContent = message;
    modal.appendChild(mEl);
  }
  if (body) {
    const bEl = el("div", "modal-body");
    if (typeof body === "string") bEl.textContent = body;
    else bEl.appendChild(body);
    modal.appendChild(bEl);
  }
  const actionsDiv = el("div", "modal-actions");
  for (const a of actions) {
    const btn = el("button", a.primary ? "btn btn-primary" : "btn");
    btn.textContent = a.label;
    btn.addEventListener("click", () => {
      finish(false);
      a.onClick?.();
    });
    actionsDiv.appendChild(btn);
  }
  modal.appendChild(actionsDiv);
  overlay.appendChild(modal);
  $("modal-root").appendChild(overlay);

  let done = false;
  const finish = (canceled) => {
    if (done) return;
    done = true;
    document.removeEventListener("keydown", escHandler);
    overlay.remove();
    if (canceled) onCancel?.();
  };
  const escHandler = (e) => {
    if (e.key === "Escape") finish(true);
  };
  document.addEventListener("keydown", escHandler);
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) finish(true);
  });
}

/* ==========================================================================
   Toasts
   ========================================================================== */

function showToast(message, type = "info") {
  const root = $("toast-root");
  const toast = el("div", `toast ${type}`);
  toast.textContent = message;
  root.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 320);
  }, type === "error" ? 6000 : 4000);
}

/* ==========================================================================
   Scroll helpers
   ========================================================================== */

function nearBottom() {
  return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 140;
}

let lastRepoRefresh = 0;
function refreshRepoThrottled() {
  const now = Date.now();
  if (now - lastRepoRefresh < 2500) return;
  lastRepoRefresh = now;
  refreshGit();
  refreshTasks();
}

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function scrollIfNearBottom() {
  if (nearBottom()) scrollBottom();
}

/* ==========================================================================
   Composer
   ========================================================================== */

function autoGrow() {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 220) + "px";
}

function updateStreamingIndicator() {
  streamingIndicator.hidden = !state.streaming;
  abortBtn.hidden = !state.streaming;
}

function addUserMessage(text, images) {
  const blocks = [];
  if (text) blocks.push({ type: "text", text });
  for (const im of images) blocks.push({ type: "image", data: im.data, mimeType: im.mimeType });
  const view = { id: undefined, role: "user", blocks };
  buildMsgEl(view);
  view.blocks.forEach((b) => makeBlockEl(view, b));
  view.blocks.forEach((b) => {
    if (b.type === "text") renderTextBlock(b);
  });
  addView(view);
  scrollBottom();
}

function sendMessage() {
  const text = inputEl.value.trim();
  const images = state.attachedImages;
  if (!text && images.length === 0) return;

  // local slash commands (like /login, /settings, /tree …)
  if (images.length === 0 && text.startsWith("/")) {
    const handled = handleLocalCommand(text);
    if (handled) {
      inputEl.value = "";
      autoGrow();
      return;
    }
  }

  addUserMessage(text, images);

  inputEl.value = "";
  autoGrow();
  clearAttachments();

  const cmd = { type: "prompt", message: text };
  if (images.length > 0) {
    cmd.images = images.map((im) => ({ type: "image", data: im.data, mimeType: im.mimeType }));
  }
  if (state.streaming) cmd.streamingBehavior = "steer";

  send(cmd)
    .then((resp) => {
      if (!resp.success) showToast(resp.error || t("sendFailed"), "error");
    })
    .catch((err) => showToast(`${t("sendFailed")}: ${err.message}`, "error"));
}

function abort() {
  sendNoWait({ type: "abort" });
  showToast(t("aborting"), "warning");
}

/* ---------- attachments ---------- */

function clearAttachments() {
  state.attachedImages = [];
  attachmentsEl.innerHTML = "";
  attachmentsEl.hidden = true;
}

function addAttachment(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const base64 = String(reader.result).split(",")[1] ?? "";
    const im = { name: file.name, mimeType: file.type || guessMime(base64), data: base64 };
    state.attachedImages.push(im);
    const thumb = el("div", "attachment-thumb");
    const img = document.createElement("img");
    img.src = dataUrl(im.data, im.mimeType);
    const x = el("button", "attachment-x");
    x.textContent = "×";
    x.addEventListener("click", () => {
      state.attachedImages = state.attachedImages.filter((a) => a !== im);
      thumb.remove();
      attachmentsEl.hidden = state.attachedImages.length === 0;
    });
    thumb.append(img, x);
    attachmentsEl.appendChild(thumb);
    attachmentsEl.hidden = false;
  };
  reader.readAsDataURL(file);
}

/* ==========================================================================
   Local commands (feature parity: /login, /model, /tree, …)
   ========================================================================== */

const LOCAL_COMMANDS = [
  { name: "/login", desc: "管理 API 凭据", run: () => openSettings("credentials") },
  { name: "/logout", desc: "移除某个 provider 的凭据", run: () => openSettings("credentials") },
  { name: "/settings", desc: "打开设置面板", run: () => openSettings() },
  { name: "/model", desc: "选择模型", run: openModelPicker },
  { name: "/new", desc: "新建会话", run: newSession },
  { name: "/resume", desc: "切换会话", runIsMenu: "sessions" },
  { name: "/name", desc: "重命名会话", run: renameSession },
  { name: "/compact", desc: "压缩上下文", run: compactNow },
  { name: "/session", desc: "显示会话信息", run: showSessionInfo },
  { name: "/tree", desc: "查看会话树并分支", run: showTree },
  { name: "/export", desc: "导出会话为 HTML", run: exportSession },
  { name: "/copy", desc: "复制最后一条助手消息", run: copyLastAssistant },
  { name: "/git", desc: "打开 Git 面板", run: openGitPanel },
  { name: "/commit", desc: "提交当前改动", run: () => gitPrompt(GIT_PROMPTS.commit) },
  { name: "/kanban", desc: "打开创作看板", run: () => {
    if (!kanbanView) toggleKanban();
  } },
  { name: "/project", desc: "进入项目目录", run: (arg) => {
    if (arg && arg.trim()) enterProjectCwd(arg.trim());
    else enterProject();
  } },
  { name: "/scratch", desc: "切换到临时会话目录", run: enterScratch },
];

function handleLocalCommand(text) {
  const [name, ...rest] = text.split(/\s+/);
  const cmd = LOCAL_COMMANDS.find((c) => c.name === name);
  if (!cmd) return false;
  if (cmd.runIsMenu) {
    state.cmdMenu = { mode: cmd.runIsMenu, filter: "", items: [], index: 0 };
    renderCmdMenu();
    cmdMenu.hidden = false;
    return true;
  }
  cmd.run(rest.join(" "));
  return true;
}

async function openModelPicker() {
  if (state.models.length === 0) await loadModels();
  const body = el("div", "modal-options");
  for (const m of state.models) {
    const b = el("button", "modal-option");
    const current = state.currentModel?.provider === m.provider && state.currentModel?.id === m.id;
    b.textContent = `${current ? "● " : ""}${m.name} · ${m.provider}`;
    b.addEventListener("click", async () => {
      const resp = await send({ type: "set_model", provider: m.provider, modelId: m.id });
      if (resp.success) {
        state.currentModel = m;
        syncModelSelect();
        loadThinkingLevels();
        refreshStats();
        showToast(`${m.name}`, "info");
      } else {
        showToast(resp.error || t("commandFailed"), "error");
      }
    });
    body.appendChild(b);
  }
  showModal({
    title: t("modelPickerTitle"),
    body,
    actions: [{ label: t("cancel") }],
  });
}

function compactNow() {
  send({ type: "compact" })
    .then((resp) => {
      if (!resp.success) showToast(resp.error || t("commandFailed"), "error");
    })
    .catch((err) => showToast(err.message, "error"));
}

async function showSessionInfo() {
  await refreshStats();
  const body = el("div");
  const stats = $("session-stats").cloneNode(true);
  body.appendChild(stats);
  showModal({
    title: t("sessionInfo"),
    body,
    actions: [{ label: t("ok"), primary: true }],
  });
}

function copyLastAssistant() {
  for (let i = state.messages.length - 1; i >= 0; i--) {
    const v = state.messages[i];
    if (v.role === "assistant") {
      const text = v.blocks.filter((b) => b.type === "text").map((b) => b.text).join("\n");
      if (text) {
        navigator.clipboard.writeText(text).then(() => showToast(t("copyDone"), "info"));
        return;
      }
    }
  }
  showToast("no assistant message", "warning");
}

async function exportSession() {
  const resp = await send({ type: "export_html" });
  if (!resp.success || !resp.data?.path) {
    showToast(resp.error || "export failed", "error");
    return;
  }
  const a = document.createElement("a");
  a.href =
    "/api/file?path=" + encodeURIComponent(resp.data.path) +
    (WEB_TOKEN ? "&token=" + encodeURIComponent(WEB_TOKEN) : "");
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast(t("exportDone"), "info");
}

async function showTree() {
  let resp;
  try {
    resp = await send({ type: "get_tree" });
  } catch (e) {
    showToast(e.message, "error");
    return;
  }
  if (!resp.success) {
    showToast(resp.error || "tree failed", "error");
    return;
  }
  const leafId = resp.data?.leafId;
  const roots = resp.data?.tree ?? [];

  const body = el("div", "modal-options");
  body.style.maxHeight = "50vh";
  body.style.overflowY = "auto";

  const renderNode = (node, depth) => {
    const entry = node.entry;
    const indent = el("span");
    indent.style.width = `${depth * 14}px`;
    indent.style.display = "inline-block";
    const b = el("button", "modal-option");
    b.style.display = "flex";
    b.style.alignItems = "center";
    b.style.gap = "6px";
    const label = el("span");
    const isUser = entry.type === "message" && entry.message?.role === "user";
    const isLeaf = entry.id === leafId;
    let glyph = "·";
    if (entry.type === "message") {
      const role = entry.message?.role;
      glyph = role === "user" ? "▸" : role === "assistant" ? "✦" : role === "toolResult" ? "⚙" : "·";
    } else if (entry.type === "compaction") glyph = "☰";
    else if (entry.type === "branch_summary") glyph = "⑃";
    const text =
      entry.type === "message"
        ? extractText(entry.message?.content ?? "").slice(0, 60)
        : entry.type === "compaction"
          ? `compact: ${(entry.summary ?? "").slice(0, 60)}`
          : entry.type === "branch_summary"
            ? `branch: ${(entry.summary ?? "").slice(0, 60)}`
            : entry.type;
    label.textContent = `${glyph} ${text || "…"}`;
    label.style.color = isUser ? "var(--text)" : isLeaf ? "var(--accent)" : "var(--text-dim)";
    label.style.fontSize = isUser ? "13.5px" : "12.5px";
    label.style.fontFamily = "var(--mono)";
    label.style.whiteSpace = "nowrap";
    label.style.overflow = "hidden";
    label.style.textOverflow = "ellipsis";
    b.append(indent, label);
    if (isUser) {
      b.addEventListener("click", async () => {
        const forkResp = await send({ type: "fork", entryId: entry.id });
        if (forkResp.success && !forkResp.data?.cancelled) {
          showToast(t("forkDone"), "info");
          await reloadAll();
        } else if (forkResp.data?.cancelled) {
          showToast("fork cancelled", "warning");
        } else {
          showToast(forkResp.error || t("forkFailed"), "error");
        }
      });
      b.title = t("treeHint");
    } else {
      b.disabled = true;
      b.style.cursor = "default";
      b.style.opacity = "0.75";
    }
    body.appendChild(b);
    for (const child of node.children ?? []) renderNode(child, depth + 1);
  };

  for (const root of roots) renderNode(root, 0);

  showModal({
    title: `${t("treeTitle")} - ${t("treeHint")}`,
    body,
    actions: [{ label: t("cancel") }],
  });
}

async function renameSession(arg) {
  const preset = typeof arg === "string" && arg.trim() ? arg.trim() : null;
  if (preset) {
    sendNoWait({ type: "set_session_name", name: preset });
    state.sessionName = preset;
    sessionNameEl.textContent = preset;
    refreshSessions();
    return;
  }
  const inp = document.createElement("input");
  inp.value = state.sessionName || "";
  inp.placeholder = "session name";
  showModal({
    title: t("renameSession"),
    body: inp,
    actions: [
      {
        label: t("ok"),
        primary: true,
        onClick: () => {
          const name = inp.value.trim();
          sendNoWait({ type: "set_session_name", name });
          state.sessionName = name || null;
          sessionNameEl.textContent = name || "-";
          refreshSessions();
        },
      },
      { label: t("cancel") },
    ],
  });
  setTimeout(() => inp.focus(), 60);
}

/* ==========================================================================
   Command menu — inline autocomplete like the Miro TUI (type / to match)
   ========================================================================== */

function buildCmdItems(filter) {
  const items = LOCAL_COMMANDS.map((c) => ({ name: c.name, desc: c.desc, kind: "miro", run: c.run }));
  for (const c of state.commands ?? []) {
    if (LOCAL_COMMANDS.some((l) => l.name === c.name)) continue;
    items.push({
      name: `/${c.name}`,
      desc: c.description || c.source || "",
      kind: c.source === "skill" ? "skill" : c.source === "prompt" ? "prompt" : "ext",
      run: () => sendCommand(`/${c.name}`),
    });
  }
  if (filter) {
    const q = filter.toLowerCase();
    return items.filter(
      (it) =>
        it.name.toLowerCase().startsWith("/" + q) ||
        it.name.toLowerCase().includes(q) ||
        it.desc.toLowerCase().includes(q),
    );
  }
  return items;
}

function sendCommand(text) {
  addUserMessage(text, []);
  send({ type: "prompt", message: text, ...(state.streaming ? { streamingBehavior: "steer" } : {}) })
    .then((resp) => {
      if (!resp.success) showToast(resp.error || t("commandFailed"), "error");
    })
    .catch((err) => showToast(err.message, "error"));
}

// Open the menu. `filter` comes from the text after "/" in the input box.
function closeCmdMenu() {
  state.cmdMenu = null;
  cmdMenu.hidden = true;
  cmdMenu.innerHTML = "";
}

// guards against stale async renders when the user types quickly
let projectMenuSeq = 0;

// Async renderer for the "/project <path>" inline autocomplete: known
// projects (fuzzy) + a live filesystem scan of the typed prefix.
async function renderProjectsAsync(m) {
  const seq = ++projectMenuSeq;
  const frag = (m.filter || "").trim();
  const items = [];
  const seen = new Set();
  const push = (path, name, desc, score) => {
    if (seen.has(path)) return;
    seen.add(path);
    items.push({ path, name, desc, score, run: () => enterProjectCwd(path) });
  };
  const projs = await getProjectsCached();
  for (const p of projs) {
    const full = fuzzyMatch(frag, p.cwd);
    const byName = fuzzyMatch(frag, p.basename);
    if (full.ok || byName.ok) {
      const hint = [p.branch, p.dirty && `●${p.dirty}`, p.remote].filter(Boolean).join(" · ");
      push(p.cwd, p.basename, hint || p.cwd, Math.max(full.score, byName.score));
    }
  }
  const dirs = await scanDirFuzzy(frag, 12);
  for (const d of dirs) push(d.path, d.name, d.path, d.score);
  if (seq !== projectMenuSeq) return; // stale keystroke
  items.sort((a, b) => b.score - a.score);
  m.items = items.slice(0, 8);
  m.index = Math.min(m.index, Math.max(0, m.items.length - 1));
  cmdMenu.innerHTML = "";
  if (m.items.length === 0) {
    const head = el("div", "cmd-menu-head");
    head.textContent = t("noProjectMatches");
    cmdMenu.appendChild(head);
    return;
  }
  m.items.forEach((it, i) => {
    const row = el("div", "cmd-menu-item" + (i === m.index ? " selected" : ""));
    const name = el("span", "c-name");
    name.textContent = it.name;
    const desc = el("span", "c-desc");
    desc.textContent = it.desc;
    row.append(name, desc);
    row.addEventListener("mousemove", () => {
      m.index = i;
      renderProjectsAsync(m);
    });
    row.addEventListener("click", () => executeCmdItem(it));
    cmdMenu.appendChild(row);
  });
}

function renderCmdMenu() {
  const m = state.cmdMenu;
  if (!m) return;
  if (m.mode === "projects") {
    renderProjectsAsync(m);
    return;
  }
  let items;
  if (m.mode === "sessions") {
    items = state.sessions.map((s) => ({
      name: s.name || s.preview || s.basename || "-",
      desc: s.cwd,
      kind: "",
      run: () => switchSession(s.file),
    }));
  } else {
    items = buildCmdItems(m.filter ?? "");
  }
  m.items = items;
  m.index = Math.min(m.index, Math.max(0, items.length - 1));
  cmdMenu.innerHTML = "";
  if (items.length === 0) {
    const head = el("div", "cmd-menu-head");
    head.textContent = m.mode === "sessions" ? t("noSessions") : "no matches";
    cmdMenu.appendChild(head);
    return;
  }
  items.forEach((it, i) => {
    const row = el("div", "cmd-menu-item" + (i === m.index ? " selected" : ""));
    const name = el("span", "c-name");
    name.textContent = it.name;
    const desc = el("span", "c-desc");
    desc.textContent = it.desc;
    row.append(name, desc);
    if (it.kind) {
      const kind = el("span", "c-kind");
      kind.textContent = it.kind;
      row.appendChild(kind);
    }
    row.addEventListener("mousemove", () => {
      m.index = i;
      renderCmdMenu();
    });
    row.addEventListener("click", () => executeCmdItem(it));
    cmdMenu.appendChild(row);
  });
}

function executeCmdItem(item) {
  if (item.runIsMenu) {
    // switch the menu into another mode (e.g. /resume -> session picker)
    state.cmdMenu = { mode: item.runIsMenu, filter: "", items: [], index: 0 };
    renderCmdMenu();
    return;
  }
  closeCmdMenu();
  inputEl.value = "";
  autoGrow();
  item.run();
}

/* ==========================================================================
   Settings panel
   ========================================================================== */

function openSettings(focusSection) {
  settingsPanel.hidden = false;
  syncThemeSeg();
  syncLangSeg();
  loadAuth();
  loadSessionStatsSection();
  if (focusSection === "credentials") {
    const cred = settingsPanel.querySelector(".settings-section:nth-of-type(2)");
    cred?.scrollIntoView({ block: "start" });
  }
}

function closeSettings() {
  settingsPanel.hidden = true;
}

function syncLangSeg() {
  document.querySelectorAll("#lang-seg button").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
}

async function loadAuth() {
  const listEl = $("cred-list");
  try {
    const resp = await fetch("/api/auth", { headers: apiHeaders() });
    const data = await resp.json();
    const providers = data.providers ?? [];
    listEl.innerHTML = "";
    if (providers.length === 0) {
      const empty = el("div", "settings-note");
      empty.textContent = t("noCredentials");
      listEl.appendChild(empty);
    }
    for (const p of providers) {
      const item = el("div", "cred-item");
      const name = el("span", "c-name");
      name.textContent = p.name;
      const key = el("span", "c-key");
      key.textContent = p.keyPreview;
      key.title = p.type;
      const del = el("button", "c-del");
      del.textContent = "✕";
      del.title = t("delete");
      del.addEventListener("click", async () => {
        const r = await fetch(`/api/auth?provider=${encodeURIComponent(p.name)}`, { method: "DELETE", headers: apiHeaders() });
        const d = await r.json();
        if (d.ok) showToast(t("deletedCredential"), "info");
        else showToast(d.error || "delete failed", "error");
        loadAuth();
      });
      item.append(name, key, del);
      listEl.appendChild(item);
    }
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function saveCredential() {
  const provider = $("cred-provider").value.trim();
  const key = $("cred-key").value.trim();
  if (!provider || !key) {
    showToast(t("commandFailed"), "warning");
    return;
  }
  try {
    const resp = await fetch("/api/auth", {
      method: "PUT",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ provider, key }),
    });
    const data = await resp.json();
    if (data.ok) {
      showToast(t("savedCredential"), "info");
      $("cred-provider").value = "";
      $("cred-key").value = "";
      loadAuth();
    } else {
      showToast(data.error || "save failed", "error");
    }
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function loadSessionStatsSection() {
  await refreshStats();
}

/* ==========================================================================
   Git panel (live read-only data via /api/git, writes go through the agent)
   ========================================================================== */

let gitPanelOpen = false;

function gitUrl(op, params = {}) {
  const q = new URLSearchParams({ op, ...params });
  const base = `/api/git?${q.toString()}`;
  return WEB_TOKEN ? `${base}&token=${encodeURIComponent(WEB_TOKEN)}` : base;
}

async function fetchGit(op, params = {}) {
  try {
    const r = await fetch(gitUrl(op, params), { headers: apiHeaders() });
    return await r.json();
  } catch {
    return null;
  }
}

async function refreshGit() {
  const cwd = activeCwd();
  state.gitCwd = cwd;
  const params = cwd ? { cwd } : {};
  const st = await fetchGit("status", params);
  if (st && st.ok && st.data) {
    const d = st.data;
    const total = d.staged.length + d.unstaged.length + d.untracked.length;
    gitChipText.textContent = total ? `${d.branch || "git"} ●` : d.branch || "git";
    if (gitPanelOpen) await renderGitPanel(d);
  } else if (st && st.ok === false && /not a git repository/i.test(st.error || "")) {
    gitChipText.textContent = "git";
    if (gitPanelOpen) renderGitNoRepo();
  } else {
    gitChipText.textContent = "git";
  }
}

function renderGitNoRepo() {
  $("git-no-repo").hidden = false;
  $("git-clean").hidden = true;
  $("git-branch").textContent = "-";
  $("git-ahead-behind").textContent = "";
  $("git-changes").innerHTML = "";
  $("git-commits").innerHTML = "";
  $("git-diff").hidden = true;
  $("git-diff").textContent = "";
}

async function renderGitPanel(st) {
  $("git-no-repo").hidden = true;
  $("git-branch").textContent = st.branch || "-";
  $("git-ahead-behind").textContent = `${st.ahead ? `↑${st.ahead} ` : ""}${st.behind ? `↓${st.behind}` : ""}`.trim();

  const changesEl = $("git-changes");
  changesEl.innerHTML = "";
  const groups = [
    ["staged", st.staged, "git-staged"],
    ["unstaged", st.unstaged, "git-unstaged"],
    ["untracked", st.untracked, "git-untracked"],
  ];
  let n = 0;
  for (const [, items, cls] of groups) n += items.length;
  $("git-clean").hidden = n > 0;
  for (const [, items, cls] of groups) {
    for (const it of items) {
      const row = el("button", `git-change ${cls}`);
      const s = el("span", "git-status");
      s.textContent = it.status;
      const name = el("span", "git-path");
      name.textContent = it.path;
      name.title = it.path;
      row.append(s, name);
      row.addEventListener("click", () => loadDiff(it.path));
      changesEl.appendChild(row);
    }
  }

  const commitsEl = $("git-commits");
  commitsEl.innerHTML = "";
  const log = await fetchGit("log", { n: 12 });
  if (log && log.ok) {
    for (const c of log.data) {
      const row = el("div", "git-commit");
      const meta = el("span", "git-commit-meta");
      meta.textContent = `${c.hash} ${c.date} · ${c.author}`;
      const sub = el("span", "git-commit-subject");
      sub.textContent = c.subject;
      row.append(meta, sub);
      commitsEl.appendChild(row);
    }
  }
}

async function loadDiff(path) {
  const diffEl = $("git-diff");
  diffEl.hidden = false;
  diffEl.textContent = t("gitLoading");
  const r = await fetchGit("diff", { path, ...(state.gitCwd ? { cwd: state.gitCwd } : {}) });
  const text = r && r.ok ? r.data.text || "(empty diff)" : r?.error || "diff failed";
  diffEl.innerHTML = "";
  for (const line of text.split("\n")) {
    const row = el("span", "git-diff-line");
    if (line.startsWith("+") && !line.startsWith("+++")) row.classList.add("ad");
    else if (line.startsWith("-") && !line.startsWith("---")) row.classList.add("dl");
    else if (line.startsWith("@@")) row.classList.add("hunk");
    else if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("+++") || line.startsWith("---")) row.classList.add("hd");
    row.textContent = line || " ";
    diffEl.appendChild(row);
  }
}

function openGitPanel() {
  gitPanelOpen = true;
  gitPanel.hidden = false;
  refreshGit();
}

function closeGitPanel() {
  gitPanelOpen = false;
  gitPanel.hidden = true;
}

function gitPrompt(text) {
  addUserMessage(text, []);
  send({ type: "prompt", message: text, ...(state.streaming ? { streamingBehavior: "steer" } : {}) })
    .then((resp) => {
      if (!resp.success) showToast(resp.error || t("commandFailed"), "error");
    })
    .catch((err) => showToast(err.message, "error"));
}

const GIT_PROMPTS = {
  commit: "请提交当前工作区的改动（用 git_commit 工具）",
  push: "请推送当前分支（用 git_push 工具）",
  release: "请发布一个新版本（用 git_release 工具）",
};

/* ==========================================================================
   Task board (kanban) — read-only view; all actions go through conversation
   ========================================================================== */

let kanbanView = false;

// cwd of the active session (from the sidebar session list), so the board
// follows the repo the user is actually talking to.
function activeCwd() {
  if (state.sessionFile) {
    const s = state.sessions.find((x) => x.file === state.sessionFile);
    if (s && s.cwd) return s.cwd;
  }
  return "";
}

function taskPrompt(text) {
  addUserMessage(text, []);
  send({ type: "prompt", message: text, ...(state.streaming ? { streamingBehavior: "steer" } : {}) })
    .then((resp) => {
      if (!resp.success) showToast(resp.error || t("commandFailed"), "error");
    })
    .catch((err) => showToast(err.message, "error"));
}

async function fetchTasks() {
  const cwd = activeCwd();
  const q = new URLSearchParams();
  if (cwd) q.set("cwd", cwd);
  const base = `/api/tasks?${q.toString()}`;
  const url = WEB_TOKEN ? `${base}&token=${encodeURIComponent(WEB_TOKEN)}` : base;
  try {
    const r = await fetch(url, { headers: apiHeaders() });
    return await r.json();
  } catch {
    return null;
  }
}

function toggleKanban() {
  kanbanView = !kanbanView;
  kanbanEl.hidden = !kanbanView;
  messagesEl.hidden = kanbanView;
  $("btn-kanban").classList.toggle("active", kanbanView);
  if (kanbanView) refreshTasks();
  else scrollBottom();
}

async function refreshTasks() {
  const data = await fetchTasks();
  if (!data || !data.ok) return;
  const tasks = data.tasks ?? [];
  kanbanRepoEl.textContent = data.cwd || "";
  renderKanban(tasks);
  const review = tasks.filter((t) => t.stage === "pending_review").length;
  kanbanReviewBadge.hidden = review === 0;
  kanbanReviewBadge.textContent = review ? `${review} ${t("reviewHint")}` : "";
}

function renderKanban(tasks) {
  const byStage = { proposed: [], in_progress: [], pending_review: [], done: [] };
  for (const t of tasks) {
    if (byStage[t.stage]) byStage[t.stage].push(t);
    else byStage.proposed.push(t);
  }
  for (const [stage, list] of Object.entries(byStage)) {
    const cardsEl = $(`kanban-${stage}`);
    cardsEl.innerHTML = "";
    const countEl = $(`count-${stage}`);
    countEl.textContent = list.length ? String(list.length) : "";
    if (list.length === 0) {
      const empty = el("div", "kanban-empty");
      empty.textContent = t("taskEmpty");
      cardsEl.appendChild(empty);
      continue;
    }
    for (const task of list) {
      cardsEl.appendChild(buildTaskCard(task));
    }
  }
}

function buildTaskCard(task) {
  const card = el("div", `kanban-card stage-${task.stage}`);
  card.dataset.id = task.id;

  const title = el("div", "k-title");
  title.textContent = task.title;

  const meta = el("div", "k-meta");
  const idEl = el("span", "k-id");
  idEl.textContent = task.id;
  meta.appendChild(idEl);
  if (task.branch) {
    const br = el("span", "k-branch");
    br.textContent = task.branch;
    meta.appendChild(br);
  }
  if (task.git?.commitCount) {
    const cc = el("span", "k-commits");
    cc.textContent = `${task.git.commitCount} commits`;
    meta.appendChild(cc);
  }
  if (task.git?.uncommittedCount) {
    const uc = el("span", "k-dirty");
    uc.textContent = `●${task.git.uncommittedCount} ${t("taskUncommitted")}`;
    meta.appendChild(uc);
  }
  if (task.git?.ahead) {
    const ah = el("span", "k-dirty");
    ah.textContent = `↑${task.git.ahead}`;
    meta.appendChild(ah);
  }

  const actions = el("div", "k-actions");
  const btn = (label, prompt) => {
    const b = el("button", "btn btn-sm");
    b.textContent = label;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      taskPrompt(prompt);
    });
    return b;
  };
  if (task.stage === "proposed") {
    actions.appendChild(btn(t("taskStart"), `开始任务 ${task.id}（用 task_start 工具）`));
  } else if (task.stage === "in_progress") {
    actions.appendChild(btn(t("taskCommit"), `提交任务 ${task.id} 的改动（用 git_commit 工具）`));
    actions.appendChild(btn(t("taskRequestReview"), `完成任务 ${task.id} 并请求审核（用 task_complete 工具，先确保已提交）`));
  } else if (task.stage === "pending_review") {
    actions.appendChild(btn(t("taskApprove"), `确认任务 ${task.id} 完成（用 task_approve 工具）`));
    actions.appendChild(btn(t("taskResume"), `继续修改任务 ${task.id}（用 task_start 工具）`));
  }

  const detail = el("div", "k-detail");
  detail.hidden = true;
  if (task.description) {
    const desc = el("div", "k-desc");
    desc.textContent = task.description;
    detail.appendChild(desc);
  }
  if (task.git?.lastCommit) {
    const lc = el("div", "k-last");
    lc.textContent = `${task.git.lastCommit.hash} ${task.git.lastCommit.date} · ${task.git.lastCommit.subject}`;
    detail.appendChild(lc);
  }

  title.addEventListener("click", () => {
    detail.hidden = !detail.hidden;
  });

  card.append(title, meta, actions, detail);
  return card;
}

function newTaskModal() {
  const inp = document.createElement("input");
  inp.placeholder = t("taskNewPlaceholder");
  showModal({
    title: t("taskNewTitle"),
    body: inp,
    actions: [
      {
        label: t("ok"),
        primary: true,
        onClick: () => {
          const title = inp.value.trim();
          if (title) taskPrompt(`帮我创建一个新任务：${title}（用 task_create 工具）`);
        },
      },
      { label: t("cancel") },
    ],
  });
  setTimeout(() => inp.focus(), 60);
}

/* ==========================================================================
   Enter project / scratch — restart the engine with a chosen working dir
   ========================================================================== */

function closeAllModals() {
  $("modal-root").innerHTML = "";
}

async function enterProjectCwd(cwd) {
  try {
    const r = await fetch("/api/enter-project", {
      method: "POST",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ cwd }),
    });
    const d = await r.json();
    if (d.ok) showToast(`${t("enteredProject")} ${d.cwd}`, "info");
    else showToast(d.error || "enter failed", "error");
  } catch (e) {
    showToast(e.message, "error");
  }
}

// Cached project list for the project picker and inline path autocomplete.
let projectListCache = null;
function getProjectsCached() {
  if (projectListCache) return Promise.resolve(projectListCache);
  return fetch("/api/projects", { headers: apiHeaders() })
    .then((r) => r.json())
    .then((d) => {
      projectListCache = d.ok && d.projects ? d.projects : [];
      return projectListCache;
    })
    .catch(() => {
      projectListCache = [];
      return projectListCache;
    });
}

// Live filesystem scan for the typed path prefix (best-effort; the client
// fuzzy-matches the returned directory names for consistent ranking).
function scanDirFuzzy(frag, limit) {
  return fetch(`/api/scan-dir?prefix=${encodeURIComponent(frag)}`, { headers: apiHeaders() })
    .then((r) => r.json())
    .then((d) => {
      if (!d.ok || !d.entries) return [];
      const out = [];
      for (const en of d.entries) {
        const byName = fuzzyMatch(frag, en.name);
        const byPath = fuzzyMatch(frag, en.path);
        if (byName.ok || byPath.ok) {
          out.push({ path: en.path, name: en.name, score: Math.max(byName.score, byPath.score) });
        }
      }
      out.sort((a, b) => b.score - a.score);
      return out.slice(0, limit);
    })
    .catch(() => []);
}

function enterScratch() {
  enterProjectCwd("~/.miro/scratch");
}

function relTime(ms) {
  if (!ms) return "";
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return lang === "zh" ? "刚刚" : "just now";
  if (s < 3600) return lang === "zh" ? `${Math.floor(s / 60)} 分钟前` : `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return lang === "zh" ? `${Math.floor(s / 3600)} 小时前` : `${Math.floor(s / 3600)}h ago`;
  return lang === "zh" ? `${Math.floor(s / 86400)} 天前` : `${Math.floor(s / 86400)}d ago`;
}

// VSCode quick-open style fuzzy path matcher (mirrors miro-tui/fuzzy.go).
// Order-exchangeable AND semantics: every space/separator-separated term must
// match the target as a subsequence, each term independently and in any
// order. Each term uses its best-scoring alignment (never greedy), with
// bonuses for path-segment starts, word boundaries, camelCase transitions,
// basename matches and consecutive runs, and a penalty for gaps.
function fuzzyMatch(query, target) {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return { ok: true, score: 0 };
  const terms = q.split(/[/\\ :]+/).filter(Boolean);
  if (!terms.length) return { ok: true, score: 0 };
  const baseStart = Math.max(t.lastIndexOf("/"), t.lastIndexOf("\\")) + 1;
  let total = 0;
  for (const term of terms) {
    const r = bestTermMatch(term, t, target, baseStart);
    if (!r.ok) return { ok: false, score: 0 };
    total += r.score;
  }
  return { ok: true, score: total };
}

const FUZZY_IMPOSSIBLE = -(1 << 30);

function bestTermMatch(term, t, tOrig, baseStart) {
  const n = t.length;
  const memo = new Map();
  const charScore = (j, prev, qi) => {
    let s = 0;
    if (qi === 0) s += 20;
    if (j === 0) s += 100;
    else if ("/\\:".includes(t[j - 1])) s += 100;
    else if ("-_. ".includes(t[j - 1])) s += 50;
    else if (/[a-z]/.test(tOrig[j - 1]) && /[A-Z]/.test(tOrig[j])) s += 50;
    if (j >= baseStart) s += 30;
    if (prev >= 0) {
      if (j === prev + 1) s += 15;
      else s -= Math.min(32, 4 * (j - prev - 1));
    }
    return s;
  };
  const rec = (qi, start) => {
    if (qi === term.length) return 0;
    const key = qi + ":" + start;
    if (memo.has(key)) return memo.get(key);
    let best = FUZZY_IMPOSSIBLE;
    const c = term[qi];
    for (let j = start; j < n; j++) {
      if (t[j] !== c) continue;
      const rest = rec(qi + 1, j + 1);
      if (rest === FUZZY_IMPOSSIBLE) continue;
      const s = charScore(j, start - 1, qi) + rest;
      if (s > best) best = s;
    }
    memo.set(key, best);
    return best;
  };
  const best = rec(0, 0);
  return { ok: best !== FUZZY_IMPOSSIBLE, score: best === FUZZY_IMPOSSIBLE ? 0 : best };
}

function enterProject() {
  const body = el("div", "modal-options");
  const filter = document.createElement("input");
  filter.placeholder = lang === "zh" ? "输入过滤…" : "Type to filter…";
  filter.style.marginBottom = "8px";
  body.appendChild(filter);

  const listEl = el("div", "modal-options");
  body.appendChild(listEl);

  const applyFilter = () => {
    const q = filter.value;
    const entries = [];
    for (const opt of listEl.querySelectorAll(".modal-option")) {
      const p = fuzzyMatch(q, opt.dataset.path || "");
      const h = fuzzyMatch(q, opt.dataset.search || "");
      const show = p.ok || h.ok;
      const score = p.ok && h.ok ? Math.max(p.score, h.score) : p.ok ? p.score : h.ok ? h.score : 0;
      entries.push({ opt, show, score });
    }
    entries.sort((a, b) => (a.show === b.show ? b.score - a.score : a.show ? -1 : 1));
    for (const e of entries) {
      e.opt.style.display = e.show ? "" : "none";
      listEl.appendChild(e.opt); // reorder by score
    }
  };

  const addOption = (title, hint, cwd) => {
    const b = el("button", "modal-option");
    b.dataset.path = cwd || "";
    b.dataset.search = `${title} ${hint}`.toLowerCase();
    const t = el("span", "p-name");
    t.textContent = title;
    b.appendChild(t);
    if (hint) {
      const h = el("span", "p-hint");
      h.textContent = hint;
      b.appendChild(h);
    }
    b.addEventListener("click", () => {
      closeAllModals();
      enterProjectCwd(cwd);
    });
    listEl.appendChild(b);
  };
  const addManual = () => {
    const manual = el("button", "modal-option");
    manual.dataset.search = t("manualPath").toLowerCase();
    manual.textContent = t("manualPath");
    manual.addEventListener("click", () => {
      const inp = document.createElement("input");
      inp.placeholder = t("projectPathPlaceholder");
      inp.style.marginBottom = "8px";
      const sugg = el("div", "modal-options");
      sugg.style.maxHeight = "260px";
      sugg.style.overflowY = "auto";
      const wrap = el("div");
      wrap.appendChild(inp);
      wrap.appendChild(sugg);

      let seq = 0;
      const renderSugg = async () => {
        const s = ++seq;
        const q = inp.value.trim();
        sugg.innerHTML = "";
        if (!q) return;
        const items = [];
        const seen = new Set();
        const push = (path, name, hint, score) => {
          if (seen.has(path)) return;
          seen.add(path);
          items.push({ path, name, hint, score });
        };
        const projs = await getProjectsCached();
        for (const p of projs) {
          const fm = fuzzyMatch(q, p.cwd);
          if (fm.ok) push(p.cwd, p.basename, p.cwd, fm.score);
        }
        const dirs = await scanDirFuzzy(q, 12);
        for (const d of dirs) push(d.path, d.name, d.path, d.score);
        if (s !== seq) return; // stale keystroke
        items.sort((a, b) => b.score - a.score);
        for (const it of items.slice(0, 6)) {
          const b = el("button", "modal-option");
          const nm = el("span", "p-name");
          nm.textContent = it.name;
          b.appendChild(nm);
          const ht = el("span", "p-hint");
          ht.textContent = it.hint;
          b.appendChild(ht);
          b.addEventListener("click", () => {
            closeAllModals();
            enterProjectCwd(it.path);
          });
          sugg.appendChild(b);
        }
      };
      inp.addEventListener("input", renderSugg);

      showModal({
        title: t("manualPath"),
        body: wrap,
        actions: [
          {
            label: t("ok"),
            primary: true,
            onClick: () => {
              const p = inp.value.trim();
              if (p) {
                closeAllModals();
                enterProjectCwd(p);
              }
            },
          },
          { label: t("cancel") },
        ],
      });
      setTimeout(() => inp.focus(), 60);
    });
    listEl.appendChild(manual);
  };
  addManual();

  fetch("/api/projects", { headers: apiHeaders() })
    .then((r) => r.json())
    .then((d) => {
      if (d.ok && d.projects && d.projects.length) {
        for (const p of d.projects) {
          const bits = [p.cwd];
          if (p.branch) bits.push(p.branch);
          if (p.dirty) bits.push(`●${p.dirty}`);
          if (p.remote) bits.push(p.remote);
          if (p.lastUsed) bits.push(relTime(p.lastUsed));
          addOption(p.basename, bits.join(" · "), p.cwd);
        }
      } else {
        const cwds = [...new Set((state.sessions || []).map((s) => s.cwd).filter(Boolean))];
        for (const c of cwds) addOption(c.split("/").pop() || c, c, c);
      }
      applyFilter();
    })
    .catch(() => {
      const cwds = [...new Set((state.sessions || []).map((s) => s.cwd).filter(Boolean))];
      for (const c of cwds) addOption(c.split("/").pop() || c, c, c);
      applyFilter();
    });

  filter.addEventListener("input", applyFilter);
  showModal({
    title: t("projectPickerTitle"),
    body,
    actions: [{ label: t("cancel") }],
  });
  setTimeout(() => filter.focus(), 60);
}

/* ==========================================================================
   Wire up the UI
   ========================================================================== */

function init() {
  applyI18n();
  applyHljsTheme(document.documentElement.dataset.theme || "dark");

  // language
  $("btn-lang").addEventListener("click", () => {
    lang = lang === "zh" ? "en" : "zh";
    localStorage.setItem("miro-web-lang", lang);
    applyI18n();
    syncLangSeg();
    refreshSessions();
  });
  document.querySelectorAll("#lang-seg button").forEach((b) => {
    b.addEventListener("click", () => {
      lang = b.dataset.lang;
      localStorage.setItem("miro-web-lang", lang);
      applyI18n();
      syncLangSeg();
      refreshSessions();
    });
  });

  // theme
  $("btn-theme").addEventListener("click", () => {
    const order = ["light", "dark", "system"];
    const cur = document.documentElement.dataset.themeMode || "system";
    setTheme(order[(order.indexOf(cur) + 1) % 3]);
  });
  document.querySelectorAll("#theme-seg button").forEach((b) => {
    b.addEventListener("click", () => setTheme(b.dataset.themeMode));
  });

  // sidebar
  $("btn-new-session").addEventListener("click", newSession);
  $("btn-sidebar-toggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));

  // collapsible session list (state persists across reloads)
  const sessToggle = $("session-list-toggle");
  const applySessionCollapse = (collapsed) => {
    sessionListEl.classList.toggle("collapsed", collapsed);
    sessToggle.setAttribute("aria-expanded", String(!collapsed));
  };
  applySessionCollapse(localStorage.getItem("miro-web-sessions-collapsed") === "1");
  sessToggle.addEventListener("click", () => {
    const collapsed = !sessionListEl.classList.contains("collapsed");
    applySessionCollapse(collapsed);
    localStorage.setItem("miro-web-sessions-collapsed", collapsed ? "1" : "0");
  });

  // settings
  $("btn-settings").addEventListener("click", () => openSettings());
  $("btn-commands").addEventListener("click", () => {
    inputEl.focus();
    if (!inputEl.value.startsWith("/")) {
      inputEl.value = "/";
      autoGrow();
    }
    inputEl.dispatchEvent(new Event("input"));
  });
  $("btn-settings-close").addEventListener("click", closeSettings);
  settingsPanel.addEventListener("mousedown", (e) => {
    if (e.target === settingsPanel) closeSettings();
  });
  $("btn-cred-save").addEventListener("click", saveCredential);

  // git panel
  $("btn-git").addEventListener("click", openGitPanel);
  $("btn-git-close").addEventListener("click", closeGitPanel);
  $("btn-git-refresh").addEventListener("click", refreshGit);
  gitPanel.addEventListener("mousedown", (e) => {
    if (e.target === gitPanel) closeGitPanel();
  });
  $("btn-git-commit").addEventListener("click", () => gitPrompt(GIT_PROMPTS.commit));
  $("btn-git-push").addEventListener("click", () => gitPrompt(GIT_PROMPTS.push));
  $("btn-git-release").addEventListener("click", () => gitPrompt(GIT_PROMPTS.release));

  // kanban
  $("btn-kanban").addEventListener("click", toggleKanban);
  $("btn-kanban-refresh").addEventListener("click", refreshTasks);
  $("btn-kanban-chat").addEventListener("click", () => {
    if (kanbanView) toggleKanban();
  });
  $("btn-task-new").addEventListener("click", newTaskModal);

  // welcome chooser: scratch session / enter project
  $("btn-scratch").addEventListener("click", enterScratch);
  $("btn-project").addEventListener("click", enterProject);

  // common providers for the datalist autocomplete
  ["anthropic", "openai", "google", "deepseek", "openrouter", "mistral", "groq", "xai", "together", "moonshot", "ollama", "bedrock", "azure", "github", "zhipu", "qwen", "kimi"].forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    $("known-providers").appendChild(opt);
  });
  $("cred-provider").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveCredential();
  });
  $("cred-key").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveCredential();
  });

  $("auto-compaction").addEventListener("change", async (e) => {
    const resp = await send({ type: "set_auto_compaction", enabled: e.target.checked });
    if (!resp.success) {
      showToast(resp.error || t("commandFailed"), "error");
      e.target.checked = !e.target.checked;
    } else {
      state.autoCompaction = e.target.checked;
    }
  });
  $("auto-retry").addEventListener("change", async (e) => {
    const resp = await send({ type: "set_auto_retry", enabled: e.target.checked });
    if (!resp.success) {
      showToast(resp.error || t("commandFailed"), "error");
      e.target.checked = !e.target.checked;
    } else {
      state.autoRetry = e.target.checked;
    }
  });
  $("btn-restart").addEventListener("click", async () => {
    showToast(t("restarting"), "info");
    try {
      const r = await fetch("/api/restart", { method: "POST", headers: apiHeaders() });
      const d = await r.json();
      if (d.ok) showToast(t("restarted"), "info");
    } catch (e) {
      showToast(e.message, "error");
    }
  });

  // composer
  sendBtn.addEventListener("click", sendMessage);
  abortBtn.addEventListener("click", abort);
  inputEl.addEventListener("input", () => {
    autoGrow();
    const v = inputEl.value;
    if (state.cmdMenu?.mode === "sessions") {
      // /resume picker stays in session mode; typing anything else closes it
      if (!v.startsWith("/")) closeCmdMenu();
      return;
    }
    // inline path autocomplete: "/project <path>" suggests matching dirs
    if (v.startsWith("/project ")) {
      const arg = v.slice("/project ".length);
      if (!arg.trim()) {
        closeCmdMenu();
        return;
      }
      if (!state.cmdMenu) state.cmdMenu = { mode: "projects", filter: "", items: [], index: 0 };
      state.cmdMenu.mode = "projects";
      state.cmdMenu.filter = arg;
      state.cmdMenu.index = 0;
      renderCmdMenu();
      cmdMenu.hidden = false;
      return;
    }
    // type "/" to start matching commands, like the Miro TUI
    if (v.startsWith("/") && !v.includes(" ")) {
      if (!state.cmdMenu) state.cmdMenu = { mode: "commands", filter: "", items: [], index: 0 };
      state.cmdMenu.filter = v.slice(1);
      state.cmdMenu.index = 0;
      renderCmdMenu();
      cmdMenu.hidden = false;
    } else {
      closeCmdMenu();
    }
  });
  inputEl.addEventListener("keydown", (e) => {
    const m = state.cmdMenu;
    if (m && !cmdMenu.hidden) {
      const n = Math.max(1, m.items.length);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        m.index = (m.index + 1) % n;
        renderCmdMenu();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        m.index = (m.index - 1 + n) % n;
        renderCmdMenu();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (m.items[m.index]) {
          executeCmdItem(m.items[m.index]);
        } else {
          closeCmdMenu();
          sendMessage();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        closeCmdMenu();
        return;
      }
      if (e.key === "Tab") {
        // complete the command name / project path in the input box
        e.preventDefault();
        if (m.items[m.index]) {
          const it = m.items[m.index];
          if (m.mode === "projects") {
            inputEl.value = "/project " + it.path + " ";
          } else {
            const slashIdx = inputEl.value.lastIndexOf("/");
            inputEl.value = inputEl.value.slice(0, slashIdx) + it.name;
          }
          const pos = inputEl.value.length;
          inputEl.setSelectionRange(pos, pos);
          closeCmdMenu();
          autoGrow();
        }
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      sendMessage();
    } else if (e.key === "Escape" && state.streaming) {
      abort();
    }
  });

  attachBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    for (const f of fileInput.files ?? []) addAttachment(f);
    fileInput.value = "";
  });

  // command menu shortcut: Ctrl+K focuses the input and types "/"
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      inputEl.focus();
      if (!inputEl.value.startsWith("/")) {
        inputEl.value = "/";
        autoGrow();
      }
      inputEl.dispatchEvent(new Event("input"));
    }
  });

  // welcome hint chips
  welcomeEl.querySelectorAll("code").forEach((chip) => {
    chip.addEventListener("click", () => {
      const name = chip.textContent;
      const cmd = LOCAL_COMMANDS.find((c) => c.name === name);
      if (!cmd) return;
      if (cmd.runIsMenu) {
        state.cmdMenu = { mode: cmd.runIsMenu, filter: "", items: [], index: 0 };
        renderCmdMenu();
        cmdMenu.hidden = false;
      } else {
        cmd.run();
      }
    });
  });

  // model / thinking selectors
  modelSelect.addEventListener("change", async () => {
    const [provider, id] = modelSelect.value.split("/");
    const resp = await send({ type: "set_model", provider, modelId: id });
    if (!resp.success) {
      showToast(resp.error || t("commandFailed"), "error");
      return;
    }
    state.currentModel = resp.data ?? { provider, id };
    loadThinkingLevels();
    refreshStats();
  });

  thinkingSelect.addEventListener("change", async () => {
    const resp = await send({ type: "set_thinking_level", level: thinkingSelect.value });
    if (resp.success) state.currentThinking = thinkingSelect.value;
    else showToast(resp.error || t("commandFailed"), "error");
  });

  // session name
  sessionNameEl.addEventListener("click", renameSession);

  // start
  openEventStream();
  setInterval(refreshStats, 15000);
  setInterval(refreshGit, 20000);
  setInterval(refreshTasks, 30000);
}

init();
