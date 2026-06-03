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

type FocusItem = {
  id: string
  source_type: string
  source_id: string | null
  title: string
  href: string
  custom: boolean
}

function validationError(error: z.ZodError) {
  return NextResponse.json(
    { error: "Journal entry is invalid", issues: error.issues.map((issue) => issue.message) },
    { status: 400 },
  )
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`)
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}

function normalizeFocusItems(value: unknown): FocusItem[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, 3)
    .map((item) => {
      const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
      const title = typeof raw.title === "string" ? raw.title.trim() : ""
      if (!title) return null
      return {
        id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `custom-${Date.now()}`,
        source_type: typeof raw.source_type === "string" && raw.source_type.trim() ? raw.source_type.trim() : "custom",
        source_id: typeof raw.source_id === "string" && raw.source_id.trim() ? raw.source_id.trim() : null,
        title: title.slice(0, 240),
        href: typeof raw.href === "string" && raw.href.trim() ? raw.href.trim() : "/today",
        custom: Boolean(raw.custom),
      }
    })
    .filter((item): item is FocusItem => Boolean(item))
}

async function syncTomorrowFocusFromJournal(userId: string, journalDate: string, tomorrowFocus: string | null | undefined) {
  const planDate = addDays(journalDate, 1)
  const title = tomorrowFocus?.trim().slice(0, 240) || ""
  const rows = await sql`
    SELECT focus_items
    FROM daily_plans
    WHERE user_id = ${userId} AND plan_date = ${planDate}
    LIMIT 1
  `
  const focusItems = normalizeFocusItems(rows[0]?.focus_items)
  const journalIndex = focusItems.findIndex((item) => item.source_type === "journal" && item.source_id === journalDate)

  if (!title) {
    if (journalIndex === -1) return
    const nextItems = focusItems.filter((_, index) => index !== journalIndex)
    await sql`
      UPDATE daily_plans
      SET focus_items = ${JSON.stringify(nextItems)}::jsonb,
          updated_at = NOW()
      WHERE user_id = ${userId} AND plan_date = ${planDate}
    `
    return
  }

  const journalItem: FocusItem = {
    id: `journal-${journalDate}`,
    source_type: "journal",
    source_id: journalDate,
    title,
    href: `/journal?date=${journalDate}`,
    custom: false,
  }
  const nextItems =
    journalIndex >= 0
      ? focusItems.map((item, index) => (index === journalIndex ? journalItem : item))
      : focusItems.length < 3
        ? [...focusItems, journalItem]
        : focusItems

  if (journalIndex === -1 && focusItems.length >= 3) return

  await sql`
    INSERT INTO daily_plans (
      user_id,
      plan_date,
      focus_items
    )
    VALUES (
      ${userId},
      ${planDate},
      ${JSON.stringify(nextItems)}::jsonb
    )
    ON CONFLICT (user_id, plan_date)
    DO UPDATE SET
      focus_items = EXCLUDED.focus_items,
      updated_at = NOW()
  `
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

    await syncTomorrowFocusFromJournal(user.id, parsedDate.data, entry.tomorrow_focus)

    return NextResponse.json({ entry: mapJournalRow(rows[0]) })
  } catch (error) {
    console.error("[journal] PUT failed:", error)
    return NextResponse.json({ error: "Could not save journal entry" }, { status: 500 })
  }
}
