import { sql } from "@/lib/db"

export type ResetItemType =
  | "task"
  | "goal"
  | "project"
  | "habit"
  | "inbox"
  | "waiting"
  | "commitment"
  | "maintenance"

export type ResetActionType = "reschedule" | "mark_complete" | "archive" | "delete" | "move_someday"

export type ResetItem = {
  id: string
  type: ResetItemType
  title: string
  subtitle: string
  href: string
  date: string | null
  status: string | null
  priority: string | null
  life_area_id: string | null
  updated_at: string | null
  reason: string
  actions: ResetActionType[]
}

export type ResetSection = {
  key:
    | "overdue_tasks"
    | "stale_goals"
    | "inactive_projects"
    | "missed_habits"
    | "unsorted_inbox"
    | "overdue_waiting"
    | "overdue_commitments"
    | "overdue_maintenance"
    | "upcoming_deadlines"
  title: string
  description: string
  items: ResetItem[]
}

type Row = Record<string, unknown>

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
  return typeof value === "string" ? value.trim() || fallback : fallback
}

function id(value: unknown) {
  return String(value ?? "")
}

function dateOnly(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

function timestamp(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  return typeof value === "string" ? value : null
}

function lifeAreaId(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  return String(value)
}

function cleanAction(value: unknown): ResetActionType | null {
  return value === "reschedule" ||
    value === "mark_complete" ||
    value === "archive" ||
    value === "delete" ||
    value === "move_someday"
    ? value
    : null
}

export function cleanDate(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

export function localDateString(daysFromNow = 0) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function item(row: Row, type: ResetItemType, overrides: Partial<ResetItem>): ResetItem {
  return {
    id: id(row.id),
    type,
    title: text(row.title || row.name, "Untitled"),
    subtitle: "",
    href: `/${type}s`,
    date: null,
    status: row.status ? String(row.status) : null,
    priority: row.priority ? String(row.priority) : null,
    life_area_id: lifeAreaId(row.life_area_id),
    updated_at: timestamp(row.updated_at || row.created_at),
    reason: "",
    actions: ["reschedule", "mark_complete", "delete"],
    ...overrides,
  }
}

export async function getResetData(userId: string) {
  const unavailable: string[] = []

  const [
    lifeAreas,
    overdueTasks,
    staleGoals,
    inactiveProjects,
    missedHabits,
    unsortedInbox,
    overdueWaiting,
    overdueCommitments,
    overdueMaintenance,
    upcomingTasks,
    upcomingGoals,
    upcomingProjects,
    upcomingCommitments,
    upcomingMaintenance,
  ] = await Promise.all([
    safeRows("life_areas", sql`
      SELECT id::text, name, icon, color
      FROM life_areas
      WHERE user_id = ${userId}
      ORDER BY sort_order ASC, name ASC
    `, unavailable),
    safeRows("overdue_tasks", sql`
      SELECT id, title, description, priority, due_date, updated_at, created_at, life_area_id
      FROM tasks
      WHERE user_id = ${userId}
        AND completed IS NOT TRUE
        AND due_date IS NOT NULL
        AND due_date < CURRENT_DATE
      ORDER BY due_date ASC, updated_at DESC NULLS LAST
      LIMIT 40
    `, unavailable),
    safeRows("stale_goals", sql`
      SELECT id, title, description, priority, target_date, status, category, progress, updated_at, created_at, life_area_id
      FROM goals
      WHERE user_id = ${userId}
        AND COALESCE(status, 'active') <> 'completed'
        AND (
          (target_date IS NOT NULL AND target_date < CURRENT_DATE)
          OR COALESCE(updated_at, created_at) < NOW() - INTERVAL '30 days'
        )
      ORDER BY target_date ASC NULLS LAST, updated_at ASC NULLS LAST
      LIMIT 40
    `, unavailable),
    safeRows("inactive_projects", sql`
      SELECT id, title, description, status, priority, due_date, progress, updated_at, created_at, life_area_id
      FROM projects
      WHERE user_id = ${userId}
        AND status IN ('active', 'paused')
        AND (
          (due_date IS NOT NULL AND due_date < CURRENT_DATE)
          OR COALESCE(updated_at, created_at) < NOW() - INTERVAL '30 days'
        )
      ORDER BY due_date ASC NULLS LAST, updated_at ASC NULLS LAST
      LIMIT 40
    `, unavailable),
    safeRows("missed_habits", sql`
      SELECT h.id, h.name AS title, h.description, h.frequency, h.custom_days, h.target_count, h.updated_at, h.created_at, h.life_area_id
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
      LIMIT 40
    `, unavailable),
    safeRows("unsorted_inbox", sql`
      SELECT id, title, raw_text AS description, status, suggested_type, updated_at, created_at, life_area_id
      FROM inbox_items
      WHERE user_id = ${userId}
        AND status = 'unsorted'
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 40
    `, unavailable),
    safeRows("overdue_waiting", sql`
      SELECT id, title, description, waiting_on_name, status, expected_date, follow_up_date, updated_at, created_at, life_area_id
      FROM waiting_items
      WHERE user_id = ${userId}
        AND status IN ('waiting', 'follow_up_needed')
        AND (
          (expected_date IS NOT NULL AND expected_date < CURRENT_DATE)
          OR (follow_up_date IS NOT NULL AND follow_up_date <= CURRENT_DATE)
        )
      ORDER BY follow_up_date ASC NULLS LAST, expected_date ASC NULLS LAST, updated_at DESC
      LIMIT 40
    `, unavailable),
    safeRows("overdue_commitments", sql`
      SELECT id, title, description, committed_to, status, commitment_type, due_date, updated_at, created_at, life_area_id
      FROM commitments
      WHERE user_id = ${userId}
        AND status IN ('open', 'at_risk')
        AND due_date IS NOT NULL
        AND due_date < CURRENT_DATE
      ORDER BY due_date ASC, updated_at DESC
      LIMIT 40
    `, unavailable),
    safeRows("overdue_maintenance", sql`
      SELECT id, title, notes AS description, category, status, recurrence, next_due_date, updated_at, created_at, life_area_id
      FROM maintenance_items
      WHERE user_id = ${userId}
        AND status = 'active'
        AND next_due_date IS NOT NULL
        AND next_due_date < CURRENT_DATE
      ORDER BY next_due_date ASC, updated_at DESC
      LIMIT 40
    `, unavailable),
    safeRows("upcoming_tasks", sql`
      SELECT id, title, priority, due_date, updated_at, created_at, life_area_id
      FROM tasks
      WHERE user_id = ${userId}
        AND completed IS NOT TRUE
        AND due_date >= CURRENT_DATE
        AND due_date <= CURRENT_DATE + INTERVAL '14 days'
      ORDER BY due_date ASC
      LIMIT 20
    `, unavailable),
    safeRows("upcoming_goals", sql`
      SELECT id, title, priority, target_date, status, updated_at, created_at, life_area_id
      FROM goals
      WHERE user_id = ${userId}
        AND COALESCE(status, 'active') <> 'completed'
        AND target_date >= CURRENT_DATE
        AND target_date <= CURRENT_DATE + INTERVAL '14 days'
      ORDER BY target_date ASC
      LIMIT 20
    `, unavailable),
    safeRows("upcoming_projects", sql`
      SELECT id, title, priority, due_date, status, updated_at, created_at, life_area_id
      FROM projects
      WHERE user_id = ${userId}
        AND status IN ('active', 'paused')
        AND due_date >= CURRENT_DATE
        AND due_date <= CURRENT_DATE + INTERVAL '14 days'
      ORDER BY due_date ASC
      LIMIT 20
    `, unavailable),
    safeRows("upcoming_commitments", sql`
      SELECT id, title, due_date, status, updated_at, created_at, life_area_id
      FROM commitments
      WHERE user_id = ${userId}
        AND status IN ('open', 'at_risk')
        AND due_date >= CURRENT_DATE
        AND due_date <= CURRENT_DATE + INTERVAL '14 days'
      ORDER BY due_date ASC
      LIMIT 20
    `, unavailable),
    safeRows("upcoming_maintenance", sql`
      SELECT id, title, next_due_date, status, updated_at, created_at, life_area_id
      FROM maintenance_items
      WHERE user_id = ${userId}
        AND status = 'active'
        AND next_due_date >= CURRENT_DATE
        AND next_due_date <= CURRENT_DATE + INTERVAL '14 days'
      ORDER BY next_due_date ASC
      LIMIT 20
    `, unavailable),
  ])

  const upcoming = [
    ...upcomingTasks.map((row) => item(row, "task", {
      subtitle: "Task due soon",
      href: "/tasks",
      date: dateOnly(row.due_date),
      reason: "Due in the next 14 days",
      actions: ["reschedule", "mark_complete", "move_someday", "delete"],
    })),
    ...upcomingGoals.map((row) => item(row, "goal", {
      subtitle: "Goal deadline soon",
      href: "/goals",
      date: dateOnly(row.target_date),
      reason: "Target date is approaching",
      actions: ["reschedule", "mark_complete", "archive", "move_someday", "delete"],
    })),
    ...upcomingProjects.map((row) => item(row, "project", {
      subtitle: "Project due soon",
      href: `/projects/${row.id}`,
      date: dateOnly(row.due_date),
      reason: "Project deadline is approaching",
      actions: ["reschedule", "mark_complete", "archive", "move_someday", "delete"],
    })),
    ...upcomingCommitments.map((row) => item(row, "commitment", {
      subtitle: "Commitment due soon",
      href: "/commitments",
      date: dateOnly(row.due_date),
      reason: "Commitment deadline is approaching",
      actions: ["reschedule", "mark_complete", "archive", "move_someday", "delete"],
    })),
    ...upcomingMaintenance.map((row) => item(row, "maintenance", {
      subtitle: "Maintenance due soon",
      href: "/maintenance",
      date: dateOnly(row.next_due_date),
      reason: "Maintenance is due soon",
      actions: ["reschedule", "mark_complete", "archive", "move_someday", "delete"],
    })),
  ].sort((a, b) => new Date(a.date || "").getTime() - new Date(b.date || "").getTime()).slice(0, 40)

  const sections: ResetSection[] = [
    {
      key: "overdue_tasks",
      title: "Overdue Tasks",
      description: "Incomplete tasks with due dates before today.",
      items: overdueTasks.map((row) => item(row, "task", {
        subtitle: "Overdue task",
        href: "/tasks",
        date: dateOnly(row.due_date),
        reason: `Due ${dateOnly(row.due_date) || "earlier"}`,
        actions: ["reschedule", "mark_complete", "move_someday", "delete"],
      })),
    },
    {
      key: "stale_goals",
      title: "Stale Goals",
      description: "Active goals that are past target date or have not moved in 30 days.",
      items: staleGoals.map((row) => item(row, "goal", {
        subtitle: row.target_date ? "Past target date" : "No recent progress",
        href: "/goals",
        date: dateOnly(row.target_date),
        reason: row.target_date && dateOnly(row.target_date)! < localDateString() ? "Target date has passed" : "No update in 30 days",
        actions: ["reschedule", "mark_complete", "archive", "move_someday", "delete"],
      })),
    },
    {
      key: "inactive_projects",
      title: "Inactive Projects",
      description: "Active or paused projects that are overdue or have gone quiet.",
      items: inactiveProjects.map((row) => item(row, "project", {
        subtitle: row.due_date ? "Project needs a decision" : "No recent update",
        href: `/projects/${row.id}`,
        date: dateOnly(row.due_date),
        reason: row.due_date && dateOnly(row.due_date)! < localDateString() ? "Project due date has passed" : "No update in 30 days",
        actions: ["reschedule", "mark_complete", "archive", "move_someday", "delete"],
      })),
    },
    {
      key: "missed_habits",
      title: "Missed Habits",
      description: "Habits due today that have not been checked in.",
      items: missedHabits.map((row) => item(row, "habit", {
        subtitle: "Due today",
        href: "/habits",
        date: localDateString(),
        reason: "No completed check-in today",
        actions: ["mark_complete", "archive", "move_someday", "delete"],
      })),
    },
    {
      key: "unsorted_inbox",
      title: "Unsorted Inbox",
      description: "Captured thoughts still waiting for a decision.",
      items: unsortedInbox.map((row) => item(row, "inbox", {
        subtitle: row.suggested_type ? `Suggested: ${row.suggested_type}` : "Unsorted capture",
        href: "/inbox",
        date: dateOnly(row.updated_at || row.created_at),
        reason: "Still unsorted",
        actions: ["archive", "delete"],
      })),
    },
    {
      key: "overdue_waiting",
      title: "Overdue Waiting For",
      description: "Waiting items whose expected or follow-up date has passed.",
      items: overdueWaiting.map((row) => item(row, "waiting", {
        subtitle: row.waiting_on_name ? `Waiting on ${row.waiting_on_name}` : "Waiting item",
        href: "/waiting",
        date: dateOnly(row.follow_up_date || row.expected_date),
        reason: row.follow_up_date ? "Follow-up is due" : "Expected date has passed",
        actions: ["reschedule", "mark_complete", "archive", "move_someday", "delete"],
      })),
    },
    {
      key: "overdue_commitments",
      title: "Overdue Commitments",
      description: "Open commitments with due dates before today.",
      items: overdueCommitments.map((row) => item(row, "commitment", {
        subtitle: row.committed_to ? `Committed to ${row.committed_to}` : "Commitment",
        href: "/commitments",
        date: dateOnly(row.due_date),
        reason: "Due date has passed",
        actions: ["reschedule", "mark_complete", "archive", "move_someday", "delete"],
      })),
    },
    {
      key: "overdue_maintenance",
      title: "Overdue Maintenance",
      description: "Active maintenance items with due dates before today.",
      items: overdueMaintenance.map((row) => item(row, "maintenance", {
        subtitle: row.category ? `${row.category} maintenance` : "Maintenance",
        href: "/maintenance",
        date: dateOnly(row.next_due_date),
        reason: "Maintenance due date has passed",
        actions: ["reschedule", "mark_complete", "archive", "move_someday", "delete"],
      })),
    },
    {
      key: "upcoming_deadlines",
      title: "Upcoming Deadlines",
      description: "Things due in the next 14 days that may need rescheduling or focus.",
      items: upcoming,
    },
  ]

  const allItems = sections.flatMap((section) => section.items)
  return {
    generated_at: new Date().toISOString(),
    life_areas: lifeAreas,
    sections,
    unavailable: Array.from(new Set(unavailable)),
    counts: {
      total: allItems.length,
      urgent: sections.slice(0, 8).reduce((sum, section) => sum + section.items.length, 0),
      upcoming: upcoming.length,
      unavailable: new Set(unavailable).size,
    },
  }
}

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export type ResetActionInput = {
  item_type?: unknown
  id?: unknown
  action?: unknown
  date?: unknown
}

export async function applyResetAction(userId: string, input: ResetActionInput) {
  const type = typeof input.item_type === "string" ? input.item_type : ""
  const itemId = cleanId(input.id)
  const action = cleanAction(input.action)
  const targetDate = cleanDate(input.date)

  if (!itemId || !action) return { ok: false, error: "Invalid reset action" }
  if (action === "reschedule" && !targetDate) return { ok: false, error: "A valid date is required" }

  if (type === "task") {
    if (action === "reschedule") return changed(await sql`UPDATE tasks SET due_date = ${targetDate}, updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "mark_complete") return changed(await sql`UPDATE tasks SET completed = TRUE, updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "move_someday") return changed(await sql`UPDATE tasks SET due_date = NULL, due_time = NULL, category = 'someday', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "delete") return changed(await sql`DELETE FROM tasks WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
  }

  if (type === "goal") {
    if (action === "reschedule") return changed(await sql`UPDATE goals SET target_date = ${targetDate}, updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "mark_complete") return changed(await sql`UPDATE goals SET status = 'completed', progress = 100, updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "archive") return changed(await sql`UPDATE goals SET status = 'paused', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "move_someday") return changed(await sql`UPDATE goals SET target_date = NULL, status = 'paused', category = 'someday', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "delete") return changed(await sql`DELETE FROM goals WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
  }

  if (type === "project") {
    if (action === "reschedule") return changed(await sql`UPDATE projects SET due_date = ${targetDate}, updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "mark_complete") return changed(await sql`UPDATE projects SET status = 'completed', progress = GREATEST(progress, 100), updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "archive") return changed(await sql`UPDATE projects SET status = 'archived', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "move_someday") return changed(await sql`UPDATE projects SET due_date = NULL, status = 'paused', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "delete") return changed(await sql`DELETE FROM projects WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
  }

  if (type === "habit") {
    if (action === "mark_complete") {
      return changed(await sql`
        INSERT INTO habit_checkins (habit_id, user_id, checkin_date, count)
        SELECT id, ${userId}, CURRENT_DATE, target_count
        FROM habits
        WHERE id = ${itemId} AND user_id = ${userId}
        ON CONFLICT (habit_id, checkin_date) DO UPDATE SET count = EXCLUDED.count
        RETURNING id
      `)
    }
    if (action === "archive" || action === "move_someday") return changed(await sql`UPDATE habits SET is_active = FALSE, updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "delete") return changed(await sql`DELETE FROM habits WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
  }

  if (type === "inbox") {
    if (action === "archive") return changed(await sql`UPDATE inbox_items SET status = 'archived', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "delete") return changed(await sql`DELETE FROM inbox_items WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
  }

  if (type === "waiting") {
    if (action === "reschedule") return changed(await sql`UPDATE waiting_items SET follow_up_date = ${targetDate}, status = 'follow_up_needed', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "mark_complete") return changed(await sql`UPDATE waiting_items SET status = 'resolved', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "archive") return changed(await sql`UPDATE waiting_items SET status = 'cancelled', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "move_someday") return changed(await sql`UPDATE waiting_items SET expected_date = NULL, follow_up_date = NULL, status = 'waiting', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "delete") return changed(await sql`DELETE FROM waiting_items WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
  }

  if (type === "commitment") {
    if (action === "reschedule") return changed(await sql`UPDATE commitments SET due_date = ${targetDate}, updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "mark_complete") return changed(await sql`UPDATE commitments SET status = 'completed', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "archive") return changed(await sql`UPDATE commitments SET status = 'cancelled', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "move_someday") return changed(await sql`UPDATE commitments SET due_date = NULL, status = 'open', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "delete") return changed(await sql`DELETE FROM commitments WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
  }

  if (type === "maintenance") {
    if (action === "reschedule") return changed(await sql`UPDATE maintenance_items SET next_due_date = ${targetDate}, updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "mark_complete") {
      return changed(await sql`
        UPDATE maintenance_items
        SET
          last_completed_date = CURRENT_DATE,
          next_due_date = CASE
            WHEN recurrence = 'weekly' THEN CURRENT_DATE + INTERVAL '7 days'
            WHEN recurrence = 'monthly' THEN CURRENT_DATE + INTERVAL '1 month'
            WHEN recurrence = 'quarterly' THEN CURRENT_DATE + INTERVAL '3 months'
            WHEN recurrence = 'yearly' THEN CURRENT_DATE + INTERVAL '1 year'
            ELSE CURRENT_DATE + (GREATEST(COALESCE(custom_interval_days, 30), 1) || ' days')::interval
          END,
          status = 'active',
          updated_at = NOW()
        WHERE id = ${itemId} AND user_id = ${userId}
        RETURNING id
      `)
    }
    if (action === "archive") return changed(await sql`UPDATE maintenance_items SET status = 'paused', updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "move_someday") return changed(await sql`UPDATE maintenance_items SET status = 'paused', next_due_date = NULL, updated_at = NOW() WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
    if (action === "delete") return changed(await sql`DELETE FROM maintenance_items WHERE id = ${itemId} AND user_id = ${userId} RETURNING id`)
  }

  return { ok: false, error: "Action is not supported for this item" }
}

function changed(rows: Row[]) {
  return rows.length > 0 ? { ok: true } : { ok: false, error: "Item not found" }
}

export function toFocusItem(item: Pick<ResetItem, "id" | "type" | "title" | "href">) {
  const supported = item.type === "task" || item.type === "goal"
  return {
    id: supported ? `${item.type}-${item.id}` : `reset-${item.type}-${item.id}`,
    source_type: supported ? item.type : item.type,
    source_id: item.id,
    title: item.title,
    href: item.href,
    custom: false,
  }
}
