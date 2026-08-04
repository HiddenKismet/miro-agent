/**
 * Miro MCP — Model Context Protocol client for Miro Personal Agent.
 *
 * Reuses the official MCP TypeScript SDK (@modelcontextprotocol/client,
 * MIT/Apache-2.0). Reads a Claude/Codex-compatible mcp.json, spawns stdio MCP
 * servers, and maps every MCP tool into pi's tool registry so the agent can
 * call them like any other tool.
 *
 * The extension factory is async on purpose: MCP servers connect and their
 * tools are registered during the initial extension load, so they land in the
 * session's tool list before the first turn (registering them later from a
 * session_start callback would not reach the already-built tool set).
 *
 * Config (first found wins):
 *   $MIRO_MCP_CONFIG            path to a JSON file
 *   ~/.miro/agent/mcp.json      global Miro home config
 *
 * mcp.json shape:
 *   { "mcpServers": {
 *       "playwright": { "command": "npx", "args": ["@playwright/mcp@latest"], "env": {} }
 *   } }
 *
 * Tools are registered as "<server>_<tool>" (sanitized). constrainedSampling
 * is disabled for MCP tools because their schemas are server-authoritative and
 * the provider round-trip adds latency / failure modes for no benefit.
 *
 * Commands:
 *   /mcp            list connected servers + tool counts
 *   /mcp reload     reconnect all servers (restart Miro if tools don't appear)
 */

import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { Type } from "typebox";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const agentDir = process.env.MIRO_CODING_AGENT_DIR || join(process.env.MIRO_HOME || join(os.homedir(), ".miro"), "agent");

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

function loadConfig(): Record<string, McpServerConfig> {
  const candidates: string[] = [];
  if (process.env.MIRO_MCP_CONFIG) candidates.push(process.env.MIRO_MCP_CONFIG);
  candidates.push(join(agentDir, "mcp.json"));
  for (const file of candidates) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      if (parsed && typeof parsed === "object" && parsed.mcpServers) {
        return parsed.mcpServers as Record<string, McpServerConfig>;
      }
    } catch {
      /* try next candidate */
    }
  }
  return {};
}

function sanitizeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "mcp";
}

// Minimal JSON Schema -> TypeBox converter for MCP tool input schemas.
// Unhandled shapes degrade to Type.Unknown() so tools still register.
function jsonSchemaToTypebox(schema: any): any {
  if (!schema || typeof schema !== "object") return Type.Unknown();
  if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
    return Type.Union(schema.anyOf.map((s: any) => jsonSchemaToTypebox(s)));
  }
  if (Array.isArray(schema.oneOf) && schema.oneOf.length) {
    return Type.Union(schema.oneOf.map((s: any) => jsonSchemaToTypebox(s)));
  }
  const t = schema.type;
  if (Array.isArray(t)) return Type.Unknown();
  switch (t) {
    case "object": {
      const props: Record<string, any> = {};
      const required = Array.isArray(schema.required) ? schema.required : [];
      for (const [k, v] of Object.entries(schema.properties ?? {})) {
        let s = jsonSchemaToTypebox(v);
        if (!required.includes(k)) s = Type.Optional(s);
        props[k] = s;
      }
      return Type.Object(props, { additionalProperties: schema.additionalProperties !== false });
    }
    case "array":
      return Type.Array(schema.items ? jsonSchemaToTypebox(schema.items) : Type.Unknown());
    case "string":
      return Array.isArray(schema.enum) && schema.enum.length
        ? Type.Union(schema.enum.map((e: any) => Type.Literal(e)))
        : Type.String();
    case "number":
      return Type.Number();
    case "integer":
      return Type.Integer();
    case "boolean":
      return Type.Boolean();
    case "null":
      return Type.Null();
    default:
      return Type.Unknown();
  }
}

