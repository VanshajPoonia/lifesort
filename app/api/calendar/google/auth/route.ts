import { NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { GOOGLE_EVENTS_SCOPE, googleRedirectUri } from "@/lib/google-sync"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

export async function GET(request: Request) {
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

  // `openid` + `userinfo.email` let the callback show "Connected as". calendar.events
  // reads and writes events, which two-way sync needs (user decision 2026-11-18).
  const scopes = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    GOOGLE_EVENTS_SCOPE,
  ].join(" ")

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(googleRedirectUri(request.url))}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&include_granted_scopes=true` +
    `&state=${user.id}`

  return NextResponse.json({ authUrl })
}
