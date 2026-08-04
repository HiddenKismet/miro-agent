/**
 * Miro Web — built-in browser UI for Miro Personal Agent.
 *
 * Provides:
 *   /web [port]   Start the web server and open the browser (default MIRO_PORT or 5175)
 *   /web-stop     Stop the web server
 *
 * The server itself lives in server.mjs next to this file. It spawns
 * `pi --mode rpc` as its backend (Miro is built on the Pi Agent core), so
 * the TUI and the web UI can run side by side using the same session dir.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = join(here, "server.mjs");

const DEFAULT_PORT = Number(process.env.MIRO_PORT) || 5175;

export default function (pi: ExtensionAPI) {
  let server: ReturnType<typeof spawn> | null = null;
  let port = DEFAULT_PORT;

  pi.registerCommand("web", {
    description: "Start the Miro Web server and open the browser UI",
    handler: async (args, ctx) => {
      if (server && !server.killed) {
        ctx.ui.notify(`Miro Web is already running at http://localhost:${port}`, "info");
        return;
      }

      let requestedPort = port;
      const arg = args?.trim();
      if (arg) {
        const n = Number.parseInt(arg, 10);
        if (!Number.isFinite(n) || n <= 0 || n > 65535) {
          ctx.ui.notify(`Invalid port: ${arg}`, "error");
          return;
        }
        requestedPort = n;
      }
      port = requestedPort;

      server = spawn("node", [SERVER_PATH, "--port", String(port), "--open"], {
        stdio: "ignore",
        detached: true,
        env: { ...process.env },
      });
      server.unref();
      server.on("error", (err) => {
        ctx.ui.notify(`Failed to start Miro Web: ${err.message}`, "error");
      });

      // Give it a moment to bind, then report the URL.
      setTimeout(() => {
        if (server && !server.killed) {
          ctx.ui.notify(`Miro Web: http://localhost:${port}`, "info");
        }
      }, 800);
    },
  });

  pi.registerCommand("web-stop", {
    description: "Stop the Miro Web server",
    handler: async (_args, ctx) => {
      if (server && !server.killed) {
        server.kill("SIGTERM");
        server = null;
        ctx.ui.notify("Miro Web stopped", "info");
      } else {
        ctx.ui.notify("Miro Web is not running", "warning");
      }
    },
  });

  // Convenience tool so the LLM itself can open the web UI on request.
  pi.registerTool({
    name: "open_miro_web",
    label: "Open Miro Web UI",
    description:
      "Start the Miro Web server (a browser interface for Miro Personal Agent) and open it in the browser. Use when the user asks to open or use the web UI.",
    parameters: Type.Object({
      port: Type.Optional(Type.Number({ description: "Port for the web server (default MIRO_PORT or 5175)" })),
    }),
    async execute(_toolCallId, params: { port?: number }, _signal, _onUpdate, _ctx) {
      const port = typeof params?.port === "number" ? String(params.port) : "";
      pi.sendUserMessage(`/web ${port}`.trim(), { deliverAs: "followUp" });
      return {
        content: [{ type: "text", text: `Queued /web ${port} to start the Miro Web server.` }],
        details: {},
      };
    },
  });
}
