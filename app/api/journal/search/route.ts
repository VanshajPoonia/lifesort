import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { mapJournalRow } from "@/lib/journal"
import { richTextToPlainText } from "@/lib/rich-text"

function buildSnippet(entry: ReturnType<typeof mapJournalRow>, query: string) {
  const text = [
    entry.affirmation_text,
    ...entry.gratitude,
    ...entry.work_todo.map((item) => item.text),
    ...entry.personal_todo.map((item) => item.text),
    ...entry.family_todo.map((item) => item.text),
    entry.what_went_well,
    entry.what_could_be_better,
    richTextToPlainText(entry.notes_from_today),
    entry.how_to_make_tomorrow_better,
    entry.work_stars_note,
    entry.personal_stars_note,
    entry.family_stars_note,
    entry.tomorrow_focus,
    entry.tomorrow_avoid,
    ...entry.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

  if (!text) return "Journal entry"

  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return text.slice(0, 180)

  const start = Math.max(0, index - 60)
  const end = Math.min(text.length, index + query.length + 120)
  return `${start > 0 ? "... " : ""}${text.slice(start, end)}${end < text.length ? " ..." : ""}`
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const query = (searchParams.get("q") || "").trim().slice(0, 80)

    if (query.length < 2) {
      return NextResponse.json({ query, results: [] })
    }

    const pattern = `%${query}%`
    const rows = await sql`
      SELECT *
      FROM daily_journal_entries
      WHERE user_id = ${user.id}
        AND (
          COALESCE(affirmation_text, '') ILIKE ${pattern}
          OR COALESCE(what_went_well, '') ILIKE ${pattern}
          OR COALESCE(what_could_be_better, '') ILIKE ${pattern}
          OR COALESCE(notes_from_today, '') ILIKE ${pattern}
          OR COALESCE(how_to_make_tomorrow_better, '') ILIKE ${pattern}
          OR COALESCE(work_stars_note, '') ILIKE ${pattern}
          OR COALESCE(personal_stars_note, '') ILIKE ${pattern}
          OR COALESCE(family_stars_note, '') ILIKE ${pattern}
          OR COALESCE(tomorrow_focus, '') ILIKE ${pattern}
          OR COALESCE(tomorrow_avoid, '') ILIKE ${pattern}
          OR gratitude::text ILIKE ${pattern}
          OR work_todo::text ILIKE ${pattern}
          OR personal_todo::text ILIKE ${pattern}
          OR family_todo::text ILIKE ${pattern}
          OR tags::text ILIKE ${pattern}
        )
      ORDER BY journal_date DESC
      LIMIT 20
    `

    const results = rows.map((row) => {
      const entry = mapJournalRow(row)
      return {
        id: entry.id,
        journal_date: entry.journal_date,
        mood: entry.mood,
        snippet: buildSnippet(entry, query),
      }
    })

    return NextResponse.json({ query, results })
  } catch (error) {
    console.error("[journal] search failed:", error)
    return NextResponse.json({ error: "Could not search journal" }, { status: 500 })
  }
}
