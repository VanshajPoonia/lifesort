import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromSession } from '@/lib/auth'

const sql = neon(process.env.DATABASE_URL!)

const VALID_ITEM_TYPES = new Set(['task', 'note', 'project', 'calendar_event'])

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

// GET /api/people/links?person_id=N
// Returns all linked items for a person with basic title info.
export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const personId = cleanId(searchParams.get('person_id'))
    if (!personId) return NextResponse.json({ error: 'person_id is required' }, { status: 400 })

    // Verify person ownership
    const ownerCheck = await sql`SELECT id FROM people WHERE id = ${personId} AND user_id = ${user.id} LIMIT 1`
    if (ownerCheck.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const links = await sql`
      SELECT pl.id, pl.item_type, pl.item_id, pl.created_at,
        CASE pl.item_type
          WHEN 'task' THEN (SELECT title FROM tasks WHERE id = pl.item_id AND user_id = ${user.id})
          WHEN 'note' THEN (SELECT title FROM notes WHERE id = pl.item_id AND user_id = ${user.id})
          WHEN 'project' THEN (SELECT title FROM projects WHERE id = pl.item_id AND user_id = ${user.id})
          WHEN 'calendar_event' THEN (SELECT title FROM calendar_events WHERE id = pl.item_id AND user_id = ${user.id})
        END AS item_title,
        CASE pl.item_type
          WHEN 'task' THEN '/tasks'
          WHEN 'note' THEN '/notes'
          WHEN 'project' THEN '/projects/' || pl.item_id::text
          WHEN 'calendar_event' THEN '/calendar'
        END AS item_href
      FROM people_links pl
      WHERE pl.person_id = ${personId} AND pl.user_id = ${user.id}
      ORDER BY pl.item_type, pl.created_at DESC
    `

    return NextResponse.json(links)
  } catch (error) {
    console.error('[people/links] GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch links' }, { status: 500 })
  }
}

// POST /api/people/links — link an item to a person
// Body: { person_id, item_type, item_id }
export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const personId = cleanId(body.person_id)
    const itemId = cleanId(body.item_id)
    const itemType = typeof body.item_type === 'string' ? body.item_type : null

    if (!personId || !itemId || !itemType || !VALID_ITEM_TYPES.has(itemType)) {
      return NextResponse.json({ error: 'person_id, item_id, and valid item_type are required' }, { status: 400 })
    }

    // Verify person ownership
    const personCheck = await sql`SELECT id FROM people WHERE id = ${personId} AND user_id = ${user.id} LIMIT 1`
    if (personCheck.length === 0) return NextResponse.json({ error: 'Person not found' }, { status: 404 })

    // Verify item ownership
    let itemCheck
    if (itemType === 'task') {
      itemCheck = await sql`SELECT id FROM tasks WHERE id = ${itemId} AND user_id = ${user.id} LIMIT 1`
    } else if (itemType === 'note') {
      itemCheck = await sql`SELECT id FROM notes WHERE id = ${itemId} AND user_id = ${user.id} LIMIT 1`
    } else if (itemType === 'project') {
      itemCheck = await sql`SELECT id FROM projects WHERE id = ${itemId} AND user_id = ${user.id} LIMIT 1`
    } else {
      itemCheck = await sql`SELECT id FROM calendar_events WHERE id = ${itemId} AND user_id = ${user.id} LIMIT 1`
    }
    if (itemCheck.length === 0) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const result = await sql`
      INSERT INTO people_links (person_id, user_id, item_type, item_id)
      VALUES (${personId}, ${user.id}, ${itemType}, ${itemId})
      ON CONFLICT (person_id, item_type, item_id) DO NOTHING
      RETURNING *
    `

    return NextResponse.json(result[0] || { person_id: personId, item_type: itemType, item_id: itemId })
  } catch (error) {
    console.error('[people/links] POST error:', error)
    return NextResponse.json({ error: 'Failed to link item' }, { status: 500 })
  }
}

// DELETE /api/people/links — unlink
// Body: { id } (people_links row id)
export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 })

    await sql`DELETE FROM people_links WHERE id = ${id} AND user_id = ${user.id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[people/links] DELETE error:', error)
    return NextResponse.json({ error: 'Failed to unlink item' }, { status: 500 })
  }
}
