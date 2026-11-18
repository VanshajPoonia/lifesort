import { after, NextResponse } from "next/server"
import { neon } from "@/lib/neon-client"
import { getUserFromSession } from "@/lib/auth"
import { pushUpcomingToGoogle } from "@/lib/google-calendar-server"
import { canWriteToGoogle, isValidTimeZone } from "@/lib/google-sync"

const sql = neon(process.env.DATABASE_URL!)

// Copying upcoming items to Google runs after the response and can take a while.
export const maxDuration = 60

export async function GET() {
  const user = await getUserFromSession()

  const googleClientId = process.env.GOOGLE_CLIENT_ID
  const isConfigured = !!googleClientId && googleClientId.length > 0

  if (!user) {
    // Still return google_configured even if not authenticated
    return NextResponse.json({
      integrations: [],
      google_configured: isConfigured,
    })
  }

  const integrations = await sql`
    SELECT provider, calendar_email, scope, sync_to_google, created_at, updated_at
    FROM calendar_integrations
    WHERE user_id = ${user.id}
  `

  return NextResponse.json({
    integrations: integrations.map(i => ({
      provider: i.provider,
      email: i.calendar_email,
      connected_at: i.created_at,
      last_synced: i.updated_at,
      can_write: canWriteToGoogle(i.scope),
      sync_to_google: i.sync_to_google === true,
    })),
    google_configured: isConfigured,
  })
}

// PATCH { sync_to_google, time_zone }: turns copying LifeSort events and planned tasks
// to Google on or off. Turning it on copies what's coming up.
export async function PATCH(request: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const enabled = body?.sync_to_google === true
  if (enabled && !isValidTimeZone(body?.time_zone)) {
    return NextResponse.json({ error: "Send your time zone." }, { status: 400 })
  }

  const rows = await sql`
    SELECT scope FROM calendar_integrations WHERE user_id = ${user.id} AND provider = 'google'
  `
  if (!rows[0]) return NextResponse.json({ error: "Connect Google Calendar first." }, { status: 404 })
  if (enabled && !canWriteToGoogle(rows[0].scope)) {
    return NextResponse.json({ error: "Reconnect Google so LifeSort can add events.", reconnect: true }, { status: 409 })
  }

  await sql`
    UPDATE calendar_integrations
    SET sync_to_google = ${enabled}, time_zone = COALESCE(${enabled ? body.time_zone : null}, time_zone), updated_at = NOW()
    WHERE user_id = ${user.id} AND provider = 'google'
  `
  if (enabled) after(() => pushUpcomingToGoogle(user.id))

  return NextResponse.json({ sync_to_google: enabled })
}

export async function DELETE(request: Request) {
  const user = await getUserFromSession()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { provider } = await request.json()

  await sql`
    DELETE FROM calendar_integrations
    WHERE user_id = ${user.id} AND provider = ${provider}
  `
  if (provider === "google") {
    await sql`DELETE FROM calendar_sync_links WHERE user_id = ${user.id}`
  }

  return NextResponse.json({ success: true })
}
