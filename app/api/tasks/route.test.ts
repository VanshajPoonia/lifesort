import { beforeEach, describe, expect, it, vi } from "vitest"

const { sql } = vi.hoisted(() => ({ sql: vi.fn() }))
const { getUserFromSession } = vi.hoisted(() => ({ getUserFromSession: vi.fn() }))

vi.mock("@/lib/neon-client", () => ({ neon: () => sql }))
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
    sql.mockResolvedValueOnce([]) // task_recurrence lookup: no rule for this task
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, completed: true }, "PUT"))

    const updated = namedCall(sql.mock.calls[2], UPDATE_FIELDS)
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

describe("PUT /api/tasks (recurrence advance)", () => {
  const baseRecurrenceRule = {
    id: 9,
    frequency: "daily",
    interval_count: 1,
    repeat_after_completion: false,
    ends_on: null as string | null,
    ends_after_count: null as number | null,
    occurrence_count: 1,
  }

  it("advances due_date and reopens status instead of staying completed", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "next", completed: false, due_date: "2026-08-01" }])
    sql.mockResolvedValueOnce([{ ...baseRecurrenceRule }]) // task_recurrence lookup
    sql.mockResolvedValueOnce([]) // occurrence_count bump
    sql.mockResolvedValueOnce([]) // checklist reset
    sql.mockResolvedValueOnce([{ id: 1 }]) // final UPDATE ... RETURNING

    await PUT(jsonRequest({ id: 1, status: "completed" }, "PUT"))

    const updated = namedCall(sql.mock.calls[4], UPDATE_FIELDS)
    expect(updated.due_date).toBe("2026-08-02")
    expect(updated.status).toBe("next")
    expect(updated.completed).toBe(false)
  })

  it("bumps occurrence_count and resets checklist items when advancing", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "next", completed: false, due_date: "2026-08-01" }])
    sql.mockResolvedValueOnce([{ ...baseRecurrenceRule }])
    sql.mockResolvedValueOnce([])
    sql.mockResolvedValueOnce([])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, status: "completed" }, "PUT"))

    expect(sql.mock.calls[2][0].join("")).toContain("UPDATE task_recurrence")
    expect(sql.mock.calls[2][0].join("")).toContain("occurrence_count = occurrence_count + 1")
    expect(sql.mock.calls[3][0].join("")).toContain("UPDATE task_checklist_items")
  })

  it("shifts scheduled_date to preserve its gap from due_date when advancing", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([
      { ...baseExistingTask, status: "next", completed: false, due_date: "2026-08-01", scheduled_date: "2026-07-31" },
    ])
    sql.mockResolvedValueOnce([{ ...baseRecurrenceRule }])
    sql.mockResolvedValueOnce([])
    sql.mockResolvedValueOnce([])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, status: "completed" }, "PUT"))

    const updated = namedCall(sql.mock.calls[4], UPDATE_FIELDS)
    expect(updated.due_date).toBe("2026-08-02")
    expect(updated.scheduled_date).toBe("2026-08-01")
  })

  it("computes the next occurrence from today when repeat_after_completion is true", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-08-10T12:00:00Z"))
    try {
      getUserFromSession.mockResolvedValue({ id: "user-1" })
      sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "next", completed: false, due_date: "2026-08-01" }])
      sql.mockResolvedValueOnce([{ ...baseRecurrenceRule, repeat_after_completion: true, interval_count: 3 }])
      sql.mockResolvedValueOnce([])
      sql.mockResolvedValueOnce([])
      sql.mockResolvedValueOnce([{ id: 1 }])

      await PUT(jsonRequest({ id: 1, status: "completed" }, "PUT"))

      const updated = namedCall(sql.mock.calls[4], UPDATE_FIELDS)
      expect(updated.due_date).toBe("2026-08-13")
    } finally {
      vi.useRealTimers()
    }
  })

  it("clamps a monthly recurrence to the target month's last day instead of overflowing", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "next", completed: false, due_date: "2026-01-31" }])
    sql.mockResolvedValueOnce([{ ...baseRecurrenceRule, frequency: "monthly", interval_count: 1 }])
    sql.mockResolvedValueOnce([])
    sql.mockResolvedValueOnce([])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, status: "completed" }, "PUT"))

    const updated = namedCall(sql.mock.calls[4], UPDATE_FIELDS)
    expect(updated.due_date).toBe("2026-02-28") // 2026 is not a leap year
  })

  it("leaves the task completed once ends_after_count is reached", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "next", completed: false, due_date: "2026-08-01" }])
    sql.mockResolvedValueOnce([{ ...baseRecurrenceRule, ends_after_count: 3, occurrence_count: 2 }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, status: "completed" }, "PUT"))

    const updated = namedCall(sql.mock.calls[2], UPDATE_FIELDS)
    expect(updated.status).toBe("completed")
    expect(updated.due_date).toBe("2026-08-01")
  })

  it("leaves the task completed once the next occurrence would be past ends_on", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "next", completed: false, due_date: "2026-08-01" }])
    sql.mockResolvedValueOnce([{ ...baseRecurrenceRule, ends_on: "2026-08-01" }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, status: "completed" }, "PUT"))

    const updated = namedCall(sql.mock.calls[2], UPDATE_FIELDS)
    expect(updated.status).toBe("completed")
  })

  it("does not advance when re-saving a task that is already completed", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "completed", completed: true, due_date: "2026-08-01" }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, status: "completed" }, "PUT"))

    // Only the existing-task lookup and the final UPDATE -- no task_recurrence lookup at all.
    expect(sql).toHaveBeenCalledTimes(2)
    const updated = namedCall(sql.mock.calls[1], UPDATE_FIELDS)
    expect(updated.status).toBe("completed")
  })

  it("does not advance when completing via cancelled status", async () => {
    getUserFromSession.mockResolvedValue({ id: "user-1" })
    sql.mockResolvedValueOnce([{ ...baseExistingTask, status: "next", completed: false, due_date: "2026-08-01" }])
    sql.mockResolvedValueOnce([{ id: 1 }])

    await PUT(jsonRequest({ id: 1, status: "cancelled" }, "PUT"))

    expect(sql).toHaveBeenCalledTimes(2)
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
