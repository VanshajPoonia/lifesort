import { NextResponse } from "next/server"
import { z } from "zod"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

const liabilityInputSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  name: z.string().trim().min(1, "Name is required").max(160),
  balance: z.coerce.number().min(0).max(999_999_999),
  interest_rate: z.coerce.number().min(0).max(100).default(0),
  monthly_payment: z.coerce.number().min(0).max(999_999_999).default(0),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal("")),
})

function cleanId(value: unknown) {
  const id = typeof value === "number" ? value : Number.parseInt(String(value || ""), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

function formatDateOnly(value: unknown) {
  if (!value) return null
  if (value instanceof Date) {
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, "0")
    const day = String(value.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }
  return String(value).slice(0, 10)
}

function serializeLiability(row: Record<string, unknown>) {
  return {
    ...row,
    balance: Number(row.balance || 0),
    interest_rate: Number(row.interest_rate || 0),
    monthly_payment: Number(row.monthly_payment || 0),
    due_date: formatDateOnly(row.due_date),
  }
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rows = await sql`
      SELECT *
      FROM liabilities
      WHERE user_id = ${user.id}
      ORDER BY due_date ASC NULLS LAST, created_at DESC
    `

    return NextResponse.json(rows.map(serializeLiability))
  } catch (error) {
    console.error("[liabilities] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch liabilities" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = liabilityInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid liability", issues: parsed.error.issues }, { status: 400 })
    }

    const data = parsed.data
    const rows = await sql`
      INSERT INTO liabilities (user_id, name, balance, interest_rate, monthly_payment, due_date)
      VALUES (
        ${user.id},
        ${data.name},
        ${data.balance},
        ${data.interest_rate},
        ${data.monthly_payment},
        ${data.due_date || null}
      )
      RETURNING *
    `

    return NextResponse.json(serializeLiability(rows[0]))
  } catch (error) {
    console.error("[liabilities] POST error:", error)
    return NextResponse.json({ error: "Failed to create liability" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const parsed = liabilityInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid liability", issues: parsed.error.issues }, { status: 400 })
    }

    const id = cleanId(parsed.data.id)
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 })

    const data = parsed.data
    const rows = await sql`
      UPDATE liabilities
      SET
        name = ${data.name},
        balance = ${data.balance},
        interest_rate = ${data.interest_rate},
        monthly_payment = ${data.monthly_payment},
        due_date = ${data.due_date || null},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (rows.length === 0) return NextResponse.json({ error: "Liability not found" }, { status: 404 })

    return NextResponse.json(serializeLiability(rows[0]))
  } catch (error) {
    console.error("[liabilities] PUT error:", error)
    return NextResponse.json({ error: "Failed to update liability" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const id = cleanId(body?.id)
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 })

    await sql`
      DELETE FROM liabilities
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[liabilities] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete liability" }, { status: 500 })
  }
}
