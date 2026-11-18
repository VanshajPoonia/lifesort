import { createHash, randomBytes, timingSafeEqual } from "node:crypto"

import { requestOrigin } from "@/lib/redirect-target"

// OAuth 2.1 for the ChatGPT and Claude connector (AI_BUILD_PLAN.md Part 0, part C):
// public clients only, PKCE S256 required, dynamic client registration. Codes and
// tokens are random strings stored only as SHA-256 hashes.

export const CONNECTOR_SCOPE = "lifesort"
export const CODE_TTL_SECONDS = 10 * 60
export const ACCESS_TTL_SECONDS = 60 * 60
export const REFRESH_TTL_SECONDS = 60 * 24 * 60 * 60
export const MAX_REDIRECT_URIS = 10

export function newSecret(bytes = 32) {
  return randomBytes(bytes).toString("base64url")
}

export function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex")
}

// RFC 7636: BASE64URL(SHA256(verifier)) must equal the challenge.
export function pkceMatches(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false
  const expected = Buffer.from(createHash("sha256").update(verifier).digest("base64url"))
  const given = Buffer.from(challenge)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export function isValidChallenge(challenge: string | null | undefined) {
  return typeof challenge === "string" && /^[A-Za-z0-9\-_]{43}$/.test(challenge)
}

// https anywhere, or http on this machine for desktop and command-line clients.
export function isAllowedRedirectUri(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 500) return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.hash || url.username || url.password) return false
  if (url.protocol === "https:") return true
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
}

export function cleanClientName(value: unknown) {
  if (typeof value !== "string") return "An app"
  const trimmed = value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 100)
  return trimmed || "An app"
}

// The origin people reach us on, used for metadata and the MCP address.
export function originOf(request: Request) {
  return requestOrigin(request)
}

export function mcpResourceUrl(request: Request) {
  return `${originOf(request)}/api/mcp`
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    revocation_endpoint: `${origin}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [CONNECTOR_SCOPE],
  }
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: [CONNECTOR_SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "LifeSort",
  }
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
}

// The token endpoint takes form posts (the standard) and JSON (some clients send it).
export async function readParams(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get("content-type") ?? ""
  if (type.includes("application/json")) {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") return {}
    return Object.fromEntries(Object.entries(body).filter(([, value]) => typeof value === "string")) as Record<string, string>
  }
  const text = await request.text().catch(() => "")
  return Object.fromEntries(new URLSearchParams(text))
}

export function oauthError(error: string, description: string, status = 400) {
  return Response.json(
    { error, error_description: description },
    { status, headers: { ...corsHeaders, "Cache-Control": "no-store" } },
  )
}
