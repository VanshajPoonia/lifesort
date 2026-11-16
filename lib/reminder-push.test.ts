import { describe, expect, it } from "vitest"

import { reminderPushPayload } from "./reminder-push"

describe("reminderPushPayload", () => {
  it("returns null with nothing to remind", () => {
    expect(reminderPushPayload([])).toBeNull()
  })

  it("names a single task and says when it is due", () => {
    expect(reminderPushPayload([{ title: "Pay rent", type: "task", reminder_days: 1 }])).toEqual({
      title: "Due tomorrow",
      body: "Pay rent",
      url: "/tasks",
      tag: "daily-reminders",
    })
  })

  it("sends a single goal to Goals", () => {
    expect(reminderPushPayload([{ title: "Run 5k", type: "goal", reminder_days: 3 }])).toMatchObject({
      title: "Due in 3 days",
      url: "/goals",
    })
  })

  it("rolls several reminders into one push", () => {
    const items = ["A", "B", "C", "D", "E"].map((title) => ({ title, type: "task" as const, reminder_days: 1 }))
    expect(reminderPushPayload(items)).toEqual({
      title: "5 things coming up",
      body: "A, B, C and 2 more",
      url: "/",
      tag: "daily-reminders",
    })
  })
})
