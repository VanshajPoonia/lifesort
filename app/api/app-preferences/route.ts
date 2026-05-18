import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

const DEFAULT_APP_PREFERENCES = {
  home_view_mode: "compact",
}

function normalizePreferences(value: unknown) {
  const prefs = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  return {
    ...DEFAULT_APP_PREFERENCES,
    home_view_mode: prefs.home_view_mode === "detailed" ? "detailed" : "compact",
  }
}

function safePatch(value: unknown) {
  const patch = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const next: Record<string, unknown> = {}
  if (patch.home_view_mode === "compact" || patch.home_view_mode === "detailed") {
    next.home_view_mode = patch.home_view_mode
  }
  return next
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rows = await sql`
      SELECT app_preferences
      FROM users
      WHERE id = ${user.id}
      LIMIT 1
    `

    return NextResponse.json({ preferences: normalizePreferences(rows[0]?.app_preferences) })
  } catch (error) {
    console.error("[app-preferences] GET failed:", error)
    return NextResponse.json({ error: "Could not load app preferences" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const patch = safePatch(body)

    if (Object.keys(patch).length === 0) {
      const rows = await sql`
        SELECT app_preferences
        FROM users
        WHERE id = ${user.id}
        LIMIT 1
      `
      return NextResponse.json({ preferences: normalizePreferences(rows[0]?.app_preferences) })
    }

    const rows = await sql`
      UPDATE users
      SET app_preferences = COALESCE(app_preferences, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb,
          updated_at = NOW()
      WHERE id = ${user.id}
      RETURNING app_preferences
    `

    return NextResponse.json({ preferences: normalizePreferences(rows[0]?.app_preferences) })
  } catch (error) {
    console.error("[app-preferences] PATCH failed:", error)
    return NextResponse.json({ error: "Could not save app preferences" }, { status: 500 })
  }
}
