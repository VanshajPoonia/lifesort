import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

// GET - Check onboarding status
export async function GET() {
  try {
    const user = await getUserFromSession()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await sql`
      SELECT onboarding_completed, app_preferences, sidebar_preferences FROM users WHERE id = ${user.id}
    `

    const onboardingCompleted = result[0]?.onboarding_completed
    const appPreferences = result[0]?.app_preferences
    const sidebarPreferences = result[0]?.sidebar_preferences

    return NextResponse.json({ 
      onboarding_completed: onboardingCompleted ?? false,
      app_preferences: appPreferences || {},
      sidebar_preferences: sidebarPreferences || {}
    })
  } catch (error) {
    console.error("Onboarding GET error:", error)
    return NextResponse.json({ error: "Failed to fetch onboarding status" }, { status: 500 })
  }
}

// POST - Complete onboarding and save preferences
export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { app_preferences, sidebar_preferences } = await request.json()

    await sql`
      UPDATE users 
      SET 
        onboarding_completed = true,
        app_preferences = ${JSON.stringify(app_preferences)},
        sidebar_preferences = ${JSON.stringify(sidebar_preferences)},
        updated_at = NOW()
      WHERE id = ${user.id}
    `

    return NextResponse.json({ success: true, onboarding_completed: true })
  } catch (error) {
    console.error("Onboarding POST error:", error)
    return NextResponse.json({ error: "Failed to save onboarding" }, { status: 500 })
  }
}
