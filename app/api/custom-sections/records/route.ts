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

    const { searchParams } = new URL(request.url)
    const sectionId = searchParams.get("section_id")

    if (!sectionId) {
      return NextResponse.json({ error: "section_id is required" }, { status: 400 })
    }

    // Verify the section belongs to this user
    const sectionCheck = await sql`
      SELECT id FROM custom_sections
      WHERE id = ${sectionId} AND user_id = ${user.id}
    `
    if (sectionCheck.length === 0) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 })
    }

    const records = await sql`
      SELECT * FROM custom_section_records
      WHERE section_id = ${sectionId}
      ORDER BY created_at DESC
    `

    return NextResponse.json(records)
  } catch (error) {
    console.error("[custom-sections/records] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch records" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { section_id, data } = body

    if (!section_id) {
      return NextResponse.json({ error: "section_id is required" }, { status: 400 })
    }

    // Verify the section belongs to this user
    const sectionCheck = await sql`
      SELECT id FROM custom_sections
      WHERE id = ${section_id} AND user_id = ${user.id}
    `
    if (sectionCheck.length === 0) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 })
    }

    const dataJson = JSON.stringify(data && typeof data === "object" ? data : {})

    const result = await sql`
      INSERT INTO custom_section_records (section_id, data)
      VALUES (${section_id}, ${dataJson}::jsonb)
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[custom-sections/records] POST error:", error)
    return NextResponse.json({ error: "Failed to create record" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { id, data } = body

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    const dataJson = JSON.stringify(data && typeof data === "object" ? data : {})

    // Join with custom_sections to verify ownership
    const result = await sql`
      UPDATE custom_section_records r
      SET data = ${dataJson}::jsonb, updated_at = NOW()
      FROM custom_sections s
      WHERE r.id = ${id}
        AND r.section_id = s.id
        AND s.user_id = ${user.id}
      RETURNING r.*
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[custom-sections/records] PUT error:", error)
    return NextResponse.json({ error: "Failed to update record" }, { status: 500 })
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

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    // Join with custom_sections to verify ownership
    await sql`
      DELETE FROM custom_section_records r
      USING custom_sections s
      WHERE r.id = ${id}
        AND r.section_id = s.id
        AND s.user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[custom-sections/records] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete record" }, { status: 500 })
  }
}
