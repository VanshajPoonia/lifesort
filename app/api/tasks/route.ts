import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromSession } from '@/lib/auth'
import { normalizeLifeAreaId } from '@/lib/life-areas'

const sql = neon(process.env.DATABASE_URL!)

const priorities = new Set(['low', 'medium', 'high'])
const taskStatuses = new Set(['inbox', 'next', 'in_progress', 'waiting', 'someday', 'completed', 'cancelled'])
const terminalStatuses = new Set(['completed', 'cancelled'])

type TaskStatus = 'inbox' | 'next' | 'in_progress' | 'waiting' | 'someday' | 'completed' | 'cancelled'

type TaskBody = {
  id?: number | string
  orderedIds?: Array<number | string>
  title?: string | null
  description?: string | null
  priority?: string | null
  due_date?: string | null
  due_time?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  duration_minutes?: number | string | null
  status?: string | null
  reminder_at?: string | null
  email_reminder?: boolean | null
  reminder_days?: number | string | null
  reminder_sent?: boolean | null
  category?: string | null
  completed?: boolean | null
  goal_id?: number | string | null
  life_area_id?: number | string | null
  sort_order?: number | string | null
}

function hasField(body: TaskBody, field: keyof TaskBody) {
  return Object.prototype.hasOwnProperty.call(body, field)
}

function cleanText(value: unknown, fallback: string | null = null) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function cleanDate(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function cleanTime(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return `${match[1]}:${match[2]}`
}

function cleanPriority(value: unknown, fallback = 'medium') {
  if (typeof value !== 'string') return fallback
  return priorities.has(value) ? value : fallback
}

function cleanStatus(value: unknown, fallback: TaskStatus = 'next'): TaskStatus {
  if (typeof value !== 'string') return fallback
  return (taskStatuses.has(value) ? value : fallback) as TaskStatus
}

function cleanDuration(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.min(10080, parsed) // cap at 7 days, in minutes
}

// `completed` stays a synced/derived convenience column so every existing
// open/overdue/completion-rate query keeps working unchanged (see
// AI_DECISIONS.md). `status` is the source of truth going forward:
// - explicit `status` in the request wins outright.
// - explicit `completed` (no `status`) toggles the terminal state: checking
//   it sets status to 'completed'; unchecking it reverts a terminal status
//   ('completed'/'cancelled') back to 'next', otherwise leaves a non-terminal
//   status (e.g. 'waiting') alone.
// - neither present -> keep whatever the row already had.
function resolveStatusAndCompleted(
  body: TaskBody,
  existing: { status?: string | null; completed?: boolean | null } | null,
) {
  const existingStatus = cleanStatus(existing?.status, 'next')

  if (hasField(body, 'status')) {
    const status = cleanStatus(body.status, existingStatus)
    return { status, completed: terminalStatuses.has(status) }
  }

  if (hasField(body, 'completed')) {
    const completed = Boolean(body.completed)
    if (completed) return { status: 'completed' as TaskStatus, completed: true }
    const status = terminalStatuses.has(existingStatus) ? ('next' as TaskStatus) : existingStatus
    return { status, completed: false }
  }

  return { status: existingStatus, completed: Boolean(existing?.completed) }
}

function cleanReminderDays(value: unknown, fallback = 1) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(365, Math.max(0, parsed))
}

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function cleanOrderedIds(value: unknown) {
  if (!Array.isArray(value)) return []
  const seen = new Set<number>()
  const ids: number[] = []

  value.forEach((item) => {
    const id = cleanId(item)
    if (!id || seen.has(id)) return
    seen.add(id)
    ids.push(id)
  })

  return ids
}

function dateOnly(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return cleanDate(String(value).slice(0, 10))
}

function timeOnly(value: unknown) {
  if (!value) return null
  if (typeof value === 'string') return cleanTime(value)
  return null
}

function computeReminderAt(dueDate: string | null, dueTime: string | null, enabled: boolean, reminderDays: number) {
  if (!enabled || !dueDate) return null

  const [year, month, day] = dueDate.split('-').map(Number)
  const [hour, minute] = (dueTime || '09:00').split(':').map(Number)
  const reminder = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  reminder.setUTCDate(reminder.getUTCDate() - reminderDays)

  return reminder.toISOString().slice(0, 19).replace('T', ' ')
}

async function validateGoalId(goalId: number | null, userId: string) {
  if (!goalId) return null

  const rows = await sql`
    SELECT id
    FROM goals
    WHERE id = ${goalId} AND user_id = ${userId}
    LIMIT 1
  `

  return rows.length > 0 ? goalId : undefined
}

