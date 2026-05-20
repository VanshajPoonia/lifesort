import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import {
  makeWhiteboardId,
  makeWhiteboardRoomId,
  mapWhiteboardRow,
  normalizeEmail,
  whiteboardCreateSchema,
} from "@/lib/whiteboards"

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const includeArchived = searchParams.get("archived") === "true"
    const search = searchParams.get("q")?.trim() || ""
    const email = normalizeEmail(user.email)

    const rows = await sql`
      SELECT
        w.*,
        owner.name AS owner_name,
        (
          SELECT COUNT(*)::int
          FROM whiteboard_collaborators wc_count
          WHERE wc_count.whiteboard_id = w.id
        ) AS collaborator_count,
        CASE
          WHEN w.user_id = ${user.id} THEN 'owner'
          WHEN wc.role = 'owner' THEN 'owner'
          WHEN wc.role = 'editor' THEN 'editor'
          WHEN wc.role = 'viewer' THEN 'viewer'
          ELSE 'viewer'
        END AS role
      FROM whiteboards w
      LEFT JOIN users owner ON owner.id = w.user_id
      LEFT JOIN whiteboard_collaborators wc
        ON wc.whiteboard_id = w.id
        AND (
          wc.user_id = ${user.id}
          OR (${email}::text IS NOT NULL AND lower(wc.email) = ${email})
        )
      WHERE
        (${includeArchived}::boolean = TRUE OR w.archived_at IS NULL)
        AND (w.user_id = ${user.id} OR wc.id IS NOT NULL)
        AND (${search} = '' OR w.title ILIKE ${`%${search}%`} OR COALESCE(w.description, '') ILIKE ${`%${search}%`})
      ORDER BY COALESCE(w.last_opened_at, w.updated_at, w.created_at) DESC, w.created_at DESC
    `

    return NextResponse.json({ boards: rows.map((row) => mapWhiteboardRow(row as never)) })
  } catch (error) {
    console.error("[whiteboards] GET failed:", error)
    return NextResponse.json({ error: "Failed to load whiteboards" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const parsed = whiteboardCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Whiteboard is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    const id = makeWhiteboardId()
    const roomId = makeWhiteboardRoomId(id)
    const title = parsed.data.title || "Untitled whiteboard"
    const description = parsed.data.description?.trim() || null

    const rows = await sql`
      WITH board AS (
        INSERT INTO whiteboards (id, user_id, title, description, liveblocks_room_id)
        VALUES (${id}, ${user.id}, ${title}, ${description}, ${roomId})
        RETURNING *
      ),
      owner_collaborator AS (
        INSERT INTO whiteboard_collaborators (whiteboard_id, user_id, email, role, invited_by, accepted_at)
        SELECT board.id, ${user.id}, ${normalizeEmail(user.email)}, 'owner', ${user.id}, NOW()
        FROM board
        RETURNING *
      )
      SELECT
        board.*,
        ${user.name} AS owner_name,
        1::int AS collaborator_count,
        'owner' AS role
      FROM board
    `

    return NextResponse.json({ board: mapWhiteboardRow(rows[0] as never) }, { status: 201 })
  } catch (error) {
    console.error("[whiteboards] POST failed:", error)
    return NextResponse.json({ error: "Failed to create whiteboard" }, { status: 500 })
  }
}
