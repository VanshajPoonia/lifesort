import { NextResponse } from 'next/server'
import { neon } from '@/lib/neon-client'
import { getUserFromSession } from '@/lib/auth'
import { normalizeLifeAreaId } from '@/lib/life-areas'

const sql = neon(process.env.DATABASE_URL!)

async function validateLifeAreaId(lifeAreaId: number | null, userId: string) {
  if (!lifeAreaId) return null
  const rows = await sql`
    SELECT id FROM life_areas
    WHERE id = ${lifeAreaId} AND user_id = ${userId}
    LIMIT 1
  `
  return rows.length > 0 ? lifeAreaId : undefined
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sources = await sql`
      SELECT * FROM income_sources 
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json(sources)
  } catch (error) {
    console.error('[v0] Get income sources error:', error)
    return NextResponse.json({ error: 'Failed to fetch income sources' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, type, amount, frequency, active, life_area_id } = await request.json()

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }

    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(life_area_id), user.id)
    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: 'Life domain not found' }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO income_sources (user_id, source_name, category, amount, frequency, active, life_area_id)
      VALUES (${user.id}, ${name}, ${type}, ${amount || 0}, ${frequency || 'monthly'}, ${active !== false}, ${lifeAreaId})
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Create income source error:', error)
    return NextResponse.json({ error: 'Failed to create income source' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, type, amount, frequency, active, life_area_id } = body

    if (!id) {
      return NextResponse.json({ error: 'Income source ID is required' }, { status: 400 })
    }

    const lifeAreaTouched = Object.prototype.hasOwnProperty.call(body, 'life_area_id')
    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(life_area_id), user.id)
    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: 'Life domain not found' }, { status: 404 })
    }

    const result = await sql`
      UPDATE income_sources 
      SET 
        source_name = COALESCE(${name}, source_name),
        category = COALESCE(${type}, category),
        amount = COALESCE(${amount}, amount),
        frequency = COALESCE(${frequency}, frequency),
        active = COALESCE(${active}, active),
        life_area_id = CASE WHEN ${lifeAreaTouched} THEN ${lifeAreaId} ELSE life_area_id END,
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Income source not found' }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Update income source error:', error)
    return NextResponse.json({ error: 'Failed to update income source' }, { status: 500 })
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
      return NextResponse.json({ error: 'Income source ID is required' }, { status: 400 })
    }

    await sql`
      DELETE FROM income_sources 
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Delete income source error:', error)
    return NextResponse.json({ error: 'Failed to delete income source' }, { status: 500 })
  }
}
