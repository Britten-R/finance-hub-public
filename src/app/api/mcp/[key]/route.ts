import { headers } from "next/headers";
import { agentKeyValid } from "@/lib/agent-key";
import { TOOLS, runTool } from "@/lib/agent-tools";
import { isLockedOut, recordFailure } from "@/lib/auth-store";

// Read-only MCP server for a Claude connector (claude.ai -> Settings ->
// Connectors -> Add custom connector, URL https://<site>/api/mcp/<key>).
// Speaks MCP's "Streamable HTTP" in its simplest form: one JSON reply per
// POST, no sessions, no streaming. The secret key in the URL is the lock;
// wrong keys count toward the same lockout as wrong passwords.

const PROTOCOLS = ["2025-06-18", "2025-03-26", "2024-11-05"];

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

async function handle(req: RpcRequest): Promise<object | null> {
  const reply = (result: object) => ({ jsonrpc: "2.0", id: req.id ?? null, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: req.id ?? null, error: { code, message } });
  if (req.id === undefined) return null; // notifications (e.g. "initialized") need no reply

  switch (req.method) {
    case "initialize": {
      const asked = String(req.params?.protocolVersion ?? "");
      return reply({
        protocolVersion: PROTOCOLS.includes(asked) ? asked : PROTOCOLS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "finance-hub", title: "Finance Hub", version: "1.0.0" },
        instructions:
          "Personal finances, read-only: balances, this month's budget and cash runway, recent transactions, and investment holdings. Dollar amounts are USD.",
      });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({
        tools: TOOLS.map(({ name, title, description, inputSchema }) => ({
          name,
          title,
          description,
          inputSchema,
          annotations: { readOnlyHint: true, openWorldHint: false },
        })),
      });
    case "tools/call": {
      const name = String(req.params?.name ?? "");
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      if (!TOOLS.some((t) => t.name === name)) return fail(-32602, `Unknown tool: ${name}`);
      try {
        return reply({ content: [{ type: "text", text: JSON.stringify(await runTool(name, args), null, 2) }] });
      } catch {
        return reply({ content: [{ type: "text", text: "Couldn't load the finance data right now." }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${req.method}`);
  }
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "local";
}

export async function POST(request: Request, ctx: RouteContext<"/api/mcp/[key]">) {
  const ip = await clientIp();
  if (await isLockedOut(ip)) return new Response("Too many tries.", { status: 429 });
  const { key } = await ctx.params;
  if (!(await agentKeyValid(key))) {
    await recordFailure(ip);
    return new Response("Not found.", { status: 404 }); // don't reveal that this address exists
  }

  let body: RpcRequest | RpcRequest[];
  try {
    body = await request.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  if (Array.isArray(body)) {
    const replies = (await Promise.all(body.map(handle))).filter(Boolean);
    return replies.length ? Response.json(replies) : new Response(null, { status: 202 });
  }
  const reply = await handle(body);
  return reply ? Response.json(reply) : new Response(null, { status: 202 });
}

// No server-to-client stream; MCP clients accept 405 here.
export function GET() {
  return new Response("Method not allowed.", { status: 405, headers: { Allow: "POST" } });
}
