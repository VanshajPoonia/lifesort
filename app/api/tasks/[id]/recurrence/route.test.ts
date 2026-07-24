import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserFromSession } = vi.hoisted(() => ({ getUserFromSession: vi.fn() }))
const { sql } = vi.hoisted(() => ({ sql: vi.fn() }))

vi.mock("@/lib/auth", () => ({ getUserFromSession }))
vi.mock("@/lib/db", () => ({ sql }))

import { DELETE, GET, PUT } from "@/app/api/tasks/[id]/recurrence/route"

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const jsonRequest = (body: unknown) => new Request("http://localhost/api/tasks/1/recurrence", {
  method: "PUT",
  body: JSON.stringify(body),
})

beforeEach(() => {
  getUserFromSession.mockReset()
  sql.mockReset()
})

describe("GET /api/tasks/[id]/recurrence", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await GET(new Request("http://localhost/api/tasks/1/recurrence"), ctx("1"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 404 when the task is not owned by the user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([])

    const response = await GET(new Request("http://localhost/api/tasks/1/recurrence"), ctx("1"))

    expect(response.status).toBe(404)
  })

  it("returns null when the task does not repeat", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([]) // no recurrence row

    const response = await GET(new Request("http://localhost/api/tasks/1/recurrence"), ctx("1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toBeNull()
  })

  it("returns the recurrence rule when one exists", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([{ id: 5, task_id: 1, frequency: "weekly", interval_count: 2 }])

    const response = await GET(new Request("http://localhost/api/tasks/1/recurrence"), ctx("1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.frequency).toBe("weekly")
  })
})

describe("PUT /api/tasks/[id]/recurrence", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await PUT(jsonRequest({ frequency: "daily" }), ctx("1"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 404 when the task is not owned by the user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([])

    const response = await PUT(jsonRequest({ frequency: "daily" }), ctx("1"))

    expect(response.status).toBe(404)
  })

  it("returns 400 for a missing or invalid frequency", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check

    const response = await PUT(jsonRequest({ frequency: "biannually" }), ctx("1"))

    expect(response.status).toBe(400)
    expect(sql).toHaveBeenCalledTimes(1)
  })

  it("upserts with defaults applied when optional fields are omitted", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([
      {
        id: 5,
        task_id: 1,
        frequency: "daily",
        interval_count: 1,
        repeat_after_completion: false,
        ends_on: null,
        ends_after_count: null,
      },
    ])

    const response = await PUT(jsonRequest({ frequency: "daily" }), ctx("1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.interval_count).toBe(1)
    expect(body.repeat_after_completion).toBe(false)
    expect(body.ends_on).toBeNull()
  })

  it("clamps interval_count and ends_after_count to valid ranges", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([{ id: 5, task_id: 1, frequency: "custom", interval_count: 365 }])

    const response = await PUT(
      jsonRequest({ frequency: "custom", interval_count: 9999, ends_after_count: -5 }),
      ctx("1"),
    )

    expect(response.status).toBe(200)
    const call = sql.mock.calls[1]
    // Tagged-template call: [strings, ...values] -- interval_count is clamped to 365, ends_after_count to null.
    expect(call).toContain(365)
    expect(call).toContain(null)
  })
})

describe("DELETE /api/tasks/[id]/recurrence", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await DELETE(new Request("http://localhost/api/tasks/1/recurrence"), ctx("1"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 404 when the task is not owned by the user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([])

    const response = await DELETE(new Request("http://localhost/api/tasks/1/recurrence"), ctx("1"))

    expect(response.status).toBe(404)
  })

  it("succeeds even when no recurrence rule existed (idempotent)", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([])

    const response = await DELETE(new Request("http://localhost/api/tasks/1/recurrence"), ctx("1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
  })
})
