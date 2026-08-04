/**
 * Miro brand hook — gives Miro Personal Agent its identity at startup.
 *
 * On session start it announces Miro ("Let Miro sort your mind") and, when
 * MIRO_AUTOWEB=1 is set, auto-launches Miro Web so the browser UI is ready
 * before the first message. The web server is detached (like /web), so it
 * survives this process and can be stopped with /web-stop.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
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

    // Brand greeting — short, quiet, on-brand.
    ctx.ui.notify("Miro ✦ Let Miro sort your mind", "info");

    // Optional: auto-start the browser UI.
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
