import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromSession } from '@/lib/auth'

const sql = neon(process.env.DATABASE_URL!)

function cleanDate(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

// GET /api/habits/checkins?date=YYYY-MM-DD&habit_id=N
// Returns check-ins for a date (or all if no date), plus streak stats per habit.
export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const date = cleanDate(searchParams.get('date'))
    const habitId = cleanId(searchParams.get('habit_id'))

    // Fetch check-ins
    let checkins
    if (date && habitId) {
      checkins = await sql`
        SELECT hc.* FROM habit_checkins hc
        JOIN habits h ON h.id = hc.habit_id
        WHERE hc.habit_id = ${habitId} AND hc.checkin_date = ${date}::date
          AND hc.user_id = ${user.id} AND h.user_id = ${user.id}
      `
    } else if (date) {
      checkins = await sql`
        SELECT hc.* FROM habit_checkins hc
        JOIN habits h ON h.id = hc.habit_id
        WHERE hc.checkin_date = ${date}::date
          AND hc.user_id = ${user.id} AND h.user_id = ${user.id}
      `
    } else if (habitId) {
      checkins = await sql`
        SELECT hc.* FROM habit_checkins hc
        JOIN habits h ON h.id = hc.habit_id
        WHERE hc.habit_id = ${habitId}
          AND hc.user_id = ${user.id} AND h.user_id = ${user.id}
        ORDER BY hc.checkin_date DESC
        LIMIT 90
      `
    } else {
      checkins = await sql`
        SELECT hc.* FROM habit_checkins hc
        JOIN habits h ON h.id = hc.habit_id
        WHERE hc.user_id = ${user.id} AND h.user_id = ${user.id}
        ORDER BY hc.checkin_date DESC
        LIMIT 200
      `
    }

    // Streak stats for all active habits
    const stats = await computeStats(user.id)

    return NextResponse.json({ checkins, stats })
  } catch (error) {
    console.error('[habits/checkins] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch checkins' }, { status: 500 })
  }
}

// POST /api/habits/checkins — upsert a check-in
// Body: { habit_id, checkin_date, count, note }
export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const habitId = cleanId(body.habit_id)
    const date = cleanDate(body.checkin_date)
    if (!habitId || !date) {
      return NextResponse.json({ error: 'habit_id and checkin_date are required' }, { status: 400 })
    }

    // Verify ownership
    const habitRows = await sql`
      SELECT id, target_count FROM habits WHERE id = ${habitId} AND user_id = ${user.id} LIMIT 1
    `
    if (habitRows.length === 0) return NextResponse.json({ error: 'Habit not found' }, { status: 404 })

    const count = Math.max(0, Math.min(100, typeof body.count === 'number' ? body.count : 1))
    const note = typeof body.note === 'string' ? body.note.trim() || null : null

    // Upsert: if count = 0 delete, otherwise insert/update
    if (count === 0) {
      await sql`
        DELETE FROM habit_checkins WHERE habit_id = ${habitId} AND checkin_date = ${date}::date AND user_id = ${user.id}
      `
      return NextResponse.json({ deleted: true })
    }

    const result = await sql`
      INSERT INTO habit_checkins (habit_id, user_id, checkin_date, count, note)
      VALUES (${habitId}, ${user.id}, ${date}::date, ${count}, ${note})
      ON CONFLICT (habit_id, checkin_date) DO UPDATE SET count = ${count}, note = ${note}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[habits/checkins] POST error:', error)
    return NextResponse.json({ error: 'Failed to save checkin' }, { status: 500 })
  }
}

// DELETE /api/habits/checkins — remove a check-in
// Body: { habit_id, checkin_date }
export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const habitId = cleanId(body.habit_id)
    const date = cleanDate(body.checkin_date)
    if (!habitId || !date) {
      return NextResponse.json({ error: 'habit_id and checkin_date are required' }, { status: 400 })
    }

    await sql`
      DELETE FROM habit_checkins
      WHERE habit_id = ${habitId} AND checkin_date = ${date}::date AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[habits/checkins] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete checkin' }, { status: 500 })
  }
}

// Streak computation — runs a single SQL query to get last 90 days of check-ins
// and computes current streak, best streak, and week/month completion rates.
async function computeStats(userId: string) {
  type Row = { habit_id: string; checkin_date: string; count: string; target_count: string; frequency: string; custom_days: string }

  const rows = await sql`
    SELECT
      hc.habit_id,
      hc.checkin_date::text,
      hc.count,
      h.target_count,
      h.frequency,
      h.custom_days::text
    FROM habit_checkins hc
    JOIN habits h ON h.id = hc.habit_id
    WHERE hc.user_id = ${userId}
      AND h.user_id = ${userId}
      AND h.is_active = TRUE
      AND hc.checkin_date >= CURRENT_DATE - INTERVAL '90 days'
    ORDER BY hc.habit_id, hc.checkin_date DESC
  ` as Row[]

  // Group by habit
  const byHabit = new Map<string, Row[]>()
  for (const row of rows) {
    const key = row.habit_id
    if (!byHabit.has(key)) byHabit.set(key, [])
    byHabit.get(key)!.push(row)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const stats: Record<string, { current_streak: number; best_streak: number; completion_week: number; completion_month: number }> = {}

  for (const [habitId, checkins] of byHabit) {
    const firstRow = checkins[0]
    const targetCount = Number(firstRow.target_count) || 1

    // Build a set of completed dates (where count >= target)
    const completedDates = new Set<string>()
    for (const c of checkins) {
      if (Number(c.count) >= targetCount) completedDates.add(c.checkin_date)
    }

    // Current streak: consecutive days going backwards from today
    let current = 0
    const cursor = new Date(today)
    while (true) {
      const key = cursor.toISOString().slice(0, 10)
      if (!completedDates.has(key)) break
      current++
      cursor.setDate(cursor.getDate() - 1)
    }

    // Best streak in the last 90 days
    let best = 0
    let run = 0
    const allDays = new Date(today)
    for (let i = 0; i < 90; i++) {
      const key = allDays.toISOString().slice(0, 10)
      if (completedDates.has(key)) {
        run++
        if (run > best) best = run
      } else {
        run = 0
      }
      allDays.setDate(allDays.getDate() - 1)
    }

    // Week completion (last 7 days)
    let weekDone = 0
    const weekCursor = new Date(today)
    for (let i = 0; i < 7; i++) {
      if (completedDates.has(weekCursor.toISOString().slice(0, 10))) weekDone++
      weekCursor.setDate(weekCursor.getDate() - 1)
    }

    // Month completion (last 30 days)
    let monthDone = 0
    const monthCursor = new Date(today)
    for (let i = 0; i < 30; i++) {
      if (completedDates.has(monthCursor.toISOString().slice(0, 10))) monthDone++
      monthCursor.setDate(monthCursor.getDate() - 1)
    }

    stats[habitId] = {
      current_streak: current,
      best_streak: Math.max(best, current),
      completion_week: Math.round((weekDone / 7) * 100),
      completion_month: Math.round((monthDone / 30) * 100),
    }
  }

  return stats
}
