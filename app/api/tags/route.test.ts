import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserFromSession } = vi.hoisted(() => ({ getUserFromSession: vi.fn() }))
const { sql } = vi.hoisted(() => ({ sql: vi.fn() }))

vi.mock("@/lib/auth", () => ({ getUserFromSession }))
vi.mock("@/lib/db", () => ({ sql }))

import { DELETE, GET, POST } from "@/app/api/tags/route"

const jsonRequest = (body: unknown) =>
  new Request("http://localhost/api/tags", {
    method: "POST",
    body: JSON.stringify(body),
  })

describe("GET /api/tags", () => {
  beforeEach(() => {
    getUserFromSession.mockReset()
    sql.mockReset()
  })

  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await GET()

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns the current user's tags scoped by user id", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValue([{ id: "tag-1", name: "Focus", color: "#64748B", item_count: 3 }])

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual([{ id: "tag-1", name: "Focus", color: "#64748B", item_count: 3 }])
    // sql is invoked as a tagged template: first arg is the strings array, followed by interpolations.
    expect(sql.mock.calls[0][1]).toBe("user-1")
  })
})

describe("POST /api/tags", () => {
  beforeEach(() => {
    getUserFromSession.mockReset()
    sql.mockReset()
  })

  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await POST(jsonRequest({ name: "Focus" }))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 400 when the name is empty", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })

    const response = await POST(jsonRequest({ name: "   " }))

    expect(response.status).toBe(400)
    expect(sql).not.toHaveBeenCalled()
  })

  it("creates a tag scoped to the current user and falls back to a default color", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValue([{ id: "tag-1", name: "Focus", color: "#64748B" }])

    const response = await POST(jsonRequest({ name: "Focus" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ id: "tag-1", name: "Focus", color: "#64748B", item_count: 0 })
    expect(sql.mock.calls[0].slice(1)).toEqual(["user-1", "Focus", "#64748B"])
  })
})

describe("DELETE /api/tags", () => {
  beforeEach(() => {
    getUserFromSession.mockReset()
    sql.mockReset()
  })

  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await DELETE(jsonRequest({ id: "tag-1" }))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 400 when no id is provided", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })

    const response = await DELETE(jsonRequest({}))

    expect(response.status).toBe(400)
    expect(sql).not.toHaveBeenCalled()
  })

  it("deletes the tag scoped to the current user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValue([])

    const response = await DELETE(jsonRequest({ id: "tag-1" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(sql.mock.calls[0].slice(1)).toEqual(["tag-1", "user-1"])
  })
})
