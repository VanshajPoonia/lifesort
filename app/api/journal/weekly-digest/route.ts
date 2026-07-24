import { neon } from "@/lib/neon-client"
import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { journalDateSchema, mapJournalRow } from "@/lib/journal"
import { addDaysToDate } from "@/lib/date-math"

const sql = neon(process.env.DATABASE_URL!)

// UTC-explicit throughout -- see lib/date-math.ts and AI_DECISIONS.md. The
// previous local-midnight-then-UTC-read version shifted the result back a
// day on any non-UTC server.
function weekBounds(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  const dow = date.getUTCDay()
  const diffToMonday = (dow + 6) % 7
  const startDate = new Date(date)
  startDate.setUTCDate(date.getUTCDate() - diffToMonday)
  const start = startDate.toISOString().slice(0, 10)
  return {
    start,
    end: addDaysToDate(start, 6),
  }
}

function average(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
  if (usable.length === 0) return null
  return Math.round((usable.reduce((sum, value) => sum + value, 0) / usable.length) * 10) / 10
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const weekOf = searchParams.get("weekOf") || new Date().toISOString().slice(0, 10)
    const parsedDate = journalDateSchema.safeParse(weekOf)
    if (!parsedDate.success) {
      return NextResponse.json({ error: parsedDate.error.issues[0]?.message || "Invalid week date" }, { status: 400 })
    }

    const { start, end } = weekBounds(parsedDate.data)
    const rows = await sql`
      SELECT *
      FROM daily_journal_entries
      WHERE user_id = ${user.id}
        AND journal_date >= ${start}
        AND journal_date <= ${end}
      ORDER BY journal_date DESC
    `
    const entries = rows.map((row) => mapJournalRow(row))

    return NextResponse.json({
      week: { start, end },
      entries,
      averages: {
        mood: average(entries.map((entry) => entry.mood)),
        work_stars: average(entries.map((entry) => entry.work_stars)),
        personal_stars: average(entries.map((entry) => entry.personal_stars)),
        family_stars: average(entries.map((entry) => entry.family_stars)),
      },
      counts: {
        entries: entries.length,
        gratitude_items: entries.reduce((sum, entry) => sum + entry.gratitude.filter(Boolean).length, 0),
        completed_intentions: entries.reduce(
          (sum, entry) =>
            sum +
            entry.work_todo.filter((item) => item.done).length +
            entry.personal_todo.filter((item) => item.done).length +
            entry.family_todo.filter((item) => item.done).length,
          0,
        ),
      },
    })
  } catch (error) {
    console.error("[journal] weekly digest failed:", error)
    return NextResponse.json({ error: "Could not load journal weekly digest" }, { status: 500 })
  }
}
