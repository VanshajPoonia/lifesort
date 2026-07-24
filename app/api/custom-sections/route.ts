import { NextRequest, NextResponse } from "next/server"
import { neon } from "@/lib/neon-client"
import { getUserFromRequest } from "@/lib/auth"
import { normalizeLifeAreaId } from "@/lib/life-areas"

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

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sections = await sql`
      SELECT * FROM custom_sections
      WHERE user_id = ${user.id}
      ORDER BY position ASC, created_at DESC
    `

    return NextResponse.json(sections)
  } catch (error) {
    console.error("[custom-sections] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch sections" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title, icon, color, description, fields, position, life_area_id } = body

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const fieldsJson = JSON.stringify(Array.isArray(fields) ? fields : [])
    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(life_area_id), user.id)

    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: "Life domain not found" }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO custom_sections (user_id, title, icon, color, description, fields, position, life_area_id)
      VALUES (
        ${user.id},
        ${title.trim()},
        ${icon || "Folder"},
        ${color || "primary"},
        ${description || null},
        ${fieldsJson}::jsonb,
        ${position ?? 0},
        ${lifeAreaId}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[custom-sections] POST error:", error)
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, icon, color, description, fields, position, life_area_id } = body

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const fieldsJson = JSON.stringify(Array.isArray(fields) ? fields : [])
    const lifeAreaTouched = Object.prototype.hasOwnProperty.call(body, "life_area_id")
    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(life_area_id), user.id)

    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: "Life domain not found" }, { status: 404 })
    }

    const result = await sql`
      UPDATE custom_sections
      SET
        title = ${title.trim()},
        icon = ${icon || "Folder"},
        color = ${color || "primary"},
        description = ${description || null},
        fields = ${fieldsJson}::jsonb,
        position = ${position ?? 0},
        life_area_id = CASE WHEN ${lifeAreaTouched} THEN ${lifeAreaId} ELSE life_area_id END,
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[custom-sections] PUT error:", error)
    return NextResponse.json({ error: "Failed to update section" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    await sql`
      DELETE FROM custom_sections
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[custom-sections] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete section" }, { status: 500 })
  }
}
