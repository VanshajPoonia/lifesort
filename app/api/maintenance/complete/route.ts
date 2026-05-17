import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function cleanDate(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function dateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function nextDueDate(completedDate: string, recurrence: string, customIntervalDays: number | null) {
  const next = new Date(`${completedDate}T00:00:00`)
  if (Number.isNaN(next.getTime())) return null

  if (recurrence === "weekly") next.setDate(next.getDate() + 7)
  else if (recurrence === "monthly") next.setMonth(next.getMonth() + 1)
  else if (recurrence === "quarterly") next.setMonth(next.getMonth() + 3)
  else if (recurrence === "yearly") next.setFullYear(next.getFullYear() + 1)
  else next.setDate(next.getDate() + Math.max(1, Math.min(3650, customIntervalDays || 30)))

  return dateString(next)
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as { id?: number | string | null; completed_date?: string | null }
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 })

    const rows = await sql`
      SELECT *
      FROM maintenance_items
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const completedDate = cleanDate(body.completed_date) || dateString(new Date())
    const nextDue = nextDueDate(completedDate, rows[0].recurrence, rows[0].custom_interval_days)

    const result = await sql`
      UPDATE maintenance_items SET
        last_completed_date = ${completedDate},
        next_due_date = ${nextDue},
        status = 'active',
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[maintenance/complete] POST error:", error)
    return NextResponse.json({ error: "Failed to complete maintenance item" }, { status: 500 })
  }
}
