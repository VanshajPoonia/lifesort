import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { sql } = vi.hoisted(() => ({ sql: vi.fn() }))
const { isPushConfigured, sendPushToUser } = vi.hoisted(() => ({ isPushConfigured: vi.fn(), sendPushToUser: vi.fn() }))

vi.mock("@/lib/db", () => ({ sql }))
vi.mock("@/lib/push", () => ({ isPushConfigured, sendPushToUser }))

import { GET } from "@/app/api/cron/timed-reminders/route"

const call = (auth = "Bearer secret") =>
  GET(new Request("http://localhost/api/cron/timed-reminders", { headers: { authorization: auth } }))

// Answers each query by what it selects; UPDATEs return nothing.
function database(rows: { people?: unknown[]; habits?: unknown[]; checkins?: unknown[]; reminders?: unknown[] }) {
  sql.mockImplementation(async (strings: TemplateStringsArray) => {
    const text = strings.join("?")
    if (text.includes("FROM push_subscriptions")) return rows.people ?? []
    if (text.includes("FROM habits")) return rows.habits ?? []
    if (text.includes("FROM habit_checkins")) return rows.checkins ?? []
    if (text.includes("FROM people_reminders")) return rows.reminders ?? []
    return []
  })
}

describe("GET /api/cron/timed-reminders", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "secret")
    // 19:00 in India.
    vi.useFakeTimers({ now: new Date("2026-11-24T13:30:20Z"), toFake: ["Date"] })
    sql.mockReset()
    isPushConfigured.mockReturnValue(true)
    sendPushToUser.mockReset().mockResolvedValue({ sent: 1, removed: 0, failed: 0 })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it("refuses a wrong secret", async () => {
    const response = await call("Bearer nope")
    expect(response.status).toBe(401)
    expect(sql).not.toHaveBeenCalled()
  })

  it("skips the database when push is not configured", async () => {
    isPushConfigured.mockReturnValue(false)
    const response = await call()
    expect(await response.json()).toMatchObject({ skipped: "push is not configured" })
    expect(sql).not.toHaveBeenCalled()
  })

  it("pushes a due habit and a due reminder in one push, and marks the reminder sent", async () => {
    database({
      people: [{ user_id: "u1", time_zone: null }],
      habits: [{ id: 1, user_id: "u1", name: "Walk", frequency: "daily", custom_days: [], target_count: 1, reminder_time: "18:30" }],
      reminders: [{ id: 7, user_id: "u1", title: "Call Mom", remind_at: "2026-11-24T19:00", is_recurring: false, recur_interval: null }],
    })

    const body = await (await call()).json()

    expect(body).toEqual({ ok: true, people: 1, items: 2, pushed: 1 })
    expect(sendPushToUser).toHaveBeenCalledWith("u1", expect.objectContaining({ title: "2 reminders", body: "Walk, Call Mom" }))
    const update = sql.mock.calls.find(([strings]) => strings.join("?").includes("SET is_sent = TRUE"))
    expect(update?.[1]).toBe(7)
  })

  it("moves a recurring reminder to its next time instead of marking it sent", async () => {
    database({
      people: [{ user_id: "u1", time_zone: "Asia/Kolkata" }],
      reminders: [{ id: 8, user_id: "u1", title: "Birthday", remind_at: "2026-11-24T19:00", is_recurring: true, recur_interval: "yearly" }],
    })

    await call()

    const update = sql.mock.calls.find(([strings]) => strings.join("?").includes("SET remind_at"))
    expect(update?.[1]).toBe("2027-11-24T19:00")
  })

  it("sends nothing when nothing is due", async () => {
    database({
      people: [{ user_id: "u1", time_zone: null }],
      habits: [{ id: 1, user_id: "u1", name: "Walk", frequency: "daily", custom_days: [], target_count: 1, reminder_time: "08:00" }],
    })

    expect(await (await call()).json()).toEqual({ ok: true, people: 1, items: 0, pushed: 0 })
    expect(sendPushToUser).not.toHaveBeenCalled()
  })
})
