import { describe, expect, it } from "vitest"

import { isPlausibleToday, kitStatusSchema, startKitSchema } from "./life-kit-input"

const base = { kit_key: "trip", anchor_date: "2026-12-20", today: "2026-11-16" }

describe("isPlausibleToday", () => {
  const now = new Date("2026-11-16T20:00:00Z")

  it("accepts the server's date and one day either side", () => {
    expect(isPlausibleToday("2026-11-15", now)).toBe(true)
    expect(isPlausibleToday("2026-11-16", now)).toBe(true)
    expect(isPlausibleToday("2026-11-17", now)).toBe(true)
  })

  it("rejects a date further off", () => {
    expect(isPlausibleToday("2026-11-19", now)).toBe(false)
  })
})

describe("startKitSchema", () => {
  it("accepts a minimal kit and defaults skip to empty", () => {
    const parsed = startKitSchema.parse(base)
    expect(parsed.skip).toEqual([])
  })

  it("rejects a key date more than two years out", () => {
    expect(startKitSchema.safeParse({ ...base, anchor_date: "2029-01-01" }).success).toBe(false)
  })

  it("rejects a negative amount and a long label", () => {
    expect(startKitSchema.safeParse({ ...base, amount: -5 }).success).toBe(false)
    expect(startKitSchema.safeParse({ ...base, label: "x".repeat(61) }).success).toBe(false)
  })
})

describe("kitStatusSchema", () => {
  it("only allows active, paused and finished", () => {
    expect(kitStatusSchema.safeParse({ status: "paused", today: "2026-11-16" }).success).toBe(true)
    expect(kitStatusSchema.safeParse({ status: "removed", today: "2026-11-16" }).success).toBe(false)
  })
})
