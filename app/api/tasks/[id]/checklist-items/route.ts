import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

type RouteContext = {
  params: Promise<{ id: string }>
}

type ChecklistItemBody = {
  id?: number | string
  title?: string | null
  completed?: boolean | null
  orderedIds?: Array<number | string>
}

function cleanId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim().slice(0, 500)
  return trimmed || null
}

function cleanOrderedIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<number>()
  const ids: number[] = []
  value.forEach((item) => {
    const id = cleanId(item)
    if (!id || seen.has(id)) return
    seen.add(id)
    ids.push(id)
  })
  return ids
}

async function getOwnedTaskId(taskIdParam: string, userId: string): Promise<number | null> {
  const taskId = cleanId(taskIdParam)
  if (!taskId) return null
  const rows = await sql`SELECT id FROM tasks WHERE id = ${taskId} AND user_id = ${userId} LIMIT 1`
  return rows.length > 0 ? taskId : null
}

// GET -> checklist items for one task, in display order.
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const taskId = await getOwnedTaskId(id, user.id)
    if (!taskId) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const items = await sql`
      SELECT *
      FROM task_checklist_items
      WHERE task_id = ${taskId} AND user_id = ${user.id}
      ORDER BY sort_order ASC, created_at ASC
    `
    return NextResponse.json(items)
  } catch (error) {
    console.error("[task-checklist-items] GET failed:", error)
    return NextResponse.json({ error: "Failed to load checklist items" }, { status: 500 })
  }
}

// POST { title } -> appends a new checklist item to this task.
export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const taskId = await getOwnedTaskId(id, user.id)
    if (!taskId) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const body = (await request.json()) as ChecklistItemBody
    const title = cleanTitle(body.title)
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const orderRows = await sql`
      SELECT COALESCE(MAX(sort_order), 0) + 1 AS sort_order
      FROM task_checklist_items
      WHERE task_id = ${taskId} AND user_id = ${user.id}
    `
    const sortOrder = Number(orderRows[0]?.sort_order ?? 1)

    const result = await sql`
      INSERT INTO task_checklist_items (task_id, user_id, title, sort_order)
      VALUES (${taskId}, ${user.id}, ${title}, ${sortOrder})
      RETURNING *
    `
    return NextResponse.json(result[0], { status: 201 })
  } catch (error) {
    console.error("[task-checklist-items] POST failed:", error)
    return NextResponse.json({ error: "Failed to create checklist item" }, { status: 500 })
  }
}

// PATCH { orderedIds } -> persists manual reordering within this task.
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const taskId = await getOwnedTaskId(id, user.id)
    if (!taskId) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const body = (await request.json()) as ChecklistItemBody
    const orderedIds = cleanOrderedIds(body.orderedIds)
    if (orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds is required" }, { status: 400 })
    }

    const existingRows = await sql`
      SELECT id FROM task_checklist_items WHERE task_id = ${taskId} AND user_id = ${user.id}
    `
    const ownedIds = new Set(existingRows.map((row) => Number(row.id)))
    const invalidId = orderedIds.find((itemId) => !ownedIds.has(itemId))
    if (invalidId) {
      return NextResponse.json({ error: "Checklist item not found", id: invalidId }, { status: 404 })
    }

    await Promise.all(
      orderedIds.map((itemId, index) =>
        sql`
          UPDATE task_checklist_items
          SET sort_order = ${index}, updated_at = NOW()
          WHERE id = ${itemId} AND task_id = ${taskId} AND user_id = ${user.id}
        `,
      ),
    )

    const items = await sql`
      SELECT * FROM task_checklist_items
      WHERE task_id = ${taskId} AND user_id = ${user.id}
      ORDER BY sort_order ASC, created_at ASC
    `
    return NextResponse.json(items)
  } catch (error) {
    console.error("[task-checklist-items] PATCH failed:", error)
    return NextResponse.json({ error: "Failed to reorder checklist items" }, { status: 500 })
  }
}

// PUT { id, title?, completed? } -> partial update of one checklist item.
export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const taskId = await getOwnedTaskId(id, user.id)
    if (!taskId) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const body = (await request.json()) as ChecklistItemBody
    const itemId = cleanId(body.id)
    if (!itemId) return NextResponse.json({ error: "Checklist item ID is required" }, { status: 400 })

    const existingRows = await sql`
      SELECT * FROM task_checklist_items
      WHERE id = ${itemId} AND task_id = ${taskId} AND user_id = ${user.id}
      LIMIT 1
    `
    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Checklist item not found" }, { status: 404 })
    }

    const existing = existingRows[0]
    const hasTitle = Object.prototype.hasOwnProperty.call(body, "title")
    const hasCompleted = Object.prototype.hasOwnProperty.call(body, "completed")
    const nextTitle = hasTitle ? cleanTitle(body.title) ?? existing.title : existing.title
    const nextCompleted = hasCompleted ? Boolean(body.completed) : Boolean(existing.completed)

    const result = await sql`
      UPDATE task_checklist_items
      SET title = ${nextTitle}, completed = ${nextCompleted}, updated_at = NOW()
      WHERE id = ${itemId} AND task_id = ${taskId} AND user_id = ${user.id}
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[task-checklist-items] PUT failed:", error)
    return NextResponse.json({ error: "Failed to update checklist item" }, { status: 500 })
  }
}

// DELETE { id } -> removes one checklist item from this task.
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const taskId = await getOwnedTaskId(id, user.id)
    if (!taskId) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const body = (await request.json()) as ChecklistItemBody
    const itemId = cleanId(body.id)
    if (!itemId) return NextResponse.json({ error: "Checklist item ID is required" }, { status: 400 })

    await sql`
      DELETE FROM task_checklist_items
      WHERE id = ${itemId} AND task_id = ${taskId} AND user_id = ${user.id}
    `
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[task-checklist-items] DELETE failed:", error)
    return NextResponse.json({ error: "Failed to delete checklist item" }, { status: 500 })
  }
}
