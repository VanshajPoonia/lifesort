import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const categories = new Set(["idea", "project", "purchase", "travel", "learning", "relationship", "finance", "health", "other"])
const statuses = new Set(["someday", "promoted", "archived"])
const views = new Set(["all", "review_due", "someday", "promoted", "archived", "category"])

type SomedayBody = {
  id?: number | string | null
  title?: string | null
  description?: string | null
  category?: string | null
  life_area_id?: number | string | null
  review_date?: string | null
  status?: string | null
}

function hasField(body: SomedayBody, field: keyof SomedayBody) {
  return Object.prototype.hasOwnProperty.call(body, field)
}

function cleanText(value: unknown, fallback: string | null = null, max = 2000) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : fallback
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

function cleanCategory(value: unknown, fallback = "idea") {
  return typeof value === "string" && categories.has(value) ? value : fallback
}

function cleanStatus(value: unknown, fallback = "someday") {
  return typeof value === "string" && statuses.has(value) ? value : fallback
}

async function validateLifeAreaId(lifeAreaId: number | null, userId: string) {
  if (!lifeAreaId) return null

  const rows = await sql`
    SELECT id
    FROM life_areas
    WHERE id = ${lifeAreaId} AND user_id = ${userId}
    LIMIT 1
  `

  return rows.length > 0 ? lifeAreaId : undefined
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const viewParam = searchParams.get("view") || "someday"
    const view = views.has(viewParam) ? viewParam : "someday"
    const category = cleanCategory(searchParams.get("category"), "")
    const lifeAreaId = normalizeLifeAreaId(searchParams.get("life_area_id"))
    const search = (searchParams.get("q") || "").trim().slice(0, 80)
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") || "100", 10) || 100))
    const pattern = `%${search}%`

    const rows = await sql`
      SELECT
        si.*,
        la.name AS life_area_name,
        la.icon AS life_area_icon,
        la.color AS life_area_color,
        (
          si.status = 'someday'
          AND si.review_date IS NOT NULL
          AND si.review_date <= CURRENT_DATE
        ) AS is_review_due
      FROM someday_items si
      LEFT JOIN life_areas la
        ON si.life_area_id = la.id
        AND la.user_id = ${user.id}
      WHERE si.user_id = ${user.id}
        AND (
          ${view} = 'all'
          OR (${view} = 'review_due' AND si.status = 'someday' AND si.review_date IS NOT NULL AND si.review_date <= CURRENT_DATE)
          OR (${view} = 'someday' AND si.status = 'someday')
          OR (${view} = 'promoted' AND si.status = 'promoted')
          OR (${view} = 'archived' AND si.status = 'archived')
          OR (${view} = 'category' AND ${category} <> '' AND si.category = ${category})
        )
        AND (${lifeAreaId}::integer IS NULL OR si.life_area_id = ${lifeAreaId})
        AND (
          ${search} = ''
          OR si.title ILIKE ${pattern}
          OR COALESCE(si.description, '') ILIKE ${pattern}
          OR si.category ILIKE ${pattern}
          OR si.status ILIKE ${pattern}
          OR COALESCE(la.name, '') ILIKE ${pattern}
        )
      ORDER BY
        CASE
          WHEN si.status = 'someday' AND si.review_date IS NOT NULL AND si.review_date <= CURRENT_DATE THEN 0
          WHEN si.status = 'someday' THEN 1
          WHEN si.status = 'promoted' THEN 2
          ELSE 3
        END,
        si.review_date ASC NULLS LAST,
        si.updated_at DESC,
        si.created_at DESC
      LIMIT ${limit}
    `

    return NextResponse.json(rows)
  } catch (error) {
    console.error("[someday] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch Someday items" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as SomedayBody
    const title = cleanText(body.title, null, 255)
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(body.life_area_id), user.id)
    if (lifeAreaId === undefined) return NextResponse.json({ error: "Life area not found" }, { status: 404 })

    const result = await sql`
      INSERT INTO someday_items (user_id, title, description, category, life_area_id, review_date, status)
      VALUES (
        ${user.id},
        ${title},
        ${cleanText(body.description)},
        ${cleanCategory(body.category)},
        ${lifeAreaId},
        ${cleanDate(body.review_date)},
        ${cleanStatus(body.status)}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[someday] POST error:", error)
    return NextResponse.json({ error: "Failed to create Someday item" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as SomedayBody
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: "Someday item ID is required" }, { status: 400 })

    const existingRows = await sql`
      SELECT *
      FROM someday_items
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `
    if (existingRows.length === 0) return NextResponse.json({ error: "Someday item not found" }, { status: 404 })

    const existing = existingRows[0]
    const title = hasField(body, "title") ? cleanText(body.title, null, 255) : cleanText(existing.title, null, 255)
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const lifeAreaId = hasField(body, "life_area_id")
      ? await validateLifeAreaId(normalizeLifeAreaId(body.life_area_id), user.id)
      : normalizeLifeAreaId(existing.life_area_id)
    if (lifeAreaId === undefined) return NextResponse.json({ error: "Life area not found" }, { status: 404 })

    const result = await sql`
      UPDATE someday_items
      SET
        title = ${title},
        description = ${hasField(body, "description") ? cleanText(body.description) : cleanText(existing.description)},
        category = ${hasField(body, "category") ? cleanCategory(body.category, existing.category) : cleanCategory(existing.category)},
        life_area_id = ${lifeAreaId},
        review_date = ${hasField(body, "review_date") ? cleanDate(body.review_date) : cleanDate(existing.review_date ? String(existing.review_date).slice(0, 10) : null)},
        status = ${hasField(body, "status") ? cleanStatus(body.status, existing.status) : cleanStatus(existing.status)},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[someday] PUT error:", error)
    return NextResponse.json({ error: "Failed to update Someday item" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: rawId } = await request.json()
    const id = cleanId(rawId)
    if (!id) return NextResponse.json({ error: "Someday item ID is required" }, { status: 400 })

    const result = await sql`
      DELETE FROM someday_items
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING id
    `

    if (result.length === 0) return NextResponse.json({ error: "Someday item not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[someday] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete Someday item" }, { status: 500 })
  }
}
