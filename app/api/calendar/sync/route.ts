import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

async function refreshGoogleToken(integration: any) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: integration.refresh_token,
      grant_type: "refresh_token",
    }),
  })

  const tokens = await response.json()
  if (response.ok) {
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)
    await sql`
      UPDATE calendar_integrations 
      SET access_token = ${tokens.access_token}, expires_at = ${expiresAt.toISOString()}, updated_at = NOW()
      WHERE id = ${integration.id}
    `
    return tokens.access_token
  }
  return null
}

async function refreshOutlookToken(integration: any) {
  // Placeholder for refreshOutlookToken function
  // This should be implemented based on Outlook's OAuth token refresh process
  return null;
}

async function fetchGoogleEvents(accessToken: string, timeMin: string, timeMax: string) {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
    `timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) return []

  const data = await response.json()
  return (data.items || []).map((event: any) => ({
    id: `google_${event.id}`,
    title: event.summary || "No Title",
    description: event.description || "",
    start: event.start?.dateTime || event.start?.date,
    end: event.end?.dateTime || event.end?.date,
    all_day: !event.start?.dateTime,
    provider: "google",
    color: "#4285f4",
    location: event.location || "",
  }))
}

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get("session_id")?.value

  if (!sessionId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const session = await sql`SELECT user_id FROM sessions WHERE id = ${sessionId}`
  if (session.length === 0) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 })
  }

  const userId = session[0].user_id
  const { searchParams } = new URL(request.url)
  
  // Default to current month
  const now = new Date()
  const timeMin = searchParams.get("timeMin") || new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const timeMax = searchParams.get("timeMax") || new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString()

  // Get user's calendar integrations
  const integrations = await sql`
    SELECT * FROM calendar_integrations WHERE user_id = ${userId}
  `

  const allEvents: any[] = []

  for (const integration of integrations) {
    let accessToken = integration.access_token

    // Check if token is expired
    if (new Date(integration.expires_at) < new Date()) {
      if (integration.provider === "google") {
        accessToken = await refreshGoogleToken(integration)
      }
    }

    if (!accessToken) continue

    try {
      if (integration.provider === "google") {
        const events = await fetchGoogleEvents(accessToken, timeMin, timeMax)
        allEvents.push(...events)
      }
    } catch (error) {
      console.error(`Error fetching ${integration.provider} events:`, error)
    }
  }

  // Sort by start time
  allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  return NextResponse.json({ events: allEvents })
}
