import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getUserFromSession } from "@/lib/auth"
import {
  journalDateSchema,
  journalEntryInputSchema,
  mapJournalRow,
  normalizeJournalInput,
} from "@/lib/journal"

const sql = neon(process.env.DATABASE_URL!)

type RouteContext = {
  params: Promise<{ date: string }>
}

function validationError(error: z.ZodError) {
  return NextResponse.json(
    { error: "Journal entry is invalid", issues: error.issues.map((issue) => issue.message) },
    { status: 400 },
  )
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { date } = await context.params
    const parsedDate = journalDateSchema.safeParse(date)
    if (!parsedDate.success) {
      return NextResponse.json({ error: parsedDate.error.issues[0]?.message || "Invalid journal date" }, { status: 400 })
    }

    const rows = await sql`
      SELECT *
      FROM daily_journal_entries
      WHERE user_id = ${user.id} AND journal_date = ${parsedDate.data}
      LIMIT 1
    `

    return NextResponse.json({ entry: rows[0] ? mapJournalRow(rows[0]) : null })
  } catch (error) {
    console.error("[journal] GET failed:", error)
    return NextResponse.json({ error: "Could not load journal entry" }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { date } = await context.params
    const parsedDate = journalDateSchema.safeParse(date)
    if (!parsedDate.success) {
      return NextResponse.json({ error: parsedDate.error.issues[0]?.message || "Invalid journal date" }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const parsed = journalEntryInputSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error)

    const entry = normalizeJournalInput(parsed.data)
    const rows = await sql`
      INSERT INTO daily_journal_entries (
        user_id,
        journal_date,
        mood,
        gratitude,
        affirmation_text,
        affirmation_pinned_until,
        work_todo,
        personal_todo,
        family_todo,
        what_went_well,
        what_could_be_better,
        notes_from_today,
        how_to_make_tomorrow_better,
        work_stars,
        work_stars_note,
        personal_stars,
        personal_stars_note,
        family_stars,
        family_stars_note,
        tomorrow_focus,
        tomorrow_avoid,
        energy_level,
        tags,
        updated_at
      )
      VALUES (
        ${user.id},
        ${parsedDate.data},
        ${entry.mood},
        ${JSON.stringify(entry.gratitude)}::jsonb,
        ${entry.affirmation_text},
        ${entry.affirmation_pinned_until},
        ${JSON.stringify(entry.work_todo)}::jsonb,
        ${JSON.stringify(entry.personal_todo)}::jsonb,
        ${JSON.stringify(entry.family_todo)}::jsonb,
        ${entry.what_went_well},
        ${entry.what_could_be_better},
        ${entry.notes_from_today},
        ${entry.how_to_make_tomorrow_better},
        ${entry.work_stars},
        ${entry.work_stars_note},
        ${entry.personal_stars},
        ${entry.personal_stars_note},
        ${entry.family_stars},
        ${entry.family_stars_note},
        ${entry.tomorrow_focus},
        ${entry.tomorrow_avoid},
        ${entry.energy_level},
        ${JSON.stringify(entry.tags)}::jsonb,
        NOW()
      )
      ON CONFLICT (user_id, journal_date) DO UPDATE SET
        mood = EXCLUDED.mood,
        gratitude = EXCLUDED.gratitude,
        affirmation_text = EXCLUDED.affirmation_text,
        affirmation_pinned_until = EXCLUDED.affirmation_pinned_until,
        work_todo = EXCLUDED.work_todo,
        personal_todo = EXCLUDED.personal_todo,
        family_todo = EXCLUDED.family_todo,
        what_went_well = EXCLUDED.what_went_well,
        what_could_be_better = EXCLUDED.what_could_be_better,
        notes_from_today = EXCLUDED.notes_from_today,
        how_to_make_tomorrow_better = EXCLUDED.how_to_make_tomorrow_better,
        work_stars = EXCLUDED.work_stars,
        work_stars_note = EXCLUDED.work_stars_note,
        personal_stars = EXCLUDED.personal_stars,
        personal_stars_note = EXCLUDED.personal_stars_note,
        family_stars = EXCLUDED.family_stars,
        family_stars_note = EXCLUDED.family_stars_note,
        tomorrow_focus = EXCLUDED.tomorrow_focus,
        tomorrow_avoid = EXCLUDED.tomorrow_avoid,
        energy_level = EXCLUDED.energy_level,
        tags = EXCLUDED.tags,
        updated_at = NOW()
      RETURNING *
    `

    return NextResponse.json({ entry: mapJournalRow(rows[0]) })
  } catch (error) {
    console.error("[journal] PUT failed:", error)
    return NextResponse.json({ error: "Could not save journal entry" }, { status: 500 })
  }
}
