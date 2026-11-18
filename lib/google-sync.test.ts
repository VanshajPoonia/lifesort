import { describe, expect, it } from "vitest"

import {
  canWriteToGoogle,
  changedInGoogle,
  endAfter,
  eventBody,
  eventPatch,
  isValidTimeZone,
  localParts,
  taskBody,
  taskPatch,
  type LocalEventRow,
  type LocalTaskRow,
} from "@/lib/google-sync"

const event: LocalEventRow = {
  id: 7,
  title: "Dentist",
  description: null,
  location: "Main St",
  event_date: "2026-11-20",
  start_time: "09:30:00",
  end_time: "10:15:00",
}

const task: LocalTaskRow = { id: 3, title: "Write report", scheduled_date: "2026-11-20", scheduled_time: "23:30:00", duration_minutes: 60 }

describe("scopes and time zones", () => {
  it("only counts a write scope", () => {
    expect(canWriteToGoogle("openid https://www.googleapis.com/auth/calendar.readonly")).toBe(false)
    expect(canWriteToGoogle("openid https://www.googleapis.com/auth/calendar.events")).toBe(true)
    expect(canWriteToGoogle(null)).toBe(false)
  })

  it("accepts real IANA zones only", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true)
    expect(isValidTimeZone("Mars/Base")).toBe(false)
    expect(isValidTimeZone(42)).toBe(false)
  })
})

describe("building Google events", () => {
  it("uses the event's own times and carries a LifeSort marker", () => {
    expect(eventBody(event, "Asia/Kolkata")).toEqual({
      summary: "Dentist",
      location: "Main St",
      start: { dateTime: "2026-11-20T09:30:00", timeZone: "Asia/Kolkata" },
      end: { dateTime: "2026-11-20T10:15:00", timeZone: "Asia/Kolkata" },
      extendedProperties: { private: { lifesort: "event:7" } },
    })
  })

  it("gives an event that ends before it starts half an hour", () => {
    const body = eventBody({ ...event, end_time: "09:00:00" }, "UTC")
    expect(body.end.dateTime).toBe("2026-11-20T10:00:00")
  })

  it("runs a late task over midnight", () => {
    const body = taskBody(task, "Asia/Kolkata")
    expect(body?.start.dateTime).toBe("2026-11-20T23:30:00")
    expect(body?.end.dateTime).toBe("2026-11-21T00:30:00")
    expect(endAfter("2026-11-20", "10:00", 30)).toEqual({ date: "2026-11-20", time: "10:30" })
  })

  it("skips tasks without a time slot", () => {
    expect(taskBody({ ...task, scheduled_time: null }, "UTC")).toBeNull()
  })
})

describe("changes made in Google", () => {
  it("reads a Google time in the person's zone", () => {
    expect(localParts("2026-11-20T04:00:00Z", "Asia/Kolkata")).toEqual({ date: "2026-11-20", time: "09:30" })
  })

  it("only treats later updates as changes", () => {
    expect(changedInGoogle({ id: "a", updated: "2026-11-18T10:00:00Z" }, "2026-11-18T09:00:00Z")).toBe(true)
    expect(changedInGoogle({ id: "a", updated: "2026-11-18T09:00:00Z" }, "2026-11-18T09:00:00Z")).toBe(false)
    expect(changedInGoogle({ id: "a" }, null)).toBe(false)
  })

  it("moves and renames an event", () => {
    const patch = eventPatch(event, {
      id: "g",
      summary: "Dentist (moved)",
      start: { dateTime: "2026-11-21T11:00:00+05:30" },
      end: { dateTime: "2026-11-21T11:45:00+05:30" },
    }, "Asia/Kolkata")
    expect(patch).toEqual({ title: "Dentist (moved)", event_date: "2026-11-21", start_time: "11:00", end_time: "11:45" })
  })

  it("returns null when nothing differs", () => {
    expect(eventPatch(event, {
      id: "g",
      summary: "Dentist",
      start: { dateTime: "2026-11-20T09:30:00+05:30" },
      end: { dateTime: "2026-11-20T10:15:00+05:30" },
    }, "Asia/Kolkata")).toBeNull()
  })

  it("only moves the date when made all-day in Google", () => {
    const patch = eventPatch(event, { id: "g", summary: "Dentist", start: { date: "2026-11-22" }, end: { date: "2026-11-23" } }, "UTC")
    expect(patch).toEqual({ title: "Dentist", event_date: "2026-11-22", start_time: "09:30", end_time: "10:15" })
  })

  it("moves a task and keeps its new length", () => {
    const patch = taskPatch(task, {
      id: "g",
      summary: "Write report",
      start: { dateTime: "2026-11-21T08:00:00Z" },
      end: { dateTime: "2026-11-21T09:30:00Z" },
    }, "UTC")
    expect(patch).toEqual({ title: "Write report", scheduled_date: "2026-11-21", scheduled_time: "08:00", duration_minutes: 90 })
  })
})
