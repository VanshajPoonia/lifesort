// Habit streaks count weeks, not days, so one missed day never wipes a streak
// (AI_BUILD_PLAN.md Part 0, "No guilt"). Weeks start on Monday.
//
// A week counts when the habit was done on more than half of its planned days:
// daily habits need 4 of 7, a 3-day custom habit needs 2, a weekly habit needs 1.
// The current week only adds to a streak once it counts. While it is still in
// progress it never breaks one.

export type HabitStreakInput = {
  frequency: string
  customDays: number[]
  targetCount: number
  checkins: Array<{ date: string; count: number }>
}

export type HabitStreakStats = {
  current_streak: number
  best_streak: number
  week_done: number
  week_goal: number
  completion_week: number
  completion_month: number
}

const DAY_MS = 86_400_000
export const STREAK_WINDOW_WEEKS = 26

function toDayNumber(key: string) {
  const [year, month, day] = key.split("-").map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS)
}

export function plannedDaysPerWeek(frequency: string, customDays: number[]) {
  if (frequency === "weekly") return 1
  if (frequency === "custom") {
    const days = new Set(customDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))
    return days.size || 1
  }
  return 7
}

export function weeklyGoal(plannedDays: number) {
  return plannedDays <= 1 ? 1 : Math.floor(plannedDays / 2) + 1
}

export function computeHabitStreak(input: HabitStreakInput, today: string): HabitStreakStats {
  const target = Math.max(1, input.targetCount || 1)
  const doneDays = new Set(
    input.checkins.filter((checkin) => checkin.count >= target).map((checkin) => toDayNumber(checkin.date)),
  )
  const todayNumber = toDayNumber(today)
  // 1970-01-01 was a Thursday, so (n + 3) % 7 gives Monday = 0.
  const currentMonday = todayNumber - ((todayNumber + 3) % 7)
  const goal = weeklyGoal(plannedDaysPerWeek(input.frequency, input.customDays))

  const doneInWeek = (monday: number) => {
    let done = 0
    for (let day = monday; day < monday + 7 && day <= todayNumber; day++) {
      if (doneDays.has(day)) done++
    }
    return done
  }

  // met[0] is the current week, met[1] last week, and so on.
  const met = Array.from({ length: STREAK_WINDOW_WEEKS }, (_, index) => doneInWeek(currentMonday - index * 7) >= goal)

  let current = 0
  for (let index = met[0] ? 0 : 1; index < met.length && met[index]; index++) current++

  let best = 0
  let run = 0
  for (const weekMet of met) {
    run = weekMet ? run + 1 : 0
    best = Math.max(best, run)
  }

  const doneInLast = (days: number) => {
    let done = 0
    for (let day = todayNumber - days + 1; day <= todayNumber; day++) {
      if (doneDays.has(day)) done++
    }
    return done
  }

  return {
    current_streak: current,
    best_streak: Math.max(best, current),
    week_done: doneInWeek(currentMonday),
    week_goal: goal,
    completion_week: Math.round((doneInLast(7) / 7) * 100),
    completion_month: Math.round((doneInLast(30) / 30) * 100),
  }
}
