import { addDaysToDate, daysBetweenDates } from "@/lib/date-math"
import { sql } from "@/lib/db"
import { plannedDaysPerWeek } from "@/lib/habit-streaks"
import { getIgnoringInsightsData } from "@/lib/ignoring-insights"
import { findPatterns, isDismissed, patternWeeks, type Pattern, type QuietDomain, type WeekStats } from "@/lib/life-patterns"

// Database side of Life Patterns. Rows tied to a domain marked is_ai_excluded are left
// out everywhere, because the feed can be sent to the AI for an explanation.

type Row = Record<string, unknown>

export type PatternFeed = {
  last_week: string
  patterns: Pattern[]
  // Older one-off signals (stale goals, renewals due) from lib/ignoring-insights.ts.
  worth_a_look: Pattern[]
}

function isMissingSchema(error: unknown) {
  const err = error as { code?: string; message?: string }
  return err.code === "42P01" || err.code === "42703" || (err.message?.toLowerCase() ?? "").includes("does not exist")
}

async function rows(query: Promise<Row[]>) {
  try {
    return await query
  } catch (error) {
    if (isMissingSchema(error)) return []
    throw error
  }
}

const num = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0)) || 0
const dateText = (value: unknown) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").slice(0, 10))

async function weeklyNumbers(userId: string, weeks: string[], excluded: number[]) {
  const from = weeks[0]
  const to = addDaysToDate(weeks[weeks.length - 1], 6)
  const afterTo = addDaysToDate(to, 1)

  const [journal, habits, checkins, done, slipped, spending] = await Promise.all([
    rows(sql`
      SELECT date_trunc('week', journal_date)::date::text AS week, avg(mood)::float AS mood,
        count(*) FILTER (WHERE mood IS NOT NULL OR coalesce(what_went_well, '') <> '' OR coalesce(notes_from_today, '') <> '') AS days
      FROM daily_journal_entries
      WHERE user_id = ${userId} AND journal_date BETWEEN ${from} AND ${to}
        AND (life_area_id IS NULL OR NOT (life_area_id = ANY(${excluded}::integer[])))
      GROUP BY 1
    `),
    rows(sql`
      SELECT frequency, custom_days, created_at::date::text AS created
      FROM habits
      WHERE user_id = ${userId} AND is_active
        AND (life_area_id IS NULL OR NOT (life_area_id = ANY(${excluded}::integer[])))
    `),
    rows(sql`
      SELECT date_trunc('week', c.checkin_date)::date::text AS week, count(DISTINCT (c.habit_id, c.checkin_date)) AS done
      FROM habit_checkins c JOIN habits h ON h.id = c.habit_id
      WHERE c.user_id = ${userId} AND h.is_active AND c.checkin_date BETWEEN ${from} AND ${to}
        AND (h.life_area_id IS NULL OR NOT (h.life_area_id = ANY(${excluded}::integer[])))
      GROUP BY 1
    `),
    rows(sql`
      SELECT date_trunc('week', updated_at)::date::text AS week, extract(isodow FROM updated_at)::int AS weekday, count(*) AS done
      FROM tasks
      WHERE user_id = ${userId} AND completed AND status = 'completed' AND updated_at >= ${from} AND updated_at < ${afterTo}
        AND (life_area_id IS NULL OR NOT (life_area_id = ANY(${excluded}::integer[])))
      GROUP BY 1, 2
    `),
    rows(sql`
      SELECT date_trunc('week', due_date)::date::text AS week, count(*) AS slipped
      FROM tasks
      WHERE user_id = ${userId} AND due_date BETWEEN ${from} AND ${to} AND NOT completed AND status <> 'cancelled'
        AND (life_area_id IS NULL OR NOT (life_area_id = ANY(${excluded}::integer[])))
      GROUP BY 1
    `),
    rows(sql`
      SELECT date_trunc('week', t.date)::date::text AS week, sum(t.amount)::float AS spent
      FROM budget_transactions t LEFT JOIN budget_categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId} AND t.type = 'expense' AND t.date BETWEEN ${from} AND ${to}
        AND (c.life_area_id IS NULL OR NOT (c.life_area_id = ANY(${excluded}::integer[])))
      GROUP BY 1
    `),
  ])

  const byWeek = (list: Row[], field: string) => new Map(list.map((row) => [String(row.week), row[field]]))
  const mood = byWeek(journal, "mood")
  const journalDays = byWeek(journal, "days")
  const checkinsByWeek = byWeek(checkins, "done")
  const slippedByWeek = byWeek(slipped, "slipped")
  const spentByWeek = byWeek(spending, "spent")
  const doneByWeek = new Map<string, number>()
  const doneByWeekday = [0, 0, 0, 0, 0, 0, 0]
  for (const row of done) {
    doneByWeek.set(String(row.week), (doneByWeek.get(String(row.week)) ?? 0) + num(row.done))
    doneByWeekday[num(row.weekday) - 1] += num(row.done)
  }

  const stats: WeekStats[] = weeks.map((week) => {
    const weekEnd = addDaysToDate(week, 6)
    // Only habits that existed by the end of the week count toward that week's plan.
    const planned = habits
      .filter((habit) => String(habit.created) <= weekEnd)
      .reduce((sum, habit) => sum + plannedDaysPerWeek(String(habit.frequency), (habit.custom_days as number[] | null) ?? []), 0)
    const moodValue = mood.get(week)
    return {
      week,
      moodAvg: moodValue === null || moodValue === undefined ? null : num(moodValue),
      journalDays: num(journalDays.get(week)),
      habitRate: planned > 0 ? Math.min(1, num(checkinsByWeek.get(week)) / planned) : null,
      tasksDone: doneByWeek.get(week) ?? 0,
      tasksSlipped: num(slippedByWeek.get(week)),
      spending: num(spentByWeek.get(week)),
    }
  })

  return { stats, doneByWeekday }
}

