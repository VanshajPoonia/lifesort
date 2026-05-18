import { z } from "zod"

export const journalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use date format YYYY-MM-DD")

const nullableText = (max = 4000) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable().optional(),
  )

export const journalTodoItemSchema = z.object({
  id: z.string().min(1).max(80),
  text: z.string().trim().max(240).default(""),
  done: z.boolean().default(false),
})

export const journalEntryInputSchema = z.object({
  mood: z.number().int().min(1).max(5).nullable().optional(),
  gratitude: z.array(z.string().trim().max(240)).max(3).default(["", "", ""]),
  affirmation_text: nullableText(140),
  affirmation_pinned_until: nullableText(30),
  work_todo: z.array(journalTodoItemSchema).max(3).default([]),
  personal_todo: z.array(journalTodoItemSchema).max(3).default([]),
  family_todo: z.array(journalTodoItemSchema).max(3).default([]),
  what_went_well: nullableText(),
  what_could_be_better: nullableText(),
  notes_from_today: nullableText(8000),
  how_to_make_tomorrow_better: nullableText(),
  work_stars: z.number().int().min(1).max(5).nullable().optional(),
  work_stars_note: nullableText(1000),
  personal_stars: z.number().int().min(1).max(5).nullable().optional(),
  personal_stars_note: nullableText(1000),
  family_stars: z.number().int().min(1).max(5).nullable().optional(),
  family_stars_note: nullableText(1000),
  tomorrow_focus: nullableText(1000),
  tomorrow_avoid: nullableText(1000),
  energy_level: z.enum(["low", "medium", "high"]).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
})

export type JournalTodoItem = z.infer<typeof journalTodoItemSchema>
export type JournalEntryInput = z.infer<typeof journalEntryInputSchema>

export type JournalEntry = JournalEntryInput & {
  id: number
  journal_date: string
  locked_at: string | null
  created_at: string | null
  updated_at: string | null
}

export function normalizeJournalInput(input: JournalEntryInput): JournalEntryInput {
  return {
    ...input,
    mood: input.mood ?? null,
    gratitude: [...input.gratitude, "", "", ""].slice(0, 3),
    affirmation_text: input.affirmation_text ?? null,
    affirmation_pinned_until: input.affirmation_pinned_until ?? null,
    work_todo: input.work_todo.slice(0, 3),
    personal_todo: input.personal_todo.slice(0, 3),
    family_todo: input.family_todo.slice(0, 3),
    what_went_well: input.what_went_well ?? null,
    what_could_be_better: input.what_could_be_better ?? null,
    notes_from_today: input.notes_from_today ?? null,
    how_to_make_tomorrow_better: input.how_to_make_tomorrow_better ?? null,
    work_stars: input.work_stars ?? null,
    work_stars_note: input.work_stars_note ?? null,
    personal_stars: input.personal_stars ?? null,
    personal_stars_note: input.personal_stars_note ?? null,
    family_stars: input.family_stars ?? null,
    family_stars_note: input.family_stars_note ?? null,
    tomorrow_focus: input.tomorrow_focus ?? null,
    tomorrow_avoid: input.tomorrow_avoid ?? null,
    energy_level: input.energy_level ?? null,
    tags: input.tags,
  }
}

function dateOnly(value: unknown) {
  if (!value) return ""
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

function timestamp(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return String(value)
}

function jsonArray<T>(value: unknown, fallback: T[]): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  }
  return fallback
}

export function mapJournalRow(row: Record<string, unknown>): JournalEntry {
  const normalized = normalizeJournalInput(journalEntryInputSchema.parse({
    mood: row.mood ?? null,
    gratitude: jsonArray<string>(row.gratitude, ["", "", ""]),
    affirmation_text: row.affirmation_text ?? null,
    affirmation_pinned_until: row.affirmation_pinned_until ? dateOnly(row.affirmation_pinned_until) : null,
    work_todo: jsonArray<JournalTodoItem>(row.work_todo, []),
    personal_todo: jsonArray<JournalTodoItem>(row.personal_todo, []),
    family_todo: jsonArray<JournalTodoItem>(row.family_todo, []),
    what_went_well: row.what_went_well ?? null,
    what_could_be_better: row.what_could_be_better ?? null,
    notes_from_today: row.notes_from_today ?? null,
    how_to_make_tomorrow_better: row.how_to_make_tomorrow_better ?? null,
    work_stars: row.work_stars ?? null,
    work_stars_note: row.work_stars_note ?? null,
    personal_stars: row.personal_stars ?? null,
    personal_stars_note: row.personal_stars_note ?? null,
    family_stars: row.family_stars ?? null,
    family_stars_note: row.family_stars_note ?? null,
    tomorrow_focus: row.tomorrow_focus ?? null,
    tomorrow_avoid: row.tomorrow_avoid ?? null,
    energy_level: row.energy_level ?? null,
    tags: jsonArray<string>(row.tags, []),
  }))

  return {
    ...normalized,
    id: Number(row.id),
    journal_date: dateOnly(row.journal_date),
    locked_at: timestamp(row.locked_at),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
  }
}
