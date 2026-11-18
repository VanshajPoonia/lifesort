import { revokeToken } from "@/lib/oauth-server"
import { corsHeaders, readParams } from "@/lib/oauth"

// POST (RFC 7009): forgets an access or refresh token. Always 200, as the spec asks.
export async function POST(request: Request) {
  const params = await readParams(request)
  if (params.token) await revokeToken(params.token)
  return new Response(null, { status: 200, headers: corsHeaders })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}
