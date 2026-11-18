import { sql } from "@/lib/db"
import {
  ACCESS_TTL_SECONDS,
  CODE_TTL_SECONDS,
  CONNECTOR_SCOPE,
  hashSecret,
  isValidChallenge,
  newSecret,
  pkceMatches,
  REFRESH_TTL_SECONDS,
} from "@/lib/oauth"

// Storage for connector OAuth: clients, one-time codes, access and refresh tokens.

const CLIENTS_PER_HOUR = 100

export type OAuthClient = { client_id: string; client_name: string; redirect_uris: string[] }

export type TokenSet = {
  access_token: string
  token_type: "Bearer"
  expires_in: number
  refresh_token: string
  scope: string
}

function inSeconds(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

export async function registerClient(name: string, redirectUris: string[]): Promise<OAuthClient | null> {
  const recent = await sql`SELECT COUNT(*)::int AS n FROM oauth_clients WHERE created_at > NOW() - INTERVAL '1 hour'`
  if (Number(recent[0]?.n ?? 0) >= CLIENTS_PER_HOUR) return null
  const clientId = `ls_${newSecret(18)}`
  const rows = await sql`
    INSERT INTO oauth_clients (client_id, client_name, redirect_uris)
    VALUES (${clientId}, ${name}, ${redirectUris})
    RETURNING client_id, client_name, redirect_uris
  `
  return rows[0] as OAuthClient
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const rows = await sql`
    SELECT client_id, client_name, redirect_uris FROM oauth_clients WHERE client_id = ${clientId}
  `
  return (rows[0] as OAuthClient | undefined) ?? null
}

export type AuthorizeCheck =
  | { ok: { client: OAuthClient; redirectUri: string; state: string | null; challenge: string } }
  | { fatal: string }
  | { sendBack: { redirectUri: string; error: string; description: string; state: string | null } }

// Validates an authorize request. Problems with the client or redirect address are shown
// on our page ("fatal"); anything else is sent back to the app's verified address.
export async function checkAuthorizeRequest(params: Record<string, string | undefined>): Promise<AuthorizeCheck> {
  const client = params.client_id ? await getClient(params.client_id) : null
  if (!client) return { fatal: "This app isn't registered with LifeSort. Try adding the connector again." }
  const redirectUri = params.redirect_uri ?? (client.redirect_uris.length === 1 ? client.redirect_uris[0] : undefined)
  if (!redirectUri || !client.redirect_uris.includes(redirectUri)) {
    return { fatal: "The app asked to return to an address it didn't register." }
  }
  const state = params.state ? params.state.slice(0, 500) : null
  if (params.response_type !== "code") {
    return { sendBack: { redirectUri, state, error: "unsupported_response_type", description: "Only response_type=code is supported." } }
  }
  if (params.code_challenge_method !== "S256" || !isValidChallenge(params.code_challenge)) {
    return { sendBack: { redirectUri, state, error: "invalid_request", description: "PKCE with S256 is required." } }
  }
  return { ok: { client, redirectUri, state, challenge: params.code_challenge as string } }
}

export function withParams(redirectUri: string, params: Record<string, string | null>) {
  const url = new URL(redirectUri)
  for (const [key, value] of Object.entries(params)) if (value !== null) url.searchParams.set(key, value)
  return url.toString()
}

export async function createCode(input: { userId: string; clientId: string; redirectUri: string; challenge: string }) {
  const code = newSecret()
  await sql`
    INSERT INTO oauth_grants (user_id, client_id, kind, token_hash, redirect_uri, code_challenge, expires_at)
    VALUES (${input.userId}, ${input.clientId}, 'code', ${hashSecret(code)}, ${input.redirectUri}, ${input.challenge},
      ${inSeconds(CODE_TTL_SECONDS)})
  `
  return code
}

async function issueTokens(userId: string, clientId: string): Promise<TokenSet> {
  const access = newSecret()
  const refresh = newSecret()
  await sql.transaction((tx) => [
    tx`
      INSERT INTO oauth_grants (user_id, client_id, kind, token_hash, expires_at)
      VALUES (${userId}, ${clientId}, 'access', ${hashSecret(access)}, ${inSeconds(ACCESS_TTL_SECONDS)})
    `,
    tx`
      INSERT INTO oauth_grants (user_id, client_id, kind, token_hash, expires_at)
      VALUES (${userId}, ${clientId}, 'refresh', ${hashSecret(refresh)}, ${inSeconds(REFRESH_TTL_SECONDS)})
    `,
    tx`DELETE FROM oauth_grants WHERE user_id = ${userId} AND expires_at < NOW()`,
  ])
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_SECONDS, refresh_token: refresh, scope: CONNECTOR_SCOPE }
}

