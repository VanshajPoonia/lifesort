import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const waitingOnTypes = new Set(["person", "company", "school", "bank", "government", "delivery", "refund", "job", "other"])
const itemStatuses = new Set(["waiting", "follow_up_needed", "resolved", "cancelled"])
const views = new Set(["all", "follow_up_today", "overdue", "resolved", "life_area"])

type WaitingBody = {
  id?: number | string | null
  title?: string | null
  description?: string | null
  waiting_on_name?: string | null
  waiting_on_type?: string | null
  status?: string | null
  expected_date?: string | null
  follow_up_date?: string | null
  life_area_id?: number | string | null
  project_id?: number | string | null
  person_id?: number | string | null
  notes?: string | null
}

function hasField(body: WaitingBody, field: keyof WaitingBody) {
  return Object.prototype.hasOwnProperty.call(body, field)
}

function cleanText(value: unknown, fallback: string | null = null) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function cleanLimitedText(value: unknown, max: number, fallback: string | null = null) {
  const text = cleanText(value, fallback)
  return text ? text.slice(0, max) : text
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

function cleanWaitingOnType(value: unknown, fallback = "other") {
  if (typeof value !== "string") return fallback
  return waitingOnTypes.has(value) ? value : fallback
}

function cleanStatus(value: unknown, fallback = "waiting") {
  if (typeof value !== "string") return fallback
  return itemStatuses.has(value) ? value : fallback
}

async function validateLinkedId(
  table: "life_areas" | "projects" | "people",
  id: number | null,
  userId: string,
) {
  if (!id) return null

  if (table === "life_areas") {
    const rows = await sql`
      SELECT id FROM life_areas WHERE id = ${id} AND user_id = ${userId} LIMIT 1
    `
    return rows.length > 0 ? id : undefined
  }

  if (table === "projects") {
    const rows = await sql`
      SELECT id FROM projects WHERE id = ${id} AND user_id = ${userId} LIMIT 1
    `
    return rows.length > 0 ? id : undefined
  }

  const rows = await sql`
    SELECT id FROM people WHERE id = ${id} AND user_id = ${userId} LIMIT 1
  `
  return rows.length > 0 ? id : undefined
}

async function getValidatedLinks(body: WaitingBody, userId: string, existing?: Record<string, unknown>) {
  const lifeAreaId = hasField(body, "life_area_id")
    ? await validateLinkedId("life_areas", normalizeLifeAreaId(body.life_area_id), userId)
    : normalizeLifeAreaId(existing?.life_area_id)
  if (lifeAreaId === undefined) return { error: "Life area not found" }

  const projectId = hasField(body, "project_id")
    ? await validateLinkedId("projects", cleanId(body.project_id), userId)
    : cleanId(existing?.project_id)
  if (projectId === undefined) return { error: "Project not found" }

  const personId = hasField(body, "person_id")
    ? await validateLinkedId("people", cleanId(body.person_id), userId)
    : cleanId(existing?.person_id)
  if (personId === undefined) return { error: "Person not found" }

  return { lifeAreaId, projectId, personId }
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const viewParam = searchParams.get("view") || "all"
    const view = views.has(viewParam) ? viewParam : "all"
    const statusParam = searchParams.get("status")
    const status = statusParam && itemStatuses.has(statusParam) ? statusParam : null
    const lifeAreaId = normalizeLifeAreaId(searchParams.get("life_area_id"))
    const search = (searchParams.get("q") || "").trim().slice(0, 80)
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") || "100", 10) || 100))
    const pattern = `%${search}%`

    const rows = await sql`
      SELECT
        wi.*,
        la.name AS life_area_name,
        la.icon AS life_area_icon,
        la.color AS life_area_color,
        p.title AS project_title,
        pe.name AS person_name,
        (
          wi.status IN ('waiting', 'follow_up_needed')
          AND wi.follow_up_date IS NOT NULL
          AND wi.follow_up_date <= CURRENT_DATE
        ) AS is_follow_up_due,
        (
          wi.status IN ('waiting', 'follow_up_needed')
          AND wi.expected_date IS NOT NULL
          AND wi.expected_date < CURRENT_DATE
        ) AS is_overdue
      FROM waiting_items wi
      LEFT JOIN life_areas la
        ON wi.life_area_id = la.id
        AND la.user_id = ${user.id}
      LEFT JOIN projects p
        ON wi.project_id = p.id
        AND p.user_id = ${user.id}
      LEFT JOIN people pe
        ON wi.person_id = pe.id
        AND pe.user_id = ${user.id}
      WHERE wi.user_id = ${user.id}
        AND (${status}::text IS NULL OR wi.status = ${status})
        AND (
          ${view} = 'all'
          OR (${view} = 'follow_up_today' AND wi.status IN ('waiting', 'follow_up_needed') AND wi.follow_up_date IS NOT NULL AND wi.follow_up_date <= CURRENT_DATE)
          OR (${view} = 'overdue' AND wi.status IN ('waiting', 'follow_up_needed') AND wi.expected_date IS NOT NULL AND wi.expected_date < CURRENT_DATE)
          OR (${view} = 'resolved' AND wi.status = 'resolved')
          OR (${view} = 'life_area' AND ${lifeAreaId}::integer IS NOT NULL AND wi.life_area_id = ${lifeAreaId})
        )
        AND (
          ${search} = ''
          OR wi.title ILIKE ${pattern}
          OR COALESCE(wi.description, '') ILIKE ${pattern}
          OR wi.waiting_on_name ILIKE ${pattern}
          OR wi.waiting_on_type ILIKE ${pattern}
          OR wi.status ILIKE ${pattern}
          OR COALESCE(wi.notes, '') ILIKE ${pattern}
          OR COALESCE(la.name, '') ILIKE ${pattern}
          OR COALESCE(p.title, '') ILIKE ${pattern}
          OR COALESCE(pe.name, '') ILIKE ${pattern}
        )
      ORDER BY
        CASE
          WHEN wi.status IN ('waiting', 'follow_up_needed') AND wi.follow_up_date IS NOT NULL AND wi.follow_up_date <= CURRENT_DATE THEN 0
          WHEN wi.status IN ('waiting', 'follow_up_needed') AND wi.expected_date IS NOT NULL AND wi.expected_date < CURRENT_DATE THEN 1
          WHEN wi.status = 'waiting' THEN 2
          WHEN wi.status = 'follow_up_needed' THEN 3
          WHEN wi.status = 'resolved' THEN 4
          ELSE 5
        END,
        wi.follow_up_date ASC NULLS LAST,
        wi.expected_date ASC NULLS LAST,
        wi.updated_at DESC,
        wi.created_at DESC
      LIMIT ${limit}
    `

    return NextResponse.json(rows)
  } catch (error) {
    console.error("[waiting] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch waiting items" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as WaitingBody
    const title = cleanLimitedText(body.title, 255)
    const waitingOnName = cleanLimitedText(body.waiting_on_name, 255)
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
    if (!waitingOnName) return NextResponse.json({ error: "Waiting on name is required" }, { status: 400 })

    const links = await getValidatedLinks(body, user.id)
    if ("error" in links) return NextResponse.json({ error: links.error }, { status: 404 })

    const result = await sql`
      INSERT INTO waiting_items (
        user_id,
        title,
        description,
        waiting_on_name,
        waiting_on_type,
        status,
        expected_date,
        follow_up_date,
        life_area_id,
        project_id,
        person_id,
        notes
      )
      VALUES (
        ${user.id},
        ${title},
        ${cleanText(body.description)},
        ${waitingOnName},
        ${cleanWaitingOnType(body.waiting_on_type)},
        ${cleanStatus(body.status)},
        ${cleanDate(body.expected_date)},
        ${cleanDate(body.follow_up_date)},
        ${links.lifeAreaId},
        ${links.projectId},
        ${links.personId},
        ${cleanText(body.notes)}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[waiting] POST error:", error)
    return NextResponse.json({ error: "Failed to create waiting item" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as WaitingBody
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: "Waiting item ID is required" }, { status: 400 })

    const existingRows = await sql`
      SELECT * FROM waiting_items WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
    `
    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Waiting item not found" }, { status: 404 })
    }

    const existing = existingRows[0]
    const links = await getValidatedLinks(body, user.id, existing)
    if ("error" in links) return NextResponse.json({ error: links.error }, { status: 404 })

    const title = hasField(body, "title") ? cleanLimitedText(body.title, 255, existing.title) : existing.title
    const waitingOnName = hasField(body, "waiting_on_name")
      ? cleanLimitedText(body.waiting_on_name, 255, existing.waiting_on_name)
      : existing.waiting_on_name

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
    if (!waitingOnName) return NextResponse.json({ error: "Waiting on name is required" }, { status: 400 })

    const result = await sql`
      UPDATE waiting_items
      SET
        title = ${title},
        description = ${hasField(body, "description") ? cleanText(body.description) : existing.description},
        waiting_on_name = ${waitingOnName},
        waiting_on_type = ${hasField(body, "waiting_on_type") ? cleanWaitingOnType(body.waiting_on_type, existing.waiting_on_type) : existing.waiting_on_type},
        status = ${hasField(body, "status") ? cleanStatus(body.status, existing.status) : existing.status},
        expected_date = ${hasField(body, "expected_date") ? cleanDate(body.expected_date) : existing.expected_date},
        follow_up_date = ${hasField(body, "follow_up_date") ? cleanDate(body.follow_up_date) : existing.follow_up_date},
        life_area_id = ${links.lifeAreaId},
        project_id = ${links.projectId},
        person_id = ${links.personId},
        notes = ${hasField(body, "notes") ? cleanText(body.notes) : existing.notes},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[waiting] PUT error:", error)
    return NextResponse.json({ error: "Failed to update waiting item" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await request.json()
    const waitingId = cleanId(id)
    if (!waitingId) return NextResponse.json({ error: "Waiting item ID is required" }, { status: 400 })

    await sql`DELETE FROM waiting_items WHERE id = ${waitingId} AND user_id = ${user.id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[waiting] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete waiting item" }, { status: 500 })
  }
}
