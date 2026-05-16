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

const sourceTypes = new Set(["task", "goal", "calendar", "note", "budget", "wishlist", "custom"])

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
    href: "/budget",
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
    href: "/wishlist",
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

  const mustDo = [
    ...overdueTasks.map((task) => taskItem(task, `Overdue since ${task.due_date}`)),
    ...highOrMediumToday.map((task) => taskItem(task, "Due today")),
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
    ...lowToday.map((task) => taskItem(task, "Low-priority task due today")),
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

  const plan = {
    id: savedPlan?.id ? String(savedPlan.id) : null,
    plan_date: planDate,
    focus_items: normalizeFocusItems(savedPlan?.focus_items),
    reflection_went_well: savedPlan?.reflection_went_well || "",
    reflection_did_not_go_well: savedPlan?.reflection_did_not_go_well || "",
    reflection_improve_tomorrow: savedPlan?.reflection_improve_tomorrow || "",
  }

  return NextResponse.json({
    plan,
    candidates,
    summary: {
      focusItems: plan.focus_items.length,
      dueOrOverdueTasks: candidates.summary.dueOrOverdueTasks,
      calendarToday: candidates.summary.calendarToday,
    },
  })
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
    const reflectionWentWell = text(body.reflection_went_well)
    const reflectionDidNotGoWell = text(body.reflection_did_not_go_well)
    const reflectionImproveTomorrow = text(body.reflection_improve_tomorrow)

    const rows = await sql`
      INSERT INTO daily_plans (
        user_id,
        plan_date,
        focus_items,
        reflection_went_well,
        reflection_did_not_go_well,
        reflection_improve_tomorrow
      )
      VALUES (
        ${user.id},
        ${planDate},
        ${JSON.stringify(focusItems)}::jsonb,
        ${reflectionWentWell || null},
        ${reflectionDidNotGoWell || null},
        ${reflectionImproveTomorrow || null}
      )
      ON CONFLICT (user_id, plan_date)
      DO UPDATE SET
        focus_items = EXCLUDED.focus_items,
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
