import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

function cleanName(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 60) : ""
}

function cleanColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#64748B"
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const tags = await sql`
      SELECT t.id, t.name, t.color, COUNT(it.id)::int AS item_count
      FROM tags t
      LEFT JOIN item_tags it ON it.tag_id = t.id
      WHERE t.user_id = ${user.id}
      GROUP BY t.id, t.name, t.color
      ORDER BY t.name ASC
    `

    return NextResponse.json(tags)
  } catch (error) {
    console.error("[tags] GET failed:", error)
    return NextResponse.json({ error: "Could not load tags" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const name = cleanName(body.name)
    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

    const result = await sql`
      INSERT INTO tags (user_id, name, color)
      VALUES (${user.id}, ${name}, ${cleanColor(body.color)})
      ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name, color
    `

    return NextResponse.json({ ...result[0], item_count: 0 })
  } catch (error) {
    console.error("[tags] POST failed:", error)
    return NextResponse.json({ error: "Could not create tag" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: "Tag ID is required" }, { status: 400 })

    await sql`DELETE FROM tags WHERE id = ${id} AND user_id = ${user.id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[tags] DELETE failed:", error)
    return NextResponse.json({ error: "Could not delete tag" }, { status: 500 })
  }
}
