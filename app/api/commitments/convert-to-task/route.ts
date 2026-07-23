import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const priorities = new Set(["low", "medium", "high"])

type ConvertBody = {
  id?: number | string | null
  title?: string | null
  description?: string | null
  due_date?: string | null
  priority?: string | null
  life_area_id?: number | string | null
}

function hasField(body: ConvertBody, field: keyof ConvertBody) {
  return Object.prototype.hasOwnProperty.call(body, field)
}

function cleanText(value: unknown, fallback: string | null = null) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === "" || value === "none") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function cleanDate(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function cleanPriority(value: unknown) {
  if (typeof value !== "string") return "medium"
  return priorities.has(value) ? value : "medium"
}

async function validateLifeAreaId(lifeAreaId: number | null, userId: string) {
  if (!lifeAreaId) return null
  const rows = await sql`
    SELECT id FROM life_areas WHERE id = ${lifeAreaId} AND user_id = ${userId} LIMIT 1
  `
  return rows.length > 0 ? lifeAreaId : undefined
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as ConvertBody
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: "Commitment ID is required" }, { status: 400 })

    const commitmentRows = await sql`
      SELECT * FROM commitments WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
    `
    if (commitmentRows.length === 0) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 })
    }

    const commitment = commitmentRows[0]
    if (commitment.related_task_id) {
      return NextResponse.json({ error: "Commitment already has a related task" }, { status: 400 })
    }

    const lifeAreaId = hasField(body, "life_area_id")
      ? await validateLifeAreaId(normalizeLifeAreaId(body.life_area_id), user.id)
      : normalizeLifeAreaId(commitment.life_area_id)
    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: "Life domain not found" }, { status: 404 })
    }

    const title = cleanText(body.title, commitment.title) || commitment.title
    const description = hasField(body, "description")
      ? cleanText(body.description)
      : cleanText(commitment.description, `Commitment to ${commitment.committed_to}`)
    const dueDate = hasField(body, "due_date") ? cleanDate(body.due_date) : cleanDate(String(commitment.due_date || "").slice(0, 10))

    const taskRows = await sql`
      INSERT INTO tasks (
        user_id,
        title,
        description,
        priority,
        due_date,
        completed,
        category,
        life_area_id
      )
      VALUES (
        ${user.id},
        ${title},
        ${description},
        ${cleanPriority(body.priority)},
        ${dueDate},
        FALSE,
        'commitment',
        ${lifeAreaId}
      )
      RETURNING *
    `

    const task = taskRows[0]
    const updatedRows = await sql`
      UPDATE commitments
      SET related_task_id = ${task.id}, updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json({ commitment: updatedRows[0], task })
  } catch (error) {
    console.error("[commitments] convert-to-task error:", error)
    return NextResponse.json({ error: "Failed to convert commitment to task" }, { status: 500 })
  }
}
