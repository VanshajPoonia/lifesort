"use server"

import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""
    const type = searchParams.get("type") || ""

    let query = sql`
      SELECT * FROM daily_content 
      WHERE user_id = ${user.id}
    `

    if (search && type) {
      query = sql`
        SELECT * FROM daily_content 
        WHERE user_id = ${user.id} 
        AND content ILIKE ${"%" + search + "%"}
        AND content_type = ${type}
        ORDER BY shown_at DESC
      `
    } else if (search) {
      query = sql`
        SELECT * FROM daily_content 
        WHERE user_id = ${user.id} 
        AND content ILIKE ${"%" + search + "%"}
        ORDER BY shown_at DESC
      `
    } else if (type) {
      query = sql`
        SELECT * FROM daily_content 
        WHERE user_id = ${user.id} 
        AND content_type = ${type}
        ORDER BY shown_at DESC
      `
    } else {
      query = sql`
        SELECT * FROM daily_content 
        WHERE user_id = ${user.id}
        ORDER BY shown_at DESC
      `
    }

    const history = await query

    return NextResponse.json(history)
  } catch (error) {
    console.error("[v0] Daily content history error:", error)
    return NextResponse.json({ error: "Failed to get history" }, { status: 500 })
  }
}
