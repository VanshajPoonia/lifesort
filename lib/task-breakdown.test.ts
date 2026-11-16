import { describe, expect, it } from "vitest"

import { breakdownSchema, buildBreakdownPrompt, totalMinutes } from "./task-breakdown"

describe("totalMinutes", () => {
  it("adds steps and rounds up to 15 minutes", () => {
    expect(totalMinutes([{ minutes: 20 }, { minutes: 15 }])).toBe(45)
    expect(totalMinutes([{ minutes: 10 }, { minutes: 10 }])).toBe(30)
    expect(totalMinutes([])).toBe(0)
  })
})

describe("breakdownSchema", () => {
  it("needs two to eight steps with sane minutes", () => {
    expect(breakdownSchema.safeParse({ steps: [{ title: "Call", minutes: 10 }] }).success).toBe(false)
    expect(breakdownSchema.safeParse({ steps: [{ title: "Call", minutes: 10 }, { title: "Email", minutes: 500 }] }).success).toBe(false)
    expect(breakdownSchema.safeParse({ steps: [{ title: "Call", minutes: 10 }, { title: "Email", minutes: 15 }] }).success).toBe(true)
  })
})

describe("buildBreakdownPrompt", () => {
  it("includes the notes and existing steps only when there are some", () => {
    const bare = buildBreakdownPrompt({ title: "File taxes", description: null }, [])
    expect(bare).not.toContain("Notes:")
    expect(bare).not.toContain("already listed")
    const full = buildBreakdownPrompt({ title: "File taxes", description: "Freelance income this year" }, ["Find last year's return"])
    expect(full).toContain('Notes: "Freelance income this year"')
    expect(full).toContain('"Find last year\'s return"')
  })
})
