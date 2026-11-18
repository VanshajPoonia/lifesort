import { after } from "next/server"

import { sql } from "@/lib/db"
import {
  canWriteToGoogle,
  changedInGoogle,
  eventBody,
  eventPatch,
  taskBody,
  taskPatch,
  type GoogleEventBody,
  type GoogleEventRaw,
  type LocalEventRow,
  type LocalTaskRow,
  type SyncItemType,
} from "@/lib/google-sync"
import { decryptToken, encryptToken } from "@/lib/token-crypto"

// Google Calendar calls for two-way sync. Pushes run after the response is sent and
// only log failures, so a Google problem never blocks a LifeSort save.

const EVENTS_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
const BACKFILL_LIMIT = 50

export type GoogleIntegration = {
  id: number
  user_id: string
  access_token: string | null
  refresh_token: string | null
  expires_at: string | Date | null
  scope: string | null
  time_zone: string | null
  sync_to_google: boolean
}

type SyncLink = { item_type: SyncItemType; item_id: number; google_event_id: string; google_updated_at: string | Date | null }

export async function refreshGoogleToken(integration: GoogleIntegration): Promise<string | null> {
  const refreshToken = decryptToken(integration.refresh_token)
  if (!refreshToken) return null

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  const tokens = await response.json()
  if (!response.ok) return null

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
  await sql`
    UPDATE calendar_integrations
    SET access_token = ${encryptToken(tokens.access_token)}, expires_at = ${expiresAt.toISOString()}, updated_at = NOW()
    WHERE id = ${integration.id}
  `
  return tokens.access_token
}

export async function accessTokenFor(integration: GoogleIntegration): Promise<string | null> {
  const expired = !integration.expires_at || new Date(integration.expires_at) < new Date(Date.now() + 60_000)
  if (expired) return refreshGoogleToken(integration)
  return decryptToken(integration.access_token)
}

async function writableIntegration(userId: string): Promise<GoogleIntegration | null> {
  const rows = await sql`
    SELECT id, user_id, access_token, refresh_token, expires_at, scope, time_zone, sync_to_google
    FROM calendar_integrations
    WHERE user_id = ${userId} AND provider = 'google' AND sync_to_google = TRUE
    LIMIT 1
  `
  const integration = rows[0] as GoogleIntegration | undefined
  return integration && canWriteToGoogle(integration.scope) ? integration : null
}

async function findLink(userId: string, type: SyncItemType, id: number): Promise<SyncLink | null> {
  const rows = await sql`
    SELECT item_type, item_id, google_event_id, google_updated_at
    FROM calendar_sync_links
    WHERE user_id = ${userId} AND item_type = ${type} AND item_id = ${id}
  `
  return (rows[0] as SyncLink | undefined) ?? null
}

async function upsertInGoogle(userId: string, token: string, type: SyncItemType, id: number, body: GoogleEventBody) {
  const link = await findLink(userId, type, id)
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
  let response: Response | null = null
  if (link) {
    response = await fetch(`${EVENTS_API}/${encodeURIComponent(link.google_event_id)}`, { method: "PATCH", headers, body: JSON.stringify(body) })
    if (response.status === 404 || response.status === 410) response = null
  }
  response ??= await fetch(EVENTS_API, { method: "POST", headers, body: JSON.stringify(body) })
  if (!response.ok) {
    console.error(`[google-sync] push ${type} ${id} failed with ${response.status}`)
    return
  }
  const created = (await response.json()) as GoogleEventRaw
  await sql`
    INSERT INTO calendar_sync_links (user_id, item_type, item_id, google_event_id, google_updated_at, pushed_at)
    VALUES (${userId}, ${type}, ${id}, ${created.id}, ${created.updated ?? null}, NOW())
    ON CONFLICT (user_id, item_type, item_id)
    DO UPDATE SET google_event_id = EXCLUDED.google_event_id, google_updated_at = EXCLUDED.google_updated_at, pushed_at = NOW()
  `
}

