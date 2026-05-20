import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import {
  canOwnWhiteboard,
  getWhiteboardAccess,
  normalizeEmail,
  whiteboardCollaboratorCreateSchema,
} from "@/lib/whiteboards"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const board = await getWhiteboardAccess(user, { id })
    if (!board) return NextResponse.json({ error: "Whiteboard not found" }, { status: 404 })
    if (!canOwnWhiteboard(board.role)) return NextResponse.json({ error: "Only the owner can invite collaborators" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const parsed = whiteboardCollaboratorCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Collaborator invite is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    let targetUserId = parsed.data.user_id || null
    let targetEmail = normalizeEmail(parsed.data.email)

    if (targetUserId) {
      const rows = await sql`SELECT id, email FROM users WHERE id = ${targetUserId} LIMIT 1`
      if (!rows[0]) return NextResponse.json({ error: "User not found" }, { status: 404 })
      targetEmail = normalizeEmail(String(rows[0].email))
    } else if (targetEmail) {
      const rows = await sql`SELECT id, email FROM users WHERE lower(email) = ${targetEmail} LIMIT 1`
      if (rows[0]) targetUserId = String(rows[0].id)
    }

    if (targetUserId === board.user_id || targetEmail === normalizeEmail(user.email)) {
      return NextResponse.json({ error: "The owner already has access" }, { status: 400 })
    }

    const existing = await sql`
      SELECT *
      FROM whiteboard_collaborators
      WHERE whiteboard_id = ${board.id}
        AND role <> 'owner'
        AND (
          (${targetUserId}::text IS NOT NULL AND user_id = ${targetUserId})
          OR (${targetEmail}::text IS NOT NULL AND lower(email) = ${targetEmail})
        )
      LIMIT 1
    `

    if (existing[0]) {
      const updated = await sql`
        UPDATE whiteboard_collaborators
        SET user_id = COALESCE(${targetUserId}, user_id),
            email = COALESCE(${targetEmail}, email),
            role = ${parsed.data.role},
            accepted_at = CASE WHEN ${targetUserId}::text IS NOT NULL THEN COALESCE(accepted_at, NOW()) ELSE accepted_at END
        WHERE id = ${existing[0].id}
        RETURNING *
      `
      return NextResponse.json({ collaborator: updated[0] })
    }

    const rows = await sql`
      INSERT INTO whiteboard_collaborators (whiteboard_id, user_id, email, role, invited_by, accepted_at)
      VALUES (
        ${board.id},
        ${targetUserId},
        ${targetEmail},
        ${parsed.data.role},
        ${user.id},
        CASE WHEN ${targetUserId}::text IS NOT NULL THEN NOW() ELSE NULL END
      )
      RETURNING *
    `

    return NextResponse.json({ collaborator: rows[0] }, { status: 201 })
  } catch (error) {
    console.error("[whiteboards] invite collaborator failed:", error)
    return NextResponse.json({ error: "Failed to invite collaborator" }, { status: 500 })
  }
}
