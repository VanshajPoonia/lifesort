import { NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
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

  const scopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events.readonly"
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
