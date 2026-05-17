import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromSession } from '@/lib/auth'
import { normalizeLifeAreaId } from '@/lib/life-areas'

const sql = neon(process.env.DATABASE_URL!)

const VALID_FREQUENCIES = new Set(['daily', 'weekly', 'custom'])
const VALID_DAYS = new Set([0, 1, 2, 3, 4, 5, 6])

type HabitBody = {
  id?: number | string
  name?: string | null
  description?: string | null
  frequency?: string | null
  custom_days?: number[] | null
  target_count?: number | string | null
  reminder_time?: string | null
  life_area_id?: number | string | null
  is_active?: boolean | null
  color?: string | null
  icon?: string | null
  sort_order?: number | string | null
}

function cleanText(value: unknown, fallback: string | null = null) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function cleanFrequency(value: unknown) {
  if (typeof value !== 'string') return 'daily'
  return VALID_FREQUENCIES.has(value) ? value : 'daily'
}

function cleanCustomDays(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value.filter((d): d is number => typeof d === 'number' && VALID_DAYS.has(d))
}

function cleanTargetCount(value: unknown) {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(100, n)
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

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const habits = await sql`
      SELECT h.*, la.name AS life_area_name, la.color AS life_area_color, la.icon AS life_area_icon
      FROM habits h
      LEFT JOIN life_areas la ON la.id = h.life_area_id AND la.user_id = ${user.id}
      WHERE h.user_id = ${user.id}
      ORDER BY h.sort_order ASC, h.created_at DESC
    `

    return NextResponse.json(habits)
  } catch (error) {
    console.error('[habits] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch habits' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as HabitBody
    const name = cleanText(body.name)
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const frequency = cleanFrequency(body.frequency)
    const customDays = cleanCustomDays(body.custom_days)
    const lifeAreaId = normalizeLifeAreaId(body.life_area_id)

    const result = await sql`
      INSERT INTO habits (
        user_id, name, description, frequency, custom_days, target_count,
        reminder_time, life_area_id, is_active, color, icon, sort_order
      ) VALUES (
        ${user.id},
        ${name},
        ${cleanText(body.description)},
        ${frequency},
        ${JSON.stringify(customDays)}::integer[],
        ${cleanTargetCount(body.target_count)},
        ${cleanTime(body.reminder_time)},
        ${lifeAreaId},
        ${body.is_active !== false},
        ${cleanText(body.color) || '#2563EB'},
        ${cleanText(body.icon) || 'CheckSquare'},
        ${cleanId(body.sort_order) ?? 0}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[habits] POST error:', error)
    return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as HabitBody
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const existing = await sql`
      SELECT * FROM habits WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
    `
    if (existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const e = existing[0]
    const frequency = 'frequency' in body ? cleanFrequency(body.frequency) : e.frequency
    const customDays = 'custom_days' in body ? cleanCustomDays(body.custom_days) : (e.custom_days || [])
    const lifeAreaId = 'life_area_id' in body ? normalizeLifeAreaId(body.life_area_id) : normalizeLifeAreaId(e.life_area_id)

    const result = await sql`
      UPDATE habits SET
        name = ${cleanText(body.name, e.name) || e.name},
        description = ${'description' in body ? cleanText(body.description) : e.description},
        frequency = ${frequency},
        custom_days = ${JSON.stringify(customDays)}::integer[],
        target_count = ${'target_count' in body ? cleanTargetCount(body.target_count) : e.target_count},
        reminder_time = ${'reminder_time' in body ? cleanTime(body.reminder_time) : e.reminder_time},
        life_area_id = ${lifeAreaId},
        is_active = ${'is_active' in body ? Boolean(body.is_active) : Boolean(e.is_active)},
        color = ${cleanText('color' in body ? body.color : null) || e.color || '#2563EB'},
        icon = ${cleanText('icon' in body ? body.icon : null) || e.icon || 'CheckSquare'},
        sort_order = ${'sort_order' in body ? (cleanId(body.sort_order) ?? 0) : e.sort_order},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[habits] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update habit' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await sql`DELETE FROM habits WHERE id = ${id} AND user_id = ${user.id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[habits] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete habit' }, { status: 500 })
  }
}