export async function exchangeCode(input: { code: string; clientId: string; redirectUri: string; verifier: string }) {
  const rows = await sql`
    SELECT id, user_id, client_id, redirect_uri, code_challenge, expires_at, used_at
    FROM oauth_grants WHERE token_hash = ${hashSecret(input.code)} AND kind = 'code'
  `
  const grant = rows[0]
  if (!grant || grant.client_id !== input.clientId) return { error: "That code isn't valid." } as const
  if (grant.used_at) {
    // A code used twice may have been stolen, so everything it led to is revoked.
    await sql`DELETE FROM oauth_grants WHERE user_id = ${grant.user_id} AND client_id = ${grant.client_id}`
    return { error: "That code was already used." } as const
  }
  if (new Date(grant.expires_at) < new Date()) return { error: "That code has expired." } as const
  if (grant.redirect_uri !== input.redirectUri) return { error: "The redirect address doesn't match." } as const
  if (!pkceMatches(input.verifier, String(grant.code_challenge))) return { error: "The code verifier doesn't match." } as const

  const used = await sql`UPDATE oauth_grants SET used_at = NOW() WHERE id = ${grant.id} AND used_at IS NULL RETURNING id`
  if (used.length === 0) return { error: "That code was already used." } as const
  return { tokens: await issueTokens(String(grant.user_id), String(grant.client_id)) } as const
}

// Refresh tokens rotate: the old one is deleted when a new pair is issued.
export async function refreshTokens(input: { refreshToken: string; clientId: string }) {
  const rows = await sql`
    DELETE FROM oauth_grants
    WHERE token_hash = ${hashSecret(input.refreshToken)} AND kind = 'refresh' AND client_id = ${input.clientId}
    RETURNING user_id, client_id, expires_at
  `
  const grant = rows[0]
  if (!grant || new Date(grant.expires_at) < new Date()) return { error: "That refresh token isn't valid." } as const
  return { tokens: await issueTokens(String(grant.user_id), String(grant.client_id)) } as const
}

export async function revokeToken(token: string) {
  await sql`DELETE FROM oauth_grants WHERE token_hash = ${hashSecret(token)} AND kind IN ('access', 'refresh')`
}

export async function userForAccessToken(token: string): Promise<{ userId: string; clientId: string } | null> {
  const rows = await sql`
    UPDATE oauth_grants SET last_used_at = NOW()
    WHERE token_hash = ${hashSecret(token)} AND kind = 'access' AND expires_at > NOW()
    RETURNING user_id, client_id
  `
  const grant = rows[0]
  return grant ? { userId: String(grant.user_id), clientId: String(grant.client_id) } : null
}

export async function listConnections(userId: string) {
  const rows = await sql`
    SELECT g.client_id, c.client_name, MIN(g.created_at) AS connected_at, MAX(g.last_used_at) AS last_used_at
    FROM oauth_grants g JOIN oauth_clients c ON c.client_id = g.client_id
    WHERE g.user_id = ${userId} AND g.kind = 'refresh' AND g.expires_at > NOW()
    GROUP BY g.client_id, c.client_name
    ORDER BY MIN(g.created_at) DESC
  `
  return rows as { client_id: string; client_name: string; connected_at: string; last_used_at: string | null }[]
}

export async function disconnect(userId: string, clientId: string) {
  await sql`DELETE FROM oauth_grants WHERE user_id = ${userId} AND client_id = ${clientId}`
}