async function deleteFromGoogle(userId: string, token: string, type: SyncItemType, id: number) {
  const link = await findLink(userId, type, id)
  if (!link) return
  const response = await fetch(`${EVENTS_API}/${encodeURIComponent(link.google_event_id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    console.error(`[google-sync] delete ${type} ${id} failed with ${response.status}`)
    return
  }
  await sql`DELETE FROM calendar_sync_links WHERE user_id = ${userId} AND item_type = ${type} AND item_id = ${id}`
}

// Creates, moves or deletes the Google copy of one LifeSort event or task to match it.
export async function syncItemToGoogle(userId: string, type: SyncItemType, id: number) {
  try {
    const integration = await writableIntegration(userId)
    if (!integration) return
    const token = await accessTokenFor(integration)
    if (!token) return
    const timeZone = integration.time_zone || "UTC"

    let body: GoogleEventBody | null = null
    if (type === "event") {
      const rows = await sql`
        SELECT id, title, description, location, event_date, start_time, end_time
        FROM calendar_events WHERE id = ${id} AND user_id = ${userId}
      `
      if (rows[0]) body = eventBody(rows[0] as LocalEventRow, timeZone)
    } else {
      const rows = await sql`
        SELECT id, title, scheduled_date, scheduled_time, duration_minutes
        FROM tasks WHERE id = ${id} AND user_id = ${userId}
      `
      if (rows[0]) body = taskBody(rows[0] as LocalTaskRow, timeZone)
    }

    if (body) await upsertInGoogle(userId, token, type, id, body)
    else await deleteFromGoogle(userId, token, type, id)
  } catch (error) {
    console.error(`[google-sync] ${type} ${id}:`, error instanceof Error ? error.message : error)
  }
}

// Queues a push for after the response, so saves stay fast.
export function syncToGoogleSoon(userId: string, type: SyncItemType, id: number | string | null | undefined) {
  const itemId = Number(id)
  if (!Number.isInteger(itemId) || itemId <= 0) return
  after(() => syncItemToGoogle(userId, type, itemId))
}

// When sync is switched on: copies upcoming events and planned tasks to Google.
export async function pushUpcomingToGoogle(userId: string) {
  const since = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const events = await sql`
    SELECT id FROM calendar_events
    WHERE user_id = ${userId} AND event_date >= ${since}
    ORDER BY event_date LIMIT ${BACKFILL_LIMIT}
  `
  const tasks = await sql`
    SELECT id FROM tasks
    WHERE user_id = ${userId} AND completed = FALSE AND scheduled_date >= ${since} AND scheduled_time IS NOT NULL
    ORDER BY scheduled_date LIMIT ${BACKFILL_LIMIT}
  `
  for (const row of events) await syncItemToGoogle(userId, "event", Number(row.id))
  for (const row of tasks) await syncItemToGoogle(userId, "task", Number(row.id))
}

function toIso(value: string | Date | null) {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : value
}

// Brings moves and renames made in Google back to the LifeSort items they came from.
// Returns the Google ids that are LifeSort's own copies, so they aren't shown twice.
export async function applyGoogleChanges(userId: string, timeZone: string | null, events: GoogleEventRaw[]) {
  const ours = new Set<string>()
  if (events.length === 0) return { ours, pulled: 0 }

  const links = (await sql`
    SELECT item_type, item_id, google_event_id, google_updated_at
    FROM calendar_sync_links
    WHERE user_id = ${userId} AND google_event_id = ANY(${events.map((event) => event.id)})
  `) as SyncLink[]

  let pulled = 0
  const zone = timeZone || "UTC"
  for (const link of links) {
    const google = events.find((event) => event.id === link.google_event_id)
    if (!google) continue
    ours.add(google.id)
    if (!changedInGoogle(google, toIso(link.google_updated_at))) continue

    if (link.item_type === "event") {
      const rows = await sql`
        SELECT id, title, description, location, event_date, start_time, end_time
        FROM calendar_events WHERE id = ${link.item_id} AND user_id = ${userId}
      `
      const patch = rows[0] ? eventPatch(rows[0] as LocalEventRow, google, zone) : null
      if (patch) {
        await sql`
          UPDATE calendar_events
          SET title = ${patch.title}, event_date = ${patch.event_date}, start_time = ${patch.start_time},
              end_time = ${patch.end_time}, updated_at = NOW()
          WHERE id = ${link.item_id} AND user_id = ${userId}
        `
        pulled += 1
      }
    } else {
      const rows = await sql`
        SELECT id, title, scheduled_date, scheduled_time, duration_minutes
        FROM tasks WHERE id = ${link.item_id} AND user_id = ${userId}
      `
      const patch = rows[0] ? taskPatch(rows[0] as LocalTaskRow, google, zone) : null
      if (patch) {
        await sql`
          UPDATE tasks
          SET title = ${patch.title}, scheduled_date = ${patch.scheduled_date}, scheduled_time = ${patch.scheduled_time},
              duration_minutes = ${patch.duration_minutes}, updated_at = NOW()
          WHERE id = ${link.item_id} AND user_id = ${userId}
        `
        pulled += 1
      }
    }
    await sql`
      UPDATE calendar_sync_links SET google_updated_at = ${google.updated ?? null}
      WHERE user_id = ${userId} AND google_event_id = ${google.id}
    `
  }
  return { ours, pulled }
}
