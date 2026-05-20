import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import {
  canOwnWhiteboard,
  getWhiteboardAccess,
  makeShareToken,
  mapWhiteboardRow,
  whiteboardShareSchema,
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
    if (!canOwnWhiteboard(board.role)) return NextResponse.json({ error: "Only the owner can change sharing" }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const parsed = whiteboardShareSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Sharing request is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    const shareToken = parsed.data.rotate || !board.share_token ? makeShareToken() : board.share_token

    const rows = await sql`
      UPDATE whiteboards
      SET visibility = ${parsed.data.visibility},
          share_token = ${shareToken},
          updated_at = NOW()
      WHERE id = ${board.id} AND user_id = ${user.id} AND archived_at IS NULL
      RETURNING *
    `

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    return NextResponse.json({
      board: mapWhiteboardRow({ ...(rows[0] as object), role: "owner" } as never),
      share_url: `${origin}/whiteboard/share/${shareToken}`,
      share_token: shareToken,
    })
  } catch (error) {
    console.error("[whiteboards] share failed:", error)
    return NextResponse.json({ error: "Failed to update sharing" }, { status: 500 })
  }
}
