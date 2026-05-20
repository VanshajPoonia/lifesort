import { Liveblocks } from "@liveblocks/node"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { getWhiteboardAccess, stableUserColor } from "@/lib/whiteboards"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } })
    }

    const secret = process.env.LIVEBLOCKS_SECRET_KEY
    if (!secret) {
      return Response.json(
        {
          error: "Liveblocks is not configured",
          code: "LIVEBLOCKS_NOT_CONFIGURED",
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      )
    }

    const body = await request.json().catch(() => null)
    const room = typeof body?.room === "string" ? body.room : null
    if (!room || !room.startsWith("lifesort:whiteboard:")) {
      return Response.json({ error: "Invalid room" }, { status: 400, headers: { "Cache-Control": "no-store" } })
    }

    const board = await getWhiteboardAccess(user, { roomId: room })
    if (!board) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } })
    }

    const profileRows = await sql`
      SELECT avatar, avatar_url
      FROM users
      WHERE id = ${user.id}
      LIMIT 1
    `
    const profile = profileRows[0] || {}
    const color = stableUserColor(user.id)
    const liveblocks = new Liveblocks({ secret })
    const session = liveblocks.prepareSession(user.id, {
      userInfo: {
        name: user.name || "LifeSort user",
        avatar: String(profile.avatar_url || profile.avatar || ""),
        color,
      },
    })

    session.allow(board.liveblocks_room_id, board.role === "viewer" ? session.READ_ACCESS : session.FULL_ACCESS)
    const { status, body: responseBody } = await session.authorize()

    return new Response(responseBody, {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[liveblocks-auth] failed:", error)
    return Response.json({ error: "Failed to authorize Liveblocks session" }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
