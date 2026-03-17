import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromSession } from '@/lib/auth'

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const items = await sql`
      SELECT * FROM wishlist_items 
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json(items)
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

    const { title, description, price, link, image_url, category, priority } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO wishlist_items (user_id, title, description, price, url, image_url, category, priority)
      VALUES (${user.id}, ${title}, ${description || null}, ${price || null}, ${link || null}, ${image_url || null}, ${category || 'general'}, ${priority || 'medium'})
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

    const { id, title, description, price, link, image_url, category, priority, purchased } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Item ID is required' }, { status: 400 })
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
