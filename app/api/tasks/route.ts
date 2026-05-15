import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromSession } from '@/lib/auth'

const sql = neon(process.env.DATABASE_URL!)

const priorities = new Set(['low', 'medium', 'high'])

type TaskBody = {
  id?: number | string
  title?: string | null
  description?: string | null
  priority?: string | null
  due_date?: string | null
  due_time?: string | null
  reminder_at?: string | null
  email_reminder?: boolean | null
  reminder_days?: number | string | null
  reminder_sent?: boolean | null
  category?: string | null
  completed?: boolean | null
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

function cleanReminderDays(value: unknown, fallback = 1) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(365, Math.max(0, parsed))
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

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasks = await sql`
      SELECT *
      FROM tasks
      WHERE user_id = ${user.id}
      ORDER BY completed ASC, due_date ASC NULLS LAST, created_at DESC
    `

    return NextResponse.json(tasks)
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
    const emailReminder = Boolean(body.email_reminder && dueDate)
    const reminderDays = cleanReminderDays(body.reminder_days, 1)
    const reminderAt = computeReminderAt(dueDate, dueTime, emailReminder, reminderDays)

    const result = await sql`
      INSERT INTO tasks (
        user_id,
        title,
        description,
        priority,
        due_date,
        due_time,
        reminder_at,
        email_reminder,
        reminder_days,
        reminder_sent,
        category,
        completed
      )
      VALUES (
        ${user.id},
        ${title},
        ${cleanText(body.description)},
        ${cleanPriority(body.priority)},
        ${dueDate},
        ${dueTime},
        ${reminderAt},
        ${emailReminder},
        ${reminderDays},
        ${Boolean(body.reminder_sent) && Boolean(reminderAt)},
        ${cleanText(body.category)},
        ${Boolean(body.completed)}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Create task error:', error)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
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
    const nextCategory = hasField(body, 'category') ? cleanText(body.category) : existing.category
    const nextCompleted = hasField(body, 'completed') ? Boolean(body.completed) : Boolean(existing.completed)
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
        reminder_at = ${nextReminderAt},
        email_reminder = ${nextEmailReminder},
        reminder_days = ${nextReminderDays},
        reminder_sent = ${nextReminderSent},
        category = ${nextCategory},
        completed = ${nextCompleted},
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
