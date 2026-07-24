import { NextResponse } from 'next/server'
import { neon } from '@/lib/neon-client'
import { getUserFromSession } from '@/lib/auth'

const sql = neon(process.env.DATABASE_URL!)

const VALID_TYPES = new Set(['birthday', 'follow_up', 'custom'])
const VALID_INTERVALS = new Set(['yearly', 'monthly', 'weekly'])

type ReminderBody = {
  id?: number | string
  person_id?: number | string
  reminder_type?: string | null
  title?: string | null
  remind_at?: string | null
  is_recurring?: boolean | null
  recur_interval?: string | null
  note?: string | null
}

function cleanText(value: unknown, fallback: string | null = null) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function cleanTimestamp(value: unknown) {
  if (typeof value !== 'string') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

// GET /api/people/reminders?person_id=N&upcoming=true
export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const personId = cleanId(searchParams.get('person_id'))
    const upcoming = searchParams.get('upcoming') === 'true'

    let reminders
    if (personId) {
      // Verify person ownership
      const ownerCheck = await sql`SELECT id FROM people WHERE id = ${personId} AND user_id = ${user.id} LIMIT 1`
      if (ownerCheck.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      reminders = await sql`
        SELECT pr.* FROM people_reminders pr
        WHERE pr.person_id = ${personId} AND pr.user_id = ${user.id}
        ORDER BY pr.remind_at ASC
      `
    } else if (upcoming) {
      // All upcoming unsent reminders across all people
      reminders = await sql`
        SELECT pr.*, p.name AS person_name, p.avatar_color, p.relationship_type
        FROM people_reminders pr
        JOIN people p ON p.id = pr.person_id AND p.user_id = ${user.id}
        WHERE pr.user_id = ${user.id}
          AND pr.is_sent = FALSE
          AND pr.remind_at >= NOW()
          AND pr.remind_at <= NOW() + INTERVAL '30 days'
        ORDER BY pr.remind_at ASC
        LIMIT 20
      `
    } else {
      reminders = await sql`
        SELECT pr.*, p.name AS person_name FROM people_reminders pr
        JOIN people p ON p.id = pr.person_id AND p.user_id = ${user.id}
        WHERE pr.user_id = ${user.id}
        ORDER BY pr.remind_at ASC
        LIMIT 50
      `
    }

    return NextResponse.json(reminders)
  } catch (error) {
    console.error('[people/reminders] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch reminders' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as ReminderBody
    const personId = cleanId(body.person_id)
    if (!personId) return NextResponse.json({ error: 'person_id is required' }, { status: 400 })

    const title = cleanText(body.title)
    if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

    const remindAt = cleanTimestamp(body.remind_at)
    if (!remindAt) return NextResponse.json({ error: 'remind_at is required' }, { status: 400 })

    // Verify person ownership
    const ownerCheck = await sql`SELECT id FROM people WHERE id = ${personId} AND user_id = ${user.id} LIMIT 1`
    if (ownerCheck.length === 0) return NextResponse.json({ error: 'Person not found' }, { status: 404 })

    const reminderType = typeof body.reminder_type === 'string' && VALID_TYPES.has(body.reminder_type) ? body.reminder_type : 'custom'
    const isRecurring = Boolean(body.is_recurring)
    const recurInterval = isRecurring && typeof body.recur_interval === 'string' && VALID_INTERVALS.has(body.recur_interval) ? body.recur_interval : null

    const result = await sql`
      INSERT INTO people_reminders (person_id, user_id, reminder_type, title, remind_at, is_recurring, recur_interval, note)
      VALUES (
        ${personId}, ${user.id}, ${reminderType}, ${title},
        ${remindAt}, ${isRecurring}, ${recurInterval}, ${cleanText(body.note)}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[people/reminders] POST error:', error)
    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as ReminderBody
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const existing = await sql`
      SELECT pr.* FROM people_reminders pr
      JOIN people p ON p.id = pr.person_id
      WHERE pr.id = ${id} AND pr.user_id = ${user.id} AND p.user_id = ${user.id}
      LIMIT 1
    `
    if (existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const e = existing[0]
    const isRecurring = 'is_recurring' in body ? Boolean(body.is_recurring) : Boolean(e.is_recurring)
    const recurInterval = isRecurring
      ? (typeof body.recur_interval === 'string' && VALID_INTERVALS.has(body.recur_interval) ? body.recur_interval : e.recur_interval)
      : null

    const result = await sql`
      UPDATE people_reminders SET
        reminder_type = ${'reminder_type' in body && typeof body.reminder_type === 'string' && VALID_TYPES.has(body.reminder_type) ? body.reminder_type : e.reminder_type},
        title = ${cleanText(body.title, e.title) || e.title},
        remind_at = ${'remind_at' in body ? (cleanTimestamp(body.remind_at) || e.remind_at) : e.remind_at},
        is_recurring = ${isRecurring},
        recur_interval = ${recurInterval},
        note = ${'note' in body ? cleanText(body.note) : e.note},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[people/reminders] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update reminder' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await sql`
      DELETE FROM people_reminders WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[people/reminders] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete reminder' }, { status: 500 })
  }
}
