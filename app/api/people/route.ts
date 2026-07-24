import { NextResponse } from 'next/server'
import { neon } from '@/lib/neon-client'
import { getUserFromSession } from '@/lib/auth'
import { normalizeLifeAreaId } from '@/lib/life-areas'

const sql = neon(process.env.DATABASE_URL!)

const VALID_RELATIONSHIP_TYPES = new Set(['family', 'friend', 'work', 'school', 'client', 'mentor', 'other'])
const VALID_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DC2626', '#EA580C', '#DB2777', '#0891B2', '#CA8A04', '#4F46E5', '#0F766E']

type PersonBody = {
  id?: number | string
  name?: string | null
  relationship_type?: string | null
  email?: string | null
  phone?: string | null
  birthday?: string | null
  location?: string | null
  notes?: string | null
  life_area_id?: number | string | null
  tags?: string[] | null
  avatar_color?: string | null
  sort_order?: number | string | null
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

function cleanRelationshipType(value: unknown) {
  if (typeof value !== 'string') return 'other'
  return VALID_RELATIONSHIP_TYPES.has(value) ? value : 'other'
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 20)
}

function cleanColor(value: unknown) {
  if (typeof value !== 'string') return '#2563EB'
  const trimmed = value.trim()
  return VALID_COLORS.includes(trimmed) ? trimmed : '#2563EB'
}

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const relationship = searchParams.get('relationship')

    let people
    if (relationship && VALID_RELATIONSHIP_TYPES.has(relationship)) {
      people = await sql`
        SELECT p.*, la.name AS life_area_name, la.color AS life_area_color,
          (
            SELECT json_agg(pr ORDER BY pr.remind_at ASC)
            FROM people_reminders pr
            WHERE pr.person_id = p.id AND pr.is_sent = FALSE AND pr.remind_at >= NOW()
            LIMIT 3
          ) AS upcoming_reminders
        FROM people p
        LEFT JOIN life_areas la ON la.id = p.life_area_id AND la.user_id = ${user.id}
        WHERE p.user_id = ${user.id} AND p.relationship_type = ${relationship}
        ORDER BY p.sort_order ASC, p.name ASC
      `
    } else {
      people = await sql`
        SELECT p.*, la.name AS life_area_name, la.color AS life_area_color,
          (
            SELECT json_agg(pr ORDER BY pr.remind_at ASC)
            FROM people_reminders pr
            WHERE pr.person_id = p.id AND pr.is_sent = FALSE AND pr.remind_at >= NOW()
            LIMIT 3
          ) AS upcoming_reminders
        FROM people p
        LEFT JOIN life_areas la ON la.id = p.life_area_id AND la.user_id = ${user.id}
        WHERE p.user_id = ${user.id}
        ORDER BY p.sort_order ASC, p.name ASC
      `
    }

    return NextResponse.json(people)
  } catch (error) {
    console.error('[people] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch people' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as PersonBody
    const name = cleanText(body.name)
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

    const lifeAreaId = normalizeLifeAreaId(body.life_area_id)
    const tags = cleanTags(body.tags)

    const result = await sql`
      INSERT INTO people (
        user_id, name, relationship_type, email, phone, birthday,
        location, notes, life_area_id, tags, avatar_color, sort_order
      ) VALUES (
        ${user.id},
        ${name},
        ${cleanRelationshipType(body.relationship_type)},
        ${cleanText(body.email)},
        ${cleanText(body.phone)},
        ${cleanDate(body.birthday)},
        ${cleanText(body.location)},
        ${cleanText(body.notes)},
        ${lifeAreaId},
        ${JSON.stringify(tags)}::text[],
        ${cleanColor(body.avatar_color)},
        ${cleanId(body.sort_order) ?? 0}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[people] POST error:', error)
    return NextResponse.json({ error: 'Failed to create person' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as PersonBody
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const existing = await sql`
      SELECT * FROM people WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
    `
    if (existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const e = existing[0]
    const tags = 'tags' in body ? cleanTags(body.tags) : (e.tags || [])
    const lifeAreaId = 'life_area_id' in body ? normalizeLifeAreaId(body.life_area_id) : normalizeLifeAreaId(e.life_area_id)

    const result = await sql`
      UPDATE people SET
        name = ${cleanText(body.name, e.name) || e.name},
        relationship_type = ${'relationship_type' in body ? cleanRelationshipType(body.relationship_type) : e.relationship_type},
        email = ${'email' in body ? cleanText(body.email) : e.email},
        phone = ${'phone' in body ? cleanText(body.phone) : e.phone},
        birthday = ${'birthday' in body ? cleanDate(body.birthday) : e.birthday},
        location = ${'location' in body ? cleanText(body.location) : e.location},
        notes = ${'notes' in body ? cleanText(body.notes) : e.notes},
        life_area_id = ${lifeAreaId},
        tags = ${JSON.stringify(tags)}::text[],
        avatar_color = ${'avatar_color' in body ? cleanColor(body.avatar_color) : e.avatar_color},
        sort_order = ${'sort_order' in body ? (cleanId(body.sort_order) ?? 0) : e.sort_order},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[people] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update person' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await sql`DELETE FROM people WHERE id = ${id} AND user_id = ${user.id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[people] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete person' }, { status: 500 })
  }
}
