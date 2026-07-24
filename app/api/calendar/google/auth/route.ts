import { NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/google/callback`
  : "http://localhost:3000/api/calendar/google/callback"

export async function GET() {
  const user = await getUserFromSession()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  if (!GOOGLE_CLIENT_ID) {
    return NextResponse.json({ 
      error: "Google Calendar not configured", 
      setup_required: true,
      message: "Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables"
    }, { status: 400 })
  }

  // `openid` + `userinfo.email` are required so the callback's
  // /oauth2/v2/userinfo call returns the user's address; without them
  // `calendar_integrations.calendar_email` ends up null and the UI shows
  // a blank "Connected as" label. calendar.events.readonly is a subset of
  // calendar.readonly and is intentionally omitted.
  const scopes = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/calendar.readonly",
  ].join(" ")

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${user.id}`

  return NextResponse.json({ authUrl })
}
