/**
 * Miro Task Board — git-backed, conversation-first task management.
 *
 * A task is a piece of creative work with a git trace, moving through four
 * stages:
 *
 *   proposed         the task is recorded (no branch yet)
 *   in_progress      Agent is working on it (branch task/<slug> checked out)
 *   pending_review   Agent finished; awaiting user review
 *   done             user approved; no more changes
 *
 * The registry lives in ~/.miro/agent/tasks/<id>.json. Git branches are the
 * artifact substrate, conversation is the engine: every write goes through an
 * explicit ui dialog, and the web kanban / TUI list are just read-only views
 * over the same registry + git metadata.
 *
 * Tools:
 *   task_create     propose a task
 *   task_start      begin work (create/checkout task branch -> in_progress)
 *   task_complete   mark finished (-> pending_review, requires a clean tree)
 *   task_approve    user approves (-> done, optionally merge into main)
 *   task_list       list tasks for the current repository
 *
 * Commands:
 *   /task-new <title>   propose a task
 *   /task-board         summarize tasks
 */

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const agentDir = process.env.MIRO_CODING_AGENT_DIR || join(process.env.MIRO_HOME || join(os.homedir(), ".miro"), "agent");
const TASKS_DIR = join(agentDir, "tasks");

const STAGES = ["proposed", "in_progress", "pending_review", "done"] as const;
type Stage = (typeof STAGES)[number];

interface Task {
  id: string;
  title: string;
  description?: string;
  stage: Stage;
  branch?: string;
  sessionId?: string;
  cwd: string;
  createdAt: string;
  updatedAt: string;
}

function stageLabel(s: Stage): string {
  return s === "proposed" ? "提出" : s === "in_progress" ? "进行中" : s === "pending_review" ? "待审核" : "已完成";
}

function taskPath(id: string): string {
  return join(TASKS_DIR, id + ".json");
}

function readTask(id: string): Task | undefined {
  try {
    return JSON.parse(readFileSync(taskPath(id), "utf8")) as Task;
  } catch {
    return undefined;
  }
}

function writeTask(task: Task) {
  mkdirSync(TASKS_DIR, { recursive: true });
  const tmp = taskPath(task.id) + ".tmp";
  writeFileSync(tmp, JSON.stringify(task, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, taskPath(task.id));
}

function listTasks(): Task[] {
  try {
    return readdirSync(TASKS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(TASKS_DIR, f), "utf8")) as Task;
        } catch {
          return null;
        }
      })
      .filter((t): t is Task => !!t && !!t.id && STAGES.includes(t.stage))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "task"
  );
}

function genTaskId(title: string): string {
  const base = "task-" + slugify(title);
  let id = base;
  let n = 2;
  while (existsSync(taskPath(id))) id = `${base}-${n++}`;
  return id;
}

const GIT_FLAGS = ["--no-pager", "-c", "color.ui=false", "-c", "core.quotepath=false"];

