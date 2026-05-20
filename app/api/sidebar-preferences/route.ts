import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

const DEFAULT_SIDEBAR_SECTIONS = {
  home: true,
  workspace: true,
  organize: true,
  reflect: true,
  plan: true,
  money: true,
  life_admin: true,
  settings: true,
  admin: true,
  dashboard: true,
  reset: true,
  rules: true,
  someday: true,
  inbox: true,
  waiting: true,
  commitments: true,
  maintenance: true,
  today: true,
  journal: true,
  whiteboard: true,
  spaces: true,
  review: true,
  insights: true,
  life_areas: true,
  projects: true,
  people: true,
  vault: true,
  calendar: true,
  goals: true,
  habits: true,
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
  capture: true,
  templates: true,
  timeline: true,
  notifications: true,
}

function applyWorkspacePreferenceFallback(preferences: Record<string, boolean>) {
  if (preferences.workspace === undefined && preferences.organize !== undefined) {
    return { ...preferences, workspace: preferences.organize }
  }
  return preferences
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

    const storedPreferences = (result[0]?.sidebar_preferences || {}) as Record<string, boolean>
    const preferences = {
      ...DEFAULT_SIDEBAR_SECTIONS,
      ...applyWorkspacePreferenceFallback(storedPreferences),
    }

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
    if (preferences.workspace !== undefined && preferences.organize === undefined) {
      preferences.organize = preferences.workspace
    }

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
