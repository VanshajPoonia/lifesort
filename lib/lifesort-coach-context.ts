import { sql } from "@/lib/db"

export const COACH_CONTEXT_MODES = [
  { id: "today", label: "Today", description: "Today, overdue items, and urgent follow-ups" },
  { id: "this_week", label: "This week", description: "This week's tasks, events, habits, and review" },
  { id: "goals", label: "Goals", description: "Active, stale, and at-risk goals" },
  { id: "projects", label: "Projects", description: "Active projects, progress, and next actions" },
  { id: "finance", label: "Finance", description: "Budget, income, investments, and finance review signals" },
  { id: "full", label: "Full LifeSort summary", description: "Compact cross-app summary across LifeSort" },
] as const

export type CoachContextMode = (typeof COACH_CONTEXT_MODES)[number]["id"]

export type CoachCitation = {
  citation_id: string
  type: string
  id: string
  title: string
  href: string
  subtitle: string | null
  date: string | null
  life_area_name: string | null
}

export type CoachContextResult = {
  mode: CoachContextMode
  mode_label: string
  generated_at: string
  prompt: string
  citations: CoachCitation[]
  unavailable: string[]
  summary: {
    citation_count: number
    unavailable_count: number
    source_count: number
  }
}

type Row = Record<string, any>

const MODE_LABELS = new Map(COACH_CONTEXT_MODES.map((mode) => [mode.id, mode.label]))

function isMissingSchema(error: unknown) {
  const err = error as { code?: string; message?: string }
  const message = err.message?.toLowerCase() ?? ""
  return err.code === "42P01" || err.code === "42703" || message.includes("does not exist") || message.includes("column")
}

async function safeRows(label: string, query: Promise<Row[]>, unavailable: string[]) {
  try {
    return await query
  } catch (error) {
    if (isMissingSchema(error)) {
      unavailable.push(label)
      return []
    }
    throw error
  }
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function dateOnly(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0))
  return Number.isFinite(parsed) ? parsed : 0
}

function boolLabel(value: unknown) {
  return value ? "yes" : "no"
}

function mondayFor(date = new Date()) {
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = copy.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  copy.setUTCDate(copy.getUTCDate() + diff)
  return copy.toISOString().slice(0, 10)
}

function plusDays(date: string, days: number) {
  const copy = new Date(`${date}T00:00:00Z`)
  copy.setUTCDate(copy.getUTCDate() + days)
  return copy.toISOString().slice(0, 10)
}

export function normalizeCoachContextMode(value: unknown): CoachContextMode {
  return COACH_CONTEXT_MODES.some((mode) => mode.id === value) ? (value as CoachContextMode) : "today"
}

function citation(input: {
  type: string
  id: unknown
  title: unknown
  href: string
  subtitle?: unknown
  date?: unknown
  life_area_name?: unknown
}): CoachCitation {
  const id = String(input.id)
  const type = input.type
  return {
    citation_id: `${type}:${id}`,
    type,
    id,
    title: text(input.title, `${type} ${id}`).slice(0, 160),
    href: input.href,
    subtitle: text(input.subtitle, "") || null,
    date: dateOnly(input.date),
    life_area_name: text(input.life_area_name, "") || null,
  }
}

function addCitation(citations: CoachCitation[], item: CoachCitation) {
  if (citations.some((existing) => existing.citation_id === item.citation_id)) return
  if (citations.length >= 60) return
  citations.push(item)
}

function lineFor(item: CoachCitation, details: string[] = []) {
  const meta = [
    item.date ? `date ${item.date}` : null,
    item.life_area_name ? `area ${item.life_area_name}` : null,
    ...details.filter(Boolean),
  ].filter(Boolean)
  return `- [${item.citation_id}] ${item.title}${item.subtitle ? ` — ${item.subtitle}` : ""}${meta.length ? ` (${meta.join("; ")})` : ""}`
}

