import { tools } from "@/lib/mcp";

export const dynamic = "force-dynamic";

// Minimal stateless MCP server over Streamable HTTP (JSON responses only). Some HTTP MCP
// clients cannot send custom headers, so the shared secret is the last path segment.
const PROTOCOL = "2025-06-18";

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

function tokenMatches(given: string): boolean {
  const expected = process.env.MCP_TOKEN || "";
  if (!expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function handle(msg: RpcRequest): object | null {
  const reply = (result: object) => ({ jsonrpc: "2.0", id: msg.id ?? null, result });
  const fail = (code: number, message: string) => ({ jsonrpc: "2.0", id: msg.id ?? null, error: { code, message } });
  if (msg.id === undefined) return null;
  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "gastos", version: "1.0.0" },
        instructions: "Personal expense tracker. Amounts are Philippine pesos; dates are Asia/Manila.",
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: tools().map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const tool = tools().find((t) => t.name === name);
      if (!tool) return fail(-32602, `Unknown tool: ${name}`);
      try {
        const text = tool.run((msg.params?.arguments as Record<string, unknown>) ?? {});
        return reply({ content: [{ type: "text", text }], isError: false });
      } catch (e) {
        return reply({ content: [{ type: "text", text: e instanceof Error ? e.message : "Tool failed" }], isError: true });
      }
    }
    default:
      return fail(-32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!process.env.MCP_TOKEN) return Response.json({ error: "MCP_TOKEN is not set on the server" }, { status: 503 });
  if (!tokenMatches((await params).token)) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as RpcRequest | RpcRequest[] | null;
  if (!body) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  const out = (Array.isArray(body) ? body : [body]).map(handle).filter((r): r is object => r !== null);
  if (!out.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? out : out[0], { headers: { "cache-control": "no-store" } });
}

export function GET() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}
