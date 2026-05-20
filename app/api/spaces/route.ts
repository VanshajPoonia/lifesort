import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { makeSpaceId, mapSpaceRow, spaceCreateSchema } from "@/lib/spaces"

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get("archived") === "true"
    const query = searchParams.get("q")?.trim() || ""

    const rows = await sql`
      SELECT
        s.*,
        COUNT(si.id)::int AS item_count,
        GREATEST(s.updated_at, COALESCE(MAX(si.created_at), s.updated_at)) AS activity_at
      FROM spaces s
      LEFT JOIN space_items si ON si.space_id = s.id
      WHERE s.user_id = ${user.id}
        AND (${includeArchived}::boolean = TRUE OR s.archived_at IS NULL)
        AND (${query} = '' OR s.name ILIKE ${`%${query}%`} OR COALESCE(s.description, '') ILIKE ${`%${query}%`})
      GROUP BY s.id
      ORDER BY s.favorite DESC, GREATEST(s.updated_at, COALESCE(MAX(si.created_at), s.updated_at)) DESC, s.created_at DESC
    `

    return NextResponse.json({ spaces: rows.map((row) => mapSpaceRow(row as never)) })
  } catch (error) {
    console.error("[spaces] GET failed:", error)
    return NextResponse.json({ error: "Failed to load spaces" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const parsed = spaceCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Space is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    const id = makeSpaceId()
    const rows = await sql`
      INSERT INTO spaces (id, user_id, name, description, color, icon, favorite)
      VALUES (
        ${id},
        ${user.id},
        ${parsed.data.name},
        ${parsed.data.description?.trim() || null},
        ${parsed.data.color || "primary"},
        ${parsed.data.icon || "FolderKanban"},
        ${Boolean(parsed.data.favorite)}
      )
      RETURNING *, 0::int AS item_count, updated_at AS activity_at
    `

    return NextResponse.json({ space: mapSpaceRow(rows[0] as never) }, { status: 201 })
  } catch (error) {
    console.error("[spaces] POST failed:", error)
    return NextResponse.json({ error: "Failed to create space" }, { status: 500 })
  }
}
