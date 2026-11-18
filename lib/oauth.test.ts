import { describe, expect, it } from "vitest"

import {
  authorizationServerMetadata,
  cleanClientName,
  hashSecret,
  isAllowedRedirectUri,
  isValidChallenge,
  newSecret,
  pkceMatches,
  readParams,
} from "@/lib/oauth"
import { requestOrigin, safeNextPath } from "@/lib/redirect-target"

// The example pair from RFC 7636 appendix B.
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

describe("PKCE", () => {
  it("matches the RFC 7636 example", () => {
    expect(isValidChallenge(CHALLENGE)).toBe(true)
    expect(pkceMatches(VERIFIER, CHALLENGE)).toBe(true)
  })

  it("rejects a wrong or malformed verifier", () => {
    expect(pkceMatches(`${VERIFIER.slice(0, -1)}A`, CHALLENGE)).toBe(false)
    expect(pkceMatches("short", CHALLENGE)).toBe(false)
    expect(isValidChallenge("plain-text")).toBe(false)
  })
})

describe("secrets", () => {
  it("makes long random secrets and stores only a hash", () => {
    const secret = newSecret()
    expect(secret.length).toBeGreaterThanOrEqual(43)
    expect(newSecret()).not.toBe(secret)
    expect(hashSecret(secret)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe("redirect addresses", () => {
  it("allows https and loopback http only", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true)
    expect(isAllowedRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true)
    expect(isAllowedRedirectUri("http://localhost:6274/oauth/callback")).toBe(true)
    expect(isAllowedRedirectUri("http://127.0.0.1:33418/callback")).toBe(true)
    expect(isAllowedRedirectUri("http://evil.example/callback")).toBe(false)
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false)
    expect(isAllowedRedirectUri("https://claude.ai/cb#frag")).toBe(false)
    expect(isAllowedRedirectUri(42)).toBe(false)
  })

  it("uses the host the person reached us on", () => {
    const behindProxy = new Request("http://localhost:3000/api/mcp", {
      headers: { "x-forwarded-host": "lifesort.vercel.app", "x-forwarded-proto": "https" },
    })
    expect(requestOrigin(behindProxy)).toBe("https://lifesort.vercel.app")
    expect(requestOrigin(new Request("http://127.0.0.1:3107/x", { headers: { host: "127.0.0.1:3107" } }))).toBe("http://127.0.0.1:3107")
  })

  it("keeps login's next on this site", () => {
    expect(safeNextPath("/oauth/authorize?client_id=x")).toBe("/oauth/authorize?client_id=x")
    expect(safeNextPath("https://evil.example")).toBe("/")
    expect(safeNextPath("//evil.example")).toBe("/")
    expect(safeNextPath("/\\evil.example")).toBe("/")
    expect(safeNextPath(null)).toBe("/")
  })
})

describe("metadata and requests", () => {
  it("advertises PKCE, public clients and registration", () => {
    const metadata = authorizationServerMetadata("https://lifesort.vercel.app")
    expect(metadata.registration_endpoint).toBe("https://lifesort.vercel.app/api/oauth/register")
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"])
    expect(metadata.token_endpoint_auth_methods_supported).toEqual(["none"])
  })

  it("tidies client names", () => {
    expect(cleanClientName("  Claude\u0007 ")).toBe("Claude")
    expect(cleanClientName("")).toBe("An app")
    expect(cleanClientName(null)).toBe("An app")
  })

  it("reads form and JSON token requests", async () => {
    const form = new Request("http://x/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=authorization_code&code=abc",
    })
    expect(await readParams(form)).toEqual({ grant_type: "authorization_code", code: "abc" })
    const json = new Request("http://x/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "refresh_token", refresh_token: "r", extra: 5 }),
    })
    expect(await readParams(json)).toEqual({ grant_type: "refresh_token", refresh_token: "r" })
  })
})
