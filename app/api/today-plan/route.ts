import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

type Row = Record<string, any>

type FocusItem = {
  id: string
  source_type: string
  source_id: string | null
  title: string
  href: string
  custom: boolean
}

const energyLevels = new Set(["low", "medium", "high"])
const dayTypes = new Set(["normal", "busy", "travel", "sick", "school", "work-heavy", "recovery"])

const sourceTypes = new Set([
  "task",
  "goal",
  "calendar",
  "note",
  "budget",
  "wishlist",
  "project",
  "habit",
  "inbox",
  "waiting",
  "commitment",
  "maintenance",
  "custom",
])

function isValidDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value))
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback
}

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || 0))
  return Number.isFinite(parsed) ? parsed : 0
}

function dateKey(value: unknown) {
  return value ? String(value).slice(0, 10) : ""
}

function cleanEnergyLevel(value: unknown) {
  const normalized = text(value, "medium").toLowerCase()
  return energyLevels.has(normalized) ? normalized : "medium"
}

function cleanDayType(value: unknown) {
  const normalized = text(value, "normal").toLowerCase()
  return dayTypes.has(normalized) ? normalized : "normal"
}

function cleanFocusMinutes(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.min(1440, parsed))
}

function cleanMood(value: unknown) {
  const mood = text(value)
  return mood ? mood.slice(0, 120) : ""
}

function normalizeFocusItems(value: unknown): FocusItem[] {
  if (!Array.isArray(value)) return []

  return value
    .slice(0, 3)
    .map((item, index) => {
      const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
      const title = text(raw.title)
      const sourceType = text(raw.source_type, "custom")
      const custom = Boolean(raw.custom || sourceType === "custom")

      if (!title) return null
      if (!custom && !sourceTypes.has(sourceType)) return null
      const sourceId = custom ? null : text(raw.source_id)
      if (!custom && !sourceId) return null

      return {
        id: text(raw.id, custom ? `custom-${index}` : `${sourceType}-${sourceId}`),
        source_type: custom ? "custom" : sourceType,
        source_id: sourceId,
        title,
        href: custom ? "/today" : text(raw.href, "/today"),
        custom,
      }
    })
    .filter((item): item is FocusItem => Boolean(item))
}

function normalizeTodayItemOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const ids: string[] = []

  value.forEach((item) => {
    if (typeof item !== "string") return
    const id = item.trim()
    if (!id || id.length > 120 || seen.has(id)) return
    seen.add(id)
    ids.push(id)
  })

  return ids.slice(0, 50)
}

function applyTodayItemOrder<T extends { id: string }>(items: T[], order: string[]) {
  if (items.length === 0 || order.length === 0) return items

  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered: T[] = []
  const used = new Set<string>()

  order.forEach((id) => {
    const item = byId.get(id)
    if (!item) return
    ordered.push(item)
    used.add(id)
  })

  items.forEach((item) => {
    if (!used.has(item.id)) ordered.push(item)
  })

  return ordered
}

function baseRecommendedFocus(energyLevel: string) {
  if (energyLevel === "low") return 1
  if (energyLevel === "high") return 3
  return 2
}

function deriveCapacitySummary(input: {
  energyLevel: string
  availableFocusMinutes: number | null
  dayType: string
  focusCount: number
  dueOrOverdueItems: number
  highPriorityDueTasks: number
}) {
  let recommendedFocusCount = baseRecommendedFocus(input.energyLevel)
  if (input.availableFocusMinutes !== null) {
    if (input.availableFocusMinutes < 60) recommendedFocusCount = Math.min(recommendedFocusCount, 1)
    else if (input.availableFocusMinutes < 120) recommendedFocusCount = Math.min(recommendedFocusCount, 2)
  }

  if (["busy", "travel", "sick", "recovery"].includes(input.dayType)) {
    recommendedFocusCount = Math.min(recommendedFocusCount, 2)
  }

  const estimatedTaskCapacity =
    input.availableFocusMinutes === null
      ? recommendedFocusCount + 2
      : Math.max(1, Math.min(8, Math.floor(input.availableFocusMinutes / 45)))

  const warnings: Array<{ type: string; message: string }> = []
  if (input.focusCount > recommendedFocusCount) {
    warnings.push({
      type: "focus_count",
      message: `You picked ${input.focusCount} focus items; ${recommendedFocusCount} may fit better today.`,
    })
  }
  if (input.dueOrOverdueItems > estimatedTaskCapacity) {
    warnings.push({
      type: "task_load",
      message: `${input.dueOrOverdueItems} due or overdue items may be too much for the focus time available.`,
    })
  }
  if (input.highPriorityDueTasks >= 3) {
    warnings.push({
      type: "high_priority",
      message: `${input.highPriorityDueTasks} high-priority due or overdue items may make today feel overloaded.`,
    })
  }

  return {
    recommended_focus_count: recommendedFocusCount,
    estimated_task_capacity: estimatedTaskCapacity,
    overload: warnings.length > 0,
    warnings,
  }
}

