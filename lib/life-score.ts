import { sql } from "@/lib/db"

export type LifeScoreComponentKey =
  | "focus_completion"
  | "overdue_task_load"
  | "habit_consistency"
  | "goals_updated"
  | "weekly_review_status"
  | "commitments_kept"
  | "maintenance_vault"
  | "life_area_balance"

export type LifeScoreComponent = {
  key: LifeScoreComponentKey
  label: string
  score: number
  weight: number
  status: "supportive" | "steady" | "attention"
  explanation: string
  href: string
}

export type LifeScoreImprovement = {
  title: string
  description: string
  href: string
  component_key: LifeScoreComponentKey
}

export type LifeScoreHistoryPoint = {
  score_date: string
  score: number
  label: string
}

export type LifeScoreData = {
  generated_at: string
  ready: boolean
  score: number
  label: string
  previous_score: number | null
  change: number | null
  components: LifeScoreComponent[]
  reasons: string[]
  top_improvements: LifeScoreImprovement[]
  history: LifeScoreHistoryPoint[]
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

function n(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0))
  return Number.isFinite(parsed) ? parsed : 0
}

function scoreStatus(score: number): LifeScoreComponent["status"] {
  if (score >= 82) return "supportive"
  if (score >= 60) return "steady"
  return "attention"
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function labelFor(score: number) {
  if (score >= 85) return "Well organized"
  if (score >= 70) return "Steady"
  if (score >= 55) return "Needs a little attention"
  return "Recovery mode could help"
}

function dateOnly(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

function parseFocusItems(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    const sourceType = String(record.source_type ?? record.type ?? "")
    const sourceId = record.source_id ?? record.id
    const title = typeof record.title === "string" ? record.title : "Focus item"
    return [{ sourceType, sourceId: sourceId === undefined || sourceId === null ? null : String(sourceId), title }]
  })
}

function component(input: Omit<LifeScoreComponent, "status" | "score"> & { score: number }): LifeScoreComponent {
  const score = clampScore(input.score)
  return { ...input, score, status: scoreStatus(score) }
}

function improvementFor(componentKey: LifeScoreComponentKey, score: number): LifeScoreImprovement {
  const fallback: Record<LifeScoreComponentKey, LifeScoreImprovement> = {
    focus_completion: {
      title: score < 70 ? "Choose one realistic focus item" : "Review today's focus",
      description: "Pick one to three visible priorities for today so the day has a clear center.",
      href: "/today",
      component_key: "focus_completion",
    },
    overdue_task_load: {
      title: "Clear one overdue task",
      description: "Complete, reschedule, or move one overdue task so the task list feels lighter.",
      href: "/tasks",
      component_key: "overdue_task_load",
    },
    habit_consistency: {
      title: "Check in on one habit",
      description: "Mark today's smallest habit win, or pause a habit that no longer fits this week.",
      href: "/habits",
      component_key: "habit_consistency",
    },
    goals_updated: {
      title: "Refresh one active goal",
      description: "Update progress, adjust the target date, or add a next task for one goal.",
      href: "/goals",
      component_key: "goals_updated",
    },
    weekly_review_status: {
      title: "Save this week's review",
      description: "A short weekly review is enough to keep the system honest and calm.",
      href: "/review",
      component_key: "weekly_review_status",
    },
    commitments_kept: {
      title: "Review one open commitment",
      description: "Check whether it is still realistic, at risk, or ready to become a task.",
      href: "/commitments",
      component_key: "commitments_kept",
    },
    maintenance_vault: {
      title: "Handle one overdue maintenance item",
      description: "Complete, reschedule, or pause one recurring maintenance or vault-related item.",
      href: "/maintenance",
      component_key: "maintenance_vault",
    },
    life_area_balance: {
      title: "Touch a quiet life domain",
      description: "Add one small task, note, or project update in a life domain that has been quiet.",
      href: "/domains",
      component_key: "life_area_balance",
    },
  }
  return fallback[componentKey]
}

