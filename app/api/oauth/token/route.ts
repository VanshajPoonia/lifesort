import { exchangeCode, refreshTokens } from "@/lib/oauth-server"
import { corsHeaders, oauthError, readParams } from "@/lib/oauth"

// POST: swaps a code (with its PKCE verifier) or a refresh token for new tokens.
export async function POST(request: Request) {
  const params = await readParams(request)
  const clientId = params.client_id
  if (!clientId) return oauthError("invalid_client", "Send client_id.", 401)

  let result
  if (params.grant_type === "authorization_code") {
    if (!params.code || !params.redirect_uri || !params.code_verifier) {
      return oauthError("invalid_request", "Send code, redirect_uri and code_verifier.")
    }
    result = await exchangeCode({ code: params.code, clientId, redirectUri: params.redirect_uri, verifier: params.code_verifier })
  } else if (params.grant_type === "refresh_token") {
    if (!params.refresh_token) return oauthError("invalid_request", "Send refresh_token.")
    result = await refreshTokens({ refreshToken: params.refresh_token, clientId })
  } else {
    return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.")
  }

  if ("error" in result) return oauthError("invalid_grant", result.error ?? "Not valid.")
  return Response.json(result.tokens, { headers: { ...corsHeaders, "Cache-Control": "no-store", Pragma: "no-cache" } })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}
