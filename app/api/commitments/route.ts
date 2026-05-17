import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const commitmentTypes = new Set(["personal", "work", "school", "family", "friend", "client", "financial", "other"])
const commitmentStatuses = new Set(["open", "at_risk", "completed", "missed", "cancelled"])
const views = new Set(["open", "due_soon", "at_risk", "completed", "missed", "all"])

type CommitmentBody = {
  id?: number | string | null
  title?: string | null
  description?: string | null
  committed_to?: string | null
  commitment_type?: string | null
  due_date?: string | null
  status?: string | null
  life_area_id?: number | string | null
  project_id?: number | string | null
  person_id?: number | string | null
  related_task_id?: number | string | null
}

function hasField(body: CommitmentBody, field: keyof CommitmentBody) {
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

function cleanCommitmentType(value: unknown, fallback = "personal") {
  if (typeof value !== "string") return fallback
  return commitmentTypes.has(value) ? value : fallback
}

function cleanStatus(value: unknown, fallback = "open") {
  if (typeof value !== "string") return fallback
  return commitmentStatuses.has(value) ? value : fallback
}

async function validateLinkedId(
  table: "life_areas" | "projects" | "people" | "tasks",
  id: number | null,
  userId: string,
) {
  if (!id) return null

  if (table === "life_areas") {
    const rows = await sql`SELECT id FROM life_areas WHERE id = ${id} AND user_id = ${userId} LIMIT 1`
    return rows.length > 0 ? id : undefined
  }

  if (table === "projects") {
    const rows = await sql`SELECT id FROM projects WHERE id = ${id} AND user_id = ${userId} LIMIT 1`
    return rows.length > 0 ? id : undefined
  }

  if (table === "people") {
    const rows = await sql`SELECT id FROM people WHERE id = ${id} AND user_id = ${userId} LIMIT 1`
    return rows.length > 0 ? id : undefined
  }

  const rows = await sql`SELECT id FROM tasks WHERE id = ${id} AND user_id = ${userId} LIMIT 1`
  return rows.length > 0 ? id : undefined
}

async function getValidatedLinks(body: CommitmentBody, userId: string, existing?: Record<string, unknown>) {
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

  const relatedTaskId = hasField(body, "related_task_id")
    ? await validateLinkedId("tasks", cleanId(body.related_task_id), userId)
    : cleanId(existing?.related_task_id)
  if (relatedTaskId === undefined) return { error: "Related task not found" }

  return { lifeAreaId, projectId, personId, relatedTaskId }
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const viewParam = searchParams.get("view") || "open"
    const view = views.has(viewParam) ? viewParam : "open"
    const lifeAreaId = normalizeLifeAreaId(searchParams.get("life_area_id"))
    const search = (searchParams.get("q") || "").trim().slice(0, 80)
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") || "100", 10) || 100))
    const pattern = `%${search}%`

    const rows = await sql`
      SELECT
        c.*,
        la.name AS life_area_name,
        la.icon AS life_area_icon,
        la.color AS life_area_color,
        p.title AS project_title,
        pe.name AS person_name,
        t.title AS related_task_title,
        (
          c.status IN ('open', 'at_risk')
          AND c.due_date IS NOT NULL
          AND c.due_date >= CURRENT_DATE
          AND c.due_date <= CURRENT_DATE + INTERVAL '7 days'
        ) AS is_due_soon,
        (
          c.status IN ('open', 'at_risk')
          AND c.due_date IS NOT NULL
          AND c.due_date < CURRENT_DATE
        ) AS is_overdue
      FROM commitments c
      LEFT JOIN life_areas la
        ON c.life_area_id = la.id
        AND la.user_id = ${user.id}
      LEFT JOIN projects p
        ON c.project_id = p.id
        AND p.user_id = ${user.id}
      LEFT JOIN people pe
        ON c.person_id = pe.id
        AND pe.user_id = ${user.id}
      LEFT JOIN tasks t
        ON c.related_task_id = t.id
        AND t.user_id = ${user.id}
      WHERE c.user_id = ${user.id}
        AND (
          ${view} = 'all'
          OR (${view} = 'open' AND c.status = 'open')
          OR (${view} = 'due_soon' AND c.status IN ('open', 'at_risk') AND c.due_date IS NOT NULL AND c.due_date >= CURRENT_DATE AND c.due_date <= CURRENT_DATE + INTERVAL '7 days')
          OR (${view} = 'at_risk' AND c.status = 'at_risk')
          OR (${view} = 'completed' AND c.status = 'completed')
          OR (${view} = 'missed' AND c.status = 'missed')
        )
        AND (${lifeAreaId}::integer IS NULL OR c.life_area_id = ${lifeAreaId})
        AND (
          ${search} = ''
          OR c.title ILIKE ${pattern}
          OR COALESCE(c.description, '') ILIKE ${pattern}
          OR c.committed_to ILIKE ${pattern}
          OR c.commitment_type ILIKE ${pattern}
          OR c.status ILIKE ${pattern}
          OR COALESCE(la.name, '') ILIKE ${pattern}
          OR COALESCE(p.title, '') ILIKE ${pattern}
          OR COALESCE(pe.name, '') ILIKE ${pattern}
          OR COALESCE(t.title, '') ILIKE ${pattern}
        )
      ORDER BY
        CASE
          WHEN c.status = 'at_risk' THEN 0
          WHEN c.status = 'open' AND c.due_date IS NOT NULL AND c.due_date < CURRENT_DATE THEN 1
          WHEN c.status = 'open' AND c.due_date IS NOT NULL AND c.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 2
          WHEN c.status = 'open' THEN 3
          WHEN c.status = 'completed' THEN 4
          WHEN c.status = 'missed' THEN 5
          ELSE 6
        END,
        c.due_date ASC NULLS LAST,
        c.updated_at DESC,
        c.created_at DESC
      LIMIT ${limit}
    `

    return NextResponse.json(rows)
  } catch (error) {
    console.error("[commitments] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch commitments" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as CommitmentBody
    const title = cleanLimitedText(body.title, 255)
    const committedTo = cleanLimitedText(body.committed_to, 255)
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
    if (!committedTo) return NextResponse.json({ error: "Committed to is required" }, { status: 400 })

    const links = await getValidatedLinks(body, user.id)
    if ("error" in links) return NextResponse.json({ error: links.error }, { status: 404 })

    const result = await sql`
      INSERT INTO commitments (
        user_id,
        title,
        description,
        committed_to,
        commitment_type,
        due_date,
        status,
        life_area_id,
        project_id,
        person_id,
        related_task_id
      )
      VALUES (
        ${user.id},
        ${title},
        ${cleanText(body.description)},
        ${committedTo},
        ${cleanCommitmentType(body.commitment_type)},
        ${cleanDate(body.due_date)},
        ${cleanStatus(body.status)},
        ${links.lifeAreaId},
        ${links.projectId},
        ${links.personId},
        ${links.relatedTaskId}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[commitments] POST error:", error)
    return NextResponse.json({ error: "Failed to create commitment" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as CommitmentBody
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: "Commitment ID is required" }, { status: 400 })

    const existingRows = await sql`
      SELECT * FROM commitments WHERE id = ${id} AND user_id = ${user.id} LIMIT 1
    `
    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 })
    }

    const existing = existingRows[0]
    const links = await getValidatedLinks(body, user.id, existing)
    if ("error" in links) return NextResponse.json({ error: links.error }, { status: 404 })

    const title = hasField(body, "title") ? cleanLimitedText(body.title, 255, existing.title) : existing.title
    const committedTo = hasField(body, "committed_to")
      ? cleanLimitedText(body.committed_to, 255, existing.committed_to)
      : existing.committed_to

    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })
    if (!committedTo) return NextResponse.json({ error: "Committed to is required" }, { status: 400 })

    const result = await sql`
      UPDATE commitments
      SET
        title = ${title},
        description = ${hasField(body, "description") ? cleanText(body.description) : existing.description},
        committed_to = ${committedTo},
        commitment_type = ${hasField(body, "commitment_type") ? cleanCommitmentType(body.commitment_type, existing.commitment_type) : existing.commitment_type},
        due_date = ${hasField(body, "due_date") ? cleanDate(body.due_date) : existing.due_date},
        status = ${hasField(body, "status") ? cleanStatus(body.status, existing.status) : existing.status},
        life_area_id = ${links.lifeAreaId},
        project_id = ${links.projectId},
        person_id = ${links.personId},
        related_task_id = ${links.relatedTaskId},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[commitments] PUT error:", error)
    return NextResponse.json({ error: "Failed to update commitment" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await request.json()
    const commitmentId = cleanId(id)
    if (!commitmentId) return NextResponse.json({ error: "Commitment ID is required" }, { status: 400 })

    await sql`DELETE FROM commitments WHERE id = ${commitmentId} AND user_id = ${user.id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[commitments] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete commitment" }, { status: 500 })
  }
}
