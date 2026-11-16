import { formatCurrency } from "@/lib/currency"
import { addDaysToDate, daysBetweenDates } from "@/lib/date-math"

// Life Patterns (AI_BUILD_PLAN.md Part 0, Stage 5): plain-language things LifeSort
// noticed across weeks. Pure functions only, so they're easy to test. Patterns describe
// what happened together, never a cause, and stay quiet until there's enough data.

export type WeekStats = {
  // The week's Monday, YYYY-MM-DD.
  week: string
  moodAvg: number | null
  journalDays: number
  // Share of planned habit days that got a check-in, 0 to 1. Null with no active habits.
  habitRate: number | null
  tasksDone: number
  // Tasks due that week that still aren't done.
  tasksSlipped: number
  spending: number
}

export type QuietDomain = { id: string; name: string; quietDays: number }

export type PatternInput = {
  // Completed weeks only, oldest first.
  weeks: WeekStats[]
  // Tasks finished per weekday over the same weeks, Monday first.
  doneByWeekday: number[]
  quietDomains: QuietDomain[]
  peopleRemindersDue: number
  currency: string
}

export type PatternKind = "mood" | "habits" | "tasks" | "money" | "journal" | "domains" | "people"

export type Pattern = {
  key: string
  kind: PatternKind
  title: string
  detail: string
  href: string
}

export const PATTERN_WEEKS = 12
const MIN_WEEKS_EACH_SIDE = 2
const MOOD_GAP = 0.5
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

// Monday of the week a date falls in.
export function mondayOf(date: string) {
  const [y, m, d] = date.split("-").map(Number)
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7
  return addDaysToDate(date, -weekday)
}

