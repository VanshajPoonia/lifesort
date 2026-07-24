import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { itemRelationshipCreateSchema, itemRelationshipTypes, validateItemOwnership } from "@/lib/item-relationships"

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const itemType = searchParams.get("item_type")
    const itemId = searchParams.get("item_id")

    if (!itemType || !itemId || !(itemRelationshipTypes as readonly string[]).includes(itemType)) {
      return NextResponse.json({ error: "item_type and item_id are required" }, { status: 400 })
    }

    const rows = await sql`
      SELECT *, CASE WHEN from_type = ${itemType} AND from_id = ${itemId} THEN 'outgoing' ELSE 'incoming' END AS direction
      FROM item_relationships
      WHERE user_id = ${user.id}
        AND ((from_type = ${itemType} AND from_id = ${itemId}) OR (to_type = ${itemType} AND to_id = ${itemId}))
      ORDER BY created_at DESC
    `

    return NextResponse.json({ relationships: rows })
  } catch (error) {
    console.error("[item-relationships] GET failed:", error)
    return NextResponse.json({ error: "Could not load item relationships" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const parsed = itemRelationshipCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid relationship", issues: parsed.error.issues }, { status: 400 })
    }

    const { from_type, from_id, to_type, to_id, relation } = parsed.data

    const [fromOwned, toOwned] = await Promise.all([
      validateItemOwnership(user, from_type, from_id),
      validateItemOwnership(user, to_type, to_id),
    ])
    if (!fromOwned || !toOwned) {
      return NextResponse.json({ error: "One or both linked items were not found" }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO item_relationships (user_id, from_type, from_id, to_type, to_id, relation)
      VALUES (${user.id}, ${from_type}, ${from_id}, ${to_type}, ${to_id}, ${relation})
      ON CONFLICT (user_id, from_type, from_id, to_type, to_id, relation)
      DO UPDATE SET relation = EXCLUDED.relation
      RETURNING *
    `

    return NextResponse.json({ relationship: result[0] }, { status: 201 })
  } catch (error) {
    console.error("[item-relationships] POST failed:", error)
    return NextResponse.json({ error: "Could not create item relationship" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const id = typeof body.id === "string" ? body.id : null
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

    await sql`DELETE FROM item_relationships WHERE id = ${id} AND user_id = ${user.id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[item-relationships] DELETE failed:", error)
    return NextResponse.json({ error: "Could not delete item relationship" }, { status: 500 })
  }
}
