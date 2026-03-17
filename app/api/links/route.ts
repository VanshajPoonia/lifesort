import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const links = await sql`
      SELECT * FROM user_links 
      WHERE user_id = ${user.id}
      ORDER BY position ASC, created_at DESC
    `

    return NextResponse.json(links)
  } catch (error) {
    console.error("[v0] Error fetching links:", error)
    return NextResponse.json({ error: "Failed to fetch links" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { title, url, description, position, folder_id, thumbnail, link_type, file_data } = body

    const result = await sql`
      INSERT INTO user_links (user_id, title, url, description, position, folder_id, thumbnail, link_type, file_data)
      VALUES (${user.id}, ${title}, ${url || ''}, ${description || null}, ${position || 0}, ${folder_id || null}, ${thumbnail || null}, ${link_type || 'link'}, ${file_data || null})
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[v0] Error creating link:", error)
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, title, url, description, folder_id, thumbnail } = body

    const result = await sql`
      UPDATE user_links 
      SET 
        title = ${title},
        url = ${url},
        description = ${description || null},
        folder_id = ${folder_id || null},
        thumbnail = ${thumbnail || null},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[v0] Error updating link:", error)
    return NextResponse.json({ error: "Failed to update link" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Link ID is required" }, { status: 400 })
    }

    await sql`
      DELETE FROM user_links 
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting link:", error)
    return NextResponse.json({ error: "Failed to delete link" }, { status: 500 })
  }
}
