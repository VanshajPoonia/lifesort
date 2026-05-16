import { NextRequest, NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

function normalizeName(name: unknown) {
  return typeof name === "string" ? name.trim() : ""
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const folders = await sql`
      SELECT *
      FROM note_folders
      WHERE user_id = ${user.id}
      ORDER BY name ASC
    `

    return NextResponse.json(folders)
  } catch (error) {
    // If the table doesn't exist yet (migration not run), return empty array
    // so the notes page degrades gracefully instead of erroring.
    const msg = error instanceof Error ? error.message : String(error)
    if (msg.includes("note_folders") || msg.includes("does not exist")) {
      return NextResponse.json([])
    }
    console.error("Get note folders error:", error)
    return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name } = await request.json()
    const normalizedName = normalizeName(name)

    if (!normalizedName) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO note_folders (user_id, name)
      VALUES (${user.id}, ${normalizedName})
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Create note folder error:", error)
    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, name } = await request.json()
    const normalizedName = normalizeName(name)

    if (!id) {
      return NextResponse.json({ error: "Folder ID is required" }, { status: 400 })
    }

    if (!normalizedName) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 })
    }

    const result = await sql`
      UPDATE note_folders
      SET name = ${normalizedName}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Update note folder error:", error)
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

    const folders = await sql`
      SELECT id FROM note_folders
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `

    if (folders.length === 0) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 })
    }

    await sql`
      UPDATE notes
      SET folder_id = NULL, updated_at = NOW()
      WHERE folder_id = ${id} AND user_id = ${user.id}
    `

    await sql`
      DELETE FROM note_folders
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete note folder error:", error)
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 })
  }
}
