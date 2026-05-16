import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

import { getUserFromSession } from "@/lib/auth"
import { DEFAULT_LIFE_AREAS, normalizeLifeAreaId } from "@/lib/life-areas"

const sql = neon(process.env.DATABASE_URL!)

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function cleanSortOrder(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function seedDefaultLifeAreas(userId: string) {
  for (const [index, area] of DEFAULT_LIFE_AREAS.entries()) {
    await sql`
      INSERT INTO life_areas (user_id, name, icon, color, description, sort_order)
      VALUES (${userId}, ${area.name}, ${area.icon}, ${area.color}, ${area.description}, ${index})
      ON CONFLICT (user_id, name) DO NOTHING
    `
  }
}

async function listLifeAreas(userId: string) {
  const rows = await sql`
    SELECT *
    FROM life_areas
    WHERE user_id = ${userId}
    ORDER BY sort_order ASC, name ASC
  `

  if (rows.length === 0) {
    await seedDefaultLifeAreas(userId)
    return sql`
      SELECT *
      FROM life_areas
      WHERE user_id = ${userId}
      ORDER BY sort_order ASC, name ASC
    `
  }

  return rows
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json(await listLifeAreas(user.id))
  } catch (error) {
    console.error("[life-areas] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch life areas" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const name = cleanText(body.name)
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const countRows = await sql`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
      FROM life_areas
      WHERE user_id = ${user.id}
    `
    const sortOrder = cleanSortOrder(body.sort_order, Number(countRows[0]?.next_sort_order || 0))

    const result = await sql`
      INSERT INTO life_areas (user_id, name, icon, color, description, sort_order)
      VALUES (
        ${user.id},
        ${name},
        ${cleanText(body.icon, "Target")},
        ${cleanText(body.color, "#2563EB")},
        ${cleanText(body.description, "") || null},
        ${sortOrder}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[life-areas] POST error:", error)
    return NextResponse.json({ error: "Failed to create life area" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const id = normalizeLifeAreaId(body.id)
    const name = cleanText(body.name)

    if (!id || !name) {
      return NextResponse.json({ error: "ID and name are required" }, { status: 400 })
    }

    const result = await sql`
      UPDATE life_areas
      SET
        name = ${name},
        icon = ${cleanText(body.icon, "Target")},
        color = ${cleanText(body.color, "#2563EB")},
        description = ${cleanText(body.description, "") || null},
        sort_order = ${cleanSortOrder(body.sort_order, 0)},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Life area not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[life-areas] PUT error:", error)
    return NextResponse.json({ error: "Failed to update life area" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orderedIds } = await request.json()
    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: "orderedIds must be an array" }, { status: 400 })
    }

    for (const [index, rawId] of orderedIds.entries()) {
      const id = normalizeLifeAreaId(rawId)
      if (!id) continue
      await sql`
        UPDATE life_areas
        SET sort_order = ${index}, updated_at = NOW()
        WHERE id = ${id} AND user_id = ${user.id}
      `
    }

    return NextResponse.json(await listLifeAreas(user.id))
  } catch (error) {
    console.error("[life-areas] PATCH error:", error)
    return NextResponse.json({ error: "Failed to reorder life areas" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: rawId } = await request.json()
    const id = normalizeLifeAreaId(rawId)
    if (!id) {
      return NextResponse.json({ error: "Life area ID is required" }, { status: 400 })
    }

    await sql`
      DELETE FROM life_areas
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[life-areas] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete life area" }, { status: 500 })
  }
}
