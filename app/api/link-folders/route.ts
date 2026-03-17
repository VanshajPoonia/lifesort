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

    const folders = await sql`
      SELECT * FROM link_folders 
      WHERE user_id = ${user.id}
      ORDER BY name ASC
    `

    return NextResponse.json(folders)
  } catch (error) {
    console.error("[v0] Error fetching folders:", error)
    return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, color, parent_id } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO link_folders (user_id, name, color, parent_id)
      VALUES (${user.id}, ${name}, ${color || 'bg-primary'}, ${parent_id || null})
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[v0] Error creating folder:", error)
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, name, color, parent_id } = body

    const result = await sql`
      UPDATE link_folders 
      SET 
        name = ${name},
        color = ${color},
        parent_id = ${parent_id || null},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[v0] Error updating folder:", error)
    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 })
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
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 })
    }

    // First, update all links in this folder to have no folder
    await sql`
      UPDATE user_links 
      SET folder_id = NULL 
      WHERE folder_id = ${id.toString()} AND user_id = ${user.id}
    `

    // Move subfolders to parent level (or root if no parent)
    const folder = await sql`SELECT parent_id FROM link_folders WHERE id = ${id}`
    const parentId = folder[0]?.parent_id || null
    
    await sql`
      UPDATE link_folders 
      SET parent_id = ${parentId}
      WHERE parent_id = ${id} AND user_id = ${user.id}
    `

    // Then delete the folder
    await sql`
      DELETE FROM link_folders 
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting folder:", error)
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 })
  }
}
