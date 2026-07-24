import { beforeEach, describe, expect, it, vi } from "vitest"

const { sql } = vi.hoisted(() => ({ sql: vi.fn() }))
const { getUserFromSession } = vi.hoisted(() => ({ getUserFromSession: vi.fn() }))

vi.mock("@neondatabase/serverless", () => ({ neon: () => sql }))
vi.mock("@/lib/auth", () => ({ getUserFromSession }))

import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/tasks/route"

const jsonRequest = (body: unknown, method = "POST") =>
  new Request("http://localhost/api/tasks", { method, body: JSON.stringify(body) })

// Positional order of the interpolated values in each query, so tests can
// read them back by name instead of hand-counting template placeholders.
const INSERT_FIELDS = [
  "user_id", "title", "description", "priority", "due_date", "due_time",
  "scheduled_date", "scheduled_time", "duration_minutes", "status",
  "reminder_at", "email_reminder", "reminder_days", "reminder_sent",
  "category", "completed", "goal_id", "life_area_id", "sort_order",
]
const UPDATE_FIELDS = [
  "title", "description", "priority", "due_date", "due_time",
  "scheduled_date", "scheduled_time", "duration_minutes", "status",
  "reminder_at", "email_reminder", "reminder_days", "reminder_sent",
  "category", "completed", "goal_id", "life_area_id",
]

function namedCall(call: unknown[], fields: string[]) {
  const values = call.slice(1)
  return Object.fromEntries(fields.map((key, i) => [key, values[i]])) as Record<string, unknown>
}

const baseExistingTask = {
  id: 1,
  title: "Existing task",
  description: null,
  priority: "medium",
  due_date: null,
  due_time: null,
  scheduled_date: null,
  scheduled_time: null,
  duration_minutes: null,
  status: "next",
  category: null,
  email_reminder: false,
  reminder_days: 1,
  reminder_sent: false,
  goal_id: null,
  life_area_id: null,
}

beforeEach(() => {
  getUserFromSession.mockReset()
  sql.mockReset()
})

describe("GET /api/tasks", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await GET(new Request("http://localhost/api/tasks"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })
})

describe("POST /api/tasks (status defaults and sync)", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await POST(jsonRequest({ title: "New task" }))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 400 when title is missing", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })

    const response = await POST(jsonRequest({}))

    expect(response.status).toBe(400)
    expect(sql).not.toHaveBeenCalled()
  })

  it("defaults to status 'next' and completed false when neither is given", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ sort_order: -1 }]) // next sort_order
    sql.mockResolvedValueOnce([{ id: 1 }]) // INSERT ... RETURNING (canned)

    await POST(jsonRequest({ title: "New task" }))

    const inserted = namedCall(sql.mock.calls[1], INSERT_FIELDS)
    expect(inserted.status).toBe("next")
    expect(inserted.completed).toBe(false)
  })

  it("accepts an explicit non-terminal status without marking the task completed", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ sort_order: -1 }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await POST(jsonRequest({ title: "New task", status: "someday" }))

    const inserted = namedCall(sql.mock.calls[1], INSERT_FIELDS)
    expect(inserted.status).toBe("someday")
    expect(inserted.completed).toBe(false)
  })

  it("derives status 'completed' from a legacy completed:true body with no status", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ sort_order: -1 }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await POST(jsonRequest({ title: "New task", completed: true }))

    const inserted = namedCall(sql.mock.calls[1], INSERT_FIELDS)
    expect(inserted.status).toBe("completed")
    expect(inserted.completed).toBe(true)
  })

  it("falls back to the default status for an invalid status value", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ sort_order: -1 }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await POST(jsonRequest({ title: "New task", status: "not-a-real-status" }))

    const inserted = namedCall(sql.mock.calls[1], INSERT_FIELDS)
    expect(inserted.status).toBe("next")
  })

  it("passes through scheduled_date, scheduled_time, and duration_minutes", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ sort_order: -1 }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await POST(
      jsonRequest({
        title: "New task",
        scheduled_date: "2026-08-01",
        scheduled_time: "14:30",
        duration_minutes: 45,
      }),
    )

    const inserted = namedCall(sql.mock.calls[1], INSERT_FIELDS)
    expect(inserted.scheduled_date).toBe("2026-08-01")
    expect(inserted.scheduled_time).toBe("14:30")
    expect(inserted.duration_minutes).toBe(45)
  })

  it("clamps an out-of-range duration_minutes to the 7-day cap", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ sort_order: -1 }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await POST(jsonRequest({ title: "New task", duration_minutes: 999999 }))

    const inserted = namedCall(sql.mock.calls[1], INSERT_FIELDS)
    expect(inserted.duration_minutes).toBe(10080)
  })
})

