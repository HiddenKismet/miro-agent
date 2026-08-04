/**
 * Auto-resume pi-task in-flight runs at session start.
 *
 * "Tasks 总会在合适的时候自动启动": when a pi session starts (startup or
 * resume), this extension checks the project's `.pi-tasks/` directory for an
 * unfinished `/task-auto` run (a TASK_AUTO_*.md with unchecked items). If one
 * exists, it queues `/task-auto-resume --unattended` as a follow-up message,
 * which continues the run at the first unchecked task title with no human in
 * the loop. When nothing is in flight, it stays completely silent.
 *
 * Note: glla (`pi-goal-list-loop-audit`) already auto-resumes unfinished
 * goals on its own; this hook only covers the pi-task pipeline.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const TASKS_DIR = ".pi-tasks";

async function hasUnfinishedAutoRun(cwd: string): Promise<boolean> {
  try {
    const dir = join(cwd, TASKS_DIR);
    const entries = await readdir(dir);
    for (const name of entries) {
      if (!/^TASK_AUTO_.*\.md$/.test(name)) continue;
      const content = await readFile(join(dir, name), "utf8");
      // An in-flight run has at least one unchecked task title and no
      // completed-final marker; "- [ ]" lines are the checkpoint source.
      if (/-\s*\[ \]/.test(content)) return true;
    }
  } catch {
    // no .pi-tasks dir — nothing to resume
  }
  return false;
}

export default function (pi: ExtensionAPI) {
  let fired = false;

  pi.on("session_start", async (event, ctx) => {
    if (fired) return;
    if (event.reason !== "startup" && event.reason !== "resume") return;
    fired = true;

    // Capture synchronously: the ctx object is only valid until the next await
    // and must not be used after a session replacement/reload.
    const cwd = (() => {
      try {
        return ctx.sessionManager?.getCwd?.() || ctx.cwd;
      } catch {
        return ctx.cwd;
      }
    })();

    // Let the session fully load before queuing anything.
    setTimeout(async () => {
      try {
        if (!(await hasUnfinishedAutoRun(cwd))) return;
        // followUp delivery: only delivered once the agent is idle.
        pi.sendUserMessage("/task-auto-resume --unattended", { deliverAs: "followUp" });
      } catch {
        /* never let a boot hook take pi down */
      }
    }, 2000);
  });
}
