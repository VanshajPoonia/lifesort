import type { PushPayload } from "@/lib/push"

// Used when a person has no Google Calendar time zone. The morning cron is set for IST too.
export const DEFAULT_TIME_ZONE = "Asia/Kolkata"
// The cron runs every two hours on the minute, so each reminder time falls in exactly one run.
const SLOT_MINUTES = 120

export type LocalNow = { day: string; minutes: number; weekday: number }

export type HabitReminderRow = {
  id: number
  user_id: string
  name: string
  frequency: string
  custom_days: number[] | null
  target_count: number
  reminder_time: string
}

export type CheckinRow = { habit_id: number; checkin_date: string; count: number }

export type PeopleReminderRow = {
  id: number
  user_id: string
  title: string
  remind_at: string
  is_recurring: boolean
  recur_interval: string | null
}

export function timeZoneOrDefault(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return DEFAULT_TIME_ZONE
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return value
  } catch {
    return DEFAULT_TIME_ZONE
  }
}

function partsIn(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") }
}

const pad = (n: number) => String(n).padStart(2, "0")

export function localNow(now: Date, timeZone: string): LocalNow {
  const p = partsIn(now, timeZone)
  return {
    day: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    minutes: p.hour * 60 + p.minute,
    weekday: new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(),
  }
}

function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

function clockMinutes(time: string) {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

// Habits whose reminder time fell in the last two hours, on a day they are due and not yet done.
export function dueHabits(habits: HabitReminderRow[], checkins: CheckinRow[], now: LocalNow) {
  return habits.filter((habit) => {
    const since = (now.minutes - clockMinutes(habit.reminder_time) + 1440) % 1440
    if (since >= SLOT_MINUTES) return false
    if (habit.frequency === "custom" && !(habit.custom_days ?? []).includes(now.weekday)) return false
    const mine = checkins.filter((c) => c.habit_id === habit.id)
    if (mine.some((c) => c.checkin_date === now.day && c.count >= habit.target_count)) return false
    // Weekly habits are due any day, so stop once this week's is done.
    if (habit.frequency === "weekly" && mine.some((c) => c.checkin_date > addDays(now.day, -7))) return false
    return true
  })
}

// A wall-clock time ("2026-11-24T19:00") in a time zone, as epoch milliseconds.
export function wallTimeToInstant(wall: string, timeZone: string) {
  const [date, time = "00:00"] = wall.split("T")
  const [y, mo, d] = date.split("-").map(Number)
  const [h, mi] = time.split(":").map(Number)
  const asUtc = Date.UTC(y, mo - 1, d, h, mi)
  const offsetAt = (ms: number) => {
    const p = partsIn(new Date(ms), timeZone)
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms
  }
  return asUtc - offsetAt(asUtc - offsetAt(asUtc))
}

// People reminders whose time fell in the last two hours. `now` should be the run's minute.
export function duePeopleReminders(reminders: PeopleReminderRow[], now: Date, timeZone: string) {
  return reminders.filter((r) => {
    const late = now.getTime() - wallTimeToInstant(r.remind_at, timeZone)
    return late >= 0 && late < SLOT_MINUTES * 60_000
  })
}

// The i-th repeat of a date, clamped to the month's last day (Jan 31 monthly gives Feb 28).
function repeatDate(y: number, mo: number, d: number, interval: string | null, i: number) {
  if (interval === "weekly") return new Date(Date.UTC(y, mo - 1, d + 7 * i))
  const months = interval === "monthly" ? i : 12 * i
  const lastDay = new Date(Date.UTC(y, mo - 1 + months + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, mo - 1 + months, Math.min(d, lastDay)))
}

// The next wall-clock time for a recurring reminder that is still in the future.
export function nextRecurrence(remindAt: string, interval: string | null, now: Date, timeZone: string) {
  const [date, time = "00:00"] = remindAt.split("T")
  const [y, mo, d] = date.split("-").map(Number)
  let wall = remindAt
  for (let i = 1; i <= 400 && wallTimeToInstant(wall, timeZone) <= now.getTime(); i++) {
    wall = `${repeatDate(y, mo, d, interval, i).toISOString().slice(0, 10)}T${time.slice(0, 5)}`
  }
  return wall
}

export type TimedItem = { kind: "habit" | "person"; title: string }

// One push per person per run, however many reminders came due.
export function timedPushPayload(items: TimedItem[]): PushPayload | null {
  if (items.length === 0) return null
  if (items.length === 1) {
    const [item] = items
    return item.kind === "habit"
      ? { title: `Time for ${item.title}`, body: "Tap to check it off.", url: "/tasks?tab=habits", tag: "timed-reminders" }
      : { title: "Reminder", body: item.title, url: "/library?tab=people", tag: "timed-reminders" }
  }
  const names = items.slice(0, 3).map((item) => item.title)
  const more = items.length - names.length
  return {
    title: `${items.length} reminders`,
    body: more > 0 ? `${names.join(", ")} and ${more} more` : names.join(", "),
    url: "/",
    tag: "timed-reminders",
  }
}
