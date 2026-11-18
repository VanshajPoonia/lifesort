import { registerClient } from "@/lib/oauth-server"
import { cleanClientName, corsHeaders, isAllowedRedirectUri, MAX_REDIRECT_URIS, oauthError } from "@/lib/oauth"

// POST: dynamic client registration (RFC 7591) for public clients like Claude and ChatGPT.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const uris: unknown[] = Array.isArray(body?.redirect_uris) ? body.redirect_uris : []
  if (uris.length === 0 || uris.length > MAX_REDIRECT_URIS || !uris.every(isAllowedRedirectUri)) {
    return oauthError("invalid_redirect_uri", "Redirect addresses must be https, or http on localhost.")
  }
  const method = body?.token_endpoint_auth_method
  if (method !== undefined && method !== "none") {
    return oauthError("invalid_client_metadata", "Only public clients (token_endpoint_auth_method none) are supported.")
  }

  const client = await registerClient(cleanClientName(body?.client_name), uris as string[])
  if (!client) return oauthError("temporarily_unavailable", "Too many apps registered recently. Try again later.", 429)

  return Response.json(
    {
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_id_issued_at: Math.floor(Date.now() / 1000),
    },
    { status: 201, headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  )
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}
