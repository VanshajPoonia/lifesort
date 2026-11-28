import { describe, expect, it } from "vitest"

import {
  DEFAULT_TIME_ZONE,
  dueHabits,
  duePeopleReminders,
  localNow,
  nextRecurrence,
  timedPushPayload,
  timeZoneOrDefault,
  wallTimeToInstant,
  type HabitReminderRow,
  type PeopleReminderRow,
} from "./timed-reminders"

const IST = "Asia/Kolkata"
// 2026-11-24 13:30 UTC is 19:00 in India, a Tuesday.
const run = new Date("2026-11-24T13:30:00Z")

const habit = (over: Partial<HabitReminderRow>): HabitReminderRow => ({
  id: 1,
  user_id: "u1",
  name: "Walk",
  frequency: "daily",
  custom_days: [],
  target_count: 1,
  reminder_time: "19:00",
  ...over,
})

const reminder = (over: Partial<PeopleReminderRow>): PeopleReminderRow => ({
  id: 1,
  user_id: "u1",
  title: "Call Mom",
  remind_at: "2026-11-24T19:00",
  is_recurring: false,
  recur_interval: null,
  ...over,
})

describe("timeZoneOrDefault", () => {
  it("keeps a real zone and falls back for anything else", () => {
    expect(timeZoneOrDefault("America/Chicago")).toBe("America/Chicago")
    expect(timeZoneOrDefault("Not/AZone")).toBe(DEFAULT_TIME_ZONE)
    expect(timeZoneOrDefault(null)).toBe(DEFAULT_TIME_ZONE)
  })
})

describe("localNow", () => {
  it("gives the day, minutes and weekday in the zone", () => {
    expect(localNow(run, IST)).toEqual({ day: "2026-11-24", minutes: 19 * 60, weekday: 2 })
    expect(localNow(run, "America/Chicago")).toEqual({ day: "2026-11-24", minutes: 7 * 60 + 30, weekday: 2 })
  })
})

describe("dueHabits", () => {
  const now = localNow(run, IST)

  it("sends a habit whose time fell in the last two hours, once", () => {
    expect(dueHabits([habit({ reminder_time: "19:00" })], [], now)).toHaveLength(1)
    expect(dueHabits([habit({ reminder_time: "17:01" })], [], now)).toHaveLength(1)
    // 17:00 belonged to the previous run, 19:01 to the next one.
    expect(dueHabits([habit({ reminder_time: "17:00" })], [], now)).toHaveLength(0)
    expect(dueHabits([habit({ reminder_time: "19:01" })], [], now)).toHaveLength(0)
  })

  it("catches a late-night time in the run just after midnight", () => {
    const midnight = localNow(new Date("2026-11-24T18:30:00Z"), IST)
    expect(midnight.minutes).toBe(0)
    expect(dueHabits([habit({ reminder_time: "23:30" })], [], midnight)).toHaveLength(1)
  })

  it("skips a habit already done today", () => {
    const done = [{ habit_id: 1, checkin_date: "2026-11-24", count: 1 }]
    expect(dueHabits([habit({})], done, now)).toHaveLength(0)
    expect(dueHabits([habit({ target_count: 2 })], done, now)).toHaveLength(1)
  })

  it("follows custom days", () => {
    expect(dueHabits([habit({ frequency: "custom", custom_days: [2] })], [], now)).toHaveLength(1)
    expect(dueHabits([habit({ frequency: "custom", custom_days: [1, 3] })], [], now)).toHaveLength(0)
  })

  it("stops a weekly habit once this week's is done", () => {
    const weekly = habit({ frequency: "weekly" })
    expect(dueHabits([weekly], [{ habit_id: 1, checkin_date: "2026-11-19", count: 1 }], now)).toHaveLength(0)
    expect(dueHabits([weekly], [{ habit_id: 1, checkin_date: "2026-11-17", count: 1 }], now)).toHaveLength(1)
  })
})

describe("wallTimeToInstant", () => {
  it("reads a wall-clock time in the zone", () => {
    expect(new Date(wallTimeToInstant("2026-11-24T19:00", IST)).toISOString()).toBe("2026-11-24T13:30:00.000Z")
    expect(new Date(wallTimeToInstant("2026-07-04T09:00", "America/Chicago")).toISOString()).toBe("2026-07-04T14:00:00.000Z")
    expect(new Date(wallTimeToInstant("2026-12-04T09:00", "America/Chicago")).toISOString()).toBe("2026-12-04T15:00:00.000Z")
  })
})

describe("duePeopleReminders", () => {
  it("sends a reminder whose time fell in the last two hours", () => {
    expect(duePeopleReminders([reminder({ remind_at: "2026-11-24T19:00" })], run, IST)).toHaveLength(1)
    expect(duePeopleReminders([reminder({ remind_at: "2026-11-24T17:05" })], run, IST)).toHaveLength(1)
    expect(duePeopleReminders([reminder({ remind_at: "2026-11-24T17:00" })], run, IST)).toHaveLength(0)
    expect(duePeopleReminders([reminder({ remind_at: "2026-11-24T19:05" })], run, IST)).toHaveLength(0)
  })
})

describe("nextRecurrence", () => {
  it("moves a sent reminder to its next time", () => {
    expect(nextRecurrence("2026-11-24T19:00", "weekly", run, IST)).toBe("2026-12-01T19:00")
    expect(nextRecurrence("2026-11-24T19:00", "monthly", run, IST)).toBe("2026-12-24T19:00")
    expect(nextRecurrence("2026-11-24T19:00", "yearly", run, IST)).toBe("2027-11-24T19:00")
  })

  it("keeps the end of the month", () => {
    expect(nextRecurrence("2027-01-31T09:00", "monthly", new Date("2027-01-31T05:00:00Z"), IST)).toBe("2027-02-28T09:00")
  })
})

describe("timedPushPayload", () => {
  it("returns null with nothing due", () => {
    expect(timedPushPayload([])).toBeNull()
  })

  it("names a single habit or reminder", () => {
    expect(timedPushPayload([{ kind: "habit", title: "Walk" }])).toEqual({
      title: "Time for Walk",
      body: "Tap to check it off.",
      url: "/tasks?tab=habits",
      tag: "timed-reminders",
    })
    expect(timedPushPayload([{ kind: "person", title: "Call Mom" }])).toMatchObject({ title: "Reminder", body: "Call Mom" })
  })

  it("rolls several into one push", () => {
    const items = ["A", "B", "C", "D"].map((title) => ({ kind: "habit" as const, title }))
    expect(timedPushPayload(items)).toMatchObject({ title: "4 reminders", body: "A, B, C and 1 more", url: "/" })
  })
})
