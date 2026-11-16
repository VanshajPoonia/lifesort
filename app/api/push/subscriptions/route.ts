import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

const MAX_ENDPOINT_LENGTH = 2048
const MAX_KEY_LENGTH = 512

function validEndpoint(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_ENDPOINT_LENGTH && value.startsWith("https://")
}

function validKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_KEY_LENGTH
}

// Saves this device's push subscription for the signed-in user.
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth
  if (!validEndpoint(endpoint) || !validKey(p256dh) || !validKey(auth)) {
    return NextResponse.json({ error: "That push subscription isn't valid." }, { status: 400 })
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null
  try {
    await sql`
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
      VALUES (${user.id}, ${endpoint}, ${p256dh}, ${auth}, ${userAgent})
      ON CONFLICT (endpoint) DO UPDATE
        SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent
    `
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[push/subscriptions] POST error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Couldn't turn on push for this device." }, { status: 500 })
  }
}

// Removes this device's subscription when the user turns push off.
export async function DELETE(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!validEndpoint(body?.endpoint)) {
    return NextResponse.json({ error: "That push subscription isn't valid." }, { status: 400 })
  }

  try {
    await sql`DELETE FROM push_subscriptions WHERE endpoint = ${body.endpoint} AND user_id = ${user.id}`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[push/subscriptions] DELETE error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Couldn't turn off push for this device." }, { status: 500 })
  }
}