async function validateLifeAreaId(lifeAreaId: number | null, userId: string) {
  if (!lifeAreaId) return null

  const rows = await sql`
    SELECT id
    FROM life_areas
    WHERE id = ${lifeAreaId} AND user_id = ${userId}
    LIMIT 1
  `

  return rows.length > 0 ? lifeAreaId : undefined
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lifeAreaId = normalizeLifeAreaId(searchParams.get('life_area_id'))
    const dateFrom = cleanDate(searchParams.get('date_from'))
    const dateTo = cleanDate(searchParams.get('date_to'))
    const completedParam = searchParams.get('completed')

    const tasks = await sql`
      SELECT *
      FROM tasks
      WHERE user_id = ${user.id}
      ORDER BY sort_order ASC, completed ASC, due_date ASC NULLS LAST, created_at DESC
    `

    const filtered = tasks.filter((task) => {
      const taskLifeAreaId = normalizeLifeAreaId(task.life_area_id)
      const dueDate = dateOnly(task.due_date)
      if (lifeAreaId && taskLifeAreaId !== lifeAreaId) return false
      if (dateFrom && (!dueDate || dueDate < dateFrom)) return false
      if (dateTo && (!dueDate || dueDate > dateTo)) return false
      if (completedParam === 'true' && task.completed !== true) return false
      if (completedParam === 'false' && task.completed === true) return false
      return true
    })

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('[v0] Get tasks error:', error)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as TaskBody
    const title = cleanText(body.title)

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const dueDate = cleanDate(body.due_date)
    const dueTime = cleanTime(body.due_time)
    const scheduledDate = cleanDate(body.scheduled_date)
    const scheduledTime = cleanTime(body.scheduled_time)
    const durationMinutes = cleanDuration(body.duration_minutes)
    const emailReminder = Boolean(body.email_reminder && dueDate)
    const reminderDays = cleanReminderDays(body.reminder_days, 1)
    const reminderAt = computeReminderAt(dueDate, dueTime, emailReminder, reminderDays)
    const { status, completed } = resolveStatusAndCompleted(body, null)
    const goalId = await validateGoalId(cleanId(body.goal_id), user.id)
    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(body.life_area_id), user.id)
    const orderRows = await sql`
      SELECT COALESCE(MIN(sort_order), 0) - 1 AS sort_order
      FROM tasks
      WHERE user_id = ${user.id}
    `
    const sortOrder = Number(orderRows[0]?.sort_order ?? 0)

    if (goalId === undefined) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: 'Life domain not found' }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO tasks (
        user_id,
        title,
        description,
        priority,
        due_date,
        due_time,
        scheduled_date,
        scheduled_time,
        duration_minutes,
        status,
        reminder_at,
        email_reminder,
        reminder_days,
        reminder_sent,
        category,
        completed,
        goal_id,
        life_area_id,
        sort_order
      )
      VALUES (
        ${user.id},
        ${title},
        ${cleanText(body.description)},
        ${cleanPriority(body.priority)},
        ${dueDate},
        ${dueTime},
        ${scheduledDate},
        ${scheduledTime},
        ${durationMinutes},
        ${status},
        ${reminderAt},
        ${emailReminder},
        ${reminderDays},
        ${Boolean(body.reminder_sent) && Boolean(reminderAt)},
        ${cleanText(body.category)},
        ${completed},
        ${goalId},
        ${lifeAreaId},
        ${sortOrder}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Create task error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as TaskBody
    const orderedIds = cleanOrderedIds(body.orderedIds)

    if (orderedIds.length === 0) {
      return NextResponse.json({ error: 'orderedIds is required' }, { status: 400 })
    }

    const existingRows = await sql`
      SELECT id
      FROM tasks
      WHERE user_id = ${user.id}
      ORDER BY sort_order ASC, completed ASC, due_date ASC NULLS LAST, created_at DESC
    `
    const existingIds = existingRows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id))
    const ownedIds = new Set(existingIds)
    const invalidId = orderedIds.find((id) => !ownedIds.has(id))

    if (invalidId) {
      return NextResponse.json({ error: 'Task not found', id: invalidId }, { status: 404 })
    }

    const orderedSet = new Set(orderedIds)
    const normalizedIds = [
      ...orderedIds,
      ...existingIds.filter((id) => !orderedSet.has(id)),
    ]

    await Promise.all(
      normalizedIds.map((id, index) =>
        sql`
          UPDATE tasks
          SET sort_order = ${index}, updated_at = NOW()
          WHERE id = ${id} AND user_id = ${user.id}
        `,
      ),
    )

    const tasks = await sql`
      SELECT *
      FROM tasks
      WHERE user_id = ${user.id}
      ORDER BY sort_order ASC, completed ASC, due_date ASC NULLS LAST, created_at DESC
    `

    return NextResponse.json({ success: true, tasks })
  } catch (error) {
    console.error('[v0] Reorder tasks error:', error)
    return NextResponse.json({ error: 'Failed to reorder tasks' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as TaskBody

    if (!body.id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    const existingRows = await sql`
      SELECT *
      FROM tasks
      WHERE id = ${body.id} AND user_id = ${user.id}
      LIMIT 1
    `

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const existing = existingRows[0]
    const nextTitle = hasField(body, 'title') ? cleanText(body.title, existing.title) : existing.title
    const nextDescription = hasField(body, 'description') ? cleanText(body.description) : existing.description
    const nextPriority = hasField(body, 'priority') ? cleanPriority(body.priority, existing.priority || 'medium') : existing.priority || 'medium'
    const nextDueDate = hasField(body, 'due_date') ? cleanDate(body.due_date) : dateOnly(existing.due_date)
    const nextDueTime = hasField(body, 'due_time') ? cleanTime(body.due_time) : timeOnly(existing.due_time)
    const nextScheduledDate = hasField(body, 'scheduled_date') ? cleanDate(body.scheduled_date) : dateOnly(existing.scheduled_date)
    const nextScheduledTime = hasField(body, 'scheduled_time') ? cleanTime(body.scheduled_time) : timeOnly(existing.scheduled_time)
    const nextDurationMinutes = hasField(body, 'duration_minutes') ? cleanDuration(body.duration_minutes) : existing.duration_minutes
    const nextCategory = hasField(body, 'category') ? cleanText(body.category) : existing.category
    const { status: nextStatus, completed: nextCompleted } = resolveStatusAndCompleted(body, existing)
    const nextGoalId = hasField(body, 'goal_id')
      ? await validateGoalId(cleanId(body.goal_id), user.id)
      : cleanId(existing.goal_id)
    const nextLifeAreaId = hasField(body, 'life_area_id')
      ? await validateLifeAreaId(normalizeLifeAreaId(body.life_area_id), user.id)
      : normalizeLifeAreaId(existing.life_area_id)

    if (nextGoalId === undefined) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    if (nextLifeAreaId === undefined) {
      return NextResponse.json({ error: 'Life domain not found' }, { status: 404 })
    }

    const nextEmailReminder = hasField(body, 'email_reminder')
      ? Boolean(body.email_reminder && nextDueDate)
      : Boolean(existing.email_reminder && nextDueDate)
    const nextReminderDays = hasField(body, 'reminder_days')
      ? cleanReminderDays(body.reminder_days, existing.reminder_days || 1)
      : cleanReminderDays(existing.reminder_days, 1)
    const nextReminderAt = computeReminderAt(nextDueDate, nextDueTime, nextEmailReminder, nextReminderDays)
    const reminderTouched =
      hasField(body, 'due_date') ||
      hasField(body, 'due_time') ||
      hasField(body, 'email_reminder') ||
      hasField(body, 'reminder_days') ||
      hasField(body, 'reminder_at')
    const nextReminderSent = hasField(body, 'reminder_sent')
      ? Boolean(body.reminder_sent && nextReminderAt)
      : reminderTouched
        ? false
        : Boolean(existing.reminder_sent)

    const result = await sql`
      UPDATE tasks
      SET
        title = ${nextTitle},
        description = ${nextDescription},
        priority = ${nextPriority},
        due_date = ${nextDueDate},
        due_time = ${nextDueTime},
        scheduled_date = ${nextScheduledDate},
        scheduled_time = ${nextScheduledTime},
        duration_minutes = ${nextDurationMinutes},
        status = ${nextStatus},
        reminder_at = ${nextReminderAt},
        email_reminder = ${nextEmailReminder},
        reminder_days = ${nextReminderDays},
        reminder_sent = ${nextReminderSent},
        category = ${nextCategory},
        completed = ${nextCompleted},
        goal_id = ${nextGoalId},
        life_area_id = ${nextLifeAreaId},
        updated_at = NOW()
      WHERE id = ${body.id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Update task error:', error)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 })
    }

    await sql`
      DELETE FROM tasks
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Delete task error:', error)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
