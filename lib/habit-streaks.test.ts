import { describe, expect, it } from "vitest"

import { computeHabitStreak, plannedDaysPerWeek, weeklyGoal } from "@/lib/habit-streaks"

// 2026-11-11 is a Wednesday. Its week runs Mon 2026-11-09 to Sun 2026-11-15.
const TODAY = "2026-11-11"

function days(...keys: string[]) {
  return keys.map((date) => ({ date, count: 1 }))
}

function daily(checkins: Array<{ date: string; count: number }>) {
  return { frequency: "daily", customDays: [], targetCount: 1, checkins }
}

describe("weeklyGoal", () => {
  it("needs more than half of the planned days", () => {
    expect(weeklyGoal(plannedDaysPerWeek("daily", []))).toBe(4)
    expect(weeklyGoal(plannedDaysPerWeek("custom", [1, 3, 5]))).toBe(2)
    expect(weeklyGoal(plannedDaysPerWeek("weekly", []))).toBe(1)
  })

  it("treats a custom habit with no days as once a week", () => {
    expect(plannedDaysPerWeek("custom", [])).toBe(1)
  })
})

describe("computeHabitStreak", () => {
  it("is zero with no check-ins", () => {
    expect(computeHabitStreak(daily([]), TODAY).current_streak).toBe(0)
  })

  it("keeps the streak when one day a week is missed", () => {
    const checkins = days(
      // Week of Oct 26: 6 of 7
      "2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31",
      // Week of Nov 2: 6 of 7
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-06", "2026-11-07", "2026-11-08",
    )
    expect(computeHabitStreak(daily(checkins), TODAY).current_streak).toBe(2)
  })

  it("does not break the streak while this week is still in progress", () => {
    const checkins = days(
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05",
      // Only one day so far this week
      "2026-11-09",
    )
    const stats = computeHabitStreak(daily(checkins), TODAY)
    expect(stats.current_streak).toBe(1)
    expect(stats.week_done).toBe(1)
    expect(stats.week_goal).toBe(4)
  })

  it("counts this week once it reaches the goal", () => {
    const checkins = days(
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05",
      "2026-11-09", "2026-11-10", "2026-11-11",
    )
    // 3 days this week is not enough yet, so only last week counts.
    expect(computeHabitStreak(daily(checkins), TODAY).current_streak).toBe(1)
    // A 4th day on Thursday makes this week count too.
    const thursday = [...checkins, { date: "2026-11-12", count: 1 }]
    expect(computeHabitStreak(daily(thursday), "2026-11-12").current_streak).toBe(2)
  })

  it("ignores check-ins after today", () => {
    const checkins = days("2026-11-09", "2026-11-10", "2026-11-11", "2026-11-14")
    expect(computeHabitStreak(daily(checkins), TODAY).week_done).toBe(3)
  })

  it("resets after a week that fell short, but remembers the best run", () => {
    const checkins = days(
      // Weeks of Oct 12 and Oct 19 met the goal
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15",
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22",
      // Week of Oct 26 fell short (2 days)
      "2026-10-26", "2026-10-27",
      // Week of Nov 2 met the goal
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05",
    )
    const stats = computeHabitStreak(daily(checkins), TODAY)
    expect(stats.current_streak).toBe(1)
    expect(stats.best_streak).toBe(2)
  })

  it("counts weekly habits with one check-in a week", () => {
    const stats = computeHabitStreak(
      { frequency: "weekly", customDays: [], targetCount: 1, checkins: days("2026-10-20", "2026-10-28", "2026-11-03", "2026-11-10") },
      TODAY,
    )
    expect(stats.current_streak).toBe(4)
  })

  it("ignores days below the target count", () => {
    const checkins = [
      { date: "2026-11-02", count: 1 },
      { date: "2026-11-03", count: 1 },
      { date: "2026-11-04", count: 1 },
      { date: "2026-11-05", count: 1 },
    ]
    expect(computeHabitStreak({ ...daily(checkins), targetCount: 2 }, TODAY).current_streak).toBe(0)
  })
})
