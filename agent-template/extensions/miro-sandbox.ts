/**
 * Miro Sandbox — safe-ish shell execution for Miro Personal Agent.
 *
 * Reuses bubblewrap (bwrap) as a lightweight subprocess sandbox: read-only
 * system bindings, only the working directory writable, network disabled
 * unless requested. Intended for untrusted or risky commands.
 *
 * Note: per bubblewrap's own documentation, this reduces risk but is not a
 * hard security boundary. It is a convenience guardrail, not a jail.
 *
 * Tool:
 *   bash_sandbox { command, network? }   run a shell command in the sandbox
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const GIT_FLAGS: string[] = [];

export default function (pi: ExtensionAPI) {
  // Use the ACTIVE SESSION's directory, not the process launch dir.
  const sessionCwd = (ctx: ExtensionContext): string => {
    try {
      return ctx.sessionManager?.getCwd?.() || ctx.cwd;
    } catch {
      return ctx.cwd;
    }
  };
  async function exec(cwd: string, args: string[], timeout: number) {
    try {
      return await pi.exec("bwrap", args, { cwd, timeout });
    } catch (e) {
      return { stdout: "", stderr: String((e as Error)?.message ?? e), code: -1, killed: false };
    }
  }

  async function runSandbox(cwd: string, command: string, network: boolean): Promise<string> {
    const which = await pi.exec("sh", ["-c", "command -v bwrap"], { cwd });
    if (which.code !== 0) {
      return "bwrap 未安装，无法进入沙箱。安装：sudo apt install bubblewrap";
    }
    const args = [
      "--die-with-parent",
      "--new-session",
      "--unshare-pid",
      "--unshare-uts",
      "--unshare-ipc",
      ...(network ? [] : ["--unshare-net"]),
      "--ro-bind", "/usr", "/usr",
      "--ro-bind", "/bin", "/bin",
      "--ro-bind", "/sbin", "/sbin",
      "--ro-bind", "/lib", "/lib",
      "--ro-bind", "/lib64", "/lib64",
      "--ro-bind", "/etc", "/etc",
      "--proc", "/proc",
      "--dev", "/dev",
      "--tmpfs", "/tmp",
      "--bind", cwd, cwd,
      "bash", "-c", command,
    ];
    const res = await exec(cwd, args, 60000);
    if (res.code === 0) return res.stdout;
    return `沙箱命令失败（code=${res.code}）\n${res.stderr || res.stdout}`;
  }

  pi.registerTool({
    name: "bash_sandbox",
    label: "Bash (sandboxed)",
    description:
      "Run a shell command inside a lightweight bubblewrap sandbox: the system is read-only, only the current working directory is writable, and the network is disabled unless network=true. Use this for untrusted, destructive, or otherwise risky commands instead of the plain bash tool.",
    parameters: Type.Object({
      command: Type.String({ description: "The shell command to run inside the sandbox" }),
      network: Type.Optional(Type.Boolean({ description: "Allow network access (default false)" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      return {
        content: [{ type: "text", text: await runSandbox(sessionCwd(ctx), params.command, !!params.network) }],
        details: {},
      };
    },
  });
}