async function safeRows(label: string, query: Promise<Row[]>, unavailable?: string[]): Promise<Row[]> {
  try {
    return await query
  } catch (error) {
    console.error(`[today-plan] ${label} query failed:`, error)
    unavailable?.push(label)
    return []
  }
}

async function safePlan(userId: string, planDate: string) {
  try {
    const rows = await sql`
      SELECT *
      FROM daily_plans
      WHERE user_id = ${userId} AND plan_date = ${planDate}
      LIMIT 1
    `
    return rows[0] || null
  } catch (error) {
    console.error("[today-plan] daily_plans query failed:", error)
    return null
  }
}

function taskItem(task: Row, label?: string) {
  return {
    id: `task-${task.id}`,
    source_type: "task",
    source_id: String(task.id),
    title: String(task.title || "Untitled task"),
    subtitle: label || [task.priority, task.due_date].filter(Boolean).join(" · "),
    href: "/tasks",
    custom: false,
    priority: task.priority || "medium",
    date: task.due_date || null,
  }
}

function goalItem(goal: Row, label?: string) {
  return {
    id: `goal-${goal.id}`,
    source_type: "goal",
    source_id: String(goal.id),
    title: String(goal.title || "Untitled goal"),
    subtitle: label || [goal.priority, goal.target_date].filter(Boolean).join(" · "),
    href: "/goals",
    custom: false,
    priority: goal.priority || "medium",
    date: goal.target_date || null,
  }
}

function projectItem(project: Row, label?: string) {
  return {
    id: `project-${project.id}`,
    source_type: "project",
    source_id: String(project.id),
    title: String(project.title || "Untitled project"),
    subtitle: label || [project.priority, project.due_date].filter(Boolean).join(" · "),
    href: `/projects/${project.id}`,
    custom: false,
    priority: project.priority || "medium",
    date: project.due_date || null,
  }
}

function waitingItem(item: Row, label?: string) {
  const date = item.follow_up_date || item.expected_date || null
  return {
    id: `waiting-${item.id}`,
    source_type: "waiting",
    source_id: String(item.id),
    title: String(item.title || "Waiting item"),
    subtitle: label || [item.waiting_on_name, date].filter(Boolean).join(" · "),
    href: "/waiting",
    custom: false,
    priority: "medium",
    date,
  }
}

function commitmentItem(item: Row, label?: string) {
  return {
    id: `commitment-${item.id}`,
    source_type: "commitment",
    source_id: String(item.id),
    title: String(item.title || "Commitment"),
    subtitle: label || [item.committed_to, item.due_date].filter(Boolean).join(" · "),
    href: "/commitments",
    custom: false,
    priority: item.status === "at_risk" ? "high" : "medium",
    date: item.due_date || null,
  }
}

function maintenanceItem(item: Row, label?: string) {
  return {
    id: `maintenance-${item.id}`,
    source_type: "maintenance",
    source_id: String(item.id),
    title: String(item.title || "Maintenance item"),
    subtitle: label || [item.category, item.next_due_date].filter(Boolean).join(" · "),
    href: "/maintenance",
    custom: false,
    priority: "medium",
    date: item.next_due_date || null,
  }
}

