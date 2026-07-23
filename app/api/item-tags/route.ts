import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

const ITEM_TYPES = new Set(["task", "goal", "project"])

function cleanItemType(value: unknown): string | null {
  return typeof value === "string" && ITEM_TYPES.has(value) ? value : null
}

function cleanItemId(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

// GET ?item_type=task&item_id=123 -> tags on one item.
// GET ?item_type=task&item_ids=1,2,3 -> tag map for many items (list views).
export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const itemType = cleanItemType(searchParams.get("item_type"))
    if (!itemType) return NextResponse.json({ error: "item_type is required" }, { status: 400 })

    const itemId = cleanItemId(searchParams.get("item_id"))
    const itemIdsParam = searchParams.get("item_ids")

    if (itemId) {
      const rows = await sql`
        SELECT t.id, t.name, t.color
        FROM item_tags it
        JOIN tags t ON t.id = it.tag_id
        WHERE it.user_id = ${user.id} AND it.item_type = ${itemType} AND it.item_id = ${itemId}
        ORDER BY t.name ASC
      `
      return NextResponse.json(rows)
    }

    if (itemIdsParam) {
      const ids = itemIdsParam.split(",").map((value) => cleanItemId(value)).filter((value): value is number => value !== null)
      if (ids.length === 0) return NextResponse.json({})

      const rows = await sql`
        SELECT it.item_id, t.id, t.name, t.color
        FROM item_tags it
        JOIN tags t ON t.id = it.tag_id
        WHERE it.user_id = ${user.id} AND it.item_type = ${itemType} AND it.item_id = ANY(${ids})
        ORDER BY t.name ASC
      `
      const map: Record<string, { id: number; name: string; color: string }[]> = {}
      for (const row of rows as any[]) {
        const key = String(row.item_id)
        if (!map[key]) map[key] = []
        map[key].push({ id: row.id, name: row.name, color: row.color })
      }
      return NextResponse.json(map)
    }

    return NextResponse.json({ error: "item_id or item_ids is required" }, { status: 400 })
  } catch (error) {
    console.error("[item-tags] GET failed:", error)
    return NextResponse.json({ error: "Could not load tags" }, { status: 500 })
  }
}

// PUT { item_type, item_id, tag_ids } -> replaces the full tag set on one item.
export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const itemType = cleanItemType(body.item_type)
    const itemId = cleanItemId(body.item_id)
    if (!itemType || !itemId) {
      return NextResponse.json({ error: "item_type and item_id are required" }, { status: 400 })
    }

    const tagIds = Array.isArray(body.tag_ids)
      ? body.tag_ids.map((value: unknown) => cleanItemId(value)).filter((value: number | null): value is number => value !== null)
      : []

    await sql`DELETE FROM item_tags WHERE user_id = ${user.id} AND item_type = ${itemType} AND item_id = ${itemId}`

    for (const tagId of tagIds) {
      await sql`
        INSERT INTO item_tags (user_id, tag_id, item_type, item_id)
        SELECT ${user.id}, ${tagId}, ${itemType}, ${itemId}
        WHERE EXISTS (SELECT 1 FROM tags WHERE id = ${tagId} AND user_id = ${user.id})
        ON CONFLICT (tag_id, item_type, item_id) DO NOTHING
      `
    }

    const rows = await sql`
      SELECT t.id, t.name, t.color
      FROM item_tags it
      JOIN tags t ON t.id = it.tag_id
      WHERE it.user_id = ${user.id} AND it.item_type = ${itemType} AND it.item_id = ${itemId}
      ORDER BY t.name ASC
    `
    return NextResponse.json(rows)
  } catch (error) {
    console.error("[item-tags] PUT failed:", error)
    return NextResponse.json({ error: "Could not save tags" }, { status: 500 })
  }
}
