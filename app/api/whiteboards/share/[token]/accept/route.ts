import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { mapWhiteboardRow, normalizeEmail } from "@/lib/whiteboards"

type RouteContext = {
  params: Promise<{ token: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { token } = await context.params
    const boardRows = await sql`
      SELECT w.*, owner.name AS owner_name
      FROM whiteboards w
      LEFT JOIN users owner ON owner.id = w.user_id
      WHERE w.share_token = ${token}
        AND w.visibility = 'public_link'
        AND w.archived_at IS NULL
      LIMIT 1
    `

    const board = boardRows[0]
    if (!board) return NextResponse.json({ error: "Share link not found" }, { status: 404 })

    if (board.user_id === user.id) {
      return NextResponse.json({ board: mapWhiteboardRow({ ...(board as object), role: "owner" } as never) })
    }

    const email = normalizeEmail(user.email)
    const existing = await sql`
      SELECT *
      FROM whiteboard_collaborators
      WHERE whiteboard_id = ${board.id}
        AND (
          user_id = ${user.id}
          OR (${email}::text IS NOT NULL AND lower(email) = ${email})
        )
      LIMIT 1
    `

    if (existing[0]) {
      const rows = await sql`
        UPDATE whiteboard_collaborators
        SET user_id = ${user.id},
            email = COALESCE(email, ${email}),
            accepted_at = COALESCE(accepted_at, NOW())
        WHERE id = ${existing[0].id}
        RETURNING role
      `
      return NextResponse.json({ board: mapWhiteboardRow({ ...(board as object), role: rows[0].role } as never) })
    }

    await sql`
      INSERT INTO whiteboard_collaborators (whiteboard_id, user_id, email, role, invited_by, accepted_at)
      VALUES (${board.id}, ${user.id}, ${email}, 'viewer', ${board.user_id}, NOW())
    `

    return NextResponse.json({ board: mapWhiteboardRow({ ...(board as object), role: "viewer" } as never) })
  } catch (error) {
    console.error("[whiteboards] accept share failed:", error)
    return NextResponse.json({ error: "Failed to accept shared whiteboard" }, { status: 500 })
  }
}
