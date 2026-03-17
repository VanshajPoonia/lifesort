import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/google/callback`
  : "http://localhost:3000/api/calendar/google/callback"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state") // user_id passed from auth route
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL("/calendar?error=google_denied", request.url))
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/calendar?error=invalid_request", request.url))
  }

  // state is the user_id
  const userId = state

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
      }),
    })

    const tokens = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error("Google token error:", tokens)
      return NextResponse.redirect(new URL("/calendar?error=token_error", request.url))
    }

    // Get user's email from Google
    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const userInfo = await userInfoResponse.json()

    // Save or update integration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000)

    await sql`
      INSERT INTO calendar_integrations (user_id, provider, access_token, refresh_token, expires_at, calendar_email)
      VALUES (${userId}, 'google', ${tokens.access_token}, ${tokens.refresh_token}, ${expiresAt.toISOString()}, ${userInfo.email})
      ON CONFLICT (user_id, provider) 
      DO UPDATE SET 
        access_token = ${tokens.access_token},
        refresh_token = COALESCE(${tokens.refresh_token}, calendar_integrations.refresh_token),
        expires_at = ${expiresAt.toISOString()},
        calendar_email = ${userInfo.email},
        updated_at = NOW()
    `

    return NextResponse.redirect(new URL("/calendar?connected=google", request.url))
  } catch (error) {
    console.error("Google OAuth error:", error)
    return NextResponse.redirect(new URL("/calendar?error=oauth_error", request.url))
  }
}
