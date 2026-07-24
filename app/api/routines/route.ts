import { NextResponse } from 'next/server'
import { neon } from '@/lib/neon-client'
import { getUserFromSession } from '@/lib/auth'

const sql = neon(process.env.DATABASE_URL!)

const VALID_TYPES = new Set(['morning', 'evening', 'custom'])

type RoutineStep = {
  id?: number | string
  step_type?: string
  habit_id?: number | string | null
  title?: string
  description?: string | null
  duration_minutes?: number | string | null
  sort_order?: number
}

type RoutineBody = {
  id?: number | string
  name?: string | null
  description?: string | null
  routine_type?: string | null
  is_active?: boolean | null
  sort_order?: number | string | null
  steps?: RoutineStep[]
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

function cleanRoutineType(value: unknown) {
  if (typeof value !== 'string') return 'custom'
  return VALID_TYPES.has(value) ? value : 'custom'
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const routines = await sql`
      SELECT r.*, COALESCE(
        json_agg(rs ORDER BY rs.sort_order ASC) FILTER (WHERE rs.id IS NOT NULL),
        '[]'::json
      ) AS steps
      FROM routines r
      LEFT JOIN routine_steps rs ON rs.routine_id = r.id
      WHERE r.user_id = ${user.id}
      GROUP BY r.id
      ORDER BY r.sort_order ASC, r.created_at DESC
    `

    return NextResponse.json(routines)
  } catch (error) {
    console.error('[routines] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch routines' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as RoutineBody
    const name = cleanText(body.name)
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const result = await sql`
      INSERT INTO routines (user_id, name, description, routine_type, is_active, sort_order)
      VALUES (
        ${user.id},
        ${name},
        ${cleanText(body.description)},
        ${cleanRoutineType(body.routine_type)},
        ${body.is_active !== false},
        ${cleanId(body.sort_order) ?? 0}
      )
      RETURNING *
    `

    const routine = result[0]

    // Insert steps if provided
    if (Array.isArray(body.steps) && body.steps.length > 0) {
      for (let i = 0; i < body.steps.length; i++) {
        const step = body.steps[i]
        const stepTitle = cleanText(step.title)
        if (!stepTitle) continue
        await sql`
          INSERT INTO routine_steps (routine_id, step_type, habit_id, title, description, duration_minutes, sort_order)
          VALUES (
            ${routine.id},
            ${cleanText(step.step_type) || 'custom'},
            ${cleanId(step.habit_id)},
            ${stepTitle},
            ${cleanText(step.description)},
            ${step.duration_minutes ? Math.max(1, Number(step.duration_minutes)) : null},
            ${i}
          )
        `
      }
    }

    const full = await sql`
      SELECT r.*, COALESCE(
        json_agg(rs ORDER BY rs.sort_order ASC) FILTER (WHERE rs.id IS NOT NULL),
        '[]'::json
      ) AS steps
      FROM routines r
      LEFT JOIN routine_steps rs ON rs.routine_id = r.id
      WHERE r.id = ${routine.id}
      GROUP BY r.id
    `

    return NextResponse.json(full[0])
  } catch (error) {
    console.error('[routines] POST error:', error)
    return NextResponse.json({ error: 'Failed to create routine' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as RoutineBody
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const existing = await sql`
      SELECT * FROM routines WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
    `
    if (existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const e = existing[0]

    await sql`
      UPDATE routines SET
        name = ${cleanText(body.name, e.name) || e.name},
        description = ${'description' in body ? cleanText(body.description) : e.description},
        routine_type = ${'routine_type' in body ? cleanRoutineType(body.routine_type) : e.routine_type},
        is_active = ${'is_active' in body ? Boolean(body.is_active) : Boolean(e.is_active)},
        sort_order = ${'sort_order' in body ? (cleanId(body.sort_order) ?? 0) : e.sort_order},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
    `

    // Replace steps if provided
    if (Array.isArray(body.steps)) {
      await sql`DELETE FROM routine_steps WHERE routine_id = ${id}`
      for (let i = 0; i < body.steps.length; i++) {
        const step = body.steps[i]
        const stepTitle = cleanText(step.title)
        if (!stepTitle) continue
        await sql`
          INSERT INTO routine_steps (routine_id, step_type, habit_id, title, description, duration_minutes, sort_order)
          VALUES (
            ${id},
            ${cleanText(step.step_type) || 'custom'},
            ${cleanId(step.habit_id)},
            ${stepTitle},
            ${cleanText(step.description)},
            ${step.duration_minutes ? Math.max(1, Number(step.duration_minutes)) : null},
            ${i}
          )
        `
      }
    }

    const full = await sql`
      SELECT r.*, COALESCE(
        json_agg(rs ORDER BY rs.sort_order ASC) FILTER (WHERE rs.id IS NOT NULL),
        '[]'::json
      ) AS steps
      FROM routines r
      LEFT JOIN routine_steps rs ON rs.routine_id = r.id
      WHERE r.id = ${id}
      GROUP BY r.id
    `

    return NextResponse.json(full[0])
  } catch (error) {
    console.error('[routines] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update routine' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await sql`DELETE FROM routines WHERE id = ${id} AND user_id = ${user.id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[routines] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete routine' }, { status: 500 })
  }
}
