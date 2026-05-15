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

    const result = await sql`
      SELECT * FROM nuke_goals 
      WHERE user_id = ${user.id}
      LIMIT 1
    `

    return NextResponse.json(result[0] || null)
  } catch (error) {
    console.error("[v0] Error fetching nuke goal:", error)
    return NextResponse.json({ error: "Failed to fetch nuke goal" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { title, description, deadline, milestones } = await request.json()

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    // Check if user already has a nuke goal
    const existing = await sql`
      SELECT id FROM nuke_goals WHERE user_id = ${user.id}
    `

    let result
    if (existing.length > 0) {
      // Update existing goal
      result = await sql`
        UPDATE nuke_goals 
        SET title = ${title}, 
            description = ${description || null}, 
            deadline = ${deadline || null}, 
            milestones = ${JSON.stringify(milestones || [])},
            completed = false,
            updated_at = NOW()
        WHERE user_id = ${user.id}
        RETURNING *
      `
    } else {
      // Create new goal
      result = await sql`
        INSERT INTO nuke_goals (user_id, title, description, deadline, milestones, completed)
        VALUES (${user.id}, ${title}, ${description || null}, ${deadline || null}, ${JSON.stringify(milestones || [])}, false)
        RETURNING *
      `
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[v0] Error saving nuke goal:", error)
    return NextResponse.json({ error: "Failed to save nuke goal" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { title, description, deadline, milestones, completed } = await request.json()

    const result = await sql`
      UPDATE nuke_goals 
      SET title = COALESCE(${title}, title),
          description = COALESCE(${description}, description),
          deadline = COALESCE(${deadline}, deadline),
          milestones = COALESCE(${milestones ? JSON.stringify(milestones) : null}, milestones),
          completed = COALESCE(${completed}, completed),
          updated_at = NOW()
      WHERE user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Nuke goal not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[v0] Error updating nuke goal:", error)
    return NextResponse.json({ error: "Failed to update nuke goal" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await sql`
      DELETE FROM nuke_goals 
      WHERE user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting nuke goal:", error)
    return NextResponse.json({ error: "Failed to delete nuke goal" }, { status: 500 })
  }
}
