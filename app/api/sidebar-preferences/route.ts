import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

const DEFAULT_SIDEBAR_SECTIONS = {
  dashboard: true,
  calendar: true,
  goals: true,
  tasks: true,
  nuke: true,
  pomodoro: true,
  notes: true,
  wishlist: true,
  investments: true,
  income: true,
  budget: true,
  links: true,
  daily_content: true,
  custom_sections: true,
  ai_assistant: true,
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ preferences: DEFAULT_SIDEBAR_SECTIONS }, { status: 200 })
    }

    const result = await sql`
      SELECT sidebar_preferences FROM users WHERE id = ${user.id}
    `

    const preferences = result[0]?.sidebar_preferences || DEFAULT_SIDEBAR_SECTIONS

    return NextResponse.json({ preferences })
  } catch (error) {
    console.error("[v0] Error fetching sidebar preferences:", error)
    return NextResponse.json({ preferences: DEFAULT_SIDEBAR_SECTIONS })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const preferences = await request.json()

    await sql`
      UPDATE users 
      SET sidebar_preferences = ${JSON.stringify(preferences)}
      WHERE id = ${user.id}
    `

    return NextResponse.json({ success: true, preferences })
  } catch (error) {
    console.error("[v0] Error saving sidebar preferences:", error)
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 })
  }
}
