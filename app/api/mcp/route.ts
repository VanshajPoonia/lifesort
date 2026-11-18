import { CONNECTOR_TOOLS, runConnectorTool } from "@/lib/connector-tools"
import { handleMcpMessage } from "@/lib/mcp"
import { userForAccessToken } from "@/lib/oauth-server"
import { corsHeaders, originOf } from "@/lib/oauth"

const headers = { ...corsHeaders, "Cache-Control": "no-store" }

function unauthorized(request: Request) {
  const metadata = `${originOf(request)}/.well-known/oauth-protected-resource`
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Sign in to LifeSort to use this connector." } },
    { status: 401, headers: { ...headers, "WWW-Authenticate": `Bearer resource_metadata="${metadata}"` } },
  )
}

// POST: one JSON-RPC message (or a batch) from ChatGPT, Claude or another MCP client.
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? ""
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : ""
  const grant = token ? await userForAccessToken(token) : null
  if (!grant) return unauthorized(request)

  const body = await request.json().catch(() => undefined)
  if (body === undefined) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers })
  }

  const origin = originOf(request)
  const run = async (name: string, args: Record<string, unknown>) => {
    try {
      return await runConnectorTool(grant.userId, origin, name, args)
    } catch (error) {
      console.error(`[mcp] ${name} failed:`, error instanceof Error ? error.message : error)
      return { text: "Something went wrong reading LifeSort. Try again in a moment.", isError: true }
    }
  }
  const messages = Array.isArray(body) ? body : [body]
  const replies = []
  for (const message of messages) {
    const reply = await handleMcpMessage(message, CONNECTOR_TOOLS, run)
    if (reply) replies.push(reply)
  }

  if (replies.length === 0) return new Response(null, { status: 202, headers })
  return Response.json(Array.isArray(body) ? replies : replies[0], { headers })
}

// No server-to-client stream: this server only answers requests.
export function GET() {
  return new Response("Method not allowed", { status: 405, headers: { ...headers, Allow: "POST" } })
}

export function DELETE() {
  return new Response("Method not allowed", { status: 405, headers: { ...headers, Allow: "POST" } })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers })
}
