import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { getSpaceForUser, mapSpaceRow, spacePatchSchema } from "@/lib/spaces"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const space = await getSpaceForUser(id, user.id, true)
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 })

    return NextResponse.json({ space })
  } catch (error) {
    console.error("[spaces] GET by id failed:", error)
    return NextResponse.json({ error: "Failed to load space" }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const space = await getSpaceForUser(id, user.id, true)
    if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const parsed = spacePatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Space update is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    const rows = await sql`
      UPDATE spaces
      SET name = ${parsed.data.name ?? space.name},
          description = ${Object.prototype.hasOwnProperty.call(parsed.data, "description") ? parsed.data.description || null : space.description},
          color = ${parsed.data.color ?? space.color},
          icon = ${parsed.data.icon ?? space.icon},
          favorite = ${parsed.data.favorite ?? space.favorite},
          archived_at = CASE
            WHEN ${parsed.data.archived === true} THEN COALESCE(archived_at, NOW())
            WHEN ${parsed.data.archived === false} THEN NULL
            ELSE archived_at
          END,
          updated_at = NOW()
      WHERE id = ${space.id} AND user_id = ${user.id}
      RETURNING *, (
        SELECT COUNT(*)::int FROM space_items WHERE space_id = spaces.id
      ) AS item_count,
      updated_at AS activity_at
    `

    return NextResponse.json({ space: mapSpaceRow(rows[0] as never) })
  } catch (error) {
    console.error("[spaces] PATCH failed:", error)
    return NextResponse.json({ error: "Failed to update space" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const rows = await sql`
      UPDATE spaces
      SET archived_at = COALESCE(archived_at, NOW()),
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id} AND archived_at IS NULL
      RETURNING id
    `

    if (!rows[0]) return NextResponse.json({ error: "Space not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[spaces] DELETE failed:", error)
    return NextResponse.json({ error: "Failed to archive space" }, { status: 500 })
  }
}