describe("PUT /api/tasks (status/completed sync)", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await PUT(jsonRequest({ id: 1, completed: true }, "PUT"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 400 when id is missing", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })

    const response = await PUT(jsonRequest({}, "PUT"))

    expect(response.status).toBe(400)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 404 when the task does not belong to the user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([])

    const response = await PUT(jsonRequest({ id: 1, completed: true }, "PUT"))

    expect(response.status).toBe(404)
  })

  it("setting status to a terminal value syncs completed to true (cancelled)", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "next", completed: false }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, status: "cancelled" }, "PUT"))

    const updated = namedCall(sql.mock.calls[1], UPDATE_FIELDS)
    expect(updated.status).toBe("cancelled")
    expect(updated.completed).toBe(true)
  })

  it("setting a non-terminal status (waiting) keeps completed false", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "completed", completed: true }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, status: "waiting" }, "PUT"))

    const updated = namedCall(sql.mock.calls[1], UPDATE_FIELDS)
    expect(updated.status).toBe("waiting")
    expect(updated.completed).toBe(false)
  })

  it("legacy completed:true (no status) derives status 'completed'", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "waiting", completed: false }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, completed: true }, "PUT"))

    const updated = namedCall(sql.mock.calls[1], UPDATE_FIELDS)
    expect(updated.status).toBe("completed")
    expect(updated.completed).toBe(true)
  })

  it("legacy completed:false reverts a terminal status (cancelled) back to 'next'", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "cancelled", completed: true }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, completed: false }, "PUT"))

    const updated = namedCall(sql.mock.calls[1], UPDATE_FIELDS)
    expect(updated.status).toBe("next")
    expect(updated.completed).toBe(false)
  })

  it("legacy completed:false leaves a non-terminal status (waiting) untouched", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "waiting", completed: false }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, completed: false }, "PUT"))

    const updated = namedCall(sql.mock.calls[1], UPDATE_FIELDS)
    expect(updated.status).toBe("waiting")
    expect(updated.completed).toBe(false)
  })

  it("leaves status and completed unchanged when neither is provided", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "in_progress", completed: false }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, title: "Renamed" }, "PUT"))

    const updated = namedCall(sql.mock.calls[1], UPDATE_FIELDS)
    expect(updated.status).toBe("in_progress")
    expect(updated.completed).toBe(false)
  })

  it("updates scheduled_date/time and duration_minutes independently of status", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "next", completed: false }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(
      jsonRequest(
        { id: 1, scheduled_date: "2026-08-05", scheduled_time: "09:00", duration_minutes: 90 },
        "PUT",
      ),
    )

    const updated = namedCall(sql.mock.calls[1], UPDATE_FIELDS)
    expect(updated.scheduled_date).toBe("2026-08-05")
    expect(updated.scheduled_time).toBe("09:00")
    expect(updated.duration_minutes).toBe(90)
    expect(updated.status).toBe("next")
  })
})

describe("DELETE /api/tasks", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await DELETE(jsonRequest({ id: 1 }, "DELETE"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("deletes the task scoped to the current user", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([])

    const response = await DELETE(jsonRequest({ id: 1 }, "DELETE"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true })
  })
})

describe("PATCH /api/tasks (reorder)", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getUserFromSession.mockResolvedValue(null)

    const response = await PATCH(jsonRequest({ orderedIds: [1, 2] }, "PATCH"))

    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("returns 400 when orderedIds is missing", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })

    const response = await PATCH(jsonRequest({}, "PATCH"))

    expect(response.status).toBe(400)
    expect(sql).not.toHaveBeenCalled()
  })
})
