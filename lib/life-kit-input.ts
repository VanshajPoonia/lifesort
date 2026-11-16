import { z } from "zod"

import { addDaysToDate } from "@/lib/date-math"

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")

// The browser sends its own date so kits follow the person's day, not the server's.
// It may differ from the server's UTC date by a day either way.
export function isPlausibleToday(today: string, now = new Date()) {
  const serverDay = now.toISOString().slice(0, 10)
  return today >= addDaysToDate(serverDay, -1) && today <= addDaysToDate(serverDay, 1)
}

export const startKitSchema = z
  .object({
    kit_key: z.string().min(1).max(50),
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

export const kitStatusSchema = z.object({
  status: z.enum(["active", "paused", "finished"]),
  today: dateString,
})
