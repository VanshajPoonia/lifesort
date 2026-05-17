import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = cleanId(searchParams.get("project_id"))
    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const projectRows = await sql`
      SELECT id
      FROM projects
      WHERE id = ${projectId} AND user_id = ${user.id}
      LIMIT 1
    `

    if (projectRows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const activity = await sql`
      SELECT *
      FROM project_activity
      WHERE project_id = ${projectId} AND user_id = ${user.id}
      ORDER BY created_at DESC
      LIMIT 50
    `

    return NextResponse.json({ activity })
  } catch (error) {
    console.error("[project-activity] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch project activity" }, { status: 500 })
  }
}