// A domain is quiet when it had activity in the last 12 weeks and none for 3 weeks, or
// when the person said it needs high attention and nothing happened there for 3 weeks.
async function quietDomains(userId: string, today: string): Promise<QuietDomain[]> {
  const domains = await rows(sql`
    SELECT la.id::text AS id, la.name, la.desired_attention, la.created_at::date::text AS created,
      GREATEST(
        (SELECT max(t.updated_at) FROM tasks t WHERE t.user_id = ${userId} AND t.life_area_id = la.id),
        (SELECT max(g.updated_at) FROM goals g WHERE g.user_id = ${userId} AND g.life_area_id = la.id),
        (SELECT max(n.updated_at) FROM notes n WHERE n.user_id = ${userId} AND n.life_area_id = la.id),
        (SELECT max(j.updated_at) FROM daily_journal_entries j WHERE j.user_id = ${userId} AND j.life_area_id = la.id),
        (SELECT max(c.checkin_date)::timestamp FROM habit_checkins c JOIN habits h ON h.id = c.habit_id
          WHERE c.user_id = ${userId} AND h.life_area_id = la.id)
      )::date::text AS last_activity
    FROM life_areas la
    WHERE la.user_id = ${userId} AND la.status = 'active' AND NOT la.is_ai_excluded
  `)

  return domains.flatMap((domain) => {
    const last = domain.last_activity ? String(domain.last_activity) : null
    const quietDays = daysBetweenDates(last ?? String(domain.created), today)
    const wentQuiet = last !== null && quietDays >= 21 && quietDays <= 84
    const wantedAttention = domain.desired_attention === "high" && quietDays >= 21
    return wentQuiet || wantedAttention ? [{ id: String(domain.id), name: String(domain.name), quietDays }] : []
  })
}

export async function getPatternFeed(userId: string, today: string): Promise<PatternFeed> {
  const weeks = patternWeeks(today)
  const [areas, profile, people] = await Promise.all([
    rows(sql`SELECT id FROM life_areas WHERE user_id = ${userId} AND is_ai_excluded`),
    rows(sql`SELECT preferred_currency, app_preferences -> 'dismissed_patterns' AS dismissed FROM users WHERE id = ${userId}`),
    rows(sql`
      SELECT count(*) AS due
      FROM people_reminders r JOIN people p ON p.id = r.person_id
      WHERE r.user_id = ${userId} AND r.remind_at::date BETWEEN ${addDaysToDate(today, -14)} AND ${today}
        AND (p.life_area_id IS NULL OR NOT (p.life_area_id = ANY(
          SELECT id FROM life_areas WHERE user_id = ${userId} AND is_ai_excluded
        )))
    `),
  ])
  const excluded = areas.map((area) => num(area.id))
  const dismissed = (profile[0]?.dismissed as Record<string, string> | null) ?? {}

  const [{ stats, doneByWeekday }, quiet, ignoring] = await Promise.all([
    weeklyNumbers(userId, weeks, excluded),
    quietDomains(userId, today),
    getIgnoringInsightsData(userId),
  ])

  const patterns = findPatterns({
    weeks: stats,
    doneByWeekday,
    quietDomains: quiet,
    peopleRemindersDue: num(people[0]?.due),
    currency: String(profile[0]?.preferred_currency ?? "USD"),
  })

  // Quiet domains already come from the patterns above, so their signals are skipped.
  const severity = { high: 0, medium: 1, low: 2 }
  const worthALook: Pattern[] = ignoring.signals
    .filter((signal) => signal.source !== "life_area" && signal.severity !== "low")
    .sort((a, b) => severity[a.severity] - severity[b.severity])
    .slice(0, 3)
    .map((signal) => ({ key: `signal-${signal.id}`, kind: "tasks", title: signal.title, detail: signal.description, href: signal.href }))

  return {
    last_week: weeks[weeks.length - 1],
    patterns: patterns.filter((pattern) => !isDismissed(dismissed, pattern.key, today)),
    worth_a_look: worthALook.filter((pattern) => !isDismissed(dismissed, pattern.key, today)),
  }
}

export async function dismissPattern(userId: string, key: string, today: string) {
  const current = await rows(sql`SELECT app_preferences -> 'dismissed_patterns' AS dismissed FROM users WHERE id = ${userId}`)
  const dismissed = (current[0]?.dismissed as Record<string, string> | null) ?? {}
  // Drop entries old enough to have expired so the list stays small.
  const kept = Object.fromEntries(Object.entries(dismissed).filter(([, on]) => daysBetweenDates(dateText(on), today) < 60))
  kept[key] = today
  await sql`
    UPDATE users
    SET app_preferences = jsonb_set(COALESCE(app_preferences, '{}'::jsonb), '{dismissed_patterns}', ${JSON.stringify(kept)}::jsonb)
    WHERE id = ${userId}
  `
}