function noteItem(note: Row) {
  return {
    id: `note-${note.id}`,
    source_type: "note",
    source_id: String(note.id),
    title: String(note.title || "Untitled note"),
    subtitle: note.updated_at ? `Updated ${new Date(note.updated_at).toLocaleDateString()}` : "Recently updated",
    href: "/notes",
    custom: false,
    date: note.updated_at || null,
  }
}

function calendarItem(event: Row) {
  return {
    id: `calendar-${event.id}`,
    source_type: "calendar",
    source_id: String(event.id),
    title: String(event.title || "Calendar event"),
    subtitle: [event.start_time, event.location].filter(Boolean).join(" · "),
    href: "/calendar",
    custom: false,
    date: event.event_date || null,
  }
}

function budgetItem(id: string, title: string, subtitle: string) {
  return {
    id,
    source_type: "budget",
    source_id: id,
    title,
    subtitle,
    href: "/money?tab=budget",
    custom: false,
  }
}

function wishlistItem(item: Row, subtitle: string) {
  return {
    id: `wishlist-${item.id}`,
    source_type: "wishlist",
    source_id: String(item.id),
    title: String(item.title || "Wishlist item"),
    subtitle,
    href: "/money?tab=wishlist",
    custom: false,
  }
}

async function getDerivedCandidates(userId: string, planDate: string) {
  const unavailable: string[] = []
  const tomorrow = addDays(planDate, 1)
  const sevenDays = addDays(planDate, 7)
  const fourteenDays = addDays(planDate, 14)
  const recentCutoff = addDays(planDate, -7)
  const monthStart = `${planDate.slice(0, 7)}-01`
  const nextMonth = addDays(`${planDate.slice(0, 7)}-28`, 4).slice(0, 8) + "01"

  const [
    overdueTasks,
    todayTasks,
    overdueGoals,
    todayGoals,
    overdueProjects,
    todayProjects,
    waitingDue,
    commitmentsDue,
    maintenanceDue,
    undatedTasks,
    upcomingTasks,
    upcomingGoals,
    todayEvents,
    recentNotes,
    budgetCategories,
    budgetGoals,
    wishlist,
    savingsProgress,
  ] = await Promise.all([
    safeRows("overdue tasks", sql`
      SELECT id, title, priority, due_date, updated_at, created_at
      FROM tasks
      WHERE user_id = ${userId}
        AND completed = false
        AND due_date IS NOT NULL
        AND due_date < ${planDate}
      ORDER BY due_date ASC, priority DESC, updated_at DESC NULLS LAST
      LIMIT 12
    `, unavailable),
    safeRows("today tasks", sql`
      SELECT id, title, priority, due_date, updated_at, created_at
      FROM tasks
      WHERE user_id = ${userId}
        AND completed = false
        AND due_date = ${planDate}
      ORDER BY
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        updated_at DESC NULLS LAST
      LIMIT 16
    `, unavailable),
    safeRows("overdue goals", sql`
      SELECT id, title, priority, target_date, status, updated_at, created_at
      FROM goals
      WHERE user_id = ${userId}
        AND COALESCE(status, 'active') != 'completed'
        AND target_date IS NOT NULL
        AND target_date < ${planDate}
      ORDER BY target_date ASC, updated_at DESC NULLS LAST
      LIMIT 8
    `, unavailable),
    safeRows("today goals", sql`
      SELECT id, title, priority, target_date, status, updated_at, created_at
      FROM goals
      WHERE user_id = ${userId}
        AND COALESCE(status, 'active') != 'completed'
        AND target_date = ${planDate}
      ORDER BY
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        updated_at DESC NULLS LAST
      LIMIT 8
    `, unavailable),
    safeRows("overdue projects", sql`
      SELECT id, title, priority, due_date, status, updated_at, created_at
      FROM projects
      WHERE user_id = ${userId}
        AND status NOT IN ('completed', 'archived')
        AND due_date IS NOT NULL
        AND due_date < ${planDate}
      ORDER BY due_date ASC, updated_at DESC NULLS LAST
      LIMIT 8
    `, unavailable),
    safeRows("today projects", sql`
      SELECT id, title, priority, due_date, status, updated_at, created_at
      FROM projects
      WHERE user_id = ${userId}
        AND status NOT IN ('completed', 'archived')
        AND due_date = ${planDate}
      ORDER BY
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        updated_at DESC NULLS LAST
      LIMIT 8
    `, unavailable),
    safeRows("waiting due", sql`
      SELECT id, title, waiting_on_name, status, expected_date, follow_up_date, updated_at, created_at
      FROM waiting_items
      WHERE user_id = ${userId}
        AND status IN ('waiting', 'follow_up_needed')
        AND (
          (follow_up_date IS NOT NULL AND follow_up_date <= ${planDate})
          OR (expected_date IS NOT NULL AND expected_date <= ${planDate})
        )
      ORDER BY follow_up_date ASC NULLS LAST, expected_date ASC NULLS LAST, updated_at DESC NULLS LAST
      LIMIT 8
    `, unavailable),
    safeRows("commitments due", sql`
      SELECT id, title, committed_to, status, due_date, updated_at, created_at
      FROM commitments
      WHERE user_id = ${userId}
        AND status IN ('open', 'at_risk')
        AND due_date IS NOT NULL
        AND due_date <= ${planDate}
      ORDER BY due_date ASC, updated_at DESC NULLS LAST
      LIMIT 8
    `, unavailable),
    safeRows("maintenance due", sql`
      SELECT id, title, category, next_due_date, updated_at, created_at
      FROM maintenance_items
      WHERE user_id = ${userId}
        AND status = 'active'
        AND next_due_date IS NOT NULL
        AND next_due_date <= ${planDate}
      ORDER BY next_due_date ASC, updated_at DESC NULLS LAST
      LIMIT 8
    `, unavailable),
    safeRows("undated tasks", sql`
      SELECT id, title, priority, due_date, updated_at, created_at
      FROM tasks
      WHERE user_id = ${userId}
        AND completed = false
        AND due_date IS NULL
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 6
    `, unavailable),
    safeRows("upcoming tasks", sql`
      SELECT id, title, priority, due_date, updated_at, created_at
      FROM tasks
      WHERE user_id = ${userId}
        AND completed = false
        AND due_date >= ${tomorrow}
        AND due_date <= ${fourteenDays}
      ORDER BY due_date ASC
      LIMIT 12
    `, unavailable),
    safeRows("upcoming goals", sql`
      SELECT id, title, priority, target_date, status, updated_at, created_at
      FROM goals
      WHERE user_id = ${userId}
        AND COALESCE(status, 'active') != 'completed'
        AND target_date >= ${tomorrow}
        AND target_date <= ${fourteenDays}
      ORDER BY target_date ASC
      LIMIT 12
    `, unavailable),
    safeRows("calendar today", sql`
      SELECT id, title, event_date, start_time, end_time, location, updated_at, created_at
      FROM calendar_events
      WHERE user_id = ${userId}
        AND event_date = ${planDate}
      ORDER BY start_time ASC
      LIMIT 12
    `, unavailable),
    safeRows("recent notes", sql`
      SELECT id, title, content, updated_at, created_at
      FROM notes
      WHERE user_id = ${userId}
        AND COALESCE(updated_at, created_at) >= ${recentCutoff}
      ORDER BY COALESCE(updated_at, created_at) DESC
      LIMIT 8
    `, unavailable),
    safeRows("budget categories", sql`
      SELECT
        c.id,
        c.name,
        c.budget_limit,
        COALESCE(SUM(t.amount), 0) AS spent
      FROM budget_categories c
      LEFT JOIN budget_transactions t
        ON t.category_id = c.id
        AND t.user_id = ${userId}
        AND t.type = 'expense'
        AND t.date >= ${monthStart}
        AND t.date < ${nextMonth}
      WHERE c.user_id = ${userId}
        AND c.budget_limit > 0
      GROUP BY c.id, c.name, c.budget_limit
      HAVING COALESCE(SUM(t.amount), 0) >= c.budget_limit * 0.8
      ORDER BY COALESCE(SUM(t.amount), 0) / NULLIF(c.budget_limit, 0) DESC
      LIMIT 5
    `, unavailable),
    safeRows("budget goals", sql`
      SELECT id, name, target_amount, current_amount, deadline
      FROM budget_goals
      WHERE user_id = ${userId}
        AND deadline IS NOT NULL
        AND deadline >= ${planDate}
        AND deadline <= ${fourteenDays}
      ORDER BY deadline ASC
      LIMIT 5
    `, unavailable),
    safeRows("wishlist", sql`
      SELECT id, title, price, priority, purchased, updated_at, created_at
      FROM wishlist_items
      WHERE user_id = ${userId}
        AND purchased = false
      ORDER BY
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        updated_at DESC NULLS LAST
      LIMIT 6
    `, unavailable),
    safeRows("savings progress", sql`
      SELECT
        w.id,
        w.title,
        w.price,
        COALESCE(SUM(i.current_value), 0) AS saved
      FROM wishlist_items w
      JOIN investments i ON i.wishlist_item_id = w.id AND i.user_id = ${userId}
      WHERE w.user_id = ${userId}
        AND w.purchased = false
        AND w.price IS NOT NULL
        AND w.price > 0
      GROUP BY w.id, w.title, w.price
      ORDER BY w.updated_at DESC NULLS LAST
      LIMIT 5
    `, unavailable),
  ])

  const highOrMediumToday = todayTasks.filter((task) => task.priority !== "low")
  const lowToday = todayTasks.filter((task) => task.priority === "low")
  const todayToDo = [
    ...overdueTasks.map((task) => taskItem(task, `Overdue since ${task.due_date}`)),
    ...highOrMediumToday.map((task) => taskItem(task, "Due today")),
    ...lowToday.map((task) => taskItem(task, "Low-priority task due today")),
    ...overdueGoals.map((goal) => goalItem(goal, `Goal overdue since ${goal.target_date}`)),
    ...todayGoals.map((goal) => goalItem(goal, "Goal due today")),
    ...overdueProjects.map((project) => projectItem(project, `Project overdue since ${project.due_date}`)),
    ...todayProjects.map((project) => projectItem(project, "Project due today")),
    ...waitingDue.map((item) => {
      const date = dateKey(item.follow_up_date || item.expected_date)
      return waitingItem(item, date && date < planDate ? `Follow-up overdue since ${date}` : "Follow-up due today")
    }),
    ...commitmentsDue.map((item) => {
      const date = dateKey(item.due_date)
      return commitmentItem(item, date < planDate ? `Commitment overdue since ${date}` : "Commitment due today")
    }),
    ...maintenanceDue.map((item) => {
      const date = dateKey(item.next_due_date)
      return maintenanceItem(item, date < planDate ? `Maintenance overdue since ${date}` : "Maintenance due today")
    }),
  ].slice(0, 20)
  const dueOrOverdueItemCount =
    overdueTasks.length +
    todayTasks.length +
    overdueGoals.length +
    todayGoals.length +
    overdueProjects.length +
    todayProjects.length +
    waitingDue.length +
    commitmentsDue.length +
    maintenanceDue.length

  const mustDo = [
    ...todayToDo,
  ].slice(0, 12)

  const budgetReminders = [
    ...budgetCategories.map((category) => {
      const spent = toNumber(category.spent)
      const limit = toNumber(category.budget_limit)
      const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0
      return budgetItem(`budget-category-${category.id}`, `${category.name} budget`, `${percent}% used this month`)
    }),
    ...budgetGoals.map((goal) => {
      const target = toNumber(goal.target_amount)
      const current = toNumber(goal.current_amount)
      const remaining = Math.max(0, target - current)
      return budgetItem(`budget-goal-${goal.id}`, goal.name || "Savings goal", `$${remaining.toFixed(0)} left · due ${goal.deadline}`)
    }),
  ]

  const shouldDo = [
    ...upcomingGoals.filter((goal) => goal.target_date <= sevenDays).map((goal) => goalItem(goal, `Goal due ${goal.target_date}`)),
    ...budgetReminders,
  ].slice(0, 12)

  const couldDo = [
    ...undatedTasks.map((task) => taskItem(task, "No due date")),
    ...recentNotes.slice(0, 4).map(noteItem),
    ...wishlist.slice(0, 4).map((item) => wishlistItem(item, item.price ? `$${item.price} wishlist item` : "Wishlist item")),
    ...savingsProgress.map((item) => {
      const price = toNumber(item.price)
      const saved = toNumber(item.saved)
      const percent = price > 0 ? Math.min(100, Math.round((saved / price) * 100)) : 0
      return wishlistItem(item, `${percent}% funded`)
    }),
  ].slice(0, 12)

  const upcomingDeadlines = [
    ...upcomingTasks.map((task) => taskItem(task, `Due ${task.due_date}`)),
    ...upcomingGoals.map((goal) => goalItem(goal, `Due ${goal.target_date}`)),
  ]
    .sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime())
    .slice(0, 12)

  const focusSuggestions = [
    ...mustDo,
    ...todayEvents.map(calendarItem),
    ...shouldDo,
    ...upcomingDeadlines,
  ].slice(0, 10)

  return {
    focusSuggestions,
    todayToDo,
    mustDo,
    shouldDo,
    couldDo,
    upcomingDeadlines,
    calendarToday: todayEvents.map(calendarItem),
    quickNotes: recentNotes.map(noteItem),
    unavailable,
    summary: {
      focusSuggestions: focusSuggestions.length,
      mustDo: mustDo.length,
      shouldDo: shouldDo.length,
      couldDo: couldDo.length,
      upcomingDeadlines: upcomingDeadlines.length,
      calendarToday: todayEvents.length,
      quickNotes: recentNotes.length,
      dueOrOverdueTasks: overdueTasks.length + todayTasks.length,
      dueOrOverdueItems: dueOrOverdueItemCount,
      highPriorityDueTasks: [
        ...overdueTasks,
        ...todayTasks,
        ...overdueGoals,
        ...todayGoals,
        ...overdueProjects,
        ...todayProjects,
        ...commitmentsDue.filter((item) => item.status === "at_risk"),
      ].filter((item) => item.priority === "high" || item.status === "at_risk").length,
    },
  }
}

