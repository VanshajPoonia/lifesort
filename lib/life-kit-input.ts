import { z } from "zod"

import { addDaysToDate } from "@/lib/date-math"
import { DEFAULT_LIFE_AREAS } from "@/lib/life-areas"

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")

// The browser sends its own date so kits follow the person's day, not the server's.
// It may differ from the server's UTC date by a day either way.
export function isPlausibleToday(today: string, now = new Date()) {
  const serverDay = now.toISOString().slice(0, 10)
  return today >= addDaysToDate(serverDay, -1) && today <= addDaysToDate(serverDay, 1)
}

// A kit drafted by the AI from "Describe your situation" (KitDraft in lib/life-kits.ts).
// Also the AI's output schema, so it sticks to constraints Gemini accepts.
export const kitDraftSchema = z.object({
  name: z.string().trim().min(1).max(60),
  summary: z.string().trim().max(160),
  kind: z.enum(["start", "deadline"]),
  date_label: z.string().trim().min(1).max(80),
  date_offset_days: z.number().int().min(-365).max(730),
  length_days: z.number().int().min(0).max(365),
  domain_name: z.string().trim().min(1).max(50),
  phases: z
    .array(z.object({ name: z.string().trim().min(1).max(40), from: z.number().int().min(-3650).max(3650), to: z.number().int().min(-3650).max(3650) }))
    .max(8),
  goal: z.object({ title: z.string().trim().min(1).max(120), day: z.number().int().min(-365).max(730) }),
  tasks: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        day: z.number().int().min(-365).max(730),
        from_start: z.boolean(),
        priority: z.enum(["low", "medium", "high"]),
      }),
    )
    .min(1)
    .max(20),
  habits: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        frequency: z.enum(["daily", "weekly", "custom"]),
        days: z.array(z.number().int().min(0).max(6)).max(7),
      }),
    )
    .max(4),
  budget_category: z.string().trim().min(1).max(100).nullable(),
  prompts: z.array(z.string().trim().min(1).max(160)).max(4),
})

export const kitDescriptionSchema = z.object({
  description: z.string().trim().min(10, "Say a little more about what's going on.").max(600, "Keep it under 600 characters."),
  today: dateString,
})

export const startKitSchema = z
  .object({
    kit_key: z.string().min(1).max(50),
    draft: kitDraftSchema.nullish(),
    anchor_date: dateString,
    today: dateString,
    label: z.string().trim().max(60).nullish(),
    amount: z.number().positive().max(1_000_000_000_000).nullish(),
    life_area_id: z.number().int().positive().nullish(),
    skip: z.array(z.string().max(40)).max(50).default([]),
  })
  .refine((value) => value.anchor_date >= addDaysToDate(value.today, -365) && value.anchor_date <= addDaysToDate(value.today, 730), {
    message: "Pick a date within the next two years",
    path: ["anchor_date"],
  })
  .refine((value) => value.kit_key !== "custom" || Boolean(value.draft), { message: "A custom kit needs its draft", path: ["draft"] })

export const kitStatusSchema = z.object({
  status: z.enum(["active", "paused", "finished"]),
  today: dateString,
})

// Prompt for "Describe your situation". Only the person's description, today's date and
// the default domain names go to the AI, never their stored data.
export function buildKitDraftPrompt(description: string, today: string) {
  const domains = DEFAULT_LIFE_AREAS.map((area) => area.name).join(", ")
  return `You design a LifeSort Life Kit: a plan for one life situation, built from one key date.
Today is ${today}. The person wrote: "${description}"

Rules:
- kind "start" when the situation begins on a date and runs for a while (a course, a new routine). kind "deadline" when it counts down to a date (an event, a move, an exam).
- date_label is the question that asks for the key date, like "When is the wedding?". date_offset_days is your best guess of that date in days from today, 0 if unclear.
- length_days: for start kits, how long it runs (7 to 365). For deadline kits, days of follow-up after the date (0 to 30).
- Task dates: a step meant for right now (this week) uses from_start true and day 0 to 7, counted from today. Every other step uses from_start false and day counted from the key date: -14 is two weeks before it, 0 is the day itself, 7 is a week after.
- 5 to 10 tasks. Small and concrete, doable in one sitting, in plain words without emojis. Spread them out, at most 2 on one day. Mark the 1 to 3 most important as high priority.
- goal is one outcome, with day for when it should be done.
- phases: 2 to 4 named stretches, in days relative to the key date, in order, covering the kit.
- habits: 0 to 2, only if a repeated action clearly helps. A custom habit lists days from 0 = Sunday to 6 = Saturday. Other habits leave days empty.
- budget_category: a short name only when money is involved, otherwise null.
- prompts: 1 or 2 gentle reflection questions.
- domain_name: the best fit from ${domains}. Use a new short name only if none fit.
- name is 2 to 4 words. summary is one sentence.
- No guilt or pressure. No made-up facts or personal details. For medical, legal or money decisions, suggest checking with a professional instead of advising.`
}
