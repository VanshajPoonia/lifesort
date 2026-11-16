import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserFromSession } = vi.hoisted(() => ({ getUserFromSession: vi.fn() }))
const { sql } = vi.hoisted(() => ({ sql: vi.fn() }))

vi.mock("@/lib/auth", () => ({ getUserFromSession }))
vi.mock("@/lib/db", () => ({ sql }))

import { DELETE, POST } from "@/app/api/push/subscriptions/route"

const request = (method: string, body: unknown) =>
  new Request("http://localhost/api/push/subscriptions", {
    method,
    headers: { "user-agent": "test-agent" },
    body: JSON.stringify(body),
  })

const subscription = {
  endpoint: "https://push.example.com/abc",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
}

describe("POST /api/push/subscriptions", () => {
  beforeEach(() => {
    getUserFromSession.mockReset()
    sql.mockReset()
  })

  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await POST(request("POST", subscription))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("rejects an endpoint that isn't https", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })

    const response = await POST(request("POST", { ...subscription, endpoint: "http://push.example.com/abc" }))

    expect(response.status).toBe(400)
    expect(sql).not.toHaveBeenCalled()
  })

  it("rejects a subscription without keys", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })

    const response = await POST(request("POST", { endpoint: subscription.endpoint }))

    expect(response.status).toBe(400)
    expect(sql).not.toHaveBeenCalled()
  })

  it("upserts the subscription for the current user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValue([])

    const response = await POST(request("POST", subscription))

    expect(response.status).toBe(200)
    expect(sql.mock.calls[0].slice(1)).toEqual(["user-1", subscription.endpoint, "p256dh-key", "auth-key", "test-agent"])
  })
})

describe("DELETE /api/push/subscriptions", () => {
  beforeEach(() => {
    getUserFromSession.mockReset()
    sql.mockReset()
  })

  it("only deletes the endpoint for the current user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValue([])

    const response = await DELETE(request("DELETE", { endpoint: subscription.endpoint }))

    expect(response.status).toBe(200)
    expect(sql.mock.calls[0].slice(1)).toEqual([subscription.endpoint, "user-1"])
  })

  it("rejects a missing endpoint", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })

    const response = await DELETE(request("DELETE", {}))

    expect(response.status).toBe(400)
    expect(sql).not.toHaveBeenCalled()
  })
})