function formatMoney(value: unknown) {
  return `$${numberValue(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
}

async function getTodayContext(userId: string, unavailable: string[], citations: CoachCitation[]) {
  const [tasks, events, habits, waiting, commitments, notes] = await Promise.all([
    safeRows("tasks", sql`
      SELECT t.id, t.title, t.priority, t.due_date, t.completed, la.name AS life_area_name
      FROM tasks t
      LEFT JOIN life_areas la ON la.id = t.life_area_id AND la.user_id = ${userId}
      WHERE t.user_id = ${userId}
        AND t.completed = FALSE
        AND t.due_date IS NOT NULL
        AND t.due_date <= CURRENT_DATE
      ORDER BY t.due_date ASC, CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.updated_at DESC
      LIMIT 12
    `, unavailable),
    safeRows("calendar_events", sql`
      SELECT id, title, event_date, start_time, end_time
      FROM calendar_events
      WHERE user_id = ${userId} AND event_date = CURRENT_DATE
      ORDER BY start_time ASC
      LIMIT 8
    `, unavailable),
    safeRows("habits", sql`
      SELECT h.id, h.name, h.frequency, h.target_count, la.name AS life_area_name,
        COALESCE(hc.count, 0)::int AS checkin_count
      FROM habits h
      LEFT JOIN life_areas la ON la.id = h.life_area_id AND la.user_id = ${userId}
      LEFT JOIN habit_checkins hc ON hc.habit_id = h.id AND hc.user_id = ${userId} AND hc.checkin_date = CURRENT_DATE
      WHERE h.user_id = ${userId}
        AND h.is_active = TRUE
        AND (
          h.frequency IN ('daily', 'weekly')
          OR (h.frequency = 'custom' AND EXTRACT(DOW FROM CURRENT_DATE)::int = ANY(h.custom_days))
        )
      ORDER BY h.sort_order ASC, h.name ASC
      LIMIT 10
    `, unavailable),
    safeRows("waiting_items", sql`
      SELECT wi.id, wi.title, wi.waiting_on_name, wi.status, wi.expected_date, wi.follow_up_date, la.name AS life_area_name
      FROM waiting_items wi
      LEFT JOIN life_areas la ON la.id = wi.life_area_id AND la.user_id = ${userId}
      WHERE wi.user_id = ${userId}
        AND wi.status IN ('waiting', 'follow_up_needed')
        AND ((wi.follow_up_date IS NOT NULL AND wi.follow_up_date <= CURRENT_DATE) OR (wi.expected_date IS NOT NULL AND wi.expected_date < CURRENT_DATE))
      ORDER BY wi.follow_up_date ASC NULLS LAST, wi.expected_date ASC NULLS LAST, wi.updated_at DESC
      LIMIT 8
    `, unavailable),
    safeRows("commitments", sql`
      SELECT c.id, c.title, c.committed_to, c.status, c.due_date, la.name AS life_area_name
      FROM commitments c
      LEFT JOIN life_areas la ON la.id = c.life_area_id AND la.user_id = ${userId}
      WHERE c.user_id = ${userId}
        AND c.status IN ('open', 'at_risk')
        AND c.due_date IS NOT NULL
        AND c.due_date <= CURRENT_DATE + INTERVAL '7 days'
      ORDER BY c.due_date ASC, c.updated_at DESC
      LIMIT 8
    `, unavailable),
    safeRows("notes", sql`
      SELECT n.id, n.title, n.tags, n.is_pinned, n.updated_at, nf.name AS folder_name, la.name AS life_area_name
      FROM notes n
      LEFT JOIN note_folders nf ON nf.id = n.folder_id AND nf.user_id = ${userId}
      LEFT JOIN life_areas la ON la.id = n.life_area_id AND la.user_id = ${userId}
      WHERE n.user_id = ${userId}
        AND n.updated_at >= NOW() - INTERVAL '7 days'
      ORDER BY n.is_pinned DESC, n.updated_at DESC
      LIMIT 8
    `, unavailable),
  ])

  const sections: string[] = []
  const taskLines = tasks.map((row) => {
    const item = citation({
      type: "task",
      id: row.id,
      title: row.title,
      href: "/tasks",
      subtitle: `priority ${text(row.priority, "medium")}`,
      date: row.due_date,
      life_area_name: row.life_area_name,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Overdue or due-today tasks:\n${taskLines.length ? taskLines.join("\n") : "- None"}`)

  const eventLines = events.map((row) => {
    const item = citation({
      type: "calendar",
      id: row.id,
      title: row.title,
      href: "/calendar",
      subtitle: `${String(row.start_time ?? "").slice(0, 5)}-${String(row.end_time ?? "").slice(0, 5)}`,
      date: row.event_date,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Calendar today:\n${eventLines.length ? eventLines.join("\n") : "- No events today"}`)

  const habitLines = habits.map((row) => {
    const done = numberValue(row.checkin_count) >= numberValue(row.target_count)
    const item = citation({
      type: "habit",
      id: row.id,
      title: row.name,
      href: "/habits",
      subtitle: `${text(row.frequency, "daily")}; done today: ${boolLabel(done)}`,
      life_area_name: row.life_area_name,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Habits due today:\n${habitLines.length ? habitLines.join("\n") : "- No habits due today"}`)

  const waitingLines = waiting.map((row) => {
    const item = citation({
      type: "waiting",
      id: row.id,
      title: row.title,
      href: "/waiting",
      subtitle: `waiting on ${text(row.waiting_on_name, "someone")}; status ${text(row.status)}`,
      date: row.follow_up_date ?? row.expected_date,
      life_area_name: row.life_area_name,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Waiting items needing attention:\n${waitingLines.length ? waitingLines.join("\n") : "- None"}`)

  const commitmentLines = commitments.map((row) => {
    const item = citation({
      type: "commitment",
      id: row.id,
      title: row.title,
      href: "/commitments",
      subtitle: `to ${text(row.committed_to, "someone")}; status ${text(row.status)}`,
      date: row.due_date,
      life_area_name: row.life_area_name,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Commitments due soon:\n${commitmentLines.length ? commitmentLines.join("\n") : "- None"}`)

  const noteLines = notes.map((row) => {
    const tags = Array.isArray(row.tags) && row.tags.length ? `tags ${row.tags.slice(0, 4).join(", ")}` : "no tags"
    const item = citation({
      type: "note",
      id: row.id,
      title: row.title,
      href: "/notes",
      subtitle: `${row.is_pinned ? "pinned; " : ""}${text(row.folder_name, "unfiled")}; ${tags}`,
      date: row.updated_at,
      life_area_name: row.life_area_name,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Recent notes metadata only, no note body content:\n${noteLines.length ? noteLines.join("\n") : "- No recent notes"}`)

  return sections.join("\n\n")
}

async function getWeekContext(userId: string, unavailable: string[], citations: CoachCitation[]) {
  const weekStart = mondayFor()
  const weekEnd = plusDays(weekStart, 6)
  const nextWeekStart = plusDays(weekStart, 7)

  const [tasks, goals, events, habits, projects, review] = await Promise.all([
    safeRows("tasks", sql`
      SELECT t.id, t.title, t.priority, t.due_date, t.completed, la.name AS life_area_name
      FROM tasks t
      LEFT JOIN life_areas la ON la.id = t.life_area_id AND la.user_id = ${userId}
      WHERE t.user_id = ${userId}
        AND (
          (t.due_date >= ${weekStart}::date AND t.due_date < ${nextWeekStart}::date)
          OR (t.completed = TRUE AND COALESCE(t.updated_at, t.created_at) >= ${weekStart}::date AND COALESCE(t.updated_at, t.created_at) < ${nextWeekStart}::date)
        )
      ORDER BY t.completed ASC, t.due_date ASC NULLS LAST, t.updated_at DESC
      LIMIT 14
    `, unavailable),
    safeRows("goals", sql`
      SELECT g.id, g.title, g.status, g.progress, g.target_date, la.name AS life_area_name
      FROM goals g
      LEFT JOIN life_areas la ON la.id = g.life_area_id AND la.user_id = ${userId}
      WHERE g.user_id = ${userId}
        AND (g.target_date <= ${weekEnd}::date OR COALESCE(g.updated_at, g.created_at) >= ${weekStart}::date)
      ORDER BY g.target_date ASC NULLS LAST, g.updated_at DESC
      LIMIT 10
    `, unavailable),
    safeRows("calendar_events", sql`
      SELECT id, title, event_date, start_time, end_time
      FROM calendar_events
      WHERE user_id = ${userId}
        AND event_date >= ${weekStart}::date
        AND event_date < ${nextWeekStart}::date
      ORDER BY event_date ASC, start_time ASC
      LIMIT 12
    `, unavailable),
    safeRows("habit_checkins", sql`
      SELECT h.id, h.name, la.name AS life_area_name,
        COUNT(hc.id)::int AS checkins,
        COUNT(hc.id) FILTER (WHERE hc.count >= h.target_count)::int AS completed_checkins
      FROM habits h
      LEFT JOIN life_areas la ON la.id = h.life_area_id AND la.user_id = ${userId}
      LEFT JOIN habit_checkins hc ON hc.habit_id = h.id AND hc.user_id = ${userId}
        AND hc.checkin_date >= ${weekStart}::date
        AND hc.checkin_date < ${nextWeekStart}::date
      WHERE h.user_id = ${userId} AND h.is_active = TRUE
      GROUP BY h.id, h.name, la.name, h.sort_order
      ORDER BY completed_checkins ASC, h.sort_order ASC
      LIMIT 10
    `, unavailable),
    safeRows("projects", sql`
      SELECT p.id, p.title, p.status, p.progress, p.due_date, la.name AS life_area_name
      FROM projects p
      LEFT JOIN life_areas la ON la.id = p.life_area_id AND la.user_id = ${userId}
      WHERE p.user_id = ${userId}
        AND (p.status IN ('active', 'paused') OR COALESCE(p.updated_at, p.created_at) >= ${weekStart}::date)
      ORDER BY p.due_date ASC NULLS LAST, p.updated_at DESC
      LIMIT 10
    `, unavailable),
    safeRows("weekly_reviews", sql`
      SELECT id, week_start, week_end, reflection_wins, reflection_challenges, reflection_lessons, reflection_next_week_focus, updated_at
      FROM weekly_reviews
      WHERE user_id = ${userId} AND week_start = ${weekStart}::date
      LIMIT 1
    `, unavailable),
  ])

  const sections: string[] = [`Week range: ${weekStart} through ${weekEnd}.`]
  const addRows = (heading: string, rows: Row[], type: string, href: string, subtitle: (row: Row) => string, dateKey: string) => {
    const lines = rows.map((row) => {
      const item = citation({
        type,
        id: row.id,
        title: row.title ?? row.name,
        href,
        subtitle: subtitle(row),
        date: row[dateKey],
        life_area_name: row.life_area_name,
      })
      addCitation(citations, item)
      return lineFor(item)
    })
    sections.push(`${heading}:\n${lines.length ? lines.join("\n") : "- None"}`)
  }

  addRows("Tasks this week", tasks, "task", "/tasks", (row) => `priority ${text(row.priority, "medium")}; completed ${boolLabel(row.completed)}`, "due_date")
  addRows("Goals this week", goals, "goal", "/goals", (row) => `status ${text(row.status)}; progress ${numberValue(row.progress)}%`, "target_date")
  addRows("Calendar this week", events, "calendar", "/calendar", (row) => `${String(row.start_time ?? "").slice(0, 5)}-${String(row.end_time ?? "").slice(0, 5)}`, "event_date")
  addRows("Habit completion this week", habits, "habit", "/habits", (row) => `${numberValue(row.completed_checkins)} completed check-ins`, "updated_at")
  addRows("Projects this week", projects, "project", "/projects", (row) => `status ${text(row.status)}; progress ${numberValue(row.progress)}%`, "due_date")

  if (review.length) {
    const row = review[0]
    const item = citation({
      type: "weekly_review",
      id: row.id,
      title: `Weekly review ${dateOnly(row.week_start)}-${dateOnly(row.week_end)}`,
      href: "/review",
      subtitle: [
        row.reflection_wins ? "wins saved" : null,
        row.reflection_challenges ? "challenges saved" : null,
        row.reflection_next_week_focus ? "next focus saved" : null,
      ].filter(Boolean).join(", "),
      date: row.updated_at,
    })
    addCitation(citations, item)
    sections.push(`Saved weekly review:\n${lineFor(item)}`)
  } else {
    sections.push("Saved weekly review:\n- No saved review for this week")
  }

  return sections.join("\n\n")
}

async function getGoalsContext(userId: string, unavailable: string[], citations: CoachCitation[]) {
  const goals = await safeRows("goals", sql`
    SELECT g.id, g.title, g.status, g.priority, g.progress, g.target_date, g.updated_at, la.name AS life_area_name,
      COUNT(t.id) FILTER (WHERE t.completed = FALSE)::int AS open_tasks,
      COUNT(t.id) FILTER (WHERE t.completed = TRUE)::int AS completed_tasks
    FROM goals g
    LEFT JOIN life_areas la ON la.id = g.life_area_id AND la.user_id = ${userId}
    LEFT JOIN tasks t ON t.goal_id = g.id AND t.user_id = ${userId}
    WHERE g.user_id = ${userId}
      AND COALESCE(g.status, 'active') <> 'completed'
    GROUP BY g.id, g.title, g.status, g.priority, g.progress, g.target_date, g.updated_at, la.name
    ORDER BY
      CASE WHEN g.target_date IS NOT NULL AND g.target_date < CURRENT_DATE THEN 0 ELSE 1 END,
      g.target_date ASC NULLS LAST,
      g.updated_at ASC
    LIMIT 18
  `, unavailable)

  const lines = goals.map((row) => {
    const stale = row.updated_at ? `updated ${dateOnly(row.updated_at)}` : "no update date"
    const item = citation({
      type: "goal",
      id: row.id,
      title: row.title,
      href: "/goals",
      subtitle: `status ${text(row.status)}; priority ${text(row.priority)}; progress ${numberValue(row.progress)}%; ${numberValue(row.open_tasks)} open linked tasks; ${stale}`,
      date: row.target_date,
      life_area_name: row.life_area_name,
    })
    addCitation(citations, item)
    return lineFor(item)
  })

  return `Active and at-risk goals:\n${lines.length ? lines.join("\n") : "- No active goals found"}`
}

async function getProjectsContext(userId: string, unavailable: string[], citations: CoachCitation[]) {
  const [projects, activity] = await Promise.all([
    safeRows("projects", sql`
      SELECT p.id, p.title, p.status, p.priority, p.progress, p.due_date, p.updated_at, la.name AS life_area_name,
        COUNT(pi.id) FILTER (WHERE pi.item_type = 'task' AND t.completed = FALSE)::int AS next_actions
      FROM projects p
      LEFT JOIN life_areas la ON la.id = p.life_area_id AND la.user_id = ${userId}
      LEFT JOIN project_items pi ON pi.project_id = p.id AND pi.user_id = ${userId}
      LEFT JOIN tasks t ON t.id = pi.item_id AND pi.item_type = 'task' AND t.user_id = ${userId}
      WHERE p.user_id = ${userId}
        AND p.status IN ('active', 'paused')
      GROUP BY p.id, p.title, p.status, p.priority, p.progress, p.due_date, p.updated_at, la.name
      ORDER BY p.due_date ASC NULLS LAST, p.updated_at ASC
      LIMIT 18
    `, unavailable),
    safeRows("project_activity", sql`
      SELECT pa.id, pa.project_id, pa.message, pa.action, pa.created_at, p.title AS project_title
      FROM project_activity pa
      JOIN projects p ON p.id = pa.project_id AND p.user_id = ${userId}
      WHERE pa.user_id = ${userId}
      ORDER BY pa.created_at DESC
      LIMIT 8
    `, unavailable),
  ])

  const projectLines = projects.map((row) => {
    const item = citation({
      type: "project",
      id: row.id,
      title: row.title,
      href: `/projects/${row.id}`,
      subtitle: `status ${text(row.status)}; priority ${text(row.priority)}; progress ${numberValue(row.progress)}%; ${numberValue(row.next_actions)} next actions`,
      date: row.due_date,
      life_area_name: row.life_area_name,
    })
    addCitation(citations, item)
    return lineFor(item)
  })

  const activityLines = activity.map((row) => {
    const item = citation({
      type: "project_activity",
      id: row.id,
      title: text(row.message, "Project activity"),
      href: `/projects/${row.project_id}`,
      subtitle: `${text(row.action)} on ${text(row.project_title, "project")}`,
      date: row.created_at,
    })
    addCitation(citations, item)
    return lineFor(item)
  })

  return `Active and paused projects:\n${projectLines.length ? projectLines.join("\n") : "- No active projects found"}

Recent project activity:\n${activityLines.length ? activityLines.join("\n") : "- No recent activity"}`
}

async function getFinanceContext(userId: string, unavailable: string[], citations: CoachCitation[]) {
  const [categories, transactions, income, investments, goals] = await Promise.all([
    safeRows("budget_categories", sql`
      SELECT bc.id, bc.name, bc.budget_limit, la.name AS life_area_name,
        COALESCE(SUM(bt.amount) FILTER (WHERE bt.type = 'expense' AND date_trunc('month', bt.date) = date_trunc('month', CURRENT_DATE)), 0)::numeric AS spent_this_month
      FROM budget_categories bc
      LEFT JOIN life_areas la ON la.id = bc.life_area_id AND la.user_id = ${userId}
      LEFT JOIN budget_transactions bt ON bt.category_id = bc.id AND bt.user_id = ${userId}
      WHERE bc.user_id = ${userId}
      GROUP BY bc.id, bc.name, bc.budget_limit, la.name
      ORDER BY spent_this_month DESC
      LIMIT 12
    `, unavailable),
    safeRows("budget_transactions", sql`
      SELECT
        COUNT(*)::int AS count,
        COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::numeric AS income,
        COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::numeric AS expense,
        MAX(date) AS last_transaction_date
      FROM budget_transactions
      WHERE user_id = ${userId}
        AND date >= CURRENT_DATE - INTERVAL '30 days'
    `, unavailable),
    safeRows("income_sources", sql`
      SELECT id, source_name, amount, frequency, next_payment_date, active, la.name AS life_area_name
      FROM income_sources i
      LEFT JOIN life_areas la ON la.id = i.life_area_id AND la.user_id = ${userId}
      WHERE i.user_id = ${userId}
      ORDER BY active DESC, next_payment_date ASC NULLS LAST
      LIMIT 8
    `, unavailable),
    safeRows("investments", sql`
      SELECT id, name, symbol, amount, current_value, purchase_date, la.name AS life_area_name
      FROM investments inv
      LEFT JOIN life_areas la ON la.id = inv.life_area_id AND la.user_id = ${userId}
      WHERE inv.user_id = ${userId}
      ORDER BY COALESCE(current_value, amount) DESC
      LIMIT 8
    `, unavailable),
    safeRows("budget_goals", sql`
      SELECT id, name, target_amount, current_amount, deadline
      FROM budget_goals
      WHERE user_id = ${userId}
      ORDER BY deadline ASC NULLS LAST
      LIMIT 8
    `, unavailable),
  ])

  const transactionSummary = transactions[0]
  const sections: string[] = [
    `Recent finance activity: ${numberValue(transactionSummary?.count)} transactions in the last 30 days; income ${formatMoney(transactionSummary?.income)}; expenses ${formatMoney(transactionSummary?.expense)}; last transaction ${dateOnly(transactionSummary?.last_transaction_date) ?? "none"}.`,
  ]

  const categoryLines = categories.map((row) => {
    const limit = numberValue(row.budget_limit)
    const spent = numberValue(row.spent_this_month)
    const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0
    const item = citation({
      type: "budget_category",
      id: row.id,
      title: row.name,
      href: "/money?tab=budget",
      subtitle: `${formatMoney(spent)} spent of ${formatMoney(limit)} (${pct}%)`,
      life_area_name: row.life_area_name,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Budget categories:\n${categoryLines.length ? categoryLines.join("\n") : "- No budget categories"}`)

  const incomeLines = income.map((row) => {
    const item = citation({
      type: "income",
      id: row.id,
      title: row.source_name,
      href: "/money?tab=income",
      subtitle: `${formatMoney(row.amount)} ${text(row.frequency)}; active ${boolLabel(row.active)}`,
      date: row.next_payment_date,
      life_area_name: row.life_area_name,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Income sources:\n${incomeLines.length ? incomeLines.join("\n") : "- No income sources"}`)

  const investmentLines = investments.map((row) => {
    const item = citation({
      type: "investment",
      id: row.id,
      title: row.name,
      href: "/money?tab=investments",
      subtitle: `${text(row.symbol, "no symbol")}; tracked value ${formatMoney(row.current_value ?? row.amount)}`,
      date: row.purchase_date,
      life_area_name: row.life_area_name,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Investments:\n${investmentLines.length ? investmentLines.join("\n") : "- No investments"}`)

  const goalLines = goals.map((row) => {
    const item = citation({
      type: "budget_goal",
      id: row.id,
      title: row.name,
      href: "/money?tab=budget",
      subtitle: `${formatMoney(row.current_amount)} saved of ${formatMoney(row.target_amount)}`,
      date: row.deadline,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Budget goals:\n${goalLines.length ? goalLines.join("\n") : "- No budget goals"}`)

  return sections.join("\n\n")
}

async function getFullContext(userId: string, unavailable: string[], citations: CoachCitation[]) {
  const [lifeAreas, counts, notes, weeklyReviews] = await Promise.all([
    safeRows("life_areas", sql`
      SELECT id, name, description, color
      FROM life_areas
      WHERE user_id = ${userId}
      ORDER BY sort_order ASC, name ASC
      LIMIT 20
    `, unavailable),
    safeRows("lifesort_summary", sql`
      SELECT
        (SELECT COUNT(*) FROM tasks WHERE user_id = ${userId} AND completed = FALSE)::int AS open_tasks,
        (SELECT COUNT(*) FROM tasks WHERE user_id = ${userId} AND completed = FALSE AND due_date < CURRENT_DATE)::int AS overdue_tasks,
        (SELECT COUNT(*) FROM goals WHERE user_id = ${userId} AND COALESCE(status, 'active') <> 'completed')::int AS active_goals,
        (SELECT COUNT(*) FROM projects WHERE user_id = ${userId} AND status IN ('active', 'paused'))::int AS active_projects,
        (SELECT COUNT(*) FROM waiting_items WHERE user_id = ${userId} AND status IN ('waiting', 'follow_up_needed'))::int AS active_waiting,
        (SELECT COUNT(*) FROM commitments WHERE user_id = ${userId} AND status IN ('open', 'at_risk'))::int AS active_commitments,
        (SELECT COUNT(*) FROM calendar_events WHERE user_id = ${userId} AND event_date >= CURRENT_DATE AND event_date <= CURRENT_DATE + INTERVAL '14 days')::int AS upcoming_events
    `, unavailable),
    safeRows("notes", sql`
      SELECT n.id, n.title, n.tags, n.updated_at, nf.name AS folder_name, la.name AS life_area_name
      FROM notes n
      LEFT JOIN note_folders nf ON nf.id = n.folder_id AND nf.user_id = ${userId}
      LEFT JOIN life_areas la ON la.id = n.life_area_id AND la.user_id = ${userId}
      WHERE n.user_id = ${userId}
      ORDER BY n.updated_at DESC
      LIMIT 10
    `, unavailable),
    safeRows("weekly_reviews", sql`
      SELECT id, week_start, week_end, reflection_wins, reflection_challenges, reflection_next_week_focus, updated_at
      FROM weekly_reviews
      WHERE user_id = ${userId}
      ORDER BY week_start DESC
      LIMIT 3
    `, unavailable),
  ])

  const summary = counts[0]
  const sections: string[] = [
    `Compact app summary: open tasks ${numberValue(summary?.open_tasks)}, overdue tasks ${numberValue(summary?.overdue_tasks)}, active goals ${numberValue(summary?.active_goals)}, active projects ${numberValue(summary?.active_projects)}, active waiting items ${numberValue(summary?.active_waiting)}, active commitments ${numberValue(summary?.active_commitments)}, upcoming calendar events ${numberValue(summary?.upcoming_events)}.`,
  ]

  const areaLines = lifeAreas.map((row) => {
    const item = citation({
      type: "life_area",
      id: row.id,
      title: row.name,
      href: "/life-areas",
      subtitle: text(row.description, "no description"),
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Life areas:\n${areaLines.length ? areaLines.join("\n") : "- No life areas"}`)

  const noteLines = notes.map((row) => {
    const tags = Array.isArray(row.tags) && row.tags.length ? `tags ${row.tags.slice(0, 4).join(", ")}` : "no tags"
    const item = citation({
      type: "note",
      id: row.id,
      title: row.title,
      href: "/notes",
      subtitle: `${text(row.folder_name, "unfiled")}; ${tags}`,
      date: row.updated_at,
      life_area_name: row.life_area_name,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Recent notes metadata only, no note body content:\n${noteLines.length ? noteLines.join("\n") : "- No recent notes"}`)

  const reviewLines = weeklyReviews.map((row) => {
    const item = citation({
      type: "weekly_review",
      id: row.id,
      title: `Weekly review ${dateOnly(row.week_start)}-${dateOnly(row.week_end)}`,
      href: "/review",
      subtitle: [
        row.reflection_wins ? "wins saved" : null,
        row.reflection_challenges ? "challenges saved" : null,
        row.reflection_next_week_focus ? "next focus saved" : null,
      ].filter(Boolean).join(", "),
      date: row.updated_at,
    })
    addCitation(citations, item)
    return lineFor(item)
  })
  sections.push(`Recent weekly reviews:\n${reviewLines.length ? reviewLines.join("\n") : "- No weekly reviews"}`)

  const [today, goals, projects, finance] = await Promise.all([
    getTodayContext(userId, unavailable, citations),
    getGoalsContext(userId, unavailable, citations),
    getProjectsContext(userId, unavailable, citations),
    getFinanceContext(userId, unavailable, citations),
  ])

  sections.push(today, goals, projects, finance)
  return sections.join("\n\n")
}

export async function getLifeSortCoachContext(
  userId: string,
  rawMode: unknown,
): Promise<CoachContextResult> {
  const mode = normalizeCoachContextMode(rawMode)
  const citations: CoachCitation[] = []
  const unavailable: string[] = []

  const body =
    mode === "today"
      ? await getTodayContext(userId, unavailable, citations)
      : mode === "this_week"
        ? await getWeekContext(userId, unavailable, citations)
        : mode === "goals"
          ? await getGoalsContext(userId, unavailable, citations)
          : mode === "projects"
            ? await getProjectsContext(userId, unavailable, citations)
            : mode === "finance"
              ? await getFinanceContext(userId, unavailable, citations)
              : await getFullContext(userId, unavailable, citations)

  const label = MODE_LABELS.get(mode) ?? "Today"
  const unavailableUnique = Array.from(new Set(unavailable))
  const sourceCount = new Set(citations.map((item) => item.type)).size
  const prompt = `LifeSort Coach context mode: ${label}
Generated at: ${new Date().toISOString()}

Rules for using this context:
- This is read-only user context. You cannot modify LifeSort data.
- Cite any LifeSort item you rely on with its exact bracket citation id, for example [task:123].
- If the context is thin or a source is unavailable, say that plainly instead of guessing.
- Notes include metadata only. Do not claim to know note body content.
- Suggested actions are drafts only and require user confirmation.

Unavailable sources: ${unavailableUnique.length ? unavailableUnique.join(", ") : "none"}

${body}`.slice(0, 24000)

  return {
    mode,
    mode_label: label,
    generated_at: new Date().toISOString(),
    prompt,
    citations,
    unavailable: unavailableUnique,
    summary: {
      citation_count: citations.length,
      unavailable_count: unavailableUnique.length,
      source_count: sourceCount,
    },
  }
}
