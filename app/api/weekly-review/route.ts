import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

type Row = Record<string, unknown>

function isValidDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function dateFromString(value: string) {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function addDays(value: string, days: number) {
  const date = dateFromString(value)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function weekRangeFor(value: string) {
  const date = dateFromString(value)
  const day = date.getUTCDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  date.setUTCDate(date.getUTCDate() + diffToMonday)
  const weekStart = date.toISOString().slice(0, 10)
  const weekEnd = addDays(weekStart, 6)
  const nextWeekStart = addDays(weekStart, 7)
  return { weekStart, weekEnd, nextWeekStart }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || 0))
  return Number.isFinite(parsed) ? parsed : 0
}

function toIsoDate(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function safeRows(label: string, query: Promise<Row[]>, unavailable: string[]): Promise<Row[]> {
  try {
    return await query
  } catch (error) {
    console.error(`[weekly-review] ${label} query failed:`, error)
    unavailable.push(label)
    return []
  }
}

async function safeReview(userId: string, weekStart: string, unavailable: string[]) {
  try {
    const rows = await sql`
      SELECT *
      FROM weekly_reviews
      WHERE user_id = ${userId} AND week_start = ${weekStart}
      LIMIT 1
    `
    return rows[0] || null
  } catch (error) {
    console.error("[weekly-review] weekly_reviews query failed:", error)
    unavailable.push("saved review")
    return null
  }
}

async function safeHistory(userId: string, weekStart: string, unavailable: string[]) {
  try {
    return await sql`
      SELECT id, week_start, week_end, reflection_wins, reflection_next_week_focus, updated_at, created_at
      FROM weekly_reviews
      WHERE user_id = ${userId} AND week_start <> ${weekStart}
      ORDER BY week_start DESC
      LIMIT 12
    `
  } catch (error) {
    console.error("[weekly-review] weekly_reviews history query failed:", error)
    if (!unavailable.includes("saved review")) unavailable.push("saved review")
    return []
  }
}

function normalizeReview(row: Row | null, weekStart: string, weekEnd: string) {
  return {
    id: row?.id ? String(row.id) : null,
    week_start: weekStart,
    week_end: weekEnd,
    reflection_wins: row?.reflection_wins || "",
    reflection_challenges: row?.reflection_challenges || "",
    reflection_lessons: row?.reflection_lessons || "",
    reflection_next_week_focus: row?.reflection_next_week_focus || "",
    summary_snapshot: row?.summary_snapshot || null,
    updated_at: toIsoDate(row?.updated_at),
    created_at: toIsoDate(row?.created_at),
  }
}

async function getDerivedSummary(userId: string, weekStart: string, weekEnd: string, nextWeekStart: string) {
  const unavailable: string[] = []
  const today = todayString()
  const effectiveEnd = today < weekEnd ? today : weekEnd
  const monthStart = `${weekStart.slice(0, 7)}-01`
  const nextMonth = addDays(`${weekStart.slice(0, 7)}-28`, 4).slice(0, 8) + "01"
  const twoWeeksAfter = addDays(weekEnd, 14)

  const [
    tasksRows,
    goalsRows,
    habitsRows,
    projectsRows,
    projectActivityRows,
    notesRows,
    financeRows,
    nearBudgetRows,
    investmentsRows,
    incomeRows,
    capacityRows,
    lifeAreaRows,
  ] = await Promise.all([
    safeRows("tasks", sql`
      SELECT
        COUNT(*) FILTER (
          WHERE completed = TRUE
            AND COALESCE(updated_at, created_at) >= ${weekStart}::date
            AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
        )::int AS completed,
        COUNT(*) FILTER (
          WHERE completed = FALSE
            AND due_date IS NOT NULL
            AND due_date <= ${effectiveEnd}::date
        )::int AS overdue,
        COUNT(*) FILTER (
          WHERE COALESCE(updated_at, created_at) >= ${weekStart}::date
            AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
        )::int AS created_updated
      FROM tasks
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("goals", sql`
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(updated_at, created_at) >= ${weekStart}::date
            AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
            AND (COALESCE(progress, 0) > 0 OR COALESCE(current_value, 0) > 0)
        )::int AS progressed,
        COUNT(*) FILTER (
          WHERE COALESCE(status, 'active') != 'completed'
            AND target_date IS NOT NULL
            AND target_date > ${weekEnd}::date
            AND target_date <= ${twoWeeksAfter}::date
        )::int AS upcoming_deadlines
      FROM goals
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("habits", sql`
      SELECT
        COUNT(*) FILTER (WHERE hc.count >= h.target_count)::int AS completed_checkins,
        COUNT(DISTINCT hc.habit_id) FILTER (WHERE hc.count >= h.target_count)::int AS habits_completed,
        COUNT(*)::int AS total_checkins
      FROM habit_checkins hc
      JOIN habits h ON h.id = hc.habit_id AND h.user_id = ${userId}
      WHERE hc.user_id = ${userId}
        AND hc.checkin_date >= ${weekStart}::date
        AND hc.checkin_date < ${nextWeekStart}::date
    `, unavailable),
    safeRows("projects", sql`
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(updated_at, created_at) >= ${weekStart}::date
            AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
        )::int AS updated,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (
          WHERE status NOT IN ('completed', 'archived')
            AND due_date IS NOT NULL
            AND due_date <= ${effectiveEnd}::date
        )::int AS overdue
      FROM projects
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("project activity", sql`
      SELECT COUNT(*)::int AS activity
      FROM project_activity
      WHERE user_id = ${userId}
        AND created_at >= ${weekStart}::date
        AND created_at < ${nextWeekStart}::date
    `, unavailable),
    safeRows("notes", sql`
      SELECT
        COUNT(*) FILTER (
          WHERE created_at >= ${weekStart}::date
            AND created_at < ${nextWeekStart}::date
        )::int AS created,
        COUNT(*) FILTER (
          WHERE updated_at >= ${weekStart}::date
            AND updated_at < ${nextWeekStart}::date
        )::int AS updated
      FROM notes
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("budget transactions", sql`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::float AS income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::float AS expenses,
        COUNT(*)::int AS transactions
      FROM budget_transactions
      WHERE user_id = ${userId}
        AND date >= ${weekStart}::date
        AND date < ${nextWeekStart}::date
    `, unavailable),
    safeRows("budget categories", sql`
      SELECT
        c.id,
        c.name,
        c.budget_limit,
        COALESCE(SUM(t.amount), 0)::float AS spent
      FROM budget_categories c
      LEFT JOIN budget_transactions t
        ON t.category_id = c.id
        AND t.user_id = ${userId}
        AND t.type = 'expense'
        AND t.date >= ${monthStart}::date
        AND t.date < ${nextMonth}::date
      WHERE c.user_id = ${userId}
        AND c.budget_limit > 0
      GROUP BY c.id, c.name, c.budget_limit
      HAVING COALESCE(SUM(t.amount), 0) >= c.budget_limit * 0.8
      ORDER BY COALESCE(SUM(t.amount), 0) / NULLIF(c.budget_limit, 0) DESC
      LIMIT 5
    `, unavailable),
    safeRows("investments", sql`
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(updated_at, created_at) >= ${weekStart}::date
            AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
        )::int AS updated,
        COALESCE(SUM(COALESCE(current_value, amount)), 0)::float AS tracked_value
      FROM investments
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("income", sql`
      SELECT
        COUNT(*) FILTER (
          WHERE COALESCE(updated_at, created_at) >= ${weekStart}::date
            AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
        )::int AS updated_sources,
        COALESCE(SUM(amount) FILTER (WHERE active = TRUE), 0)::float AS active_amount
      FROM income_sources
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("daily capacity", sql`
      SELECT
        COUNT(*)::int AS days_logged,
        COUNT(*) FILTER (WHERE energy_level = 'low')::int AS low_energy_days,
        COUNT(*) FILTER (WHERE energy_level = 'medium')::int AS medium_energy_days,
        COUNT(*) FILTER (WHERE energy_level = 'high')::int AS high_energy_days,
        ROUND(AVG(available_focus_minutes))::int AS average_focus_minutes,
        ROUND(AVG(jsonb_array_length(focus_items)))::int AS average_focus_items,
        COUNT(*) FILTER (
          WHERE jsonb_array_length(focus_items) >
            CASE
              WHEN energy_level = 'low' THEN 1
              WHEN energy_level = 'high' THEN 3
              ELSE 2
            END
        )::int AS overload_days,
        (
          SELECT day_type
          FROM daily_plans dp2
          WHERE dp2.user_id = ${userId}
            AND dp2.plan_date >= ${weekStart}::date
            AND dp2.plan_date < ${nextWeekStart}::date
          GROUP BY day_type
          ORDER BY COUNT(*) DESC, day_type ASC
          LIMIT 1
        ) AS most_common_day_type
      FROM daily_plans
      WHERE user_id = ${userId}
        AND plan_date >= ${weekStart}::date
        AND plan_date < ${nextWeekStart}::date
    `, unavailable),
    safeRows("life domain balance", sql`
      WITH activity AS (
        SELECT life_area_id, 'task' AS source_type, COUNT(*)::int AS activity_count
        FROM tasks
        WHERE user_id = ${userId}
          AND COALESCE(updated_at, created_at) >= ${weekStart}::date
          AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
        GROUP BY life_area_id
        UNION ALL
        SELECT life_area_id, 'goal' AS source_type, COUNT(*)::int AS activity_count
        FROM goals
        WHERE user_id = ${userId}
          AND COALESCE(updated_at, created_at) >= ${weekStart}::date
          AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
        GROUP BY life_area_id
        UNION ALL
        SELECT life_area_id, 'note' AS source_type, COUNT(*)::int AS activity_count
        FROM notes
        WHERE user_id = ${userId}
          AND COALESCE(updated_at, created_at) >= ${weekStart}::date
          AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
        GROUP BY life_area_id
        UNION ALL
        SELECT life_area_id, 'project' AS source_type, COUNT(*)::int AS activity_count
        FROM projects
        WHERE user_id = ${userId}
          AND COALESCE(updated_at, created_at) >= ${weekStart}::date
          AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
        GROUP BY life_area_id
        UNION ALL
        SELECT life_area_id, 'income' AS source_type, COUNT(*)::int AS activity_count
        FROM income_sources
        WHERE user_id = ${userId}
          AND COALESCE(updated_at, created_at) >= ${weekStart}::date
          AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
        GROUP BY life_area_id
        UNION ALL
        SELECT life_area_id, 'investment' AS source_type, COUNT(*)::int AS activity_count
        FROM investments
        WHERE user_id = ${userId}
          AND COALESCE(updated_at, created_at) >= ${weekStart}::date
          AND COALESCE(updated_at, created_at) < ${nextWeekStart}::date
        GROUP BY life_area_id
      )
      SELECT
        COALESCE(activity.life_area_id::text, 'unassigned') AS key,
        la.name,
        la.icon,
        la.color,
        SUM(activity.activity_count)::int AS activity_count
      FROM activity
      LEFT JOIN life_areas la
        ON la.id = activity.life_area_id
        AND la.user_id = ${userId}
      WHERE la.is_ai_excluded IS NOT TRUE
      GROUP BY activity.life_area_id, la.name, la.icon, la.color
      ORDER BY SUM(activity.activity_count) DESC
      LIMIT 8
    `, unavailable),
  ])

  const tasks = tasksRows[0] || {}
  const goals = goalsRows[0] || {}
  const habits = habitsRows[0] || {}
  const projects = projectsRows[0] || {}
  const projectActivity = toNumber(projectActivityRows[0]?.activity)
  const notes = notesRows[0] || {}
  const finance = financeRows[0] || {}
  const investments = investmentsRows[0] || {}
  const income = incomeRows[0] || {}
  const capacity = capacityRows[0] || {}
  const expenses = toNumber(finance.expenses)
  const budgetIncome = toNumber(finance.income)

  const summary = {
    week_start: weekStart,
    week_end: weekEnd,
    unavailable: Array.from(new Set(unavailable)),
    tasks: {
      completed: toNumber(tasks.completed),
      overdue: toNumber(tasks.overdue),
      created_updated: toNumber(tasks.created_updated),
    },
    goals: {
      progressed: toNumber(goals.progressed),
      upcoming_deadlines: toNumber(goals.upcoming_deadlines),
    },
    habits: {
      completed_checkins: toNumber(habits.completed_checkins),
      habits_completed: toNumber(habits.habits_completed),
      total_checkins: toNumber(habits.total_checkins),
    },
    projects: {
      updated: toNumber(projects.updated),
      active: toNumber(projects.active),
      overdue: toNumber(projects.overdue),
      activity: projectActivity,
    },
    notes: {
      created: toNumber(notes.created),
      updated: toNumber(notes.updated),
    },
    finance: {
      income: budgetIncome,
      expenses,
      net: budgetIncome - expenses,
      transactions: toNumber(finance.transactions),
      near_budget_categories: nearBudgetRows.map((row) => {
        const spent = toNumber(row.spent)
        const limit = toNumber(row.budget_limit)
        return {
          id: String(row.id),
          name: String(row.name || "Budget category"),
          spent,
          budget_limit: limit,
          percent_used: limit > 0 ? Math.round((spent / limit) * 100) : 0,
        }
      }),
      income_sources_updated: toNumber(income.updated_sources),
      active_income_amount: toNumber(income.active_amount),
      investments_updated: toNumber(investments.updated),
      investment_tracked_value: toNumber(investments.tracked_value),
    },
    capacity: {
      days_logged: toNumber(capacity.days_logged),
      low_energy_days: toNumber(capacity.low_energy_days),
      medium_energy_days: toNumber(capacity.medium_energy_days),
      high_energy_days: toNumber(capacity.high_energy_days),
      average_focus_minutes: toNumber(capacity.average_focus_minutes),
      average_focus_items: toNumber(capacity.average_focus_items),
      overload_days: toNumber(capacity.overload_days),
      most_common_day_type: capacity.most_common_day_type || null,
    },
    life_areas: lifeAreaRows.map((row) => ({
      key: String(row.key || "unassigned"),
      name: row.name || "Unassigned",
      icon: row.icon || "Target",
      color: row.color || "#64748B",
      activity_count: toNumber(row.activity_count),
    })),
  }

  return summary
}

export async function GET(request: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const rawDate = url.searchParams.get("date") || todayString()
  if (!isValidDate(rawDate)) {
    return NextResponse.json({ error: "A valid date is required" }, { status: 400 })
  }

  const { weekStart, weekEnd, nextWeekStart } = weekRangeFor(rawDate)
  const unavailable: string[] = []
  const [savedReview, history, summary] = await Promise.all([
    safeReview(user.id, weekStart, unavailable),
    safeHistory(user.id, weekStart, unavailable),
    getDerivedSummary(user.id, weekStart, weekEnd, nextWeekStart),
  ])

  const allUnavailable = Array.from(new Set([...summary.unavailable, ...unavailable]))

  return NextResponse.json({
    week: { week_start: weekStart, week_end: weekEnd },
    review: normalizeReview(savedReview, weekStart, weekEnd),
    history: history.map((row) => ({
      id: String(row.id),
      week_start: row.week_start,
      week_end: row.week_end,
      reflection_wins: row.reflection_wins || "",
      reflection_next_week_focus: row.reflection_next_week_focus || "",
      updated_at: toIsoDate(row.updated_at),
      created_at: toIsoDate(row.created_at),
    })),
    summary: { ...summary, unavailable: allUnavailable },
  })
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const rawDate = text(body.date) || text(body.week_start) || todayString()
    if (!isValidDate(rawDate)) {
      return NextResponse.json({ error: "A valid date or week_start is required" }, { status: 400 })
    }

    const { weekStart, weekEnd, nextWeekStart } = weekRangeFor(rawDate)
    const summary = await getDerivedSummary(user.id, weekStart, weekEnd, nextWeekStart)

    const rows = await sql`
      INSERT INTO weekly_reviews (
        user_id,
        week_start,
        week_end,
        reflection_wins,
        reflection_challenges,
        reflection_lessons,
        reflection_next_week_focus,
        summary_snapshot
      )
      VALUES (
        ${user.id},
        ${weekStart},
        ${weekEnd},
        ${text(body.reflection_wins) || null},
        ${text(body.reflection_challenges) || null},
        ${text(body.reflection_lessons) || null},
        ${text(body.reflection_next_week_focus) || null},
        ${JSON.stringify(summary)}::jsonb
      )
      ON CONFLICT (user_id, week_start)
      DO UPDATE SET
        week_end = EXCLUDED.week_end,
        reflection_wins = EXCLUDED.reflection_wins,
        reflection_challenges = EXCLUDED.reflection_challenges,
        reflection_lessons = EXCLUDED.reflection_lessons,
        reflection_next_week_focus = EXCLUDED.reflection_next_week_focus,
        summary_snapshot = EXCLUDED.summary_snapshot,
        updated_at = NOW()
      RETURNING *
    `

    return NextResponse.json({
      review: normalizeReview(rows[0], weekStart, weekEnd),
      summary,
    })
  } catch (error) {
    console.error("[weekly-review] save error:", error)
    return NextResponse.json({ error: "Failed to save weekly review" }, { status: 500 })
  }
}
