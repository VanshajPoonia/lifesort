import { corsHeaders, originOf, protectedResourceMetadata } from "@/lib/oauth"

// RFC 9728 metadata for the MCP endpoint. Clients ask at the root or with the
// resource path appended (/.well-known/oauth-protected-resource/api/mcp).
export function GET(request: Request) {
  return Response.json(protectedResourceMetadata(originOf(request)), { headers: corsHeaders })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}