export default function (pi: ExtensionAPI) {
  async function git(cwd: string, args: string[], opts: { timeout?: number } = {}) {
    try {
      return await pi.exec("git", [...GIT_FLAGS, ...args], { cwd, timeout: opts.timeout ?? 20000 });
    } catch (e) {
      return { stdout: "", stderr: String((e as Error)?.message ?? e), code: -1, killed: false };
    }
  }
  const ok = (r: { code: number }) => r.code === 0;
  const failText = (msg: string) => ({ content: [{ type: "text" as const, text: msg }], details: {} });
  // Dialogs must never hang the agent (see miro-git.ts for details).
  const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
  // Use the ACTIVE SESSION's directory, not the process launch dir (the web
  // engine spawns from the server dir, which is not the user's project).
  const sessionCwd = (ctx: ExtensionContext): string => {
    try {
      return ctx.sessionManager?.getCwd?.() || sessionCwd(ctx);
    } catch {
      return sessionCwd(ctx);
    }
  };
  // Resolve the enclosing git repository root so tasks point at the project
  // repo even when the agent runs from a subdirectory or the server dir.
  async function repoRoot(cwd: string): Promise<string> {
    const r = await git(cwd, ["rev-parse", "--show-toplevel"]);
    if (ok(r) && r.stdout.trim()) return r.stdout.trim();
    return cwd;
  }

  async function defaultBranch(cwd: string): Promise<string | undefined> {
    for (const name of ["main", "master"]) {
      if (ok(await git(cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${name}`]))) return name;
    }
    return undefined;
  }

  // Ensure the task's branch exists and is checked out. Returns the branch name
  // or null on failure.
  async function checkoutTaskBranch(task: Task): Promise<string | null> {
    const branch = task.branch || `task/${slugify(task.title)}`;
    const exists = ok(await git(task.cwd, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]));
    if (!exists) {
      const c = await git(task.cwd, ["switch", "-c", branch]);
      if (!ok(c)) return null;
      return branch;
    }
    const cur = (await git(task.cwd, ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
    if (cur === branch) return branch;
    const s = await git(task.cwd, ["switch", branch]);
    if (!ok(s)) return null;
    return branch;
  }

  async function createTask(ctx: ExtensionContext, title: string, description?: string) {
    const trimmed = title.trim();
    if (!trimmed) return failText("任务标题不能为空");
    const id = genTaskId(trimmed);
    const now = new Date().toISOString();
    const task: Task = {
      id,
      title: trimmed,
      description: description?.trim() || undefined,
      stage: "proposed",
      cwd: await repoRoot(sessionCwd(ctx)),
      createdAt: now,
      updatedAt: now,
    };
    writeTask(task);
    return {
      content: [{ type: "text", text: `已提出任务 ${id}\n标题：${trimmed}\n阶段：提出\n告诉 Miro「开始」即可进入进行中（会检出 task/<slug> 分支）。` }],
      details: {},
    };
  }

  // -------------------------------------------------------------------------
  // Tools
  // -------------------------------------------------------------------------

  pi.registerTool({
    name: "task_create",
    label: "Create task",
    description:
      "Propose a new task (stage: proposed). Records the task in the registry without touching git; the task branch is created when the task starts. Use when the user asks to create, record or propose a task, or mentions something worth turning into a task.",
    parameters: Type.Object({
      title: Type.String({ description: "Short task title" }),
      description: Type.Optional(Type.String({ description: "Optional longer description / acceptance notes" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      return createTask(ctx, params.title ?? "", params.description);
    },
  });

  pi.registerTool({
    name: "task_start",
    label: "Start task",
    description:
      "Begin work on a task: check out (or create) the task's git branch task/<slug> and move it to in_progress. Use when the user says start/begin a task, or wants to resume one.",
    parameters: Type.Object({
      taskId: Type.Optional(Type.String({ description: "Task id (e.g. task-foo). Omitted: pick the first non-done task in this repo." })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      let task = params.taskId ? readTask(params.taskId) : undefined;
      if (!task) {
        const candidates = listTasks().filter((t) => t.cwd === sessionCwd(ctx) && t.stage !== "done");
        task = params.taskId ? undefined : candidates[0];
      }
      if (!task) return failText(`未找到任务：${params.taskId || "(当前仓库没有未完成任务)"}`);
      if (task.cwd !== sessionCwd(ctx)) return failText(`任务属于其他目录（${task.cwd}），当前目录是 ${sessionCwd(ctx)}`);
      if (ctx.hasUI) {
        const confirmed = await withTimeout(ctx.ui.confirm(`开始任务 ${task.id}？`, `标题：${task.title}\n将检出 task/<slug> 分支并标记为「进行中」。`), 30000, false);
        if (!confirmed) return failText("已取消");
      }
      const branch = await checkoutTaskBranch(task);
      if (!branch) return failText(`检出任务分支失败（${task.title}）`);
      task.branch = branch;
      task.stage = "in_progress";
      task.updatedAt = new Date().toISOString();
      writeTask(task);
      return { content: [{ type: "text", text: `已开始任务 ${task.id}\n分支：${branch}\n阶段：进行中` }], details: {} };
    },
  });

  pi.registerTool({
    name: "task_complete",
    label: "Complete task (request review)",
    description:
      "Mark a task as finished and move it to pending_review, where it waits for the user to review. Requires the task branch to be checked out with a clean working tree (commit first with git_commit). Include a summary of what was done. Use when the user finishes a task or hands it over for review.",
    parameters: Type.Object({
      taskId: Type.Optional(Type.String({ description: "Task id; omitted: the in_progress (or proposed) task in this repo" })),
      summary: Type.Optional(Type.String({ description: "Summary of what was done, shown to the user for review" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      let task = params.taskId ? readTask(params.taskId) : undefined;
      if (!task) {
        const candidates = listTasks().filter((t) => t.cwd === sessionCwd(ctx));
        task = candidates.find((t) => t.stage === "in_progress") || candidates.find((t) => t.stage === "proposed");
      }
      if (!task) return failText(`未找到任务：${params.taskId || "(当前仓库没有进行中/待开始的任务)"}`);
      if (task.stage !== "in_progress" && task.stage !== "proposed") {
        return failText(`任务 ${task.id} 当前阶段是「${stageLabel(task.stage)}」，不能提交审核`);
      }
      if (!task.branch) return failText(`任务 ${task.id} 还没有分支，请先开始任务（task_start）`);
      const cur = (await git(task.cwd, ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim();
      if (cur !== task.branch) return failText(`请先检出任务分支 ${task.branch}（当前在 ${cur || "(无)"}）`);
      const st = await git(task.cwd, ["status", "--porcelain"]);
      const dirty = st.stdout.trim() ? st.stdout.trim().split("\n").filter(Boolean).length : 0;
      if (dirty > 0) return failText(`工作区还有 ${dirty} 个未提交改动，请先用 git_commit 提交再请求审核`);
      const log = await git(task.cwd, ["log", "--oneline", "-n", "8", task.branch]);
      const commits = ok(log) && log.stdout.trim() ? log.stdout.trim() : "(无提交)";
      task.stage = "pending_review";
      task.updatedAt = new Date().toISOString();
      writeTask(task);
      const summary = params.summary?.trim();
      return {
        content: [
          {
            type: "text",
            text: `任务 ${task.id} 已进入「待审核」\n标题：${task.title}\n分支：${task.branch}\n\n最近提交：\n${commits}${summary ? `\n\n完成摘要：\n${summary}` : ""}\n\n请用户审核；确认后用 task_approve 标记完成。`,
          },
        ],
        details: {},
      };
    },
  });

  pi.registerTool({
    name: "task_approve",
    label: "Approve task (done)",
    description:
      "Move a pending_review task to done after the user approves. Optionally merge the task branch into the main branch. Use when the user confirms a task is finished with no further changes.",
    parameters: Type.Object({
      taskId: Type.Optional(Type.String({ description: "Task id; omitted: the pending_review task in this repo" })),
      merge: Type.Optional(Type.Boolean({ description: "Also merge the task branch into main (asks confirmation)" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      let task = params.taskId ? readTask(params.taskId) : undefined;
      if (!task) task = listTasks().find((t) => t.cwd === sessionCwd(ctx) && t.stage === "pending_review");
      if (!task) return failText(`未找到待审核的任务：${params.taskId || "(当前仓库没有待审核任务)"}`);
      if (task.stage !== "pending_review") return failText(`任务 ${task.id} 不是「待审核」状态（当前：${stageLabel(task.stage)}）`);
      if (ctx.hasUI) {
        const confirmed = await withTimeout(ctx.ui.confirm("确认任务完成？", `${task.id} · ${task.title}`), 30000, false);
        if (!confirmed) return failText("已取消");
      }
      task.stage = "done";
      task.updatedAt = new Date().toISOString();
      writeTask(task);

      let mergeText = "";
      if (params.merge && task.branch) {
        const main = await defaultBranch(task.cwd);
        if (main) {
          const co = await git(task.cwd, ["checkout", main]);
          if (ok(co)) {
            const mg = await git(task.cwd, ["merge", "--no-ff", task.branch, "-m", `Merge ${task.id}: ${task.title}`]);
            mergeText = ok(mg) ? `\n已合并到 ${main}` : `\n合并失败：${(mg.stderr || mg.stdout).slice(0, 200)}`;
          } else {
            mergeText = "\n检出主分支失败，未合并";
          }
        } else {
          mergeText = "\n未找到 main/master 分支，未合并";
        }
      }
      return { content: [{ type: "text", text: `任务 ${task.id} 已完成 ✓${mergeText}` }], details: {} };
    },
  });

  pi.registerTool({
    name: "task_list",
    label: "List tasks",
    description:
      "List tasks for the current repository with their stage, branch and id. Use when the user asks what tasks exist, wants to review the board, or before starting/continuing work.",
    parameters: Type.Object({
      all: Type.Optional(Type.Boolean({ description: "Include tasks from all repositories" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const tasks = listTasks().filter((t) => params.all || t.cwd === sessionCwd(ctx));
      if (tasks.length === 0) return failText("当前仓库还没有任务（可直接说「创建任务：…」，或用 task_create）");
      const lines: string[] = [];
      for (const s of STAGES) {
        const group = tasks.filter((t) => t.stage === s);
        if (group.length === 0) continue;
        lines.push(`[${stageLabel(s)}]`);
        for (const t of group) lines.push(`  ${t.id}  ${t.title}${t.branch ? `  (${t.branch})` : ""}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }], details: {} };
    },
  });

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  pi.registerCommand("task-new", {
    description: "Propose a new task: /task-new <title>",
    handler: async (args, ctx) => {
      const result = await createTask(ctx, args);
      ctx.ui.notify(result.content[0].text.split("\n").slice(0, 2).join("\n"), "info");
    },
  });

  pi.registerCommand("task-board", {
    description: "Summarize tasks for this repository",
    handler: async (_args, ctx) => {
      const tasks = listTasks().filter((t) => t.cwd === sessionCwd(ctx));
      if (tasks.length === 0) {
        ctx.ui.notify("当前仓库还没有任务", "info");
        return;
      }
      const lines = tasks.map((t) => `${stageLabel(t.stage)}  ${t.id}  ${t.title}${t.branch ? ` (${t.branch})` : ""}`);
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
