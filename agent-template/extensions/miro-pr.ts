/**
 * Miro PR — GitHub pull-request review for Miro Personal Agent.
 *
 * Reuses the gh CLI (MIT). Fetches a PR's diff for the agent to review, then
 * posts the review (comment / approve / request changes). The agent drives the
 * flow: user says "review PR 12" → pr_review fetches the diff → the agent
 * reviews it → pr_review_post submits (after an explicit confirmation).
 *
 * Tools:
 *   pr_review          resolve a PR and return its metadata + diff
 *   pr_review_post     post a review comment / approve / request changes
 * Command:
 *   /pr [number]       show a compact summary of a PR (default: current branch's PR)
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  async function gh(cwd: string, args: string[], opts: { timeout?: number } = {}) {
    try {
      return await pi.exec("gh", args, { cwd, timeout: opts.timeout ?? 30000 });
    } catch (e) {
      return { stdout: "", stderr: String((e as Error)?.message ?? e), code: -1, killed: false };
    }
  }
  const ok = (r: { code: number }) => r.code === 0;
  const failText = (msg: string) => ({ content: [{ type: "text" as const, text: msg }], details: {} });
  // Dialogs must never hang the agent (see miro-git.ts for details).
  const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
    Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
  // Use the ACTIVE SESSION's directory, not the process launch dir.
  const sessionCwd = (ctx: ExtensionContext): string => {
    try {
      return ctx.sessionManager?.getCwd?.() || sessionCwd(ctx);
    } catch {
      return sessionCwd(ctx);
    }
  };

  async function resolvePr(cwd: string, pr?: string): Promise<string | null> {
    if (pr && pr.trim()) return pr.trim();
    const r = await gh(cwd, ["pr", "view", "--json", "number", "--jq", ".number"]);
    if (!ok(r) || !r.stdout.trim()) return null;
    return r.stdout.trim();
  }

  pi.registerTool({
    name: "pr_review",
    label: "PR review (fetch)",
    description:
      "Fetch a GitHub pull request's metadata and diff for review. Pass pr=<number> or omit to use the current branch's PR. Use when the user asks to review a pull request.",
    parameters: Type.Object({
      pr: Type.Optional(Type.String({ description: "PR number; omitted: current branch's PR" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const number = await resolvePr(sessionCwd(ctx), params.pr);
      if (!number) return failText("没有找到 PR（当前分支可能没有关联 PR，或 gh 未登录）。请提供 PR 编号。");
      const view = await gh(sessionCwd(ctx), ["pr", "view", number, "--json", "number,title,author,state,headRefName,baseRefName,body,additions,deletions,changedFiles"]);
      if (!ok(view)) return failText(`gh pr view 失败：${(view.stderr || "").trim()}`);
      let meta = "";
      try {
        const d = JSON.parse(view.stdout);
        meta = `PR #${d.number} · ${d.title}\n作者: ${d.author?.login}  状态: ${d.state}\n${d.headRefName} → ${d.baseRefName}\n+${d.additions} -${d.deletions} · ${d.changedFiles} files\n\n${(d.body || "(无描述)").slice(0, 800)}`;
      } catch {
        meta = view.stdout.slice(0, 800);
      }
      const diff = await gh(sessionCwd(ctx), ["pr", "diff", number], { timeout: 60000 });
      if (!ok(diff)) return failText(`gh pr diff 失败：${(diff.stderr || "").trim()}`);
      let text = diff.stdout;
      if (text.length > 40000) text = text.slice(0, 40000) + "\n…（diff 过长，已截断）";
      return { content: [{ type: "text", text: `${meta}\n\n====== DIFF ======\n${text}` }], details: {} };
    },
  });

  pi.registerTool({
    name: "pr_review_post",
    label: "PR review (post)",
    description:
      "Submit a review for a pull request via gh: post a comment, approve, or request changes. Asks for confirmation before posting. Use after reviewing with pr_review.",
    parameters: Type.Object({
      pr: Type.Optional(Type.String({ description: "PR number; omitted: current branch's PR" })),
      comment: Type.Optional(Type.String({ description: "Review body text" })),
      approve: Type.Optional(Type.Boolean({ description: "Approve the PR instead of commenting" })),
      requestChanges: Type.Optional(Type.Boolean({ description: "Request changes instead of commenting" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const number = await resolvePr(sessionCwd(ctx), params.pr);
      if (!number) return failText("没有找到 PR，请提供 PR 编号。");
      const args = ["pr", "review", number];
      if (params.approve) args.push("--approve");
      else if (params.requestChanges) args.push("--request-changes");
      else args.push("--comment");
      if (params.comment) args.push("--body", params.comment);
      if (ctx.hasUI) {
        const action = params.approve ? "批准" : params.requestChanges ? "请求修改" : "评论";
        const confirmed = await withTimeout(ctx.ui.confirm(`提交 PR #${number} 的${action}？`, params.comment ? `评论预览：\n${params.comment.slice(0, 500)}` : action), 30000, false);
        if (!confirmed) return failText("已取消");
      }
      const r = await gh(sessionCwd(ctx), args, { timeout: 30000 });
      if (!ok(r)) return failText(`提交审查失败：${(r.stderr || "").trim()}`);
      return { content: [{ type: "text", text: `已提交 PR #${number} 的审查${params.approve ? "（批准）" : params.requestChanges ? "（请求修改）" : "（评论）"}` }], details: {} };
    },
  });

  pi.registerCommand("pr", {
    description: "Show a compact PR summary: /pr [number]",
    handler: async (args, ctx) => {
      const number = await resolvePr(sessionCwd(ctx), args);
      if (!number) {
        ctx.ui.notify("没有找到 PR（gh 未登录或当前分支无关联 PR）", "warning");
        return;
      }
      const view = await gh(sessionCwd(ctx), ["pr", "view", number, "--json", "number,title,state,headRefName,baseRefName,changedFiles"]);
      if (!ok(view)) {
        ctx.ui.notify(`gh pr view 失败：${(view.stderr || "").trim()}`, "error");
        return;
      }
      try {
        const d = JSON.parse(view.stdout);
        ctx.ui.notify(`PR #${d.number} ${d.title} [${d.state}] ${d.headRefName}→${d.baseRefName} · ${d.changedFiles} files`, "info");
      } catch {
        ctx.ui.notify(view.stdout.slice(0, 300), "info");
      }
    },
  });
}
