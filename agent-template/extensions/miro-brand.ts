/**
 * Miro brand hook — gives Miro Personal Agent its identity.
 *
 * TUI customization (per docs/tui.md):
 *   1. Mint pulsing ✦ working indicator while streaming
 *   2. Persistent "✦ Miro" status in the footer area
 *   3. Custom footer: usage stats + model + git branch + Miro signature
 *
 * Also announces Miro at session start and, when MIRO_AUTOWEB=1,
 * auto-launches Miro Web (detached, survives this process).
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const WEB_SERVER = join(here, "miro-web", "server.mjs");

export default function (pi: ExtensionAPI) {
  let fired = false;

  pi.on("session_start", async (event, ctx) => {
    if (fired) return;
    fired = true;

    // ---- brand greeting -----------------------------------------------------
    ctx.ui.notify("Miro ✦ Let Miro sort your mind", "info");

    // ---- terminal window title ------------------------------------------------
    ctx.ui.setTitle("Miro ✦ Personal Agent");

    // ---- mint pulse working indicator ---------------------------------------
    // Frames are rendered verbatim, so colors come from the current theme.
    ctx.ui.setWorkingIndicator({
      frames: [
        ctx.ui.theme.fg("dim", "✦"),
        ctx.ui.theme.fg("muted", "✦"),
        ctx.ui.theme.fg("accent", "✦"),
        ctx.ui.theme.fg("muted", "✦"),
      ],
      intervalMs: 140,
    });

    // ---- persistent status ---------------------------------------------------
    ctx.ui.setStatus("miro", ctx.ui.theme.fg("accent", "✦ Miro"));

    // ---- custom footer: stats · model · branch · signature --------------------
    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          // usage stats from the current session branch
          let input = 0,
            output = 0,
            cost = 0;
          for (const e of ctx.sessionManager.getBranch()) {
            if (e.type === "message" && e.message.role === "assistant") {
              const m = e.message as AssistantMessage;
              input += m.usage.input;
              output += m.usage.output;
              cost += m.usage.cost.total;
            }
          }
          const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);

          const left = theme.fg("dim", `↑${fmt(input)} ↓${fmt(output)} $${cost.toFixed(3)}`);

          const branch = footerData.getGitBranch();
          const branchStr = branch ? ` ${theme.fg("dim", "(")}${theme.fg("muted", branch)}${theme.fg("dim", ")")}` : "";
          const modelStr = ctx.model?.id ? ` ${theme.fg("dim", ctx.model.id)}` : "";
          const right = `${theme.fg("accent", "✦")} ${theme.fg("muted", "Miro")}${modelStr}${branchStr}`;

          const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
          return [truncateToWidth(left + pad + right, width)];
        },
      };
    });

    // ---- optional: auto-start the browser UI ----------------------------------
    if (process.env.MIRO_AUTOWEB === "1") {
      const port = String(Number(process.env.MIRO_PORT) || 5175);
      try {
        const server = spawn("node", [WEB_SERVER, "--port", port, "--open"], {
          stdio: "ignore",
          detached: true,
          env: { ...process.env },
        });
        server.unref();
        server.on("error", (err) => {
          ctx.ui.notify(`Miro Web failed to auto-start: ${err.message}`, "error");
        });
        setTimeout(() => {
          ctx.ui.notify(`Miro Web: http://localhost:${port}`, "info");
        }, 800);
      } catch {
        /* boot hooks must never take the agent down */
      }
    }
  });
}
