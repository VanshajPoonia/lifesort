import { NextResponse } from "next/server"
import { z } from "zod"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { MAX_BANK_ROWS } from "@/lib/bank-import"

const importSchema = z.object({
  rows: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        description: z.string().trim().min(1).max(500),
        amount: z.number().positive().max(1_000_000_000),
        type: z.enum(["income", "expense"]),
      }),
    )
    .min(1)
    .max(MAX_BANK_ROWS),
})

const BATCH = 250

// POST /api/import/transactions { rows }: adds bank statement rows parsed in the browser
// by lib/bank-import.ts. A row matching an existing transaction (same date, amount, type
// and description) is skipped, so importing the same statement twice adds nothing.
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = importSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "Those rows don't look right. Try exporting the statement again." }, { status: 400 })
  }

  const { rows } = parsed.data
  try {
    const results = await sql.transaction((tx) => {
      const queries = []
      for (let start = 0; start < rows.length; start += BATCH) {
        const batch = rows.slice(start, start + BATCH)
        queries.push(tx`
          INSERT INTO budget_transactions (user_id, type, amount, description, date)
          SELECT ${user.id}, r.type, r.amount, r.description, r.date
          FROM unnest(
            ${batch.map((row) => row.type)}::text[],
            ${batch.map((row) => row.amount)}::numeric[],
            ${batch.map((row) => row.description)}::text[],
            ${batch.map((row) => row.date)}::date[]
          ) AS r(type, amount, description, date)
          WHERE NOT EXISTS (
            SELECT 1 FROM budget_transactions b
            WHERE b.user_id = ${user.id} AND b.date = r.date AND b.amount = r.amount AND b.type = r.type
              AND COALESCE(b.description, '') = r.description
          )
          RETURNING id
        `)
      }
      return queries
    })
    const created = results.reduce((total, batch) => total + batch.length, 0)
    return NextResponse.json({ created, already_there: rows.length - created }, { status: 201 })
  } catch (error) {
    console.error("[import/transactions] POST error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Couldn't import that statement." }, { status: 500 })
  }
}
