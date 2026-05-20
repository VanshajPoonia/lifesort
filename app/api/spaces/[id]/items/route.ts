import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import {
  createSpaceBackedItem,
  getSpaceForUser,
  hydrateSpaceItems,
  spaceItemCreateSchema,
  spaceItemDeleteSchema,
  spaceItemTypes,
  validateSpaceItemAccess,
  type SpaceItemType,
} from "@/lib/spaces"

type RouteContext = {
  params: Promise<{ id: string }>
}

function readType(value: string | null): SpaceItemType | null {
  return spaceItemTypes.includes(value as SpaceItemType) ? (value as SpaceItemType) : null
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const space = await getSpaceForUser(id, user.id, true)
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 })

    const { searchParams } = new URL(request.url)
    const type = readType(searchParams.get("type"))

    const rows = await sql`
      SELECT *
      FROM space_items
      WHERE space_id = ${space.id}
        AND (${type}::text IS NULL OR item_type = ${type})
      ORDER BY sort_order ASC, created_at DESC
    `

    const items = await hydrateSpaceItems(user, rows as never)
    return NextResponse.json({ items })
  } catch (error) {
    console.error("[spaces] GET items failed:", error)
    return NextResponse.json({ error: "Failed to load space items" }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const space = await getSpaceForUser(id, user.id)
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const parsed = spaceItemCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Space item is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    const itemId = parsed.data.create_new
      ? await createSpaceBackedItem(user, parsed.data.item_type, parsed.data)
      : String(parsed.data.item_id)

    const hasAccess = await validateSpaceItemAccess(user, parsed.data.item_type, itemId)
    if (!hasAccess) return NextResponse.json({ error: "Item not found" }, { status: 404 })

    const orderRows = await sql`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order
      FROM space_items
      WHERE space_id = ${space.id}
    `
    const sortOrder = Number(orderRows[0]?.sort_order || 1)

    const rows = await sql`
      INSERT INTO space_items (space_id, item_type, item_id, sort_order)
      VALUES (${space.id}, ${parsed.data.item_type}, ${itemId}, ${sortOrder})
      ON CONFLICT (space_id, item_type, item_id)
      DO UPDATE SET sort_order = EXCLUDED.sort_order
      RETURNING *
    `

    await sql`UPDATE spaces SET updated_at = NOW() WHERE id = ${space.id} AND user_id = ${user.id}`

    const items = await hydrateSpaceItems(user, rows as never)
    return NextResponse.json({ item: items[0] }, { status: parsed.data.create_new ? 201 : 200 })
  } catch (error) {
    console.error("[spaces] POST item failed:", error)
    return NextResponse.json({ error: "Failed to add item to space" }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const space = await getSpaceForUser(id, user.id, true)
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const parsed = spaceItemDeleteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Space item removal is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    await sql`
      DELETE FROM space_items
      WHERE space_id = ${space.id}
        AND item_type = ${parsed.data.item_type}
        AND item_id = ${parsed.data.item_id}
    `
    await sql`UPDATE spaces SET updated_at = NOW() WHERE id = ${space.id} AND user_id = ${user.id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[spaces] DELETE item failed:", error)
    return NextResponse.json({ error: "Failed to remove item from space" }, { status: 500 })
  }
}
