import { NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { getUserFromSession } from "@/lib/auth"

type Row = Record<string, any>

const startOfToday = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const endOfToday = () => {
  const date = new Date()
  date.setHours(23, 59, 59, 999)
  return date
}

const toNumber = (value: unknown) => {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const safeRows = async (label: string, query: Promise<any>): Promise<Row[]> => {
  try {
    return await query
  } catch (error) {
    console.error(`[dashboard] ${label} query failed:`, error)
    return []
  }
}

const toActivity = (label: string, title: string, href: string, date: string | Date | null, type: string) => ({
  label,
  title,
  href,
  type,
  at: date ? new Date(date).toISOString() : new Date().toISOString(),
})

export async function GET() {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const todayStart = startOfToday()
  const todayEnd = endOfToday()
  const todayDate = todayStart.toISOString().split("T")[0]

  const [
    goals,
    todayTasks,
    upcomingTasks,
    todayEvents,
    upcomingEvents,
    notes,
    links,
    investments,
    incomeSources,
    budgetStats,
    wishlist,
    nukeGoals,
  ] = await Promise.all([
    safeRows("goals", sql`
      SELECT id, title, status, progress, target_date, current_value, target_value, updated_at, created_at
      FROM goals
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `),
    safeRows("today tasks", sql`
      SELECT id, title, completed, priority, due_date, updated_at, created_at
      FROM tasks
      WHERE user_id = ${user.id}
      AND (
        due_date = ${todayDate}
        OR (due_date IS NULL AND created_at BETWEEN ${todayStart.toISOString()} AND ${todayEnd.toISOString()})
      )
      ORDER BY completed ASC, created_at DESC
      LIMIT 8
    `),
    safeRows("upcoming tasks", sql`
      SELECT id, title, completed, priority, due_date, updated_at, created_at
      FROM tasks
      WHERE user_id = ${user.id}
      AND completed = false
      AND due_date IS NOT NULL
      AND due_date >= ${todayDate}
      ORDER BY due_date ASC
      LIMIT 6
    `),
    safeRows("today events", sql`
      SELECT id, title, event_date, start_time, end_time, category, location, updated_at, created_at
      FROM calendar_events
      WHERE user_id = ${user.id}
      AND event_date = ${todayDate}
      ORDER BY start_time ASC
      LIMIT 8
    `),
    safeRows("upcoming events", sql`
      SELECT id, title, event_date, start_time, end_time, category, location, updated_at, created_at
      FROM calendar_events
      WHERE user_id = ${user.id}
      AND event_date >= ${todayDate}
      ORDER BY event_date ASC, start_time ASC
      LIMIT 6
    `),
    safeRows("notes", sql`
      SELECT id, title, content, updated_at, created_at
      FROM notes
      WHERE user_id = ${user.id}
      ORDER BY updated_at DESC
      LIMIT 5
    `),
    safeRows("links", sql`
      SELECT id, title, url, thumbnail, updated_at, created_at
      FROM user_links
      WHERE user_id = ${user.id}
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 5
    `),
    safeRows("investments", sql`
      SELECT id, name, amount, current_value, updated_at, created_at
      FROM investments
      WHERE user_id = ${user.id}
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 50
    `),
    safeRows("income", sql`
      SELECT id, source_name, amount, frequency, active, updated_at, created_at
      FROM income_sources
      WHERE user_id = ${user.id}
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 50
    `),
    safeRows("budget", sql`
      SELECT type, COALESCE(SUM(amount), 0) as total
      FROM budget_transactions
      WHERE user_id = ${user.id}
      AND EXTRACT(MONTH FROM date) = ${todayStart.getMonth() + 1}
      AND EXTRACT(YEAR FROM date) = ${todayStart.getFullYear()}
      GROUP BY type
    `),
    safeRows("wishlist", sql`
      SELECT id, title, price, purchased, updated_at, created_at
      FROM wishlist_items
      WHERE user_id = ${user.id}
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 20
    `),
    safeRows("nuke", sql`
      SELECT id, title, deadline, completed, updated_at, created_at
      FROM nuke_goals
      WHERE user_id = ${user.id}
      LIMIT 1
    `),
  ])

  const completedGoals = goals.filter(goal => goal.status === "completed").length
  const completedTasksToday = todayTasks.filter(task => task.completed).length
  const portfolioValue = investments.reduce((sum, inv) => sum + toNumber(inv.current_value || inv.amount), 0)
  const monthlyIncome = incomeSources
    .filter(source => source.active !== false)
    .reduce((sum, source) => sum + toNumber(source.amount), 0)
  const monthlyBudgetIncome = toNumber(budgetStats.find(row => row.type === "income")?.total)
  const monthlyExpenses = toNumber(budgetStats.find(row => row.type === "expense")?.total)
  const wishlistOpenValue = wishlist
    .filter(item => !item.purchased)
    .reduce((sum, item) => sum + toNumber(item.price), 0)

  const upcomingDeadlines = [
    ...upcomingTasks.map(task => ({
      id: `task-${task.id}`,
      title: task.title,
      type: "Task",
      date: task.due_date,
      href: "/tasks",
    })),
    ...goals
      .filter(goal => goal.status !== "completed" && goal.target_date)
      .map(goal => ({
        id: `goal-${goal.id}`,
        title: goal.title,
        type: "Goal",
        date: goal.target_date,
        href: "/goals",
      })),
    ...nukeGoals
      .filter(goal => !goal.completed && goal.deadline)
      .map(goal => ({
        id: `nuke-${goal.id}`,
        title: goal.title,
        type: "Nuke Goal",
        date: goal.deadline,
        href: "/nuke",
      })),
  ]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6)

  const activity = [
    ...goals.slice(0, 3).map(goal => toActivity("Goal updated", goal.title, "/goals", goal.updated_at || goal.created_at, "goal")),
    ...todayTasks.slice(0, 3).map(task => toActivity(task.completed ? "Task completed" : "Task added", task.title, "/tasks", task.updated_at || task.created_at, "task")),
    ...notes.slice(0, 3).map(note => toActivity("Note edited", note.title || "Untitled note", "/notes", note.updated_at || note.created_at, "note")),
    ...links.slice(0, 2).map(link => toActivity("Link saved", link.title, "/links", link.updated_at || link.created_at, "link")),
    ...investments.slice(0, 2).map(inv => toActivity("Investment updated", inv.name, "/investments", inv.updated_at || inv.created_at, "investment")),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8)

  return NextResponse.json({
    stats: {
      totalGoals: goals.length,
      completedGoals,
      goalsProgress: goals.length ? Math.round((completedGoals / goals.length) * 100) : 0,
      tasksToday: todayTasks.length,
      completedTasksToday,
      portfolioValue,
      monthlyIncome,
      monthlyBudgetIncome,
      monthlyExpenses,
      monthlyBalance: monthlyBudgetIncome - monthlyExpenses,
      wishlistOpenValue,
      notesCount: notes.length,
      linksCount: links.length,
    },
    today: {
      tasks: todayTasks,
      events: todayEvents,
    },
    upcoming: {
      events: upcomingEvents,
      deadlines: upcomingDeadlines,
    },
    recent: {
      notes,
      links,
      activity,
    },
  })
}
