import { beforeEach, describe, expect, it, vi } from "vitest"

const { getUserFromSession } = vi.hoisted(() => ({ getUserFromSession: vi.fn() }))
const { sql } = vi.hoisted(() => ({ sql: vi.fn() }))

vi.mock("@/lib/auth", () => ({ getUserFromSession }))
vi.mock("@/lib/db", () => ({ sql }))

import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/tasks/[id]/checklist-items/route"

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const jsonRequest = (body: unknown) => new Request("http://localhost/api/tasks/1/checklist-items", {
  method: "POST",
  body: JSON.stringify(body),
})

beforeEach(() => {
  getUserFromSession.mockReset()
  sql.mockReset()
})

describe("GET /api/tasks/[id]/checklist-items", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await GET(new Request("http://localhost/api/tasks/1/checklist-items"), ctx("1"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 404 when the task is not owned by the user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([])

    const response = await GET(new Request("http://localhost/api/tasks/1/checklist-items"), ctx("1"))

    expect(response.status).toBe(404)
    expect(sql).toHaveBeenCalledTimes(1)
  })

  it("returns checklist items scoped to the task", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([{ id: 10, title: "Step 1", completed: false, sort_order: 0 }])

    const response = await GET(new Request("http://localhost/api/tasks/1/checklist-items"), ctx("1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].title).toBe("Step 1")
  })
})

describe("POST /api/tasks/[id]/checklist-items", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await POST(jsonRequest({ title: "New step" }), ctx("1"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 404 when the task is not owned by the user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([])

    const response = await POST(jsonRequest({ title: "New step" }), ctx("1"))

    expect(response.status).toBe(404)
    expect(sql).toHaveBeenCalledTimes(1)
  })

  it("returns 400 for a blank title", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check

    const response = await POST(jsonRequest({ title: "   " }), ctx("1"))

    expect(response.status).toBe(400)
    expect(sql).toHaveBeenCalledTimes(1)
  })

  it("creates a checklist item appended to the end", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([{ sort_order: 3 }]) // next sort_order
    sql.mockResolvedValueOnce([{ id: 10, task_id: 1, title: "New step", completed: false, sort_order: 3 }])

    const response = await POST(jsonRequest({ title: "New step" }), ctx("1"))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.title).toBe("New step")
    expect(body.sort_order).toBe(3)
  })
})

describe("PATCH /api/tasks/[id]/checklist-items (reorder)", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await PATCH(jsonRequest({ orderedIds: [1, 2] }), ctx("1"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 400 when orderedIds is missing", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check

    const response = await PATCH(jsonRequest({}), ctx("1"))

    expect(response.status).toBe(400)
  })

  it("returns 404 when an id in orderedIds does not belong to this task", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([{ id: 10 }]) // existing items owned by this task

    const response = await PATCH(jsonRequest({ orderedIds: [10, 99] }), ctx("1"))

    expect(response.status).toBe(404)
  })

  it("persists the new sort order", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([{ id: 10 }, { id: 20 }]) // existing items
    sql.mockResolvedValueOnce([]) // UPDATE item 20
    sql.mockResolvedValueOnce([]) // UPDATE item 10
    sql.mockResolvedValueOnce([
      { id: 20, sort_order: 0 },
      { id: 10, sort_order: 1 },
    ])

    const response = await PATCH(jsonRequest({ orderedIds: [20, 10] }), ctx("1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body[0].id).toBe(20)
  })
})

describe("PUT /api/tasks/[id]/checklist-items", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await PUT(jsonRequest({ id: 10, completed: true }), ctx("1"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 404 when the checklist item does not exist on this task", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([]) // existing item lookup, empty

    const response = await PUT(jsonRequest({ id: 10, completed: true }), ctx("1"))

    expect(response.status).toBe(404)
  })

  it("updates the completed flag", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([{ id: 10, title: "Step 1", completed: false }]) // existing item
    sql.mockResolvedValueOnce([{ id: 10, title: "Step 1", completed: true }])

    const response = await PUT(jsonRequest({ id: 10, completed: true }), ctx("1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.completed).toBe(true)
  })
})

describe("DELETE /api/tasks/[id]/checklist-items", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await DELETE(jsonRequest({ id: 10 }), ctx("1"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 400 when no id is provided", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check

    const response = await DELETE(jsonRequest({}), ctx("1"))

    expect(response.status).toBe(400)
  })

  it("deletes the checklist item scoped to the task and user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ id: 1 }]) // task ownership check
    sql.mockResolvedValueOnce([])

    const response = await DELETE(jsonRequest({ id: 10 }), ctx("1"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
  })
})
