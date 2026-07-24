import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

type RouteContext = {
  params: Promise<{ id: string }>
}

const frequencies = new Set(["daily", "weekdays", "weekly", "monthly", "yearly", "custom"])

type RecurrenceBody = {
  frequency?: string | null
  interval_count?: number | string | null
  repeat_after_completion?: boolean | null
  ends_on?: string | null
  ends_after_count?: number | string | null
}

function cleanId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function cleanFrequency(value: unknown): string | null {
  if (typeof value !== "string") return null
  return frequencies.has(value) ? value : null
}

function cleanIntervalCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.min(365, parsed)
}

function cleanEndsOn(value: unknown): string | null {
  if (typeof value !== "string") return null
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() : null
}

function cleanEndsAfterCount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed) || parsed < 1) return null
  return Math.min(1000, parsed)
}

async function getOwnedTaskId(taskIdParam: string, userId: string): Promise<number | null> {
  const taskId = cleanId(taskIdParam)
  if (!taskId) return null
  const rows = await sql`SELECT id FROM tasks WHERE id = ${taskId} AND user_id = ${userId} LIMIT 1`
  return rows.length > 0 ? taskId : null
}

// GET -> the recurrence rule for one task, or null if it doesn't repeat.
export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const taskId = await getOwnedTaskId(id, user.id)
    if (!taskId) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const rows = await sql`
      SELECT * FROM task_recurrence WHERE task_id = ${taskId} AND user_id = ${user.id} LIMIT 1
    `
    return NextResponse.json(rows[0] ?? null)
  } catch (error) {
    console.error("[task-recurrence] GET failed:", error)
    return NextResponse.json({ error: "Failed to load recurrence" }, { status: 500 })
  }
}

// PUT { frequency, interval_count?, repeat_after_completion?, ends_on?, ends_after_count? }
// -> creates or updates the recurrence rule for this task. occurrence_count is
// never touched here -- only the tasks PUT handler's recurrence-advance logic
// bumps it, so editing the rule doesn't restart the series.
export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const taskId = await getOwnedTaskId(id, user.id)
    if (!taskId) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    const body = (await request.json()) as RecurrenceBody
    const frequency = cleanFrequency(body.frequency)
    if (!frequency) {
      return NextResponse.json({ error: "A valid frequency is required" }, { status: 400 })
    }

    const intervalCount = cleanIntervalCount(body.interval_count)
    const repeatAfterCompletion = Boolean(body.repeat_after_completion)
    const endsOn = cleanEndsOn(body.ends_on)
    const endsAfterCount = cleanEndsAfterCount(body.ends_after_count)

    const result = await sql`
      INSERT INTO task_recurrence (
        task_id, user_id, frequency, interval_count, repeat_after_completion, ends_on, ends_after_count
      )
      VALUES (
        ${taskId}, ${user.id}, ${frequency}, ${intervalCount}, ${repeatAfterCompletion}, ${endsOn}, ${endsAfterCount}
      )
      ON CONFLICT (task_id) DO UPDATE SET
        frequency = EXCLUDED.frequency,
        interval_count = EXCLUDED.interval_count,
        repeat_after_completion = EXCLUDED.repeat_after_completion,
        ends_on = EXCLUDED.ends_on,
        ends_after_count = EXCLUDED.ends_after_count,
        updated_at = NOW()
      RETURNING *
    `
    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[task-recurrence] PUT failed:", error)
    return NextResponse.json({ error: "Failed to save recurrence" }, { status: 500 })
  }
}

// DELETE -> stops this task from repeating. Idempotent: succeeds even if no
// recurrence rule existed.
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const taskId = await getOwnedTaskId(id, user.id)
    if (!taskId) return NextResponse.json({ error: "Task not found" }, { status: 404 })

    await sql`DELETE FROM task_recurrence WHERE task_id = ${taskId} AND user_id = ${user.id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[task-recurrence] DELETE failed:", error)
    return NextResponse.json({ error: "Failed to delete recurrence" }, { status: 500 })
  }
}
