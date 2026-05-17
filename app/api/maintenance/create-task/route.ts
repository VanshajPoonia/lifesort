import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const priorities = new Set(["low", "medium", "high"])

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === "" || value === "none") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function cleanText(value: unknown, fallback: string | null = null) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function cleanDate(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function cleanPriority(value: unknown) {
  return typeof value === "string" && priorities.has(value) ? value : "medium"
}

async function validateLifeAreaId(lifeAreaId: number | null, userId: string) {
  if (!lifeAreaId) return null
  const rows = await sql`SELECT id FROM life_areas WHERE id = ${lifeAreaId} AND user_id = ${userId} LIMIT 1`
  return rows.length > 0 ? lifeAreaId : undefined
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as {
      id?: number | string | null
      title?: string | null
      description?: string | null
      due_date?: string | null
      priority?: string | null
      life_area_id?: number | string | null
    }
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 })

    const rows = await sql`
      SELECT *
      FROM maintenance_items
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const item = rows[0]
    const title = cleanText(body.title, item.title) || item.title
    const lifeAreaId = await validateLifeAreaId(
      Object.prototype.hasOwnProperty.call(body, "life_area_id")
        ? normalizeLifeAreaId(body.life_area_id)
        : normalizeLifeAreaId(item.life_area_id),
      user.id,
    )
    if (lifeAreaId === undefined) return NextResponse.json({ error: "Life area not found" }, { status: 404 })

    const task = await sql`
      INSERT INTO tasks (
        user_id,
        title,
        description,
        priority,
        due_date,
        category,
        completed,
        life_area_id
      ) VALUES (
        ${user.id},
        ${title},
        ${cleanText(body.description, item.notes)},
        ${cleanPriority(body.priority)},
        ${cleanDate(body.due_date) || item.next_due_date},
        'maintenance',
        FALSE,
        ${lifeAreaId}
      )
      RETURNING *
    `

    return NextResponse.json({ task: task[0], maintenance_item: item })
  } catch (error) {
    console.error("[maintenance/create-task] POST error:", error)
    return NextResponse.json({ error: "Failed to create task from maintenance item" }, { status: 500 })
  }
}
