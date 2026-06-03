import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

function dateOnly(value: unknown) {
  if (!value) return ""
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""))
  return Number.isFinite(parsed) ? parsed : null
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rows = await sql`
      SELECT journal_date, mood, work_stars, personal_stars, family_stars, gratitude
      FROM daily_journal_entries
      WHERE user_id = ${user.id}
        AND journal_date >= CURRENT_DATE - INTERVAL '89 days'
      ORDER BY journal_date ASC
    `

    return NextResponse.json({
      entries: rows.map((row) => ({
        journal_date: dateOnly(row.journal_date),
        mood: toNumber(row.mood),
        work_stars: toNumber(row.work_stars),
        personal_stars: toNumber(row.personal_stars),
        family_stars: toNumber(row.family_stars),
        gratitude: toStringArray(row.gratitude),
      })),
    })
  } catch (error) {
    console.error("[journal] insights failed:", error)
    return NextResponse.json({ error: "Could not load journal insights" }, { status: 500 })
  }
}