function buildReasons(score: number, components: LifeScoreComponent[], previousComponents: LifeScoreComponent[] | null, previousScore: number | null) {
  const reasons: string[] = []

  if (previousScore === null) {
    const strongest = [...components].sort((a, b) => b.score - a.score)[0]
    const focus = [...components].sort((a, b) => a.score - b.score)[0]
    reasons.push("This is your first saved LifeScore snapshot.")
    if (strongest) reasons.push(`${strongest.label} is currently supporting the score.`)
    if (focus && focus.score < 80) reasons.push(`${focus.label} is the clearest place to make the score easier next.`)
    return reasons.slice(0, 3)
  }

  const delta = score - previousScore
  if (delta > 0) reasons.push(`LifeScore is up ${delta} point${delta === 1 ? "" : "s"} from the previous snapshot.`)
  else if (delta < 0) reasons.push(`LifeScore is down ${Math.abs(delta)} point${Math.abs(delta) === 1 ? "" : "s"} from the previous snapshot.`)
  else reasons.push("LifeScore is steady compared with the previous snapshot.")

  if (previousComponents) {
    const previousByKey = new Map(previousComponents.map((item) => [item.key, item]))
    const shifts = components
      .map((item) => ({ item, delta: item.score - (previousByKey.get(item.key)?.score ?? item.score) }))
      .filter((entry) => entry.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

    for (const shift of shifts.slice(0, 2)) {
      const direction = shift.delta > 0 ? "helped" : "needs a bit more attention"
      reasons.push(`${shift.item.label} ${direction} today.`)
    }
  }

  if (reasons.length < 3) {
    const focus = [...components].sort((a, b) => a.score - b.score)[0]
    if (focus) reasons.push(`${focus.label} is the most useful next lever.`)
  }

  return reasons.slice(0, 3)
}

async function getPreviousSnapshot(userId: string, unavailable: string[]) {
  const rows = await safeRows("life_score_history", sql`
    SELECT score, components
    FROM life_score_history
    WHERE user_id = ${userId} AND score_date < CURRENT_DATE
    ORDER BY score_date DESC
    LIMIT 1
  `, unavailable)
  const row = rows[0]
  if (!row) return { score: null as number | null, components: null as LifeScoreComponent[] | null }
  return {
    score: n(row.score),
    components: Array.isArray(row.components) ? row.components as LifeScoreComponent[] : null,
  }
}

async function saveSnapshot(userId: string, data: Omit<LifeScoreData, "history">, unavailable: string[]) {
  await safeRows("life_score_history", sql`
    INSERT INTO life_score_history (
      user_id,
      score_date,
      score,
      label,
      components,
      reasons,
      top_improvements,
      unavailable,
      updated_at
    )
    VALUES (
      ${userId},
      CURRENT_DATE,
      ${data.score},
      ${data.label},
      ${JSON.stringify(data.components)}::jsonb,
      ${JSON.stringify(data.reasons)}::jsonb,
      ${JSON.stringify(data.top_improvements)}::jsonb,
      ${data.unavailable},
      NOW()
    )
    ON CONFLICT (user_id, score_date)
    DO UPDATE SET
      score = EXCLUDED.score,
      label = EXCLUDED.label,
      components = EXCLUDED.components,
      reasons = EXCLUDED.reasons,
      top_improvements = EXCLUDED.top_improvements,
      unavailable = EXCLUDED.unavailable,
      updated_at = NOW()
    RETURNING id
  `, unavailable)
}

async function getHistory(userId: string, unavailable: string[]) {
  const rows = await safeRows("life_score_history", sql`
    SELECT score_date, score, label
    FROM life_score_history
    WHERE user_id = ${userId}
    ORDER BY score_date DESC
    LIMIT 14
  `, unavailable)

  return rows.reverse().map((row) => ({
    score_date: dateOnly(row.score_date) ?? "",
    score: Math.round(n(row.score)),
    label: typeof row.label === "string" ? row.label : labelFor(n(row.score)),
  })).filter((row) => row.score_date)
}

export async function getLifeScoreData(userId: string): Promise<LifeScoreData> {
  const unavailable: string[] = []

  const [
    todayPlan,
    taskSummary,
    goalSummary,
    habitSummary,
    weeklyReview,
    commitmentSummary,
    maintenanceSummary,
    vaultSummary,
    lifeAreas,
    activityByArea,
    previous,
  ] = await Promise.all([
    safeRows("daily_plans", sql`
      SELECT focus_items
      FROM daily_plans
      WHERE user_id = ${userId} AND plan_date = CURRENT_DATE
      LIMIT 1
    `, unavailable),
    safeRows("tasks", sql`
      SELECT
        COUNT(*)::int AS total_tasks,
        COUNT(*) FILTER (WHERE completed IS NOT TRUE)::int AS open_tasks,
        COUNT(*) FILTER (
          WHERE completed IS NOT TRUE AND due_date IS NOT NULL AND due_date < CURRENT_DATE
        )::int AS overdue_tasks,
        COUNT(*) FILTER (
          WHERE completed IS NOT TRUE
            AND COALESCE(priority, 'medium') = 'high'
            AND due_date IS NOT NULL
            AND due_date < CURRENT_DATE
        )::int AS high_overdue_tasks
      FROM tasks
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("goals", sql`
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(status, 'active') <> 'completed')::int AS active_goals,
        COUNT(*) FILTER (
          WHERE COALESCE(status, 'active') <> 'completed'
            AND COALESCE(updated_at, created_at) >= NOW() - INTERVAL '14 days'
        )::int AS recently_updated_goals,
        COUNT(*) FILTER (
          WHERE COALESCE(status, 'active') <> 'completed'
            AND COALESCE(updated_at, created_at) < NOW() - INTERVAL '30 days'
        )::int AS stale_goals
      FROM goals
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("habits", sql`
      SELECT
        COUNT(DISTINCT h.id)::int AS active_habits,
        COUNT(DISTINCT (hc.habit_id, hc.checkin_date)) FILTER (WHERE hc.count >= h.target_count)::int AS completed_checkins
      FROM habits h
      LEFT JOIN habit_checkins hc
        ON hc.habit_id = h.id
       AND hc.user_id = ${userId}
       AND hc.checkin_date >= CURRENT_DATE - INTERVAL '6 days'
       AND hc.checkin_date <= CURRENT_DATE
      WHERE h.user_id = ${userId} AND h.is_active IS NOT FALSE
    `, unavailable),
    safeRows("weekly_reviews", sql`
      SELECT
        COUNT(*)::int AS total_reviews,
        COUNT(*) FILTER (WHERE week_start = DATE_TRUNC('week', CURRENT_DATE)::date)::int AS current_week_reviews
      FROM weekly_reviews
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("commitments", sql`
      SELECT
        COUNT(*)::int AS total_commitments,
        COUNT(*) FILTER (WHERE status IN ('open', 'at_risk'))::int AS active_commitments,
        COUNT(*) FILTER (
          WHERE status IN ('open', 'at_risk') AND due_date IS NOT NULL AND due_date < CURRENT_DATE
        )::int AS overdue_commitments,
        COUNT(*) FILTER (WHERE status = 'missed')::int AS missed_commitments,
        COUNT(*) FILTER (
          WHERE status = 'completed' AND COALESCE(updated_at, created_at) >= NOW() - INTERVAL '30 days'
        )::int AS completed_recent
      FROM commitments
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("maintenance_items", sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active')::int AS active_maintenance,
        COUNT(*) FILTER (
          WHERE status = 'active' AND next_due_date IS NOT NULL AND next_due_date < CURRENT_DATE
        )::int AS overdue_maintenance
      FROM maintenance_items
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("vault_items", sql`
      SELECT
        COUNT(*)::int AS vault_items,
        COUNT(*) FILTER (
          WHERE (expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE)
             OR (renewal_date IS NOT NULL AND renewal_date < CURRENT_DATE)
        )::int AS overdue_vault
      FROM vault_items
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("life_areas", sql`
      SELECT id::text, name
      FROM life_areas
      WHERE user_id = ${userId}
    `, unavailable),
    safeRows("life_area_activity", sql`
      SELECT life_area_id::text, MAX(last_activity) AS last_activity
      FROM (
        SELECT life_area_id, COALESCE(updated_at, created_at) AS last_activity FROM tasks WHERE user_id = ${userId} AND life_area_id IS NOT NULL
        UNION ALL
        SELECT life_area_id, COALESCE(updated_at, created_at) AS last_activity FROM goals WHERE user_id = ${userId} AND life_area_id IS NOT NULL
        UNION ALL
        SELECT life_area_id, COALESCE(updated_at, created_at) AS last_activity FROM habits WHERE user_id = ${userId} AND life_area_id IS NOT NULL
        UNION ALL
        SELECT life_area_id, COALESCE(updated_at, created_at) AS last_activity FROM projects WHERE user_id = ${userId} AND life_area_id IS NOT NULL
        UNION ALL
        SELECT life_area_id, COALESCE(updated_at, created_at) AS last_activity FROM notes WHERE user_id = ${userId} AND life_area_id IS NOT NULL
        UNION ALL
        SELECT life_area_id, created_at AS last_activity FROM budget_categories WHERE user_id = ${userId} AND life_area_id IS NOT NULL
        UNION ALL
        SELECT life_area_id, COALESCE(updated_at, created_at) AS last_activity FROM wishlist_items WHERE user_id = ${userId} AND life_area_id IS NOT NULL
        UNION ALL
        SELECT life_area_id, COALESCE(updated_at, created_at) AS last_activity FROM investments WHERE user_id = ${userId} AND life_area_id IS NOT NULL
        UNION ALL
        SELECT life_area_id, COALESCE(updated_at, created_at) AS last_activity FROM income_sources WHERE user_id = ${userId} AND life_area_id IS NOT NULL
      ) activity
      GROUP BY life_area_id
    `, unavailable),
    getPreviousSnapshot(userId, unavailable),
  ])

  const focusItems = parseFocusItems(todayPlan[0]?.focus_items)
  const focusTaskIds = focusItems
    .filter((item) => item.sourceType === "task" && item.sourceId && /^\d+$/.test(item.sourceId))
    .map((item) => Number(item.sourceId))
  const focusTasks = focusTaskIds.length
    ? await safeRows("tasks", sql`
        SELECT id, completed
        FROM tasks
        WHERE user_id = ${userId} AND id = ANY(${focusTaskIds}::int[])
      `, unavailable)
    : []
  const completedFocusTasks = focusTasks.filter((row) => row.completed === true).length
  const focusScore = focusItems.length === 0
    ? 70
    : focusTaskIds.length === 0
      ? 82
      : 55 + (completedFocusTasks / Math.max(1, focusTaskIds.length)) * 45

  const tasks = taskSummary[0] ?? {}
  const totalTasks = n(tasks.total_tasks)
  const overdueTasks = n(tasks.overdue_tasks)
  const highOverdueTasks = n(tasks.high_overdue_tasks)
  const overdueScore = overdueTasks === 0 ? 100 : overdueTasks <= 2 ? 85 : overdueTasks <= 5 ? 65 : overdueTasks <= 10 ? 45 : 25

  const habits = habitSummary[0] ?? {}
  const activeHabits = n(habits.active_habits)
  const completedCheckins = n(habits.completed_checkins)
  const habitScore = activeHabits === 0 ? 82 : Math.min(100, (completedCheckins / Math.max(1, activeHabits * 7)) * 100)

  const goals = goalSummary[0] ?? {}
  const activeGoals = n(goals.active_goals)
  const recentlyUpdatedGoals = n(goals.recently_updated_goals)
  const staleGoals = n(goals.stale_goals)
  const goalsScore = activeGoals === 0 ? 82 : Math.max(35, (recentlyUpdatedGoals / Math.max(1, activeGoals)) * 100 - staleGoals * 4)

  const reviews = weeklyReview[0] ?? {}
  const totalReviews = n(reviews.total_reviews)
  const weeklyScore = n(reviews.current_week_reviews) > 0 ? 100 : 65

  const commitments = commitmentSummary[0] ?? {}
  const totalCommitments = n(commitments.total_commitments)
  const activeCommitments = n(commitments.active_commitments)
  const overdueCommitments = n(commitments.overdue_commitments)
  const missedCommitments = n(commitments.missed_commitments)
  const completedRecentCommitments = n(commitments.completed_recent)
  const commitmentBase = activeCommitments + completedRecentCommitments === 0 ? 86 : 100
  const commitmentScore = commitmentBase - overdueCommitments * 18 - missedCommitments * 10

  const maintenance = maintenanceSummary[0] ?? {}
  const vault = vaultSummary[0] ?? {}
  const overdueMaintenance = n(maintenance.overdue_maintenance)
  const overdueVault = n(vault.overdue_vault)
  const maintenanceScore = (n(maintenance.active_maintenance) + n(vault.vault_items)) === 0
    ? 86
    : 100 - overdueMaintenance * 18 - overdueVault * 12

  const lifeAreaCount = lifeAreas.length
  const activeAreaIds = new Set(activityByArea
    .filter((row) => {
      const date = row.last_activity ? new Date(row.last_activity) : null
      if (!date || Number.isNaN(date.getTime())) return false
      return Date.now() - date.getTime() <= 30 * 86_400_000
    })
    .map((row) => String(row.life_area_id)))
  const quietAreas = Math.max(0, lifeAreaCount - activeAreaIds.size)
  const balanceScore = lifeAreaCount === 0 ? 82 : Math.max(45, 100 - (quietAreas / Math.max(1, lifeAreaCount)) * 55)

  const unavailableSet = new Set(unavailable)
  const componentSourceMap: Record<LifeScoreComponentKey, string[]> = {
    focus_completion: ["daily_plans", "tasks"],
    overdue_task_load: ["tasks"],
    habit_consistency: ["habits"],
    goals_updated: ["goals"],
    weekly_review_status: ["weekly_reviews"],
    commitments_kept: ["commitments"],
    maintenance_vault: ["maintenance_items", "vault_items"],
    life_area_balance: ["life_areas", "life_area_activity"],
  }
  const isComponentAvailable = (key: LifeScoreComponentKey) =>
    !componentSourceMap[key].some((source) => unavailableSet.has(source))
  const components: LifeScoreComponent[] = []

  if (focusItems.length > 0 && isComponentAvailable("focus_completion")) {
    components.push(component({
      key: "focus_completion",
      label: "Focus completion",
      score: focusScore,
      weight: 15,
      explanation: focusItems.length === 0
        ? "No focus items are selected today, so this is a gentle neutral score."
        : `${completedFocusTasks}/${Math.max(focusTaskIds.length, focusItems.length)} visible focus item${focusItems.length === 1 ? "" : "s"} are complete or ready.`,
      href: "/today",
    }))
  }

  if (totalTasks > 0 && isComponentAvailable("overdue_task_load")) {
    components.push(component({
      key: "overdue_task_load",
      label: "Overdue task load",
      score: overdueScore,
      weight: 20,
      explanation: overdueTasks === 0
        ? "No overdue tasks are weighing down today."
        : `${overdueTasks} overdue task${overdueTasks === 1 ? "" : "s"} need a decision, including ${highOverdueTasks} high-priority item${highOverdueTasks === 1 ? "" : "s"}.`,
      href: "/tasks",
    }))
  }

  if (activeHabits > 0 && isComponentAvailable("habit_consistency")) {
    components.push(component({
      key: "habit_consistency",
      label: "Habit consistency",
      score: habitScore,
      weight: 15,
      explanation: activeHabits === 0
        ? "No active habits are tracked yet, so this stays neutral."
        : `${completedCheckins} habit check-in${completedCheckins === 1 ? "" : "s"} logged across the last 7 days.`,
      href: "/habits",
    }))
  }

  if (activeGoals > 0 && isComponentAvailable("goals_updated")) {
    components.push(component({
      key: "goals_updated",
      label: "Goals updated",
      score: goalsScore,
      weight: 15,
      explanation: activeGoals === 0
        ? "No active goals are tracked yet, so this stays neutral."
        : `${recentlyUpdatedGoals}/${activeGoals} active goal${activeGoals === 1 ? "" : "s"} were updated recently.`,
      href: "/goals",
    }))
  }

  if (totalReviews > 0 && isComponentAvailable("weekly_review_status")) {
    components.push(component({
      key: "weekly_review_status",
      label: "Weekly review",
      score: weeklyScore,
      weight: 10,
      explanation: n(reviews.current_week_reviews) > 0
        ? "This week's review has been saved."
        : "This week's review is still open.",
      href: "/review",
    }))
  }

  if (totalCommitments > 0 && isComponentAvailable("commitments_kept")) {
    components.push(component({
      key: "commitments_kept",
      label: "Commitments kept",
      score: commitmentScore,
      weight: 10,
      explanation: overdueCommitments === 0 && missedCommitments === 0
        ? "No open commitments are overdue or marked missed."
        : `${overdueCommitments} open commitment${overdueCommitments === 1 ? "" : "s"} are overdue and ${missedCommitments} are marked missed.`,
      href: "/commitments",
    }))
  }

  if ((n(maintenance.active_maintenance) + n(vault.vault_items)) > 0 && isComponentAvailable("maintenance_vault")) {
    components.push(component({
      key: "maintenance_vault",
      label: "Maintenance and vault",
      score: maintenanceScore,
      weight: 10,
      explanation: overdueMaintenance === 0 && overdueVault === 0
        ? "Maintenance and vault dates look current."
        : `${overdueMaintenance + overdueVault} maintenance or vault date${overdueMaintenance + overdueVault === 1 ? "" : "s"} need attention.`,
      href: "/maintenance",
    }))
  }

  if (activeAreaIds.size > 0 && isComponentAvailable("life_area_balance")) {
    components.push(component({
      key: "life_area_balance",
      label: "Life domain balance",
      score: balanceScore,
      weight: 5,
      explanation: lifeAreaCount === 0
        ? "No Life Domains are set up yet, so this stays neutral."
        : `${activeAreaIds.size}/${lifeAreaCount} Life Domain${lifeAreaCount === 1 ? "" : "s"} have recent tracked activity.`,
      href: "/insights",
    }))
  }

  const score = components.length
    ? clampScore(components.reduce((sum, item) => sum + item.score * item.weight, 0) / components.reduce((sum, item) => sum + item.weight, 0))
    : 0
  const label = labelFor(score)
  const reasons = buildReasons(score, components, previous.components, previous.score)
  const topImprovements = [...components]
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map((item) => improvementFor(item.key, item.score))

  const snapshot = {
    generated_at: new Date().toISOString(),
    ready: components.length > 0,
    score,
    label: components.length > 0 ? label : "Not enough data yet",
    previous_score: previous.score,
    change: components.length > 0 && previous.score !== null ? score - previous.score : null,
    components,
    reasons: components.length > 0 ? reasons : [],
    top_improvements: topImprovements,
    unavailable: Array.from(new Set(unavailable)),
  }

  if (snapshot.ready) await saveSnapshot(userId, snapshot, unavailable)
  const history = await getHistory(userId, unavailable)

  return {
    ...snapshot,
    unavailable: Array.from(new Set(unavailable)),
    history,
  }
}
