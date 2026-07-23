import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const statuses = new Set(["unsorted", "converted", "archived", "all"])
const itemStatuses = new Set(["unsorted", "converted", "archived"])
const sources = new Set(["manual", "quick_add", "ai_capture"])
const targetTypes = new Set(["task", "goal", "note", "project", "habit", "wishlist_item", "vault_item", "calendar_event"])

type InboxBody = {
  id?: number | string | null
  title?: string | null
  raw_text?: string | null
  suggested_type?: string | null
  status?: string | null
  life_area_id?: number | string | null
  source?: string | null
}

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function cleanSuggestedType(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  return targetTypes.has(value) ? value : null
}

function cleanStatus(value: unknown, fallback = "unsorted") {
  if (typeof value !== "string") return fallback
  return itemStatuses.has(value) ? value : fallback
}

function cleanSource(value: unknown) {
  if (typeof value !== "string") return "manual"
  return sources.has(value) ? value : "manual"
}

function deriveTitle(title: unknown, rawText: unknown) {
  const explicit = cleanText(title)
  if (explicit) return explicit.slice(0, 255)
  const firstLine = cleanText(rawText).split(/\r?\n/)[0]?.trim()
  return (firstLine || "Inbox item").slice(0, 255)
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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get("status") || "unsorted"
    const status = statuses.has(statusParam) ? statusParam : "unsorted"
    const search = (searchParams.get("q") || "").trim().slice(0, 80)
    const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "100", 10) || 100))
    const pattern = `%${search}%`

    const rows = await sql`
      SELECT
        inbox_items.*,
        life_areas.name AS life_area_name,
        life_areas.icon AS life_area_icon,
        life_areas.color AS life_area_color
      FROM inbox_items
      LEFT JOIN life_areas
        ON inbox_items.life_area_id = life_areas.id
        AND life_areas.user_id = ${user.id}
      WHERE inbox_items.user_id = ${user.id}
        AND (${status} = 'all' OR inbox_items.status = ${status})
        AND (
          ${search} = ''
          OR inbox_items.title ILIKE ${pattern}
          OR inbox_items.raw_text ILIKE ${pattern}
          OR COALESCE(inbox_items.suggested_type, '') ILIKE ${pattern}
          OR COALESCE(inbox_items.source, '') ILIKE ${pattern}
          OR COALESCE(life_areas.name, '') ILIKE ${pattern}
        )
      ORDER BY
        CASE inbox_items.status
          WHEN 'unsorted' THEN 0
          WHEN 'converted' THEN 1
          ELSE 2
        END,
        inbox_items.updated_at DESC,
        inbox_items.created_at DESC
      LIMIT ${limit}
    `

    return NextResponse.json(rows)
  } catch (error) {
    console.error("[inbox] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch inbox items" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as InboxBody
    const rawText = cleanText(body.raw_text)
    const hasCaptureText = Boolean(cleanText(body.title) || rawText)
    const title = deriveTitle(body.title, rawText)
    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(body.life_area_id), user.id)

    if (!hasCaptureText) {
      return NextResponse.json({ error: "Title or text is required" }, { status: 400 })
    }

    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: "Life domain not found" }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO inbox_items (
        user_id,
        title,
        raw_text,
        suggested_type,
        status,
        life_area_id,
        source
      )
      VALUES (
        ${user.id},
        ${title},
        ${rawText},
        ${cleanSuggestedType(body.suggested_type)},
        'unsorted',
        ${lifeAreaId},
        ${cleanSource(body.source)}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[inbox] POST error:", error)
    return NextResponse.json({ error: "Failed to create inbox item" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as InboxBody
    const id = cleanId(body.id)
    if (!id) {
      return NextResponse.json({ error: "Inbox item ID is required" }, { status: 400 })
    }

    const existingRows = await sql`
      SELECT *
      FROM inbox_items
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Inbox item not found" }, { status: 404 })
    }

    const existing = existingRows[0]
    const hasLifeArea = Object.prototype.hasOwnProperty.call(body, "life_area_id")
    const lifeAreaId = hasLifeArea
      ? await validateLifeAreaId(normalizeLifeAreaId(body.life_area_id), user.id)
      : normalizeLifeAreaId(existing.life_area_id)

    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: "Life domain not found" }, { status: 404 })
    }

    const rawText = Object.prototype.hasOwnProperty.call(body, "raw_text")
      ? cleanText(body.raw_text)
      : cleanText(existing.raw_text)
    const title = Object.prototype.hasOwnProperty.call(body, "title")
      ? deriveTitle(body.title, rawText)
      : cleanText(existing.title, "Inbox item")

    const result = await sql`
      UPDATE inbox_items
      SET
        title = ${title},
        raw_text = ${rawText},
        suggested_type = ${Object.prototype.hasOwnProperty.call(body, "suggested_type") ? cleanSuggestedType(body.suggested_type) : cleanSuggestedType(existing.suggested_type)},
        status = ${Object.prototype.hasOwnProperty.call(body, "status") ? cleanStatus(body.status, existing.status) : existing.status},
        life_area_id = ${lifeAreaId},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[inbox] PUT error:", error)
    return NextResponse.json({ error: "Failed to update inbox item" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: rawId } = await request.json()
    const id = cleanId(rawId)
    if (!id) {
      return NextResponse.json({ error: "Inbox item ID is required" }, { status: 400 })
    }

    await sql`
      DELETE FROM inbox_items
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[inbox] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete inbox item" }, { status: 500 })
  }
}
