/**
 * Miro Git — built-in git integration for Miro Personal Agent.
 *
 * Bridges the local git repository into Miro's product surfaces:
 *
 *   Read-only tools (the LLM can call these autonomously):
 *     git_status   current branch, ahead/behind, staged/unstaged/untracked
 *     git_diff     unified diff for the working tree (optional path / staged)
 *     git_log      recent commits (hash, date, author, subject)
 *     git_branch   local/remote branches with the current one marked
 *
 *   Write tools (each gates on an explicit ui.confirm / ui.editor dialog):
 *     git_commit   smart commit: status → heuristic message → edit → commit
 *     git_push     push the current branch (never force)
 *     git_release  full release: bump version files → commit → tag → push → gh
 *
 *   Commands:
 *     /git         one-line repository status (branch, counts, last commit)
 *     /commit      same flow as git_commit (defaults to no push)
 *     /release     same flow as git_release (bump from args or a selector)
 *
 * Every write operation is appended to ~/.miro/agent/logs/git-ops.jsonl.
 * After each settled agent turn, a dirty working tree produces a single
 * advisory notify (never an automatic write).
 */

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import os from "node:os";

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

const agentDir = process.env.MIRO_CODING_AGENT_DIR || join(process.env.MIRO_HOME || join(os.homedir(), ".miro"), "agent");
const AUDIT_FILE = join(agentDir, "logs", "git-ops.jsonl");

function audit(op: string, cwd: string, ok: boolean, extra: Record<string, unknown> = {}) {
  try {
    mkdirSync(dirname(AUDIT_FILE), { recursive: true });
    appendFileSync(AUDIT_FILE, JSON.stringify({ ts: new Date().toISOString(), op, cwd, ok, ...extra }) + "\n");
  } catch {
    /* logging must never take the agent down */
  }
}

// ---------------------------------------------------------------------------
// Git runner (via the extension shell channel: pi.exec)
// ---------------------------------------------------------------------------

const GIT_FLAGS = ["--no-pager", "-c", "color.ui=false", "-c", "core.quotepath=false"];

