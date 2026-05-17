import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromSession } from '@/lib/auth'
import { normalizeLifeAreaId } from '@/lib/life-areas'

const sql = neon(process.env.DATABASE_URL!)

const VALID_CATEGORIES = new Set([
  'documents', 'subscriptions', 'warranty', 'insurance',
  'vehicle', 'home', 'medical', 'education', 'work', 'other',
])

type VaultBody = {
  id?: number | string
  title?: string | null
  category?: string | null
  description?: string | null
  notes?: string | null
  start_date?: string | null
  expiry_date?: string | null
  renewal_date?: string | null
  reminder_date?: string | null
  url?: string | null
  life_area_id?: number | string | null
  tags?: string[] | null
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

function cleanCategory(value: unknown) {
  if (typeof value !== 'string') return 'other'
  return VALID_CATEGORIES.has(value) ? value : 'other'
}

function cleanUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Accept URLs with or without protocol
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.includes('.')) return `https://${trimmed}`
  return null
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 20)
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
    const category = searchParams.get('category')

    let items
    if (category && VALID_CATEGORIES.has(category)) {
      items = await sql`
        SELECT vi.*, la.name AS life_area_name, la.color AS life_area_color
        FROM vault_items vi
        LEFT JOIN life_areas la ON la.id = vi.life_area_id AND la.user_id = ${user.id}
        WHERE vi.user_id = ${user.id} AND vi.category = ${category}
        ORDER BY vi.expiry_date ASC NULLS LAST, vi.title ASC
      `
    } else {
      items = await sql`
        SELECT vi.*, la.name AS life_area_name, la.color AS life_area_color
        FROM vault_items vi
        LEFT JOIN life_areas la ON la.id = vi.life_area_id AND la.user_id = ${user.id}
        WHERE vi.user_id = ${user.id}
        ORDER BY vi.expiry_date ASC NULLS LAST, vi.title ASC
      `
    }

    return NextResponse.json(items)
  } catch (error) {
    console.error('[vault] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch vault items' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as VaultBody
    const title = cleanText(body.title)
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    const tags = cleanTags(body.tags)
    const lifeAreaId = normalizeLifeAreaId(body.life_area_id)

    const result = await sql`
      INSERT INTO vault_items (
        user_id, title, category, description, notes,
        start_date, expiry_date, renewal_date, reminder_date,
        url, life_area_id, tags
      ) VALUES (
        ${user.id},
        ${title},
        ${cleanCategory(body.category)},
        ${cleanText(body.description)},
        ${cleanText(body.notes)},
        ${cleanDate(body.start_date)},
        ${cleanDate(body.expiry_date)},
        ${cleanDate(body.renewal_date)},
        ${cleanDate(body.reminder_date)},
        ${cleanUrl(body.url)},
        ${lifeAreaId},
        ${JSON.stringify(tags)}::text[]
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[vault] POST error:', error)
    return NextResponse.json({ error: 'Failed to create vault item' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await request.json()) as VaultBody
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    const existing = await sql`
      SELECT * FROM vault_items WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
    `
    if (existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const e = existing[0]
    const tags = 'tags' in body ? cleanTags(body.tags) : (e.tags || [])
    const lifeAreaId = 'life_area_id' in body ? normalizeLifeAreaId(body.life_area_id) : normalizeLifeAreaId(e.life_area_id)

    const result = await sql`
      UPDATE vault_items SET
        title = ${cleanText(body.title, e.title) || e.title},
        category = ${'category' in body ? cleanCategory(body.category) : e.category},
        description = ${'description' in body ? cleanText(body.description) : e.description},
        notes = ${'notes' in body ? cleanText(body.notes) : e.notes},
        start_date = ${'start_date' in body ? cleanDate(body.start_date) : e.start_date},
        expiry_date = ${'expiry_date' in body ? cleanDate(body.expiry_date) : e.expiry_date},
        renewal_date = ${'renewal_date' in body ? cleanDate(body.renewal_date) : e.renewal_date},
        reminder_date = ${'reminder_date' in body ? cleanDate(body.reminder_date) : e.reminder_date},
        url = ${'url' in body ? cleanUrl(body.url) : e.url},
        life_area_id = ${lifeAreaId},
        tags = ${JSON.stringify(tags)}::text[],
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[vault] PUT error:', error)
    return NextResponse.json({ error: 'Failed to update vault item' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await sql`DELETE FROM vault_items WHERE id = ${id} AND user_id = ${user.id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[vault] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete vault item' }, { status: 500 })
  }
}
