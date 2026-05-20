import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import {
  canEditWhiteboard,
  canOwnWhiteboard,
  getWhiteboardAccess,
  mapWhiteboardRow,
  whiteboardPatchSchema,
} from "@/lib/whiteboards"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const board = await getWhiteboardAccess(user, { id })
    if (!board) return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 })

    await sql`
      UPDATE whiteboards
      SET last_opened_at = NOW()
      WHERE id = ${board.id}
    `

    const collaborators = await sql`
      SELECT
        wc.id,
        wc.whiteboard_id,
        wc.user_id,
        wc.email,
        wc.role,
        wc.invited_by,
        wc.invited_at,
        wc.accepted_at,
        wc.created_at,
        u.name,
        u.avatar,
        u.avatar_url
      FROM whiteboard_collaborators wc
      LEFT JOIN users u ON u.id = wc.user_id
      WHERE wc.whiteboard_id = ${board.id}
      ORDER BY
        CASE wc.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
        wc.created_at ASC
    `

    return NextResponse.json({ board, collaborators, liveblocks_configured: Boolean(process.env.LIVEBLOCKS_SECRET_KEY) })
  } catch (error) {
    console.error("[whiteboards] GET by id failed:", error)
    return NextResponse.json({ error: "Failed to load whiteboard" }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const board = await getWhiteboardAccess(user, { id })
    if (!board) return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 })
    if (!canEditWhiteboard(board.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const parsed = whiteboardPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Whiteboard update is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    const nextTitle = parsed.data.title ?? board.title
    const nextDescription = Object.prototype.hasOwnProperty.call(parsed.data, "description")
      ? parsed.data.description || null
      : board.description

    const rows = await sql`
      UPDATE whiteboards
      SET title = ${nextTitle},
          description = ${nextDescription},
          updated_at = NOW()
      WHERE id = ${board.id} AND archived_at IS NULL
      RETURNING *
    `

    return NextResponse.json({ board: mapWhiteboardRow({ ...(rows[0] as object), role: board.role } as never) })
  } catch (error) {
    console.error("[whiteboards] PATCH failed:", error)
    return NextResponse.json({ error: "Failed to update whiteboard" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const board = await getWhiteboardAccess(user, { id })
    if (!board) return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 })
    if (!canOwnWhiteboard(board.role)) return NextResponse.json({ error: "Only the owner can archive this board" }, { status: 403 })

    await sql`
      UPDATE whiteboards
      SET archived_at = COALESCE(archived_at, NOW()),
          updated_at = NOW()
      WHERE id = ${board.id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[whiteboards] DELETE failed:", error)
    return NextResponse.json({ error: "Failed to archive whiteboard" }, { status: 500 })
  }
}
