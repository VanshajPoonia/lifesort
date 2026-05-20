import { NextResponse } from "next/server"

import { sql } from "@/lib/db"

type RouteContext = {
  params: Promise<{ token: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params
    const rows = await sql`
      SELECT
        w.id,
        w.title,
        w.description,
        w.visibility,
        w.archived_at,
        u.name AS owner_name
      FROM whiteboards w
      LEFT JOIN users u ON u.id = w.user_id
      WHERE w.share_token = ${token}
        AND w.visibility = 'public_link'
        AND w.archived_at IS NULL
      LIMIT 1
    `

    if (!rows[0]) return NextResponse.json({ error: "Share link not found" }, { status: 404 })
    return NextResponse.json({ board: rows[0], login_required: true })
  } catch (error) {
    console.error("[whiteboards] share metadata failed:", error)
    return NextResponse.json({ error: "Failed to load shared whiteboard" }, { status: 500 })
  }
}
