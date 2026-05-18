import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

type CountKey =
  | "dueTasksToday"
  | "overdueTasks"
  | "calendarToday"
  | "habitsDueToday"
  | "unsortedInbox"
  | "waitingFollowUpsDue"
  | "waitingOverdue"
  | "commitmentsDueSoon"
  | "commitmentsAtRisk"
  | "commitmentsOverdue"
  | "maintenanceUpcoming"
  | "maintenanceOverdue"
  | "somedayReviewDue"
  | "weeklyReviewPending"
  | "unreadNotifications"

const emptyCounts: Record<CountKey, number> = {
  dueTasksToday: 0,
  overdueTasks: 0,
  calendarToday: 0,
  habitsDueToday: 0,
  unsortedInbox: 0,
  waitingFollowUpsDue: 0,
  waitingOverdue: 0,
  commitmentsDueSoon: 0,
  commitmentsAtRisk: 0,
  commitmentsOverdue: 0,
  maintenanceUpcoming: 0,
  maintenanceOverdue: 0,
  somedayReviewDue: 0,
  weeklyReviewPending: 0,
  unreadNotifications: 0,
}

function todayString() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function weekStart(value: string) {
  const date = new Date(`${value}T00:00:00`)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date.toISOString().slice(0, 10)
}

function toCount(rows: unknown[]) {
  const row = rows[0] as { count?: number | string } | undefined
  const parsed = Number(row?.count || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function isMissingSchema(error: unknown) {
  const err = error as { code?: string; message?: string }
  const message = err.message?.toLowerCase() || ""
  return err.code === "42P01" || err.code === "42703" || message.includes("does not exist")
}

async function safeCount(key: CountKey, query: Promise<unknown[]>, unavailable: string[]) {
  try {
    return toCount(await query)
  } catch (error) {
    if (isMissingSchema(error)) {
      unavailable.push(key)
      return 0
    }
    console.error(`[navigation-summary] ${key} failed:`, error)
    unavailable.push(key)
    return 0
  }
}

export async function GET() {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = todayString()
  const inSevenDays = addDays(today, 7)
  const inThirtyDays = addDays(today, 30)
  const monday = weekStart(today)
  const dayOfWeek = new Date(`${today}T00:00:00`).getDay()
  const unavailable: string[] = []

  const results = await Promise.all([
    safeCount("dueTasksToday", sql`
      SELECT COUNT(*) AS count
      FROM tasks
      WHERE user_id = ${user.id}
        AND completed = FALSE
        AND due_date = ${today}
    `, unavailable),
    safeCount("overdueTasks", sql`
      SELECT COUNT(*) AS count
      FROM tasks
      WHERE user_id = ${user.id}
        AND completed = FALSE
        AND due_date IS NOT NULL
        AND due_date < ${today}
    `, unavailable),
    safeCount("calendarToday", sql`
      SELECT COUNT(*) AS count
      FROM calendar_events
      WHERE user_id = ${user.id}
        AND event_date = ${today}
    `, unavailable),
    safeCount("habitsDueToday", sql`
      SELECT COUNT(*) AS count
      FROM habits h
      WHERE h.user_id = ${user.id}
        AND h.is_active = TRUE
        AND (
          h.frequency IN ('daily', 'weekly')
          OR (h.frequency = 'custom' AND ${dayOfWeek} = ANY(h.custom_days))
        )
        AND NOT EXISTS (
          SELECT 1
          FROM habit_checkins hc
          WHERE hc.user_id = ${user.id}
            AND hc.habit_id = h.id
            AND hc.checkin_date = ${today}
        )
    `, unavailable),
    safeCount("unsortedInbox", sql`
      SELECT COUNT(*) AS count
      FROM inbox_items
      WHERE user_id = ${user.id}
        AND status = 'unsorted'
    `, unavailable),
    safeCount("waitingFollowUpsDue", sql`
      SELECT COUNT(*) AS count
      FROM waiting_items
      WHERE user_id = ${user.id}
        AND status IN ('waiting', 'follow_up_needed')
        AND follow_up_date IS NOT NULL
        AND follow_up_date <= ${today}
    `, unavailable),
    safeCount("waitingOverdue", sql`
      SELECT COUNT(*) AS count
      FROM waiting_items
      WHERE user_id = ${user.id}
        AND status IN ('waiting', 'follow_up_needed')
        AND expected_date IS NOT NULL
        AND expected_date < ${today}
    `, unavailable),
    safeCount("commitmentsDueSoon", sql`
      SELECT COUNT(*) AS count
      FROM commitments
      WHERE user_id = ${user.id}
        AND status IN ('open', 'at_risk')
        AND due_date IS NOT NULL
        AND due_date BETWEEN ${today} AND ${inSevenDays}
    `, unavailable),
    safeCount("commitmentsAtRisk", sql`
      SELECT COUNT(*) AS count
      FROM commitments
      WHERE user_id = ${user.id}
        AND status = 'at_risk'
    `, unavailable),
    safeCount("commitmentsOverdue", sql`
      SELECT COUNT(*) AS count
      FROM commitments
      WHERE user_id = ${user.id}
        AND status IN ('open', 'at_risk')
        AND due_date IS NOT NULL
        AND due_date < ${today}
    `, unavailable),
    safeCount("maintenanceUpcoming", sql`
      SELECT COUNT(*) AS count
      FROM maintenance_items
      WHERE user_id = ${user.id}
        AND status = 'active'
        AND next_due_date IS NOT NULL
        AND next_due_date BETWEEN ${today} AND ${inThirtyDays}
    `, unavailable),
    safeCount("maintenanceOverdue", sql`
      SELECT COUNT(*) AS count
      FROM maintenance_items
      WHERE user_id = ${user.id}
        AND status = 'active'
        AND next_due_date IS NOT NULL
        AND next_due_date < ${today}
    `, unavailable),
    safeCount("somedayReviewDue", sql`
      SELECT COUNT(*) AS count
      FROM someday_items
      WHERE user_id = ${user.id}
        AND status = 'someday'
        AND review_date IS NOT NULL
        AND review_date <= ${today}
    `, unavailable),
    safeCount("weeklyReviewPending", sql`
      SELECT CASE WHEN EXISTS (
        SELECT 1
        FROM weekly_reviews
        WHERE user_id = ${user.id}
          AND week_start = ${monday}
      ) THEN 0 ELSE 1 END AS count
    `, unavailable),
    safeCount("unreadNotifications", sql`
      SELECT COUNT(*) AS count
      FROM notifications
      WHERE user_id = ${user.id}
        AND is_read = FALSE
    `, unavailable),
  ])

  const keys = Object.keys(emptyCounts) as CountKey[]
  const counts = keys.reduce<Record<CountKey, number>>((acc, key, index) => {
    acc[key] = results[index] || 0
    return acc
  }, { ...emptyCounts })

  return NextResponse.json({
    counts,
    unavailable,
    generated_at: new Date().toISOString(),
  })
}
