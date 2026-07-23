import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { mapJournalRow } from "@/lib/journal"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = Math.max(1, Math.min(100, Number.parseInt(searchParams.get("limit") || "30", 10) || 30))
    const lifeAreaId = normalizeLifeAreaId(searchParams.get("life_area_id"))

    const rows = lifeAreaId
      ? await sql`
          SELECT *
          FROM daily_journal_entries
          WHERE user_id = ${user.id} AND life_area_id = ${lifeAreaId}
          ORDER BY journal_date DESC
          LIMIT ${limit}
        `
      : await sql`
          SELECT *
          FROM daily_journal_entries
          WHERE user_id = ${user.id}
          ORDER BY journal_date DESC
          LIMIT ${limit}
        `

    return NextResponse.json({ entries: rows.map((row) => mapJournalRow(row)) })
  } catch (error) {
    console.error("[journal] recent failed:", error)
    return NextResponse.json({ error: "Could not load recent journal entries" }, { status: 500 })
  }
}