// The last PATTERN_WEEKS completed weeks before today's week, oldest first.
export function patternWeeks(today: string) {
  const current = mondayOf(today)
  return Array.from({ length: PATTERN_WEEKS }, (_, index) => addDaysToDate(current, -7 * (PATTERN_WEEKS - index)))
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const one = (value: number) => value.toFixed(1)
const percent = (value: number) => `${Math.round(value * 100)}%`

// Average mood in weeks that match versus weeks that don't, when both sides have data.
function moodSplit(weeks: WeekStats[], matches: (week: WeekStats) => boolean | null) {
  const inside: number[] = []
  const outside: number[] = []
  for (const week of weeks) {
    if (week.moodAvg === null) continue
    const result = matches(week)
    if (result === null) continue
    if (result) inside.push(week.moodAvg)
    else outside.push(week.moodAvg)
  }
  if (inside.length < MIN_WEEKS_EACH_SIDE || outside.length < MIN_WEEKS_EACH_SIDE) return null
  return { inside: average(inside) as number, outside: average(outside) as number }
}

function moodAndSlippedTasks(weeks: WeekStats[]): Pattern | null {
  const threshold = Math.max(3, Math.ceil(median(weeks.filter((week) => week.moodAvg !== null).map((week) => week.tasksSlipped))))
  const split = moodSplit(weeks, (week) => week.tasksSlipped >= threshold)
  if (!split || split.outside - split.inside < MOOD_GAP) return null
  return {
    key: "mood-slipped",
    kind: "mood",
    title: "Your mood dipped in weeks when more tasks slipped",
    detail: `Mood averaged ${one(split.inside)} out of 5 in weeks with ${threshold} or more tasks left past their date, and ${one(split.outside)} in other weeks.`,
    href: "/",
  }
}

function moodAndHabits(weeks: WeekStats[]): Pattern | null {
  const split = moodSplit(weeks, (week) => (week.habitRate === null ? null : week.habitRate >= 0.6))
  if (!split || split.inside - split.outside < MOOD_GAP) return null
  return {
    key: "mood-habits",
    kind: "mood",
    title: "You felt better in weeks you kept up your habits",
    detail: `Mood averaged ${one(split.inside)} out of 5 in weeks you did most of your habits, and ${one(split.outside)} in other weeks.`,
    href: "/tasks?tab=habits",
  }
}

function moodAndSpending(weeks: WeekStats[], currency: string): Pattern | null {
  const middle = median(weeks.filter((week) => week.moodAvg !== null && week.spending > 0).map((week) => week.spending))
  if (middle <= 0) return null
  const split = moodSplit(weeks, (week) => week.spending > middle)
  if (!split || split.outside - split.inside < MOOD_GAP) return null
  return {
    key: "mood-spending",
    kind: "money",
    title: "Your mood was lower in weeks you spent more",
    detail: `Mood averaged ${one(split.inside)} out of 5 in weeks you spent over ${formatCurrency(middle, currency)}, and ${one(split.outside)} in other weeks.`,
    href: "/money",
  }
}

function busiestWeekday(doneByWeekday: number[], weekCount: number): Pattern | null {
  const total = doneByWeekday.reduce((sum, value) => sum + value, 0)
  if (total < 10) return null
  const top = doneByWeekday.indexOf(Math.max(...doneByWeekday))
  if (doneByWeekday[top] < 1.5 * (total / 7)) return null
  return {
    key: "weekday",
    kind: "tasks",
    title: `You get the most done on ${WEEKDAYS[top]}s`,
    detail: `${doneByWeekday[top]} of the ${total} tasks you finished in the last ${weekCount} weeks were on a ${WEEKDAYS[top]}.`,
    href: "/tasks",
  }
}

function habitTrend(weeks: WeekStats[]): Pattern | null {
  const rates = (slice: WeekStats[]) => slice.map((week) => week.habitRate).filter((rate): rate is number => rate !== null)
  const recent = rates(weeks.slice(-2))
  const before = rates(weeks.slice(-6, -2))
  if (recent.length < 2 || before.length < 2) return null
  const now = average(recent) as number
  const then = average(before) as number
  if (now <= then - 0.25) {
    return {
      key: "habits-down",
      kind: "habits",
      title: "Habits have been quieter the last two weeks",
      detail: `You did about ${percent(now)} of your planned habit days, down from ${percent(then)}. Picking one small habit back up is enough.`,
      href: "/tasks?tab=habits",
    }
  }
  if (now >= then + 0.25) {
    return {
      key: "habits-up",
      kind: "habits",
      title: "Your habits picked up",
      detail: `You did about ${percent(now)} of your planned habit days in the last two weeks, up from ${percent(then)}.`,
      href: "/tasks?tab=habits",
    }
  }
  return null
}

function journalStreak(weeks: WeekStats[]): Pattern | null {
  const last = weeks.at(-1)
  const usual = average(weeks.slice(-5, -1).map((week) => week.journalDays))
  if (!last || usual === null || last.journalDays < 4 || last.journalDays < usual + 2) return null
  return {
    key: `journal-${last.week}`,
    kind: "journal",
    title: `You wrote in your journal on ${last.journalDays} days last week`,
    detail: `That's more than your usual ${Math.round(usual)} a week.`,
    href: "/library?tab=journal",
  }
}

function spendingSpike(weeks: WeekStats[], currency: string): Pattern | null {
  const last = weeks.at(-1)
  const before = weeks.slice(-5, -1).filter((week) => week.spending > 0)
  if (!last || before.length < 2) return null
  const usual = average(before.map((week) => week.spending)) as number
  if (last.spending < 1.5 * usual) return null
  return {
    key: `spending-${last.week}`,
    kind: "money",
    title: "You spent more than usual last week",
    detail: `${formatCurrency(last.spending, currency)} against a usual ${formatCurrency(usual, currency)} a week.`,
    href: "/money",
  }
}

function quietDomains(domains: QuietDomain[]): Pattern[] {
  return [...domains]
    .sort((a, b) => b.quietDays - a.quietDays)
    .slice(0, 2)
    .map((domain) => ({
      key: `quiet-${domain.id}`,
      kind: "domains" as const,
      title: `${domain.name} has been quiet for ${Math.floor(domain.quietDays / 7)} weeks`,
      detail: "Nothing new there in a while. Worth a look, or fine to leave for now.",
      href: `/domains/${domain.id}`,
    }))
}

function peopleReminders(count: number): Pattern | null {
  if (count < 2) return null
  return {
    key: "people",
    kind: "people",
    title: `${count} catch-ups came up in the last two weeks`,
    detail: "People reminders you set have come due. A short message counts.",
    href: "/library?tab=people",
  }
}

export function findPatterns(input: PatternInput): Pattern[] {
  const found = [
    ...quietDomains(input.quietDomains),
    moodAndSlippedTasks(input.weeks),
    moodAndHabits(input.weeks),
    moodAndSpending(input.weeks, input.currency),
    habitTrend(input.weeks),
    busiestWeekday(input.doneByWeekday, input.weeks.length),
    spendingSpike(input.weeks, input.currency),
    journalStreak(input.weeks),
    peopleReminders(input.peopleRemindersDue),
  ]
  return found.filter((pattern): pattern is Pattern => pattern !== null)
}

// Dismissed patterns stay hidden for four weeks, then may come back if still true.
export const DISMISS_DAYS = 28

export function isDismissed(dismissed: Record<string, string>, key: string, today: string) {
  const on = dismissed[key]
  return Boolean(on) && daysBetweenDates(on, today) < DISMISS_DAYS
}
