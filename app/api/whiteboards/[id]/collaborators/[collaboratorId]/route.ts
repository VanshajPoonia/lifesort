import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import {
  canOwnWhiteboard,
  getWhiteboardAccess,
  whiteboardCollaboratorPatchSchema,
} from "@/lib/whiteboards"

type RouteContext = {
  params: Promise<{ id: string; collaboratorId: string }>
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id, collaboratorId } = await context.params
    const board = await getWhiteboardAccess(user, { id })
    if (!board) return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 })
    if (!canOwnWhiteboard(board.role)) return NextResponse.json({ error: "Only the owner can update collaborators" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const parsed = whiteboardCollaboratorPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Collaborator update is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    const rows = await sql`
      UPDATE whiteboard_collaborators
      SET role = ${parsed.data.role}
      WHERE id = ${collaboratorId}
        AND whiteboard_id = ${board.id}
        AND role <> 'owner'
      RETURNING *
    `

    if (!rows[0]) return NextResponse.json({ error: "Collaborator not found" }, { status: 404 })
    return NextResponse.json({ collaborator: rows[0] })
  } catch (error) {
    console.error("[whiteboards] collaborator patch failed:", error)
    return NextResponse.json({ error: "Failed to update collaborator" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id, collaboratorId } = await context.params
    const board = await getWhiteboardAccess(user, { id })
    if (!board) return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 })
    if (!canOwnWhiteboard(board.role)) return NextResponse.json({ error: "Only the owner can remove collaborators" }, { status: 403 })

    const rows = await sql`
      DELETE FROM whiteboard_collaborators
      WHERE id = ${collaboratorId}
        AND whiteboard_id = ${board.id}
        AND role <> 'owner'
      RETURNING id
    `

    if (!rows[0]) return NextResponse.json({ error: "Collaborator not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[whiteboards] collaborator delete failed:", error)
    return NextResponse.json({ error: "Failed to remove collaborator" }, { status: 500 })
  }
}
