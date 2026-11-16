import { describe, expect, it } from "vitest"

import { LIFE_KITS, definitionFromDraft, getKitDefinition, kitProgress, planKit, type PlannedKitItem } from "./life-kits"

const kit = (key: string) => {
  const definition = getKitDefinition(key)
  if (!definition) throw new Error(`missing kit ${key}`)
  return definition
}
const tasks = (items: PlannedKitItem[]) => items.filter((item) => item.type === "task") as Extract<PlannedKitItem, { type: "task" }>[]
const none = { label: null, amount: null }

describe("LIFE_KITS", () => {
  it("has the eight kits the user picked, each with a unique key", () => {
    expect(LIFE_KITS.map((item) => item.key)).toEqual([
      "new-semester",
      "new-job",
      "moving-house",
      "getting-fit",
      "saving-for-something",
      "job-search",
      "trip",
      "renewing-documents",
    ])
  })

  it("never plans a task before today, for any kit and key date", () => {
    for (const definition of LIFE_KITS) {
      for (const offset of [-40, -3, 0, 2, 10, 90]) {
        const anchor = new Date(Date.UTC(2026, 10, 16 + offset)).toISOString().slice(0, 10)
        const plan = planKit(definition, anchor, "2026-11-16", none)
        for (const task of tasks(plan.items)) expect(task.date >= "2026-11-16").toBe(true)
      }
    }
  })
})

describe("planKit", () => {
  it("dates a semester's steps from the first day of class", () => {
    const plan = planKit(kit("new-semester"), "2026-11-20", "2026-11-16", none)
    const byTitle = Object.fromEntries(tasks(plan.items).map((task) => [task.title, task.date]))
    expect(byTitle["Buy or borrow your textbooks"]).toBe("2026-11-18")
    expect(byTitle["Make a midterm study plan"]).toBe("2027-01-01")
    expect(plan.skippedPast).toBe(0)
  })

  it("skips a start kit's steps that already passed", () => {
    const plan = planKit(kit("new-semester"), "2026-10-26", "2026-11-16", none)
    expect(tasks(plan.items).some((task) => task.title === "Buy or borrow your textbooks")).toBe(false)
    expect(plan.skippedPast).toBe(6)
  })

  it("spreads a close move's late steps one a day from today, before moving day", () => {
    const plan = planKit(kit("moving-house"), "2026-11-21", "2026-11-16", none)
    const dates = tasks(plan.items).map((task) => task.date)
    const beforeMove = dates.filter((date) => date < "2026-11-21")
    expect(beforeMove.length).toBeGreaterThan(0)
    expect(new Set(beforeMove).size).toBeLessThanOrEqual(5)
    expect(dates).toContain("2026-11-16")
    expect(plan.skippedPast).toBe(0)
  })

  it("uses the label and amount in a saving kit", () => {
    const plan = planKit(kit("saving-for-something"), "2027-05-16", "2026-11-16", { label: "a laptop", amount: 80000 })
    expect(plan.title).toBe("Saving for a laptop")
    expect(plan.items[0]).toMatchObject({ type: "goal", title: "Save 80,000 for a laptop", targetDate: "2027-05-16", targetValue: 80000 })
    expect(plan.items).toContainEqual(expect.objectContaining({ type: "budget_category", name: "Savings: a laptop" }))
  })

  it("files a document kit in the Vault with its expiry", () => {
    const plan = planKit(kit("renewing-documents"), "2027-02-01", "2026-11-16", { label: "passport", amount: null })
    expect(plan.items).toContainEqual(
      expect.objectContaining({ type: "vault_item", title: "Passport", expiryDate: "2027-02-01", reminderDate: "2026-12-03" }),
    )
  })

  it("plans the workout habit for Monday, Wednesday and Friday", () => {
    const plan = planKit(kit("getting-fit"), "2026-11-16", "2026-11-16", none)
    expect(plan.items).toContainEqual(expect.objectContaining({ type: "habit", name: "Workout", frequency: "custom", customDays: [1, 3, 5] }))
  })
})

describe("kitProgress", () => {
  it("shows the week of a start kit", () => {
    expect(kitProgress(kit("new-semester"), "2026-11-02", "2026-11-02", "2026-11-16")).toMatchObject({
      line: "Week 3 of 15",
      phase: "Steady weeks",
    })
  })

  it("counts down before a start kit begins", () => {
    expect(kitProgress(kit("new-job"), "2026-11-23", "2026-11-16", "2026-11-16")).toMatchObject({
      line: "Starts in 7 days",
      phase: "Before day one",
    })
  })

  it("counts down to a deadline kit's day", () => {
    const progress = kitProgress(kit("moving-house"), "2026-12-04", "2026-11-04", "2026-11-16")
    expect(progress.line).toBe("18 days to go")
    expect(progress.phase).toBe("Packing")
    expect(progress.percent).toBe(40)
    expect(progress.ended).toBe(false)
  })

  it("ends a deadline kit after its follow-up days", () => {
    expect(kitProgress(kit("moving-house"), "2026-11-01", "2026-10-01", "2026-11-16").ended).toBe(true)
  })
})

describe("definitionFromDraft", () => {
  const draft = {
    name: "New puppy",
    summary: "Get ready for a puppy.",
    kind: "deadline" as const,
    date_label: "When does the puppy come home?",
    date_offset_days: 21,
    length_days: 14,
    domain_name: "Home",
    phases: [{ name: "Getting ready", from: -60, to: -1 }],
    goal: { title: "Settle the puppy in", day: 14 },
    tasks: [
      { title: "Set a budget for supplies", day: 1, from_start: true, priority: "high" as const },
      { title: "Buy a crate and bowls", day: -10, from_start: false, priority: "medium" as const },
    ],
    habits: [{ name: "Short training session", frequency: "daily" as const, days: [] }],
    budget_category: "Puppy",
    prompts: ["What surprised you this week?"],
  }

  it("plans a drafted kit like a built-in one", () => {
    const plan = planKit(definitionFromDraft(draft), "2026-12-07", "2026-11-16", none)
    expect(plan.title).toBe("New puppy")
    expect(tasks(plan.items).map((task) => [task.title, task.date])).toEqual([
      ["Set a budget for supplies", "2026-11-17"],
      ["Buy a crate and bowls", "2026-11-27"],
    ])
    expect(plan.items).toContainEqual(expect.objectContaining({ type: "budget_category", name: "Puppy" }))
    expect(kitProgress(definitionFromDraft(draft), "2026-12-07", "2026-11-16", "2026-11-16").line).toBe("21 days to go")
  })
})