export async function GET(request: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const planDate = url.searchParams.get("date")
  if (!isValidDate(planDate)) {
    return NextResponse.json({ error: "A valid date is required" }, { status: 400 })
  }

  const [savedPlan, candidates] = await Promise.all([
    safePlan(user.id, planDate!),
    getDerivedCandidates(user.id, planDate!),
  ])
  const todayItemOrder = normalizeTodayItemOrder(savedPlan?.today_item_order)
  const todayToDo = applyTodayItemOrder(candidates.todayToDo, todayItemOrder)
  const orderedCandidates = {
    ...candidates,
    todayToDo,
    mustDo: todayToDo.length ? todayToDo.slice(0, 12) : candidates.mustDo,
  }

  const plan = {
    id: savedPlan?.id ? String(savedPlan.id) : null,
    plan_date: planDate,
    focus_items: normalizeFocusItems(savedPlan?.focus_items),
    today_item_order: todayItemOrder,
    energy_level: cleanEnergyLevel(savedPlan?.energy_level),
    available_focus_minutes: cleanFocusMinutes(savedPlan?.available_focus_minutes),
    mood: cleanMood(savedPlan?.mood),
    day_type: cleanDayType(savedPlan?.day_type),
    reflection_went_well: savedPlan?.reflection_went_well || "",
    reflection_did_not_go_well: savedPlan?.reflection_did_not_go_well || "",
    reflection_improve_tomorrow: savedPlan?.reflection_improve_tomorrow || "",
  }
  const capacity = deriveCapacitySummary({
    energyLevel: plan.energy_level,
    availableFocusMinutes: plan.available_focus_minutes,
    dayType: plan.day_type,
    focusCount: plan.focus_items.length,
    dueOrOverdueItems: candidates.summary.dueOrOverdueItems,
    highPriorityDueTasks: candidates.summary.highPriorityDueTasks,
  })

  return NextResponse.json({
    plan,
    candidates: orderedCandidates,
    capacity,
    summary: {
      focusItems: plan.focus_items.length,
      dueOrOverdueTasks: candidates.summary.dueOrOverdueTasks,
      dueOrOverdueItems: candidates.summary.dueOrOverdueItems,
      highPriorityDueTasks: candidates.summary.highPriorityDueTasks,
      calendarToday: candidates.summary.calendarToday,
    },
  })
}