interface ConnectedServer {
  name: string;
  client: Client | null;
  tools: { mcpName: string; displayName: string; description: string; inputSchema: any }[];
  error?: string;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`connect to "${label}" timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export default async function (pi: ExtensionAPI) {
  let servers = new Map<string, ConnectedServer>();

  async function connectServer(name: string, cfg: McpServerConfig) {
    const transport = new StdioClientTransport({
      command: cfg.command,
      args: cfg.args,
      env: { ...process.env, ...(cfg.env ?? {}) },
      ...(cfg.cwd ? { cwd: cfg.cwd } : {}),
      stderr: "pipe",
    });
    const client = new Client({ name: `Miro ${name}`, version: "0.2.0" });
    await withTimeout(client.connect(transport), 15000, name);
    const { tools } = await client.listTools();
    return {
      name,
      client,
      tools: (tools ?? []).map((t) => ({
        mcpName: t.name,
        displayName: t.title || t.name,
        description: t.description ?? "",
        inputSchema: t.inputSchema,
      })),
    };
  }

  function registerServerTools() {
    for (const [serverName, srv] of servers) {
      if (!srv.client || !srv.tools.length) continue;
      for (const t of srv.tools) {
        const toolName = sanitizeName(`${serverName}_${t.mcpName}`);
        try {
          pi.registerTool({
            name: toolName,
            label: t.displayName,
            description: `${t.description || t.mcpName} (via MCP server "${serverName}")`,
            constrainedSampling: false,
            parameters: jsonSchemaToTypebox(t.inputSchema),
            async execute(_id, params, _signal, _onUpdate, ctx) {
              const live = servers.get(serverName);
              if (!live?.client) return { content: [{ type: "text", text: `MCP server "${serverName}" is not connected` }], details: {} };
              try {
                const res = await live.client.callTool({ name: t.mcpName, arguments: params ?? {} });
                const blocks = Array.isArray(res.content) ? res.content : [];
                const text = blocks
                  .filter((b: any) => b.type === "text")
                  .map((b: any) => b.text ?? "")
                  .join("\n");
                const imageCount = blocks.filter((b: any) => b.type === "image").length;
                return {
                  content: [{ type: "text", text: text || (res.isError ? "(tool error)" : "(no text output)") + (imageCount ? `\n[+${imageCount} image block(s) omitted]` : "") }],
                  details: {},
                };
              } catch (e) {
                return { content: [{ type: "text", text: `MCP call "${t.mcpName}" failed: ${(e as Error).message}` }], details: {} };
              }
            },
          });
        } catch {
          /* skip a single failing tool registration */
        }
      }
    }
  }

  async function connectAll() {
    const config = loadConfig();
    for (const [name, cfg] of Object.entries(config)) {
      try {
        const srv = await connectServer(name, cfg);
        servers.set(name, srv);
      } catch (e) {
        servers.set(name, { name, client: null, tools: [], error: (e as Error).message });
      }
    }
    registerServerTools();
    const failed = [...servers.values()].filter((s) => s.error);
    if (failed.length > 0) {
      // Notify after load completes; the session may not be bound yet, so use
      // a deferred notify via the runner rather than a captured ctx.
      console.warn(`[miro-mcp] ${failed.map((f) => `"${f.name}": ${f.error}`).join("; ")}`);
    }
  }

  await connectAll();

  pi.registerCommand("mcp", {
    description: "Show MCP server status: /mcp [reload]",
    handler: async (args, ctx) => {
      const arg = args.trim();
      if (arg === "reload") {
        servers = new Map();
        await connectAll();
        ctx.ui.notify("MCP servers reloaded", "info");
        return;
      }
      const entries = [...servers.values()];
      if (entries.length === 0) {
        ctx.ui.notify("没有配置 MCP 服务器（在 ~/.miro/agent/mcp.json 的 mcpServers 里添加）", "warning");
        return;
      }
      const lines = entries.map((s) =>
        s.error ? `✗ ${s.name}  — ${s.error}` : `✓ ${s.name}  — ${s.tools.length} tools`,
      );
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
