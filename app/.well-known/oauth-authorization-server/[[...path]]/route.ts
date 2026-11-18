import { authorizationServerMetadata, corsHeaders, originOf } from "@/lib/oauth"

// RFC 8414 metadata, at the root or with a path appended.
export function GET(request: Request) {
  return Response.json(authorizationServerMetadata(originOf(request)), { headers: corsHeaders })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}
