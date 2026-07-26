import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserFromSession } = vi.hoisted(() => ({ getUserFromSession: vi.fn() }))
const { sql } = vi.hoisted(() => {
  const fn = vi.fn() as ReturnType<typeof vi.fn> & { unsafe: (value: string) => string }
  fn.unsafe = (value: string) => value
  return { sql: fn }
})
const { validateItemOwnership } = vi.hoisted(() => ({ validateItemOwnership: vi.fn() }))

vi.mock("@/lib/auth", () => ({ getUserFromSession }))
vi.mock("@/lib/db", () => ({ sql }))
vi.mock("@/lib/item-relationships", async () => {
  const actual = await vi.importActual<typeof import("@/lib/item-relationships")>("@/lib/item-relationships")
  return { ...actual, validateItemOwnership }
})

import { DELETE, GET, POST } from "@/app/api/item-relationships/route"

const jsonRequest = (url: string, body: unknown) =>
  new Request(url, { method: "POST", body: JSON.stringify(body) })

describe("GET /api/item-relationships", () => {
  beforeEach(() => {
    getUserFromSession.mockReset()
    sql.mockReset()
  })

  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await GET(new Request("http://localhost/api/item-relationships?item_type=task&item_id=1"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 400 for a missing or invalid item_type", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })

    const response = await GET(new Request("http://localhost/api/item-relationships?item_type=bogus&item_id=1"))

    expect(response.status).toBe(400)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns relationships scoped to the current user and item", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValue([
      { id: "rel-1", from_type: "task", from_id: "1", to_type: "note", to_id: "2", relation: "related", direction: "outgoing" },
    ])

    const response = await GET(new Request("http://localhost/api/item-relationships?item_type=task&item_id=1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.relationships).toHaveLength(1)
    expect(sql.mock.calls[0].slice(1)).toEqual(["task", "1", "user-1", "task", "1", "task", "1"])
  })

  it("resolves a display label for the other side of each relationship", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql
      .mockResolvedValueOnce([
        { id: "rel-1", from_type: "task", from_id: "1", to_type: "note", to_id: "2", relation: "related", direction: "outgoing" },
        { id: "rel-2", from_type: "goal", from_id: "5", to_type: "task", to_id: "1", relation: "related", direction: "incoming" },
      ])
      .mockResolvedValueOnce([{ label: "Meeting notes" }])
      .mockResolvedValueOnce([{ label: "Ship v2" }])

    const response = await GET(new Request("http://localhost/api/item-relationships?item_type=task&item_id=1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.relationships[0].label).toBe("Meeting notes")
    expect(body.relationships[1].label).toBe("Ship v2")
    expect(sql).toHaveBeenCalledTimes(3)
  })

  it("falls back to a null label when the linked item no longer exists", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql
      .mockResolvedValueOnce([
        { id: "rel-1", from_type: "task", from_id: "1", to_type: "note", to_id: "2", relation: "related", direction: "outgoing" },
      ])
      .mockResolvedValueOnce([])

    const response = await GET(new Request("http://localhost/api/item-relationships?item_type=task&item_id=1"))
    const body = await response.json()

    expect(body.relationships[0].label).toBeNull()
  })
})

describe("POST /api/item-relationships", () => {
  beforeEach(() => {
    getUserFromSession.mockReset()
    sql.mockReset()
    validateItemOwnership.mockReset()
  })

  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await POST(
      jsonRequest("http://localhost/api/item-relationships", {
        from_type: "task",
        from_id: "1",
        to_type: "note",
        to_id: "2",
        relation: "related",
      }),
    )

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 400 for an invalid body", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })

    const response = await POST(jsonRequest("http://localhost/api/item-relationships", { from_type: "task" }))

    expect(response.status).toBe(400)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 404 when either linked item is not owned by the user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    validateItemOwnership.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    const response = await POST(
      jsonRequest("http://localhost/api/item-relationships", {
        from_type: "task",
        from_id: "1",
        to_type: "note",
        to_id: "2",
        relation: "related",
      }),
    )

    expect(response.status).toBe(404)
    expect(sql).not.toHaveBeenCalled()
  })

  it("creates a relationship once both linked items are confirmed owned", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    validateItemOwnership.mockResolvedValue(true)
    sql.mockResolvedValue([
      { id: "rel-1", user_id: "user-1", from_type: "task", from_id: "1", to_type: "note", to_id: "2", relation: "related" },
    ])

    const response = await POST(
      jsonRequest("http://localhost/api/item-relationships", {
        from_type: "task",
        from_id: "1",
        to_type: "note",
        to_id: "2",
        relation: "related",
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.relationship.id).toBe("rel-1")
    expect(sql.mock.calls[0].slice(1)).toEqual(["user-1", "task", "1", "note", "2", "related"])
  })
})

describe("DELETE /api/item-relationships", () => {
  beforeEach(() => {
    getUserFromSession.mockReset()
    sql.mockReset()
  })

  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await DELETE(jsonRequest("http://localhost/api/item-relationships", { id: "rel-1" }))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 400 when no id is provided", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })

    const response = await DELETE(jsonRequest("http://localhost/api/item-relationships", {}))

    expect(response.status).toBe(400)
    expect(sql).not.toHaveBeenCalled()
  })

  it("deletes the relationship scoped to the current user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValue([])

    const response = await DELETE(jsonRequest("http://localhost/api/item-relationships", { id: "rel-1" }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
    expect(sql.mock.calls[0].slice(1)).toEqual(["rel-1", "user-1"])
  })
})
