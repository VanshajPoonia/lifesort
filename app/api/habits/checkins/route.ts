import { NextResponse } from 'next/server'
import { neon } from '@/lib/neon-client'
import { getUserFromSession } from '@/lib/auth'
import { computeHabitStreak, STREAK_WINDOW_WEEKS, type HabitStreakStats } from '@/lib/habit-streaks'

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

    // Weekly streak stats for all active habits
    const stats = await computeStats(user.id, date ?? serverToday())

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

// Weekly streaks for all active habits, from the last 26 weeks of check-ins.
// `today` is the browser's local date when it sent one, so the week lines up
// with the user's calendar rather than the server's.
async function computeStats(userId: string, today: string) {
  type Row = { habit_id: string; checkin_date: string; count: string; target_count: string; frequency: string; custom_days: string | null }

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
      AND hc.checkin_date >= ${today}::date - ${STREAK_WINDOW_WEEKS * 7 + 7}::int
    ORDER BY hc.habit_id, hc.checkin_date DESC
  ` as Row[]

  const byHabit = new Map<string, Row[]>()
  for (const row of rows) {
    if (!byHabit.has(row.habit_id)) byHabit.set(row.habit_id, [])
    byHabit.get(row.habit_id)!.push(row)
  }

  const stats: Record<string, HabitStreakStats> = {}
  for (const [habitId, checkins] of byHabit) {
    const first = checkins[0]
    stats[habitId] = computeHabitStreak(
      {
        frequency: first.frequency,
        customDays: parseIntArray(first.custom_days),
        targetCount: Number(first.target_count) || 1,
        checkins: checkins.map((checkin) => ({ date: checkin.checkin_date, count: Number(checkin.count) })),
      },
      today,
    )
  }

  return stats
}

// Postgres sends integer[] as text like "{1,3,5}".
function parseIntArray(value: string | null) {
  if (!value) return []
  return value.replace(/[{}]/g, "").split(",").map((part) => Number.parseInt(part, 10)).filter(Number.isInteger)
}

function serverToday() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}
