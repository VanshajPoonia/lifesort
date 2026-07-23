import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const PERIOD_TYPES = new Set(["weekly", "monthly", "quarterly", "custom"])
const ATTENTION_ADJUSTMENTS = new Set(["increase", "decrease", "keep_same"])

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 4000) : null
}

function cleanPeriodType(value: unknown) {
  return typeof value === "string" && PERIOD_TYPES.has(value) ? value : "custom"
}

function cleanAttentionAdjustment(value: unknown) {
  return typeof value === "string" && ATTENTION_ADJUSTMENTS.has(value) ? value : null
}

function cleanDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const lifeAreaId = normalizeLifeAreaId(searchParams.get("life_area_id"))
    if (!lifeAreaId) {
      return NextResponse.json({ error: "life_area_id is required" }, { status: 400 })
    }

    const reviews = await sql`
      SELECT * FROM life_area_reviews
      WHERE user_id = ${user.id} AND life_area_id = ${lifeAreaId}
      ORDER BY created_at DESC
      LIMIT 50
    `

    return NextResponse.json(reviews)
  } catch (error) {
    console.error("[life-area-reviews] GET failed:", error)
    return NextResponse.json({ error: "Could not load domain reviews" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const lifeAreaId = normalizeLifeAreaId(body.life_area_id)
    if (!lifeAreaId) {
      return NextResponse.json({ error: "life_area_id is required" }, { status: 400 })
    }

    const owned = await sql`SELECT id FROM life_areas WHERE id = ${lifeAreaId} AND user_id = ${user.id} LIMIT 1`
    if (owned.length === 0) {
      return NextResponse.json({ error: "Life domain not found" }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO life_area_reviews (
        user_id, life_area_id, period_type, period_start, period_end,
        feeling, improved, needs_attention, stress, stop_doing, continue_doing,
        next_action, attention_adjustment
      )
      VALUES (
        ${user.id}, ${lifeAreaId}, ${cleanPeriodType(body.period_type)},
        ${cleanDate(body.period_start)}, ${cleanDate(body.period_end)},
        ${cleanText(body.feeling)}, ${cleanText(body.improved)}, ${cleanText(body.needs_attention)},
        ${cleanText(body.stress)}, ${cleanText(body.stop_doing)}, ${cleanText(body.continue_doing)},
        ${cleanText(body.next_action)}, ${cleanAttentionAdjustment(body.attention_adjustment)}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[life-area-reviews] POST failed:", error)
    return NextResponse.json({ error: "Could not save domain review" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: "Review ID is required" }, { status: 400 })

    await sql`DELETE FROM life_area_reviews WHERE id = ${id} AND user_id = ${user.id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[life-area-reviews] DELETE failed:", error)
    return NextResponse.json({ error: "Could not delete domain review" }, { status: 500 })
  }
}
