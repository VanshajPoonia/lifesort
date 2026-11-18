// A small MCP server over Streamable HTTP without sessions: each POST carries one
// JSON-RPC message and gets one JSON reply. Enough for tools; no prompts or resources.

export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"]

export type ToolDefinition = {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }
}

export type ToolResult = { text: string; structured?: Record<string, unknown>; isError?: boolean }
export type ToolRunner = (name: string, args: Record<string, unknown>) => Promise<ToolResult>

type JsonRpcId = string | number | null

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | { jsonrpc: "2.0"; id: JsonRpcId; error: { code: number; message: string } }

const SERVER_INFO = { name: "lifesort", title: "LifeSort", version: "1.0.0" }

const INSTRUCTIONS = `LifeSort is the user's personal planner. You can read their tasks, goals, notes, calendar events and Inbox, and add things to their Inbox or tasks.
Use search to find items and fetch to read one. get_today shows what's on a day. Prefer add_to_inbox for loose thoughts; use add_task only when the user clearly wants a task.
Journal, money, Vault, people and any area they keep away from AI are never shared.`

function failure(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// Returns the reply for one message, or null for a notification (which gets 202 and no body).
export async function handleMcpMessage(message: unknown, tools: ToolDefinition[], run: ToolRunner): Promise<JsonRpcResponse | null> {
  if (!isRecord(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return failure(null, -32600, "Invalid request")
  }
  const hasId = "id" in message && (typeof message.id === "string" || typeof message.id === "number")
  if (!hasId) return null
  const id = message.id as string | number
  const params = isRecord(message.params) ? message.params : {}

  switch (message.method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : ""
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      }
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} }
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools } }
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : ""
      if (!tools.some((tool) => tool.name === name)) return failure(id, -32602, `Unknown tool: ${name || "(none)"}`)
      const args = isRecord(params.arguments) ? params.arguments : {}
      const output = await run(name, args)
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: output.text }],
          ...(output.structured ? { structuredContent: output.structured } : {}),
          isError: output.isError === true,
        },
      }
    }
    default:
      return failure(id, -32601, `Method not found: ${message.method}`)
  }
}