export default function (pi: ExtensionAPI) {
  let proposalFired = false;

  pi.on("session_start", () => {
    proposalFired = false;
  });

  async function git(cwd: string, args: string[], opts: { timeout?: number } = {}) {
    try {
      return await pi.exec("git", [...GIT_FLAGS, ...args], { cwd, timeout: opts.timeout ?? 20000 });
    } catch (e) {
      return { stdout: "", stderr: String((e as Error)?.message ?? e), code: -1, killed: false };
    }
  }

  const ok = (r: { code: number }) => r.code === 0;
  const failText = (msg: string) => ({ content: [{ type: "text" as const, text: msg }], details: {} });
  // Dialogs must never hang the agent: if the UI (web/TUI) never responds,
  // the tool would block forever and wedge the session (switch/abort wait on
  // idle). Race every dialog against a timeout and treat it as cancelled.
  const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
  // Use the ACTIVE SESSION's working directory, not the process launch dir.
  // In the web UI the engine is spawned from the server dir (not a project),
  // so sessionCwd(ctx) alone would point git at the wrong place.
  const sessionCwd = (ctx: ExtensionContext): string => {
    try {
      return ctx.sessionManager?.getCwd?.() || sessionCwd(ctx);
    } catch {
      return sessionCwd(ctx);
    }
  };

  // -------------------------------------------------------------------------
  // Status parsing
  // -------------------------------------------------------------------------

  interface Change {
    status: string;
    path: string;
  }
  interface GitStatus {
    isRepo: boolean;
    branch: string;
    ahead: number;
    behind: number;
    staged: Change[];
    unstaged: Change[];
    untracked: Change[];
    allChanges: Change[];
    conventional: boolean;
  }

  async function detectConventionalStyle(cwd: string): Promise<boolean> {
    const res = await git(cwd, ["log", "--format=%s", "-n", "20"]);
    if (!ok(res)) return false;
    const subs = res.stdout.split("\n").filter(Boolean);
    if (subs.length === 0) return false;
    const conv = subs.filter((s) => /^[a-z]+(\([a-z0-9._-]+\))?: /.test(s)).length;
    return conv >= Math.floor(subs.length / 2);
  }

  async function gitStatus(cwd: string): Promise<GitStatus> {
    const res = await git(cwd, ["status", "--porcelain=v1", "-b"]);
    if (!ok(res)) {
      const err = (res.stderr || res.stdout).trim();
      if (/not a git repository/i.test(err)) {
        return { isRepo: false, branch: "", ahead: 0, behind: 0, staged: [], unstaged: [], untracked: [], allChanges: [], conventional: false };
      }
      throw new Error(`git status failed: ${err}`);
    }
    let branch = "";
    let ahead = 0;
    let behind = 0;
    const staged: Change[] = [];
    const unstaged: Change[] = [];
    const untracked: Change[] = [];
    for (const line of res.stdout.split("\n")) {
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
      if (x === "?" && y === "?") {
        untracked.push({ status: "??", path });
      } else if (x !== " " && y !== " ") {
        staged.push({ status: x, path }); // both staged & unstaged — report staged
      } else if (x !== " " && y === " ") {
        staged.push({ status: x, path });
      } else if (x === " " && y !== " ") {
        unstaged.push({ status: y, path });
      }
    }
    return {
      isRepo: true,
      branch,
      ahead,
      behind,
      staged,
      unstaged,
      untracked,
      allChanges: [...staged, ...unstaged, ...untracked],
      conventional: await detectConventionalStyle(cwd),
    };
  }

  function formatStatus(s: GitStatus): string {
    if (!s.isRepo) return "not a git repository";
    const lines = [
      `branch: ${s.branch}${s.ahead ? ` (ahead ${s.ahead})` : ""}${s.behind ? ` (behind ${s.behind})` : ""}`,
      `staged: ${s.staged.length} changed`,
      ...s.staged.map((c) => `  ${c.status}  ${c.path}`),
      `unstaged: ${s.unstaged.length} changed`,
      ...s.unstaged.map((c) => `  ${c.status}  ${c.path}`),
      `untracked: ${s.untracked.length}`,
      ...s.untracked.map((c) => `  ??  ${c.path}`),
    ];
    return lines.join("\n");
  }

  // -------------------------------------------------------------------------
  // Heuristic commit message
  // -------------------------------------------------------------------------

  const SCOPE_MAP: Record<string, string> = {
    "agent-template": "agent",
    extensions: "web",
    public: "web",
    "miro-tui": "tui",
    ui: "tui",
    rpc: "tui",
    docs: "docs",
    doc: "docs",
    test: "test",
    tests: "test",
    ".github": "ci",
    bin: "build",
    scripts: "build",
    themes: "theme",
  };

  function suggestCommitMessage(s: GitStatus): string {
    const counts = new Map<string, number>();
    let hasRoot = false;
    for (const c of s.allChanges) {
      const seg = c.path.split("/")[0];
      if (!seg || seg === ".") {
        hasRoot = true;
        continue;
      }
      const key = SCOPE_MAP[seg] || seg;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    let scope = "";
    let max = 0;
    for (const [k, n] of counts) {
      if (n > max) {
        max = n;
        scope = k;
      }
    }
    if (!scope) scope = hasRoot ? "repo" : "misc";

    const statusCounts = new Map<string, number>();
    for (const c of s.allChanges) statusCounts.set(c.status, (statusCounts.get(c.status) || 0) + 1);
    let status = "M";
    let smax = 0;
    for (const [k, n] of statusCounts) {
      if (n > smax) {
        smax = n;
        status = k;
      }
    }
    const verb = status === "A" ? "add" : status === "D" ? "remove" : status === "R" ? "rename" : "update";
    const files = s.allChanges
      .slice(0, 3)
      .map((c) => c.path.split("/").pop() || c.path)
      .join(", ");
    const suffix = s.allChanges.length > 3 ? ` (${s.allChanges.length})` : "";
    if (s.conventional) {
      const kind = status === "M" ? "feat" : status === "D" ? "chore" : "feat";
      return `${kind}(${scope}): ${files}${suffix}`;
    }
    return `${verb} ${scope}: ${files}${suffix}`;
  }

  // -------------------------------------------------------------------------
  // Write flows
  // -------------------------------------------------------------------------

  async function doCommit(ctx: ExtensionContext, opts: { push?: boolean; message?: string } = {}): Promise<{ content: { type: "text"; text: string }[]; details: Record<string, unknown> }> {
    const s = await gitStatus(sessionCwd(ctx));
    if (!s.isRepo) return failText("当前目录不是 git 仓库");
    if (s.allChanges.length === 0) return failText("工作区干净，没有可提交的改动");

    let message = opts.message?.trim() ?? "";
    if (!message) {
      if (ctx.hasUI) {
        const edited = await withTimeout(ctx.ui.editor("Commit message", suggestCommitMessage(s)), 60000, undefined);
        if (edited === undefined) return failText("已取消");
        message = edited.trim();
        if (!message) return failText("已取消（提交信息为空）");
      } else {
        message = suggestCommitMessage(s);
      }
    }

    if (ctx.hasUI) {
      const fileList = s.allChanges.slice(0, 15).map((c) => `${c.status}  ${c.path}`).join("\n");
      const more = s.allChanges.length > 15 ? `\n… 等 ${s.allChanges.length} 个` : "";
      const confirmed = await withTimeout(
        ctx.ui.confirm(
          `提交 ${s.allChanges.length} 个文件？`,
          `提交信息：${message}\n\n${fileList}${more}`,
        ),
        30000,
        false,
      );
      if (!confirmed) return failText("已取消");
    }

    const add = await git(sessionCwd(ctx), ["add", "-A"]);
    if (!ok(add)) return failText(`git add 失败：${(add.stderr || add.stdout).trim()}`);
    const commit = await git(sessionCwd(ctx), ["commit", "-m", message]);
    if (!ok(commit)) return failText(`commit 失败：${(commit.stderr || commit.stdout).trim()}`);

    let pushText = "";
    if (opts.push) {
      const branch = (await git(sessionCwd(ctx), ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
      const p = await git(sessionCwd(ctx), ["push", "origin", branch], { timeout: 60000 });
      pushText = ok(p) ? "\n已推送" : `\npush 失败：${(p.stderr || p.stdout).slice(0, 300)}`;
    }

    audit("commit", sessionCwd(ctx), true, { message, push: !!opts.push, files: s.allChanges.length });
    return { content: [{ type: "text", text: `已提交 ${s.allChanges.length} 个文件\n${(commit.stdout || "").trim()}${pushText}` }], details: {} };
  }

  async function doPush(ctx: ExtensionContext): Promise<{ content: { type: "text"; text: string }[]; details: Record<string, unknown> }> {
    const s = await gitStatus(sessionCwd(ctx));
    if (!s.isRepo) return failText("当前目录不是 git 仓库");
    const branch = (await git(sessionCwd(ctx), ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
    if (ctx.hasUI) {
      const confirmed = await withTimeout(ctx.ui.confirm("推送当前分支？", `${branch} → origin/${branch}`), 30000, false);
      if (!confirmed) return failText("已取消");
    }
    const p = await git(sessionCwd(ctx), ["push", "origin", branch], { timeout: 60000 });
    if (!ok(p)) return failText(`push 失败：${(p.stderr || p.stdout).trim()}`);
    audit("push", sessionCwd(ctx), true, { branch });
    return { content: [{ type: "text", text: `已推送 ${branch} → origin/${branch}` }], details: {} };
  }

  function readText(path: string): string | undefined {
    try {
      return readFileSync(path, "utf8");
    } catch {
      return undefined;
    }
  }

  function currentRepoVersion(cwd: string): string | undefined {
    try {
      const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
      if (typeof pkg.version === "string" && pkg.version) return pkg.version;
    } catch {
      /* no package.json */
    }
    const v = readText(join(cwd, "VERSION"))?.trim();
    if (v && /^\d+\.\d+\.\d+/.test(v)) return v;
    return undefined;
  }

  function bumpVersion(v: string, bump: string): string {
    const m = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(String(v).trim());
    if (!m) throw new Error(`无法解析版本号：${v}`);
    let [ma, mi, pa] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (bump === "major") {
      ma++;
      mi = 0;
      pa = 0;
    } else if (bump === "minor") {
      mi++;
      pa = 0;
    } else {
      pa++;
    }
    return `${ma}.${mi}.${pa}`;
  }

  function setJsonVersion(file: string, version: string) {
    const pkg = JSON.parse(readFileSync(file, "utf8"));
    pkg.version = version;
    if (pkg.packages && pkg.packages[""] && typeof pkg.packages[""] === "object") {
      pkg.packages[""].version = version;
    }
    writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n");
  }

  async function doRelease(ctx: ExtensionContext, opts: { bump?: string; version?: string } = {}): Promise<{ content: { type: "text"; text: string }[]; details: Record<string, unknown> }> {
    const s = await gitStatus(sessionCwd(ctx));
    if (!s.isRepo) return failText("当前目录不是 git 仓库");

    const current = opts.version?.trim() || currentRepoVersion(sessionCwd(ctx));
    if (!current) return failText("无法确定当前版本（缺少 package.json / VERSION，也没有可用版本）");

    let bump = opts.bump;
    if (!bump) {
      if (!ctx.hasUI) return failText("请提供 bump 参数（patch / minor / major）");
      const choice = await withTimeout(ctx.ui.select("选择发布版本增量", ["patch", "minor", "major"]), 30000, undefined);
      if (!choice) return failText("已取消");
      bump = choice;
    }
    if (bump !== "patch" && bump !== "minor" && bump !== "major") return failText(`无效的增量：${bump}`);

    const next = bumpVersion(current, bump);
    const lastTag = (await git(sessionCwd(ctx), ["describe", "--tags", "--abbrev=0"])).stdout.trim();
    const notesRes = await git(sessionCwd(ctx), ["log", "--oneline", "--no-decorate", lastTag ? `${lastTag}..HEAD` : "-n 30"]);
    const notes = ok(notesRes) ? notesRes.stdout.trim() : "";
    const notesPreview = (notes || "(no commits since last tag)").slice(0, 1200);

    if (ctx.hasUI && s.allChanges.length > 0) {
      const fileList = s.allChanges.slice(0, 15).map((c) => `${c.status}  ${c.path}`).join("\n");
      const more = s.allChanges.length > 15 ? `\n… 等 ${s.allChanges.length} 个` : "";
      const go = await withTimeout(
        ctx.ui.confirm(
          `工作区有 ${s.allChanges.length} 个未提交改动`,
          `将只暂存版本文件，其余改动保持不变。\n\n${fileList}${more}\n\n继续？`,
        ),
        30000,
        false,
      );
      if (!go) return failText("已取消");
    }

    if (ctx.hasUI) {
      const confirmed = await withTimeout(
        ctx.ui.confirm(
          `发布 v${next}？`,
          `版本文件更新 → commit → tag v${next} → push${s.isRepo && (await git(sessionCwd(ctx), ["remote"])).stdout.trim() ? "" : "（无 remote，跳过 push）"}\n\n本次变更：\n${notesPreview}`,
        ),
        30000,
        false,
      );
      if (!confirmed) return failText("已取消");
    }

    const candidates = [
      "package.json",
      "package-lock.json",
      "agent-template/extensions/miro-web/package.json",
      "agent-template/extensions/miro-web/package-lock.json",
      "VERSION",
    ];
    const touched: string[] = [];
    for (const rel of candidates) {
      const f = join(sessionCwd(ctx), rel);
      if (!existsSync(f)) continue;
      if (rel.endsWith(".json")) setJsonVersion(f, next);
      else if (rel === "VERSION") writeFileSync(f, next + "\n");
      touched.push(rel);
    }
    if (touched.length === 0) return failText("未找到任何版本文件（package.json / VERSION），无法发布");

    const add = await git(sessionCwd(ctx), ["add", ...touched]);
    if (!ok(add)) return failText(`git add 失败：${(add.stderr || add.stdout).trim()}`);
    const commit = await git(sessionCwd(ctx), ["commit", "-m", `chore(release): v${next}`]);
    if (!ok(commit)) return failText(`commit 失败：${(commit.stderr || commit.stdout).trim()}`);
    const tag = await git(sessionCwd(ctx), ["tag", "-a", `v${next}`, "-m", `v${next}`]);
    if (!ok(tag)) return failText(`tag 失败：${(tag.stderr || tag.stdout).trim()}`);

    const remote = (await git(sessionCwd(ctx), ["remote"])).stdout.trim();
    let pushed = false;
    let ghResult = "";
    if (remote) {
      const branch = (await git(sessionCwd(ctx), ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
      const p = await git(sessionCwd(ctx), ["push", "origin", branch], { timeout: 60000 });
      if (!ok(p)) return failText(`push 失败：${(p.stderr || p.stdout).trim()}`);
      const pt = await git(sessionCwd(ctx), ["push", "--tags"], { timeout: 60000 });
      pushed = ok(pt);
    } else {
      ghResult = "（未检测到 remote，跳过 push）";
    }

    try {
      const ghCheck = await pi.exec("gh", ["--version"], { cwd: sessionCwd(ctx) });
      if (ghCheck.code === 0) {
        const notesArg = `## v${next}\n\n${notes || "No release notes."}`;
        const r = await pi.exec("gh", ["release", "create", `v${next}`, "--title", `Miro v${next}`, "--notes", notesArg], {
          cwd: sessionCwd(ctx),
          timeout: 60000,
        });
        ghResult = ok(r) ? "GitHub Release 已创建" : `（gh 创建失败：${(r.stderr || r.stdout).slice(0, 300)}）`;
      } else {
        ghResult = "（gh 不可用，请手动创建 GitHub Release）";
      }
    } catch {
      ghResult = "（gh 不可用，请手动创建 GitHub Release）";
    }

    audit("release", sessionCwd(ctx), true, { version: next, pushed, touched });
    return {
      content: [{ type: "text", text: `已发布 v${next}\n版本文件：${touched.join(", ")}\n${ghResult}` }],
      details: {},
    };
  }

  // -------------------------------------------------------------------------
  // Read-only tools
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: "git_status",
    label: "Git status",
    description:
      "Show the current git repository state: branch, ahead/behind counts, and the list of staged, unstaged and untracked changes. Use this when the user asks what changed, wants to review the working tree, or before committing.",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      try {
        return { content: [{ type: "text", text: formatStatus(await gitStatus(sessionCwd(ctx))) }], details: {} };
      } catch (e) {
        return failText(`git_status 失败：${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "git_diff",
    label: "Git diff",
    description:
      "Show the unified diff of the working tree (or a single file). Pass staged=true to inspect the index, stat=true for a summary, or path to narrow to one file. Use when the user wants to see exactly what would be committed.",
    parameters: Type.Object({
      path: Type.Optional(Type.String({ description: "Only diff this path" })),
      staged: Type.Optional(Type.Boolean({ description: "Diff the index instead of the working tree" })),
      stat: Type.Optional(Type.Boolean({ description: "Show a stat summary only" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const args = ["diff", "--no-ext-diff"];
        if (params.staged) args.push("--cached");
        if (params.stat) args.push("--stat");
        if (params.path) args.push("--", params.path);
        const res = await git(sessionCwd(ctx), args, { timeout: 30000 });
        if (!ok(res)) return failText(`git diff 失败：${(res.stderr || res.stdout).trim()}`);
        let text = res.stdout;
        if (text.length > 30000) text = text.slice(0, 30000) + "\n…（输出过长，已截断）";
        return { content: [{ type: "text", text }], details: {} };
      } catch (e) {
        return failText(`git_diff 失败：${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "git_log",
    label: "Git log",
    description:
      "Show recent commits as hash + date + author + subject. Pass count to control the number (1-100, default 15) or all=true to include other branches. Use to understand recent history, or to match the repository's commit style.",
    parameters: Type.Object({
      count: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, description: "Number of commits to show (default 15)" })),
      all: Type.Optional(Type.Boolean({ description: "Include commits from all branches" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const n = String(params.count ?? 15);
        const args = ["log", "--format=%h %ad %an %s", "--date=short", ...(params.all ? ["--all"] : []), "-n", n];
        const res = await git(sessionCwd(ctx), args);
        if (!ok(res)) return failText(`git log 失败：${(res.stderr || res.stdout).trim()}`);
        return { content: [{ type: "text", text: res.stdout.trim() || "(no commits)" }], details: {} };
      } catch (e) {
        return failText(`git_log 失败：${(e as Error).message}`);
      }
    },
  });

  pi.registerTool({
    name: "git_branch",
    label: "Git branch",
    description:
      "List local (or with all=true, remote) branches, marking the current branch. Use when the user asks which branch is active or what branches exist.",
    parameters: Type.Object({
      all: Type.Optional(Type.Boolean({ description: "Include remote branches" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const res = await git(sessionCwd(ctx), ["branch", ...(params.all ? ["-a"] : [])]);
        if (!ok(res)) return failText(`git branch 失败：${(res.stderr || res.stdout).trim()}`);
        return { content: [{ type: "text", text: res.stdout.trim() || "(no branches)" }], details: {} };
      } catch (e) {
        return failText(`git_branch 失败：${(e as Error).message}`);
      }
    },
  });

  // -------------------------------------------------------------------------
  // Write tools (every write goes through an explicit dialog)
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: "git_commit",
    label: "Git commit",
    description:
      "Commit the working tree. Detects changes, proposes a commit message consistent with the repo's style, lets the user edit it, confirms, then stages + commits (optionally pushes). Use when the user asks to commit changes. Never call without user intent to commit.",
    parameters: Type.Object({
      push: Type.Optional(Type.Boolean({ description: "Push after committing" })),
      message: Type.Optional(Type.String({ description: "Commit message; omitted to propose one for the user to confirm" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      return doCommit(ctx, { push: params.push, message: params.message });
    },
  });

  pi.registerTool({
    name: "git_push",
    label: "Git push",
    description: "Push the current branch to origin after an explicit confirmation. Use when the user asks to push. Never force-pushes.",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      return doPush(ctx);
    },
  });

  pi.registerTool({
    name: "git_release",
    label: "Git release",
    description:
      "Run a full release: bump the version files (VERSION, package.json, package-lock.json) by patch/minor/major, commit, create an annotated tag vX.Y.Z, push, and create a GitHub release via gh when available. Use when the user asks to release, tag, or publish a new version.",
    parameters: Type.Object({
      bump: Type.Optional(Type.Union([Type.Literal("patch"), Type.Literal("minor"), Type.Literal("major")], { description: "Version increment (default: ask)" })),
      version: Type.Optional(Type.String({ description: "Explicit next version (overrides bump)" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      return doRelease(ctx, { bump: params.bump, version: params.version });
    },
  });

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  pi.registerCommand("git", {
    description: "Show a one-line summary of the current git repository",
    handler: async (_args, ctx) => {
      try {
        const s = await gitStatus(sessionCwd(ctx));
        if (!s.isRepo) {
          ctx.ui.notify("当前目录不是 git 仓库", "warning");
          return;
        }
        const last = await git(sessionCwd(ctx), ["log", "-1", "--format=%h %s"]);
        const parts = [
          `git ${s.branch}${s.ahead ? ` ↑${s.ahead}` : ""}${s.behind ? ` ↓${s.behind}` : ""}`,
          `staged ${s.staged.length} · unstaged ${s.unstaged.length} · untracked ${s.untracked.length}`,
        ];
        if (ok(last) && last.stdout.trim()) parts.push(`last: ${last.stdout.trim()}`);
        ctx.ui.notify(parts.join("\n"), "info");
      } catch (e) {
        ctx.ui.notify(`git 检查失败：${(e as Error).message}`, "error");
      }
    },
  });

  pi.registerCommand("commit", {
    description: "Commit the current changes (proposes a message, then confirms)",
    handler: async (_args, ctx) => {
      const result = await doCommit(ctx, {});
      ctx.ui.notify(result.content[0].text.split("\n")[0], "info");
    },
  });

  pi.registerCommand("release", {
    description: "Release a new version (bump, tag, push, GitHub release)",
    handler: async (args, ctx) => {
      const bump = args.trim();
      const result = await doRelease(ctx, { bump: bump || undefined });
      ctx.ui.notify(result.content[0].text.split("\n").slice(0, 3).join("\n"), "info");
    },
  });

  // -------------------------------------------------------------------------
  // Plan mode + git checkpoints
  // -------------------------------------------------------------------------

  let planMode = false;

  pi.on("before_agent_start", (event) => {
    if (!planMode) return;
    return {
      systemPrompt:
        event.systemPrompt +
        "\n\n[PLAN MODE] 计划模式已开启：本轮先输出你的实施计划（明确列出要改的文件、步骤、风险），等待用户明确批准后再执行任何文件修改。执行前可用 git_checkpoint 建立检查点。用户说「执行/开始/批准」后再动手。",
    };
  });

  pi.registerCommand("plan", {
    description: "Toggle plan mode: /plan on|off|status",
    handler: async (args, ctx) => {
      const a = args.trim();
      if (a === "on") planMode = true;
      else if (a === "off") planMode = false;
      else if (a === "status") {
        ctx.ui.notify(`计划模式：${planMode ? "开" : "关"}`, "info");
        return;
      } else {
        ctx.ui.notify("用法：/plan on | /plan off | /plan status", "warning");
        return;
      }
      ctx.ui.notify(`计划模式：${planMode ? "开（先计划，批准后执行）" : "关"}`, "info");
    },
  });

  pi.registerTool({
    name: "git_checkpoint",
    label: "Git checkpoint",
    description:
      "Create a lightweight restore point: tags current HEAD (checkpoint/<label>-<ts>) and captures any uncommitted work via git stash create without touching the working tree. Returns ids usable with git_checkpoint_restore. Use before starting risky or multi-step work.",
    parameters: Type.Object({
      label: Type.Optional(Type.String({ description: "Short label for the checkpoint (default: plan)" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = sessionCwd(ctx);
      const label = (params.label?.trim() || "plan").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 30) || "plan";
      const head = await git(cwd, ["rev-parse", "HEAD"]);
      if (!ok(head)) return failText(`不是 git 仓库或还没有提交：${(head.stderr || "").trim()}`);
      const wip = await git(cwd, ["stash", "create", `checkpoint: ${label}`]);
      const wipId = ok(wip) && wip.stdout.trim() ? wip.stdout.trim() : "";
      const tag = `checkpoint/${label}-${Date.now()}`;
      const tagRes = await git(cwd, ["tag", tag]);
      if (!ok(tagRes)) return failText(`创建检查点 tag 失败：${(tagRes.stderr || "").trim()}`);
      audit("checkpoint", cwd, true, { tag, wip: wipId });
      return {
        content: [{ type: "text", text: `检查点已创建：${tag}\nHEAD: ${head.stdout.trim()}\n未提交工作区快照: ${wipId || "(无)"}` }],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "git_checkpoint_restore",
    label: "Restore git checkpoint",
    description:
      "Restore a checkpoint created by git_checkpoint: resets the working tree to the checkpoint tag (discarding later changes) and optionally reapplies the captured uncommitted work. Destructive — asks for confirmation.",
    parameters: Type.Object({
      checkpoint: Type.String({ description: "Checkpoint tag (e.g. checkpoint/plan-1712345678901)" }),
      wip: Type.Optional(Type.String({ description: "WIP snapshot id to reapply after reset, if any" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const cwd = sessionCwd(ctx);
      if (ctx.hasUI) {
        const confirmed = await withTimeout(ctx.ui.confirm("恢复到检查点？", `将 git reset --hard 到 ${params.checkpoint}（丢弃之后的所有改动）${params.wip ? "，并重放未提交快照" : ""}。继续？`), 30000, false);
        if (!confirmed) return failText("已取消");
      }
      const reset = await git(cwd, ["reset", "--hard", params.checkpoint], { timeout: 30000 });
      if (!ok(reset)) return failText(`恢复失败：${(reset.stderr || "").trim()}`);
      let extra = "";
      if (params.wip) {
        const apply = await git(cwd, ["stash", "apply", params.wip], { timeout: 30000 });
        extra = ok(apply) ? "\n未提交快照已重放" : `\n快照重放失败：${(apply.stderr || "").trim()}`;
      }
      audit("checkpoint_restore", cwd, true, { checkpoint: params.checkpoint });
      return { content: [{ type: "text", text: `已恢复到 ${params.checkpoint}${extra}` }], details: {} };
    },
  });

  // -------------------------------------------------------------------------
  // Advisory auto-proposal: never writes, only notifies once per session
  // -------------------------------------------------------------------------

  pi.on("agent_settled", (_event, ctx) => {
    if (proposalFired || !ctx.hasUI) return;
    // Capture the primitive synchronously: the ctx object is only valid until
    // the next await, and using it after a session replacement/reload throws.
    const cwd = sessionCwd(ctx);
    proposalFired = true;
    void (async () => {
      try {
        const s = await gitStatus(cwd);
        if (!s.isRepo || s.allChanges.length === 0) return;
        pi.sendMessage({
          customType: "git_proposal",
          content: [{ type: "text", text: `工作区有 ${s.allChanges.length} 个未提交改动，输入 /commit 提交` }],
          display: true,
        });
      } catch {
        /* silence */
      }
    })();
  });
}