export async function PATCH(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const planDate = text(body.plan_date)
    if (!isValidDate(planDate)) {
      return NextResponse.json({ error: "A valid plan_date is required" }, { status: 400 })
    }

    const todayItemOrder = normalizeTodayItemOrder(body.today_item_order)
    const rows = await sql`
      INSERT INTO daily_plans (
        user_id,
        plan_date,
        today_item_order
      )
      VALUES (
        ${user.id},
        ${planDate},
        ${JSON.stringify(todayItemOrder)}::jsonb
      )
      ON CONFLICT (user_id, plan_date)
      DO UPDATE SET
        today_item_order = EXCLUDED.today_item_order,
        updated_at = NOW()
      RETURNING id, plan_date, today_item_order
    `

    return NextResponse.json({
      plan: {
        id: String(rows[0].id),
        plan_date: String(rows[0].plan_date).slice(0, 10),
        today_item_order: normalizeTodayItemOrder(rows[0].today_item_order),
      },
    })
  } catch (error) {
    console.error("[today-plan] reorder save error:", error)
    return NextResponse.json({ error: "Failed to save today order" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const planDate = text(body.plan_date)
    if (!isValidDate(planDate)) {
      return NextResponse.json({ error: "A valid plan_date is required" }, { status: 400 })
    }

    const focusItems = normalizeFocusItems(body.focus_items)
    const energyLevel = cleanEnergyLevel(body.energy_level)
    const availableFocusMinutes = cleanFocusMinutes(body.available_focus_minutes)
    const mood = cleanMood(body.mood)
    const dayType = cleanDayType(body.day_type)
    const reflectionWentWell = text(body.reflection_went_well)
    const reflectionDidNotGoWell = text(body.reflection_did_not_go_well)
    const reflectionImproveTomorrow = text(body.reflection_improve_tomorrow)

    const rows = await sql`
      INSERT INTO daily_plans (
        user_id,
        plan_date,
        focus_items,
        energy_level,
        available_focus_minutes,
        mood,
        day_type,
        reflection_went_well,
        reflection_did_not_go_well,
        reflection_improve_tomorrow
      )
      VALUES (
        ${user.id},
        ${planDate},
        ${JSON.stringify(focusItems)}::jsonb,
        ${energyLevel},
        ${availableFocusMinutes},
        ${mood || null},
        ${dayType},
        ${reflectionWentWell || null},
        ${reflectionDidNotGoWell || null},
        ${reflectionImproveTomorrow || null}
      )
      ON CONFLICT (user_id, plan_date)
      DO UPDATE SET
        focus_items = EXCLUDED.focus_items,
        energy_level = EXCLUDED.energy_level,
        available_focus_minutes = EXCLUDED.available_focus_minutes,
        mood = EXCLUDED.mood,
        day_type = EXCLUDED.day_type,
        reflection_went_well = EXCLUDED.reflection_went_well,
        reflection_did_not_go_well = EXCLUDED.reflection_did_not_go_well,
        reflection_improve_tomorrow = EXCLUDED.reflection_improve_tomorrow,
        updated_at = NOW()
      RETURNING *
    `

    return NextResponse.json({
      plan: {
        ...rows[0],
        id: String(rows[0].id),
        focus_items: normalizeFocusItems(rows[0].focus_items),
        energy_level: cleanEnergyLevel(rows[0].energy_level),
        available_focus_minutes: cleanFocusMinutes(rows[0].available_focus_minutes),
        mood: cleanMood(rows[0].mood),
        day_type: cleanDayType(rows[0].day_type),
        reflection_went_well: rows[0].reflection_went_well || "",
        reflection_did_not_go_well: rows[0].reflection_did_not_go_well || "",
        reflection_improve_tomorrow: rows[0].reflection_improve_tomorrow || "",
      },
    })
  } catch (error) {
    console.error("[today-plan] save error:", error)
    return NextResponse.json({ error: "Failed to save today plan" }, { status: 500 })
  }
}
