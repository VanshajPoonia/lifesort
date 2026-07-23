import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
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

    const investments = await sql`
      SELECT * FROM investments 
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json(investments)
  } catch (error) {
    console.error('[v0] Get investments error:', error)
    return NextResponse.json({ error: 'Failed to fetch investments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, type, symbol, amount, current_value, purchase_date, notes, estimated_return_rate, wishlist_item_id, quantity, life_area_id } = await request.json()

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }

    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(life_area_id), user.id)
    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: 'Life domain not found' }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO investments (user_id, name, type, symbol, amount, current_value, purchase_date, notes, estimated_return_rate, wishlist_item_id, quantity, life_area_id)
      VALUES (${user.id}, ${name}, ${type}, ${symbol || null}, ${amount || 0}, ${current_value || amount || 0}, ${purchase_date || null}, ${notes || null}, ${estimated_return_rate || 0}, ${wishlist_item_id || null}, ${quantity || null}, ${lifeAreaId})
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Create investment error:', error)
    return NextResponse.json({ error: 'Failed to create investment' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, type, symbol, amount, current_value, purchase_date, notes, estimated_return_rate, wishlist_item_id, quantity, life_area_id } = body

    if (!id) {
      return NextResponse.json({ error: 'Investment ID is required' }, { status: 400 })
    }

    const lifeAreaTouched = Object.prototype.hasOwnProperty.call(body, 'life_area_id')
    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(life_area_id), user.id)
    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: 'Life domain not found' }, { status: 404 })
    }

    const result = await sql`
      UPDATE investments 
      SET 
        name = COALESCE(${name}, name),
        type = COALESCE(${type}, type),
        symbol = ${symbol !== undefined ? symbol : null},
        amount = COALESCE(${amount}, amount),
        current_value = COALESCE(${current_value}, current_value),
        purchase_date = COALESCE(${purchase_date}, purchase_date),
        notes = COALESCE(${notes}, notes),
        estimated_return_rate = COALESCE(${estimated_return_rate}, estimated_return_rate),
        wishlist_item_id = ${wishlist_item_id !== undefined ? wishlist_item_id : null},
        quantity = ${quantity !== undefined ? quantity : null},
        life_area_id = CASE WHEN ${lifeAreaTouched} THEN ${lifeAreaId} ELSE life_area_id END,
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Investment not found' }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Update investment error:', error)
    return NextResponse.json({ error: 'Failed to update investment' }, { status: 500 })
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
      return NextResponse.json({ error: 'Investment ID is required' }, { status: 400 })
    }

    await sql`
      DELETE FROM investments 
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Delete investment error:', error)
    return NextResponse.json({ error: 'Failed to delete investment' }, { status: 500 })
  }
}
