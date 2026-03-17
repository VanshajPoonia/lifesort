import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { getSessionFromCookie, getSession, getUserById } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const sessionToken = getSessionFromCookie(request)
    if (!sessionToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await getSession(sessionToken)
    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const user = await getUserById(session)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    const body = await request.json()
    const wishlist_item_id = body.wishlist_item_id || body.wishlistItemId
    const { purchase_price, purchase_date } = body

    if (!wishlist_item_id) {
      return NextResponse.json({ error: 'Wishlist item ID is required' }, { status: 400 })
    }

    // Get the wishlist item
    const wishlistItem = await sql`
      SELECT * FROM wishlist_items 
      WHERE id = ${wishlist_item_id} AND user_id = ${user.id}
    `

    if (wishlistItem.length === 0) {
      return NextResponse.json({ error: 'Wishlist item not found' }, { status: 404 })
    }

    const item = wishlistItem[0]

    // Create investment from wishlist item
    const investment = await sql`
      INSERT INTO investments (
        user_id, 
        name, 
        type, 
        amount, 
        current_value, 
        purchase_date, 
        notes, 
        wishlist_item_id
      )
      VALUES (
        ${user.id},
        ${item.title},
        ${item.category || 'Other'},
        ${purchase_price || item.price || 0},
        ${purchase_price || item.price || 0},
        ${purchase_date || new Date().toISOString().split('T')[0]},
        ${item.description || ''},
        ${wishlist_item_id}
      )
      RETURNING *
    `

    // Mark wishlist item as purchased
    await sql`
      UPDATE wishlist_items 
      SET purchased = true, updated_at = NOW()
      WHERE id = ${wishlist_item_id} AND user_id = ${user.id}
    `

    return NextResponse.json({
      success: true,
      investment: investment[0],
      message: 'Wishlist item converted to investment successfully'
    })
  } catch (error) {
    console.error('[v0] Error converting wishlist to investment:', error)
    return NextResponse.json({ error: 'Failed to convert to investment' }, { status: 500 })
  }
}
