import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromRequest } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sections = await sql`
      SELECT * FROM custom_sections 
      WHERE user_id = ${user.id}
      ORDER BY position ASC, created_at DESC
    `

    return NextResponse.json(sections)
  } catch (error) {
    console.error("[v0] Error fetching custom sections:", error)
    return NextResponse.json({ error: "Failed to fetch sections" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title, icon, color, position } = body

    const result = await sql`
      INSERT INTO custom_sections (user_id, title, icon, color, position)
      VALUES (${user.id}, ${title}, ${icon || 'Folder'}, ${color || 'primary'}, ${position || 0})
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[v0] Error creating custom section:", error)
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, icon, color, position } = body

    const result = await sql`
      UPDATE custom_sections 
      SET title = ${title}, icon = ${icon}, color = ${color}, position = ${position}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[v0] Error updating custom section:", error)
    return NextResponse.json({ error: "Failed to update section" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    await sql`
      DELETE FROM custom_sections 
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting custom section:", error)
    return NextResponse.json({ error: "Failed to delete section" }, { status: 500 })
  }
}
