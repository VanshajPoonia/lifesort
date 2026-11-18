import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { accessTokenFor, applyGoogleChanges, type GoogleIntegration } from "@/lib/google-calendar-server"
import type { GoogleEventRaw } from "@/lib/google-sync"

type GoogleEventFull = GoogleEventRaw & { description?: string; location?: string }

type CalendarEventItem = {
  id: string
  title: string
  description: string
  start: string | undefined
  end: string | undefined
  all_day: boolean
  provider: string
  color: string
  location: string
}

async function fetchGoogleEvents(accessToken: string, timeMin: string, timeMax: string): Promise<GoogleEventFull[]> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!response.ok) return []
  const data = await response.json()
  return data.items || []
}

function toItem(event: GoogleEventFull): CalendarEventItem {
  return {
    id: `google_${event.id}`,
    title: event.summary || "No Title",
    description: event.description || "",
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    all_day: !event.start?.dateTime,
    provider: "google",
    color: "#4285f4",
    location: event.location || "",
  }
}

// GET: Google events for a range. Changes made in Google to LifeSort's own copies are
// applied to the LifeSort items first (`pulled` counts them), and those copies are left out.
export async function GET(request: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const timeMin = searchParams.get("timeMin") || new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const timeMax = searchParams.get("timeMax") || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()

  const integrations = (await sql`
    SELECT id, user_id, provider, access_token, refresh_token, expires_at, scope, time_zone, sync_to_google
    FROM calendar_integrations WHERE user_id = ${user.id}
  `) as (GoogleIntegration & { provider: string })[]

  const allEvents: CalendarEventItem[] = []
  let pulled = 0

  for (const integration of integrations) {
    if (integration.provider !== "google") continue
    try {
      const accessToken = await accessTokenFor(integration)
      if (!accessToken) continue
      const events = await fetchGoogleEvents(accessToken, timeMin, timeMax)
      const changes = await applyGoogleChanges(user.id, integration.time_zone, events)
      pulled += changes.pulled
      allEvents.push(...events.filter((event) => !changes.ours.has(event.id)).map(toItem))
    } catch (error) {
      console.error("Error fetching google events:", error)
    }
  }

  allEvents.sort((a, b) => new Date(a.start || "").getTime() - new Date(b.start || "").getTime())

  return NextResponse.json({ events: allEvents, pulled })
}
