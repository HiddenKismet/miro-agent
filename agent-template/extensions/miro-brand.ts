/**
 * Miro brand hook — gives Miro Personal Agent its identity and an
 * OpenCode-inspired TUI:
 *
 *   1. Mint pulsing ✦ working indicator while streaming
 *   2. Persistent "✦ Miro" status
 *   3. OpenCode-style two-line footer: status bar + key hints
 *   4. Info widget above the editor (tokens / cost / model)
 *   5. Session greeting + optional MIRO_AUTOWEB auto-launch
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const WEB_SERVER = join(here, "miro-web", "server.mjs");

// Version is stamped by install.sh into the agent home (VERSION); fall back to
// the value kept in sync at build time.
function resolveVersion(): string {
  try {
    const agentDir = process.env.MIRO_CODING_AGENT_DIR || join(process.env.MIRO_HOME || join(os.homedir(), ".miro"), "agent");
    const v = readFileSync(join(agentDir, "VERSION"), "utf8").trim();
    if (v) return v;
  } catch {
    /* no VERSION stamp yet */
  }
  return "0.1.0";
}
const MIRO_VERSION = resolveVersion();

export default function (pi: ExtensionAPI) {
  let fired = false;

  pi.on("session_start", async (event, ctx) => {
    if (fired) return;
    fired = true;

    // The TUI renders its own banner + greeting, so no notify here (avoids a
    // duplicated "Miro … sort your mind" line at startup).
    ctx.ui.setTitle("Miro ✦ Personal Agent");

    // ---- mint pulse working indicator ------------------------------------------
    ctx.ui.setWorkingIndicator({
      frames: [
        ctx.ui.theme.fg("dim", "■"),
        ctx.ui.theme.fg("muted", "■■"),
        ctx.ui.theme.fg("accent", "■■■"),
        ctx.ui.theme.fg("muted", "■■"),
      ],
      intervalMs: 140,
    });

    // ---- persistent status -------------------------------------------------------
    ctx.ui.setStatus("miro", ctx.ui.theme.fg("accent", "✦ Miro"));

    // ---- info widget above the editor (OpenCode sidebar vibe) ---------------------
    const renderInfo = () => {
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
      const theme = ctx.ui.theme;
      const model = ctx.model?.id ? ctx.model.id.split("/").pop() : "—";
      return [
        theme.fg("accent", "✦") +
          theme.fg("muted", " Miro") +
          theme.fg("dim", "  ·  ") +
          theme.fg("dim", `↑${fmt(input)} ↓${fmt(output)}`) +
          theme.fg("dim", "  ·  ") +
          theme.fg("warning", `$${cost.toFixed(3)}`) +
          theme.fg("dim", "  ·  ") +
          theme.fg("muted", model ?? ""),
      ];
    };
    ctx.ui.setWidget("miro-info", renderInfo(), { placement: "aboveEditor" });

    // ---- OpenCode-style two-line footer --------------------------------------------
    ctx.ui.setFooter((tui, theme, footerData) => {
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          // line 1: path : branch  ···  • Miro version
          let cwd = "";
          try {
            cwd = ctx.sessionManager.getCwd();
          } catch {
            /* noop */
          }
          const home = process.env.HOME || "";
          const shownCwd = home && cwd.startsWith(home) ? "~" + cwd.slice(home.length) : cwd;
          const branch = footerData.getGitBranch();
          const left =
            theme.fg("muted", shownCwd) +
            (branch ? theme.fg("dim", ":") + theme.fg("accent", branch) : "");
          const right = theme.fg("dim", `• Miro ${MIRO_VERSION}`);
          const pad1 = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
          const line1 = truncateToWidth(left + pad1 + right, width);

          // line 2: key hints
          const hints = theme.fg(
            "dim",
            "⌃C exit    /web browser    /task workflow    /goal objectives    /list backlog    /loop optimize",
          );
          const line2 = truncateToWidth(hints, width);

          return [line1, line2];
        },
      };
    });

    // ---- optional: auto-start the browser UI ----------------------------------------
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
