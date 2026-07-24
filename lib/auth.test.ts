import { describe, expect, it } from "vitest"
import { getSessionFromCookie, hashPassword, isLegacyPasswordHash, verifyPassword } from "@/lib/auth"

describe("hashPassword / verifyPassword", () => {
  it("hashes a password into a bcrypt hash", async () => {
    const hash = await hashPassword("correct horse battery staple")
    expect(hash).toMatch(/^\$2[aby]\$/)
  })

  it("verifies a correct password against its bcrypt hash", async () => {
    const hash = await hashPassword("correct horse battery staple")
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true)
  })

  it("rejects an incorrect password against a bcrypt hash", async () => {
    const hash = await hashPassword("correct horse battery staple")
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false)
  })

  it("rejects when there is no stored hash", async () => {
    await expect(verifyPassword("anything", "")).resolves.toBe(false)
  })

  it("still verifies legacy SHA-256 hashes for upgrade-on-login", async () => {
    const legacyHash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode("legacy-password")),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    await expect(verifyPassword("legacy-password", legacyHash)).resolves.toBe(true)
    await expect(verifyPassword("wrong-password", legacyHash)).resolves.toBe(false)
  })
})

describe("isLegacyPasswordHash", () => {
  it("treats bcrypt hashes as not legacy", () => {
    expect(isLegacyPasswordHash("$2b$12$abcdefghijklmnopqrstuv")).toBe(false)
  })

  it("treats non-bcrypt hashes as legacy", () => {
    expect(isLegacyPasswordHash("deadbeef")).toBe(true)
  })

  it("treats an empty hash as not legacy (falsy short-circuit)", () => {
    expect(isLegacyPasswordHash("")).toBe(false)
  })
})

describe("getSessionFromCookie", () => {
  const request = (cookieHeader: string | null) =>
    new Request("http://localhost/api/example", {
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    })

  it("extracts the session token from a single cookie", () => {
    expect(getSessionFromCookie(request("session=abc123"))).toBe("abc123")
  })

  it("extracts the session token among multiple cookies", () => {
    expect(getSessionFromCookie(request("theme=dark; session=abc123; other=x"))).toBe("abc123")
  })

  it("returns null when there is no cookie header", () => {
    expect(getSessionFromCookie(request(null))).toBeNull()
  })

  it("returns null when the session cookie is missing", () => {
    expect(getSessionFromCookie(request("theme=dark"))).toBeNull()
  })
})
