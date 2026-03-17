import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

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
    SELECT provider, calendar_email, created_at, updated_at 
    FROM calendar_integrations 
    WHERE user_id = ${user.id}
  `

  return NextResponse.json({
    integrations: integrations.map(i => ({
      provider: i.provider,
      email: i.calendar_email,
      connected_at: i.created_at,
      last_synced: i.updated_at,
    })),
    google_configured: isConfigured,
  })
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

  return NextResponse.json({ success: true })
}
