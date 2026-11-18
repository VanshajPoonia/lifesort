import { addDaysToDate } from "@/lib/date-math"
import { requestOrigin } from "@/lib/redirect-target"

// Two-way Google Calendar sync (AI_BUILD_PLAN.md Part 0, Stage 6). Pure helpers:
// building the Google event for a LifeSort item, and deciding when a change made
// in Google should come back. lib/google-calendar-server.ts does the calls.

export const GOOGLE_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events"
const FULL_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar"
export const DEFAULT_TASK_MINUTES = 30

export type SyncItemType = "event" | "task"

export type LocalEventRow = {
  id: number
  title: string
  description: string | null
  location: string | null
  event_date: string
  start_time: string
  end_time: string
}

export type LocalTaskRow = {
  id: number
  title: string
  scheduled_date: string | null
  scheduled_time: string | null
  duration_minutes: number | null
}

export type GoogleEventBody = {
  summary: string
  description?: string
  location?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  extendedProperties: { private: { lifesort: string } }
}

export type GoogleEventRaw = {
  id: string
  status?: string
  summary?: string
  updated?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  extendedProperties?: { private?: Record<string, string> }
}

// Built from the request's own host: NEXT_PUBLIC_APP_URL points at a domain that
// currently returns 404, and the token exchange must repeat the exact same address.
export function googleRedirectUri(request: Request) {
  return `${requestOrigin(request)}/api/calendar/google/callback`
}

export function canWriteToGoogle(scope: string | null | undefined) {
  const granted = (scope ?? "").split(/\s+/)
  return granted.includes(GOOGLE_EVENTS_SCOPE) || granted.includes(FULL_CALENDAR_SCOPE)
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || !value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value })
    return true
  } catch {
    return false
  }
}

function hhmm(time: string) {
  return time.slice(0, 5)
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

function fromMinutes(total: number) {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

// A start plus a length, carried over midnight when it runs past it.
export function endAfter(date: string, time: string, minutes: number) {
  const total = toMinutes(time) + Math.max(1, minutes)
  return { date: addDaysToDate(date, Math.floor(total / 1440)), time: fromMinutes(total % 1440) }
}

export function marker(type: SyncItemType, id: number) {
  return `${type}:${id}`
}

export function eventBody(event: LocalEventRow, timeZone: string): GoogleEventBody {
  const start = hhmm(event.start_time)
  const endTime = hhmm(event.end_time)
  const end = toMinutes(endTime) > toMinutes(start)
    ? { date: event.event_date, time: endTime }
    : endAfter(event.event_date, start, DEFAULT_TASK_MINUTES)
  return {
    summary: event.title,
    ...(event.description ? { description: event.description } : {}),
    ...(event.location ? { location: event.location } : {}),
    start: { dateTime: `${event.event_date}T${start}:00`, timeZone },
    end: { dateTime: `${end.date}T${end.time}:00`, timeZone },
    extendedProperties: { private: { lifesort: marker("event", event.id) } },
  }
}

// Only tasks planned into a time slot go to Google.
export function taskBody(task: LocalTaskRow, timeZone: string): GoogleEventBody | null {
  if (!task.scheduled_date || !task.scheduled_time) return null
  const start = hhmm(task.scheduled_time)
  const end = endAfter(task.scheduled_date, start, task.duration_minutes || DEFAULT_TASK_MINUTES)
  return {
    summary: task.title,
    description: "Planned in LifeSort",
    start: { dateTime: `${task.scheduled_date}T${start}:00`, timeZone },
    end: { dateTime: `${end.date}T${end.time}:00`, timeZone },
    extendedProperties: { private: { lifesort: marker("task", task.id) } },
  }
}

// The date and HH:MM a Google timestamp falls on in the person's time zone.
export function localParts(dateTime: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(dateTime))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` }
}

function googleTimes(event: GoogleEventRaw, timeZone: string) {
  if (event.start?.dateTime && event.end?.dateTime) {
    const start = localParts(event.start.dateTime, timeZone)
    const end = localParts(event.end.dateTime, timeZone)
    const minutes = Math.round((Date.parse(event.end.dateTime) - Date.parse(event.start.dateTime)) / 60000)
    return { date: start.date, start: start.time, end: end.time, minutes }
  }
  if (event.start?.date) return { date: event.start.date, start: null, end: null, minutes: null }
  return null
}

// Google changed it after our last push: true when its `updated` is later.
export function changedInGoogle(event: GoogleEventRaw, lastKnown: string | null) {
  if (!event.updated) return false
  if (!lastKnown) return true
  return Date.parse(event.updated) > Date.parse(lastKnown)
}

export type EventPatch = { title: string; event_date: string; start_time: string; end_time: string }
export type TaskPatch = { title: string; scheduled_date: string; scheduled_time: string | null; duration_minutes: number | null }

// What a LifeSort event should become after a move or rename in Google, or null if nothing differs.
// An all-day change only moves the date.
export function eventPatch(local: LocalEventRow, google: GoogleEventRaw, timeZone: string): EventPatch | null {
  const times = googleTimes(google, timeZone)
  if (!times) return null
  const patch: EventPatch = {
    title: google.summary?.trim() || local.title,
    event_date: times.date,
    start_time: times.start ?? hhmm(local.start_time),
    end_time: times.end && times.minutes !== null && times.minutes < 1440 && times.end > (times.start ?? "")
      ? times.end
      : hhmm(local.end_time),
  }
  const same = patch.title === local.title && patch.event_date === local.event_date &&
    patch.start_time === hhmm(local.start_time) && patch.end_time === hhmm(local.end_time)
  return same ? null : patch
}

export function taskPatch(local: LocalTaskRow, google: GoogleEventRaw, timeZone: string): TaskPatch | null {
  const times = googleTimes(google, timeZone)
  if (!times) return null
  const patch: TaskPatch = {
    title: google.summary?.trim() || local.title,
    scheduled_date: times.date,
    scheduled_time: times.start ?? (local.scheduled_time ? hhmm(local.scheduled_time) : null),
    duration_minutes: times.minutes !== null && times.minutes > 0 && times.minutes <= 1440 ? times.minutes : local.duration_minutes,
  }
  const same = patch.title === local.title && patch.scheduled_date === local.scheduled_date &&
    patch.scheduled_time === (local.scheduled_time ? hhmm(local.scheduled_time) : null) &&
    patch.duration_minutes === local.duration_minutes
  return same ? null : patch
}
