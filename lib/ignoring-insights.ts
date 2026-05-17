import { sql } from "@/lib/db"

export type IgnoringSignalSource =
  | "life_area"
  | "goal"
  | "project"
  | "waiting"
  | "commitment"
  | "habit"
  | "maintenance"
  | "vault"
  | "finance"

export type IgnoringSignalSeverity = "low" | "medium" | "high"

export type IgnoringSignal = {
  id: string
  source: IgnoringSignalSource
  title: string
  description: string
  evidence: string
  href: string
  date: string | null
  days_inactive: number | null
  severity: IgnoringSignalSeverity
  life_area_id: string | null
  life_area_name: string | null
  life_area_color: string | null
}

export type IgnoringInsightsData = {
  generated_at: string
  signals: IgnoringSignal[]
  summary: {
    total: number
    high: number
    medium: number
    low: number
    life_areas_quiet_14d: number
    life_areas_quiet_30d: number
    stale_goals: number
    stale_projects: number
    hidden_risks: number
  }
  unavailable: string[]
}

type Row = Record<string, any>

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

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function dateOnly(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

function toDate(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function lifeAreaId(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  return String(value)
}

function daysSince(value: unknown, now = new Date()) {
  const date = toDate(value)
  if (!date) return null
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000))
}

function n(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0))
  return Number.isFinite(parsed) ? parsed : 0
}

function areaMeta(row: Row, lifeAreaById: Map<string, Row>) {
  const id = lifeAreaId(row.life_area_id)
  const area = id ? lifeAreaById.get(id) : null
  return {
    life_area_id: id,
    life_area_name: area ? text(area.name, "Life area") : null,
    life_area_color: area ? nullableText(area.color) : null,
  }
}

function makeSignal(signal: IgnoringSignal): IgnoringSignal {
  return signal
}

