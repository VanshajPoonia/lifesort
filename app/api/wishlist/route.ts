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

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lifeAreaId = normalizeLifeAreaId(searchParams.get('life_area_id'))

    const items = await sql`
      SELECT * FROM wishlist_items 
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json(
      lifeAreaId ? items.filter((item) => normalizeLifeAreaId(item.life_area_id) === lifeAreaId) : items
    )
  } catch (error) {
    console.error('[v0] Get wishlist error:', error)
    return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, description, price, link, image_url, category, priority, life_area_id } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(life_area_id), user.id)
    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: 'Life area not found' }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO wishlist_items (user_id, title, description, price, url, image_url, category, priority, life_area_id)
      VALUES (${user.id}, ${title}, ${description || null}, ${price || null}, ${link || null}, ${image_url || null}, ${category || 'general'}, ${priority || 'medium'}, ${lifeAreaId})
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Create wishlist item error:', error)
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, description, price, link, image_url, category, priority, purchased, life_area_id } = body

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    const lifeAreaTouched = Object.prototype.hasOwnProperty.call(body, 'life_area_id')
    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(life_area_id), user.id)
    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: 'Life area not found' }, { status: 404 })
    }

    const result = await sql`
      UPDATE wishlist_items 
      SET 
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        price = COALESCE(${price}, price),
        url = COALESCE(${link}, url),
        image_url = COALESCE(${image_url}, image_url),
        category = COALESCE(${category}, category),
        priority = COALESCE(${priority}, priority),
        purchased = COALESCE(${purchased}, purchased),
        life_area_id = CASE WHEN ${lifeAreaTouched} THEN ${lifeAreaId} ELSE life_area_id END,
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Update wishlist item error:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
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
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
    }

    await sql`
      DELETE FROM wishlist_items 
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Delete wishlist item error:', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
