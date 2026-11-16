import { describe, expect, it } from "vitest"

import { findPatterns, isDismissed, mondayOf, patternWeeks, type PatternInput, type WeekStats } from "./life-patterns"

const week = (index: number, stats: Partial<WeekStats> = {}): WeekStats => ({
  week: `2026-08-${String(3 + index * 7).padStart(2, "0")}`,
  moodAvg: null,
  journalDays: 0,
  habitRate: null,
  tasksDone: 0,
  tasksSlipped: 0,
  spending: 0,
  ...stats,
})

const input = (weeks: WeekStats[], extra: Partial<PatternInput> = {}): PatternInput => ({
  weeks,
  doneByWeekday: [0, 0, 0, 0, 0, 0, 0],
  quietDomains: [],
  peopleRemindersDue: 0,
  currency: "INR",
  ...extra,
})

const keys = (value: PatternInput) => findPatterns(value).map((pattern) => pattern.key)

describe("weeks", () => {
  it("finds the Monday of any day", () => {
    expect(mondayOf("2026-11-16")).toBe("2026-11-16")
    expect(mondayOf("2026-11-22")).toBe("2026-11-16")
    expect(mondayOf("2026-11-17")).toBe("2026-11-16")
  })

  it("lists twelve completed weeks before today's week", () => {
    const weeks = patternWeeks("2026-11-18")
    expect(weeks).toHaveLength(12)
    expect(weeks.at(-1)).toBe("2026-11-09")
    expect(weeks[0]).toBe("2026-08-24")
  })
})

describe("findPatterns", () => {
  it("says nothing without data", () => {
    expect(findPatterns(input([0, 1, 2, 3].map((index) => week(index))))).toEqual([])
  })

  it("notices lower mood in weeks with more slipped tasks", () => {
    const weeks = [
      week(0, { moodAvg: 4, tasksSlipped: 1 }),
      week(1, { moodAvg: 4.2, tasksSlipped: 0 }),
      week(2, { moodAvg: 2.8, tasksSlipped: 6 }),
      week(3, { moodAvg: 3, tasksSlipped: 5 }),
    ]
    const pattern = findPatterns(input(weeks)).find((item) => item.key === "mood-slipped")
    expect(pattern?.detail).toBe("Mood averaged 2.9 out of 5 in weeks with 3 or more tasks left past their date, and 4.1 in other weeks.")
  })

  it("needs two weeks on each side before comparing mood", () => {
    const weeks = [week(0, { moodAvg: 4, tasksSlipped: 0 }), week(1, { moodAvg: 2, tasksSlipped: 8 }), week(2, { moodAvg: 4.1, tasksSlipped: 1 })]
    expect(keys(input(weeks))).not.toContain("mood-slipped")
  })

  it("notices better mood in weeks with most habits done", () => {
    const weeks = [
      week(0, { moodAvg: 4, habitRate: 0.8 }),
      week(1, { moodAvg: 4.4, habitRate: 0.7 }),
      week(2, { moodAvg: 3, habitRate: 0.2 }),
      week(3, { moodAvg: 3.2, habitRate: 0.3 }),
    ]
    expect(keys(input(weeks))).toContain("mood-habits")
  })

  it("notices habits slowing down without blame", () => {
    const weeks = [0.8, 0.8, 0.9, 0.7, 0.3, 0.2].map((habitRate, index) => week(index, { habitRate }))
    const pattern = findPatterns(input(weeks)).find((item) => item.key === "habits-down")
    expect(pattern?.title).toBe("Habits have been quieter the last two weeks")
    expect(pattern?.detail).toContain("25%")
  })

  it("names the busiest weekday only when it clearly stands out", () => {
    const weeks = [0, 1, 2, 3].map((index) => week(index))
    expect(keys(input(weeks, { doneByWeekday: [2, 9, 2, 2, 2, 1, 0] }))).toContain("weekday")
    expect(keys(input(weeks, { doneByWeekday: [3, 3, 3, 3, 3, 2, 1] }))).not.toContain("weekday")
  })

  it("flags a spending spike in the last week, keyed to that week", () => {
    const weeks = [1000, 1200, 900, 1100, 3000].map((spending, index) => week(index, { spending }))
    const pattern = findPatterns(input(weeks)).find((item) => item.kind === "money")
    expect(pattern?.key).toBe(`spending-${weeks[4].week}`)
    expect(pattern?.detail).toContain("₹3,000")
  })

  it("lists the two quietest domains", () => {
    const quietDomains = [
      { id: "1", name: "Health", quietDays: 30 },
      { id: "2", name: "Friends", quietDays: 50 },
      { id: "3", name: "Learning", quietDays: 22 },
    ]
    const titles = findPatterns(input([], { quietDomains })).map((pattern) => pattern.title)
    expect(titles).toEqual(["Friends has been quiet for 7 weeks", "Health has been quiet for 4 weeks"])
  })
})

describe("isDismissed", () => {
  it("hides a pattern for four weeks after dismissing it", () => {
    expect(isDismissed({ weekday: "2026-11-01" }, "weekday", "2026-11-17")).toBe(true)
    expect(isDismissed({ weekday: "2026-10-01" }, "weekday", "2026-11-17")).toBe(false)
    expect(isDismissed({}, "weekday", "2026-11-17")).toBe(false)
  })
})
