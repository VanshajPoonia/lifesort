import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromSession } from '@/lib/auth'

const sql = neon(process.env.DATABASE_URL!)

const priorities = new Set(['low', 'medium', 'high'])
const statuses = new Set(['active', 'completed', 'paused'])

type GoalBody = {
  id?: number | string
  title?: string | null
  description?: string | null
  category?: string | null
  target_date?: string | null
  status?: string | null
  priority?: string | null
  progress?: number | string | null
  target_value?: number | string | null
  current_value?: number | string | null
  value_unit?: string | null
  email_reminder?: boolean | null
  reminder_days?: number | string | null
  reminder_sent?: boolean | null
}

type GoalRow = Record<string, unknown>
type NormalizedGoal = GoalRow & {
  status: string
  priority: string
  target_date: string | null
  target_value: number | null
  current_value: number | null
  progress: number
  email_reminder: boolean
  reminder_days: number
  reminder_sent: boolean
}

function hasField(body: GoalBody, field: keyof GoalBody) {
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

function dateOnly(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return cleanDate(String(value).slice(0, 10))
}

function cleanNumber(value: unknown, fallback: number | null = null) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function cleanProgress(value: unknown, fallback = 0) {
  const parsed = cleanNumber(value, fallback) ?? fallback
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

function cleanReminderDays(value: unknown, fallback = 3) {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(365, Math.max(0, parsed))
}

function cleanPriority(value: unknown, fallback = 'medium') {
  if (typeof value !== 'string') return fallback
  return priorities.has(value) ? value : fallback
}

function cleanStatus(value: unknown, fallback = 'active') {
  if (value === 'in_progress') return 'active'
  if (typeof value !== 'string') return fallback
  return statuses.has(value) ? value : fallback
}

function progressFromValues(progress: unknown, currentValue: number | null, targetValue: number | null) {
  if (targetValue && targetValue > 0 && currentValue !== null) {
    return Math.min(100, Math.max(0, Math.round((currentValue / targetValue) * 100)))
  }

  return cleanProgress(progress, 0)
}

function normalizeGoal(row: GoalRow): NormalizedGoal {
  const targetValue = cleanNumber(row.target_value)
  const currentValue = cleanNumber(row.current_value, 0)

  return {
    ...row,
    status: cleanStatus(row.status),
    priority: cleanPriority(row.priority),
    target_date: dateOnly(row.target_date),
    target_value: targetValue,
    current_value: currentValue,
    progress: progressFromValues(row.progress, currentValue, targetValue),
    email_reminder: Boolean(row.email_reminder && row.target_date),
    reminder_days: cleanReminderDays(row.reminder_days, 3),
    reminder_sent: Boolean(row.reminder_sent),
  }
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const goals = await sql`
      SELECT *
      FROM goals
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json(goals.map(normalizeGoal))
  } catch (error) {
    console.error('[v0] Get goals error:', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as GoalBody
    const title = cleanText(body.title)

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const targetDate = cleanDate(body.target_date)
    const targetValue = cleanNumber(body.target_value)
    const currentValue = cleanNumber(body.current_value, targetValue ? 0 : null)
    const progress = progressFromValues(body.progress, currentValue, targetValue)
    const emailReminder = Boolean(body.email_reminder && targetDate)

    const result = await sql`
      INSERT INTO goals (
        user_id,
        title,
        description,
        category,
        target_date,
        status,
        priority,
        progress,
        target_value,
        current_value,
        value_unit,
        email_reminder,
        reminder_days,
        reminder_sent
      )
      VALUES (
        ${user.id},
        ${title},
        ${cleanText(body.description)},
        ${cleanText(body.category, 'personal')},
        ${targetDate},
        ${cleanStatus(body.status)},
        ${cleanPriority(body.priority)},
        ${progress},
        ${targetValue},
        ${currentValue},
        ${cleanText(body.value_unit)},
        ${emailReminder},
        ${cleanReminderDays(body.reminder_days, 3)},
        false
      )
      RETURNING *
    `

    return NextResponse.json(normalizeGoal(result[0]))
  } catch (error) {
    console.error('[v0] Create goal error:', error)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as GoalBody

    if (!body.id) {
      return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 })
    }

    const existingRows = await sql`
      SELECT *
      FROM goals
      WHERE id = ${body.id} AND user_id = ${user.id}
      LIMIT 1
    `

    if (existingRows.length === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    const existing = normalizeGoal(existingRows[0])
    const nextTitle = hasField(body, 'title') ? cleanText(body.title, String(existing.title || '')) : String(existing.title || '')
    const nextDescription = hasField(body, 'description') ? cleanText(body.description) : cleanText(existing.description)
    const nextCategory = hasField(body, 'category') ? cleanText(body.category, 'personal') : cleanText(existing.category, 'personal')
    const nextTargetDate = hasField(body, 'target_date') ? cleanDate(body.target_date) : dateOnly(existing.target_date)
    const nextStatus = hasField(body, 'status') ? cleanStatus(body.status, String(existing.status || 'active')) : cleanStatus(existing.status)
    const nextPriority = hasField(body, 'priority') ? cleanPriority(body.priority, String(existing.priority || 'medium')) : cleanPriority(existing.priority)
    const nextTargetValue = hasField(body, 'target_value') ? cleanNumber(body.target_value) : cleanNumber(existing.target_value)
    const nextCurrentValue = hasField(body, 'current_value')
      ? cleanNumber(body.current_value, nextTargetValue ? 0 : null)
      : cleanNumber(existing.current_value, nextTargetValue ? 0 : null)
    const nextProgress = hasField(body, 'progress') || hasField(body, 'target_value') || hasField(body, 'current_value')
      ? progressFromValues(body.progress ?? existing.progress, nextCurrentValue, nextTargetValue)
      : cleanProgress(existing.progress)
    const nextValueUnit = hasField(body, 'value_unit') ? cleanText(body.value_unit) : cleanText(existing.value_unit)
    const nextEmailReminder = hasField(body, 'email_reminder')
      ? Boolean(body.email_reminder && nextTargetDate)
      : Boolean(existing.email_reminder && nextTargetDate)
    const nextReminderDays = hasField(body, 'reminder_days')
      ? cleanReminderDays(body.reminder_days, Number(existing.reminder_days || 3))
      : cleanReminderDays(existing.reminder_days, 3)
    const reminderTouched =
      hasField(body, 'target_date') ||
      hasField(body, 'email_reminder') ||
      hasField(body, 'reminder_days')
    const nextReminderSent = hasField(body, 'reminder_sent')
      ? Boolean(body.reminder_sent && nextEmailReminder)
      : reminderTouched
        ? false
        : Boolean(existing.reminder_sent)

    const result = await sql`
      UPDATE goals
      SET
        title = ${nextTitle},
        description = ${nextDescription},
        category = ${nextCategory},
        target_date = ${nextTargetDate},
        status = ${nextStatus},
        priority = ${nextPriority},
        progress = ${nextProgress},
        target_value = ${nextTargetValue},
        current_value = ${nextCurrentValue},
        value_unit = ${nextValueUnit},
        email_reminder = ${nextEmailReminder},
        reminder_days = ${nextReminderDays},
        reminder_sent = ${nextReminderSent},
        updated_at = NOW()
      WHERE id = ${body.id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(normalizeGoal(result[0]))
  } catch (error) {
    console.error('[v0] Update goal error:', error)
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
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
      return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 })
    }

    await sql`
      DELETE FROM goals
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Delete goal error:', error)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}