export async function getIgnoringInsightsData(userId: string): Promise<IgnoringInsightsData> {
  const unavailable: string[] = []
  const now = new Date()

  const lifeAreas = await safeRows("life_areas", sql`
    SELECT id::text, name, color, sort_order
    FROM life_areas
    WHERE user_id = ${userId}
    ORDER BY sort_order ASC, name ASC
  `, unavailable)

  const lifeAreaById = new Map(lifeAreas.map((row) => [String(row.id), row]))

  const [
    taskActivity,
    goalActivity,
    habitActivity,
    projectActivity,
    noteActivity,
    wishlistActivity,
    investmentActivity,
    incomeActivity,
    budgetCategoryActivity,
    staleGoals,
    staleProjects,
    overdueWaiting,
    overdueCommitments,
    missedHabits,
    overdueMaintenance,
    vaultRenewals,
    financeTransactions,
    financeCategories,
    financeIncome,
    financeInvestments,
  ] = await Promise.all([
    safeRows("tasks", sql`
      SELECT life_area_id::text, MAX(COALESCE(updated_at, created_at)) AS last_activity, COUNT(*)::int AS count
      FROM tasks
      WHERE user_id = ${userId} AND life_area_id IS NOT NULL
      GROUP BY life_area_id
    `, unavailable),
    safeRows("goals", sql`
      SELECT life_area_id::text, MAX(COALESCE(updated_at, created_at)) AS last_activity, COUNT(*)::int AS count
      FROM goals
      WHERE user_id = ${userId} AND life_area_id IS NOT NULL
      GROUP BY life_area_id
    `, unavailable),
    safeRows("habits", sql`
      SELECT life_area_id::text, MAX(COALESCE(updated_at, created_at)) AS last_activity, COUNT(*)::int AS count
      FROM habits
      WHERE user_id = ${userId} AND life_area_id IS NOT NULL
      GROUP BY life_area_id
    `, unavailable),
    safeRows("projects", sql`
      SELECT life_area_id::text, MAX(COALESCE(updated_at, created_at)) AS last_activity, COUNT(*)::int AS count
      FROM projects
      WHERE user_id = ${userId} AND life_area_id IS NOT NULL
      GROUP BY life_area_id
    `, unavailable),
    safeRows("notes", sql`
      SELECT life_area_id::text, MAX(COALESCE(updated_at, created_at)) AS last_activity, COUNT(*)::int AS count
      FROM notes
      WHERE user_id = ${userId} AND life_area_id IS NOT NULL
      GROUP BY life_area_id
    `, unavailable),
    safeRows("wishlist_items", sql`
      SELECT life_area_id::text, MAX(COALESCE(updated_at, created_at)) AS last_activity, COUNT(*)::int AS count
      FROM wishlist_items
      WHERE user_id = ${userId} AND life_area_id IS NOT NULL
      GROUP BY life_area_id
    `, unavailable),
    safeRows("investments", sql`
      SELECT life_area_id::text, MAX(COALESCE(updated_at, created_at)) AS last_activity, COUNT(*)::int AS count
      FROM investments
      WHERE user_id = ${userId} AND life_area_id IS NOT NULL
      GROUP BY life_area_id
    `, unavailable),
    safeRows("income_sources", sql`
      SELECT life_area_id::text, MAX(COALESCE(updated_at, created_at)) AS last_activity, COUNT(*)::int AS count
      FROM income_sources
      WHERE user_id = ${userId} AND life_area_id IS NOT NULL
      GROUP BY life_area_id
    `, unavailable),
    safeRows("budget_categories", sql`
      SELECT life_area_id::text, MAX(created_at) AS last_activity, COUNT(*)::int AS count
      FROM budget_categories
      WHERE user_id = ${userId} AND life_area_id IS NOT NULL
      GROUP BY life_area_id
    `, unavailable),
    safeRows("stale_goals", sql`
      SELECT id, title, status, priority, target_date, COALESCE(updated_at, created_at) AS last_activity, life_area_id
      FROM goals
      WHERE user_id = ${userId}
        AND COALESCE(status, 'active') <> 'completed'
        AND COALESCE(updated_at, created_at) < NOW() - INTERVAL '30 days'
      ORDER BY COALESCE(updated_at, created_at) ASC
      LIMIT 12
    `, unavailable),
    safeRows("stale_projects", sql`
      SELECT id, title, status, priority, due_date, COALESCE(updated_at, created_at) AS last_activity, life_area_id
      FROM projects
      WHERE user_id = ${userId}
        AND status IN ('active', 'paused')
        AND COALESCE(updated_at, created_at) < NOW() - INTERVAL '30 days'
      ORDER BY COALESCE(updated_at, created_at) ASC
      LIMIT 12
    `, unavailable),
    safeRows("overdue_waiting", sql`
      SELECT id, title, waiting_on_name, status, expected_date, follow_up_date, life_area_id
      FROM waiting_items
      WHERE user_id = ${userId}
        AND status IN ('waiting', 'follow_up_needed')
        AND (
          (expected_date IS NOT NULL AND expected_date < CURRENT_DATE)
          OR (follow_up_date IS NOT NULL AND follow_up_date <= CURRENT_DATE)
        )
      ORDER BY follow_up_date ASC NULLS LAST, expected_date ASC NULLS LAST
      LIMIT 12
    `, unavailable),
    safeRows("overdue_commitments", sql`
      SELECT id, title, committed_to, status, due_date, life_area_id
      FROM commitments
      WHERE user_id = ${userId}
        AND status IN ('open', 'at_risk')
        AND due_date IS NOT NULL
        AND due_date < CURRENT_DATE
      ORDER BY due_date ASC
      LIMIT 12
    `, unavailable),
    safeRows("missed_habits", sql`
      SELECT h.id, h.name AS title, h.frequency, h.target_count, h.life_area_id
      FROM habits h
      LEFT JOIN habit_checkins hc
        ON hc.habit_id = h.id
       AND hc.user_id = ${userId}
       AND hc.checkin_date = CURRENT_DATE
       AND hc.count >= h.target_count
      WHERE h.user_id = ${userId}
        AND h.is_active IS NOT FALSE
        AND (
          h.frequency = 'daily'
          OR h.frequency = 'weekly'
          OR (h.frequency = 'custom' AND h.custom_days @> ARRAY[EXTRACT(DOW FROM CURRENT_DATE)::int])
        )
        AND hc.id IS NULL
      ORDER BY h.sort_order ASC, h.created_at DESC
      LIMIT 12
    `, unavailable),
    safeRows("overdue_maintenance", sql`
      SELECT id, title, category, next_due_date, life_area_id
      FROM maintenance_items
      WHERE user_id = ${userId}
        AND status = 'active'
        AND next_due_date IS NOT NULL
        AND next_due_date < CURRENT_DATE
      ORDER BY next_due_date ASC
      LIMIT 12
    `, unavailable),
    safeRows("vault_items", sql`
      SELECT id, title, category, expiry_date, renewal_date, life_area_id
      FROM vault_items
      WHERE user_id = ${userId}
        AND (
          (renewal_date IS NOT NULL AND renewal_date >= CURRENT_DATE AND renewal_date <= CURRENT_DATE + INTERVAL '30 days')
          OR (expiry_date IS NOT NULL AND expiry_date >= CURRENT_DATE AND expiry_date <= CURRENT_DATE + INTERVAL '30 days')
        )
      ORDER BY renewal_date ASC NULLS LAST, expiry_date ASC NULLS LAST
      LIMIT 12
    `, unavailable),
    safeRows("budget_transactions", sql`
      SELECT MAX(date)::text AS last_activity, COUNT(*)::int AS count
      FROM budget_transactions
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("budget_categories", sql`
      SELECT MAX(created_at) AS last_activity, COUNT(*)::int AS count
      FROM budget_categories
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("income_sources", sql`
      SELECT MAX(COALESCE(updated_at, created_at)) AS last_activity, COUNT(*)::int AS count
      FROM income_sources
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("investments", sql`
      SELECT MAX(COALESCE(updated_at, created_at)) AS last_activity, COUNT(*)::int AS count
      FROM investments
      WHERE user_id = ${userId}
    `, unavailable),
  ])

  const activityByArea = new Map<string, { last: Date | null; count: number }>()
  const activityRows = [
    ...taskActivity,
    ...goalActivity,
    ...habitActivity,
    ...projectActivity,
    ...noteActivity,
    ...wishlistActivity,
    ...investmentActivity,
    ...incomeActivity,
    ...budgetCategoryActivity,
  ]

  for (const row of activityRows) {
    const id = lifeAreaId(row.life_area_id)
    if (!id) continue
    const current = activityByArea.get(id) ?? { last: null, count: 0 }
    const candidate = toDate(row.last_activity)
    if (candidate && (!current.last || candidate > current.last)) current.last = candidate
    current.count += n(row.count)
    activityByArea.set(id, current)
  }

  const signals: IgnoringSignal[] = []

  for (const area of lifeAreas) {
    const areaId = String(area.id)
    const activity = activityByArea.get(areaId)
    const inactiveDays = activity?.last ? daysSince(activity.last, now) : null
    const quiet30 = !activity?.last || (inactiveDays !== null && inactiveDays >= 30)
    const quiet14 = !quiet30 && inactiveDays !== null && inactiveDays >= 14

    if (!quiet30 && !quiet14) continue
    signals.push(makeSignal({
      id: `life_area:${areaId}:${quiet30 ? "30d" : "14d"}`,
      source: "life_area",
      title: `${text(area.name, "Life area")} has been quiet`,
      description: quiet30 ? "No tracked activity in this Life Area for 30 days." : "No tracked activity in this Life Area for 14 days.",
      evidence: activity?.last ? `Last activity ${inactiveDays} days ago` : "No tracked activity found",
      href: "/life-areas",
      date: activity?.last ? dateOnly(activity.last) : null,
      days_inactive: inactiveDays,
      severity: quiet30 ? "high" : "medium",
      life_area_id: areaId,
      life_area_name: text(area.name, "Life area"),
      life_area_color: text(area.color),
    }))
  }

  for (const row of staleGoals) {
    const area = areaMeta(row, lifeAreaById)
    signals.push(makeSignal({
      id: `goal:${row.id}`,
      source: "goal",
      title: text(row.title, "Untitled goal"),
      description: "This active goal has not been updated in 30 days.",
      evidence: `Last update ${daysSince(row.last_activity, now) ?? "many"} days ago`,
      href: "/goals",
      date: dateOnly(row.target_date),
      days_inactive: daysSince(row.last_activity, now),
      severity: row.target_date && dateOnly(row.target_date)! < new Date().toISOString().slice(0, 10) ? "high" : "medium",
      ...area,
    }))
  }

  for (const row of staleProjects) {
    const area = areaMeta(row, lifeAreaById)
    signals.push(makeSignal({
      id: `project:${row.id}`,
      source: "project",
      title: text(row.title, "Untitled project"),
      description: "This active or paused project has not been updated in 30 days.",
      evidence: `Last update ${daysSince(row.last_activity, now) ?? "many"} days ago`,
      href: `/projects/${row.id}`,
      date: dateOnly(row.due_date),
      days_inactive: daysSince(row.last_activity, now),
      severity: row.due_date && dateOnly(row.due_date)! < new Date().toISOString().slice(0, 10) ? "high" : "medium",
      ...area,
    }))
  }

  for (const row of overdueWaiting) {
    const area = areaMeta(row, lifeAreaById)
    const dueDate = dateOnly(row.follow_up_date || row.expected_date)
    signals.push(makeSignal({
      id: `waiting:${row.id}`,
      source: "waiting",
      title: text(row.title, "Waiting item"),
      description: row.waiting_on_name ? `Waiting on ${row.waiting_on_name}.` : "This waiting item needs attention.",
      evidence: row.follow_up_date ? "Follow-up date is due or overdue" : "Expected date has passed",
      href: "/waiting",
      date: dueDate,
      days_inactive: dueDate ? daysSince(dueDate, now) : null,
      severity: "high",
      ...area,
    }))
  }

  for (const row of overdueCommitments) {
    const area = areaMeta(row, lifeAreaById)
    signals.push(makeSignal({
      id: `commitment:${row.id}`,
      source: "commitment",
      title: text(row.title, "Commitment"),
      description: row.committed_to ? `Committed to ${row.committed_to}.` : "This commitment is overdue.",
      evidence: "Due date has passed",
      href: "/commitments",
      date: dateOnly(row.due_date),
      days_inactive: row.due_date ? daysSince(row.due_date, now) : null,
      severity: "high",
      ...area,
    }))
  }

  for (const row of missedHabits) {
    const area = areaMeta(row, lifeAreaById)
    signals.push(makeSignal({
      id: `habit:${row.id}`,
      source: "habit",
      title: text(row.title, "Habit"),
      description: "This active habit is due today and has not been checked in.",
      evidence: `Target count ${n(row.target_count) || 1}`,
      href: "/habits",
      date: new Date().toISOString().slice(0, 10),
      days_inactive: 0,
      severity: "medium",
      ...area,
    }))
  }

  for (const row of overdueMaintenance) {
    const area = areaMeta(row, lifeAreaById)
    signals.push(makeSignal({
      id: `maintenance:${row.id}`,
      source: "maintenance",
      title: text(row.title, "Maintenance item"),
      description: row.category ? `${row.category} maintenance is overdue.` : "This maintenance item is overdue.",
      evidence: "Next due date has passed",
      href: "/maintenance",
      date: dateOnly(row.next_due_date),
      days_inactive: row.next_due_date ? daysSince(row.next_due_date, now) : null,
      severity: "high",
      ...area,
    }))
  }

  for (const row of vaultRenewals) {
    const area = areaMeta(row, lifeAreaById)
    const renewalDate = dateOnly(row.renewal_date)
    const expiryDate = dateOnly(row.expiry_date)
    signals.push(makeSignal({
      id: `vault:${row.id}`,
      source: "vault",
      title: text(row.title, "Vault item"),
      description: renewalDate ? "This vault item has an upcoming renewal." : "This vault item expires soon.",
      evidence: renewalDate ? "Renewal date is within 30 days" : "Expiry date is within 30 days",
      href: "/vault",
      date: renewalDate || expiryDate,
      days_inactive: null,
      severity: "medium",
      ...area,
    }))
  }

  const financeLabels = ["budget_transactions", "budget_categories", "income_sources", "investments"]
  const unavailableSet = new Set(unavailable)
  const availableFinanceSources = financeLabels.filter((label) => !unavailableSet.has(label))
  if (availableFinanceSources.length > 0) {
    const financeRows = [...financeTransactions, ...financeCategories, ...financeIncome, ...financeInvestments]
    const financeActivity = financeRows.reduce<{ last: Date | null; count: number }>((acc, row) => {
      const candidate = toDate(row.last_activity)
      if (candidate && (!acc.last || candidate > acc.last)) acc.last = candidate
      acc.count += n(row.count)
      return acc
    }, { last: null, count: 0 })
    const inactiveDays = financeActivity.last ? daysSince(financeActivity.last, now) : null
    if (!financeActivity.last || (inactiveDays !== null && inactiveDays >= 30)) {
      signals.push(makeSignal({
        id: "finance:not-reviewed",
        source: "finance",
        title: "Finance has not been reviewed recently",
        description: "No recent budget, income, investment, or category activity was found.",
        evidence: financeActivity.last ? `Last finance activity ${inactiveDays} days ago` : "No finance activity found",
        href: "/budget",
        date: financeActivity.last ? dateOnly(financeActivity.last) : null,
        days_inactive: inactiveDays,
        severity: "medium",
        life_area_id: null,
        life_area_name: "Finance",
        life_area_color: null,
      }))
    }
  }

  const sortedSignals = signals.sort((a, b) => {
    const severityRank = { high: 3, medium: 2, low: 1 }
    const severityDelta = severityRank[b.severity] - severityRank[a.severity]
    if (severityDelta !== 0) return severityDelta
    return (b.days_inactive ?? 0) - (a.days_inactive ?? 0)
  })

  return {
    generated_at: new Date().toISOString(),
    signals: sortedSignals,
    summary: {
      total: sortedSignals.length,
      high: sortedSignals.filter((signal) => signal.severity === "high").length,
      medium: sortedSignals.filter((signal) => signal.severity === "medium").length,
      low: sortedSignals.filter((signal) => signal.severity === "low").length,
      life_areas_quiet_14d: sortedSignals.filter((signal) => signal.source === "life_area" && signal.severity === "medium").length,
      life_areas_quiet_30d: sortedSignals.filter((signal) => signal.source === "life_area" && signal.severity === "high").length,
      stale_goals: staleGoals.length,
      stale_projects: staleProjects.length,
      hidden_risks: sortedSignals.filter((signal) => signal.severity === "high").length,
    },
    unavailable: Array.from(new Set(unavailable)),
  }
}
