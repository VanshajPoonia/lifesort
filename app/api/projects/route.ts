import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const projectStatuses = new Set(["active", "paused", "completed", "archived"])
const priorities = new Set(["low", "medium", "high"])

type ProjectBody = {
  id?: number | string | null
  title?: string | null
  description?: string | null
  life_area_id?: number | string | null
  status?: string | null
  priority?: string | null
  start_date?: string | null
  due_date?: string | null
  progress?: number | string | null
}

function hasField(body: ProjectBody, field: keyof ProjectBody) {
  return Object.prototype.hasOwnProperty.call(body, field)
}

function cleanText(value: unknown, fallback: string | null = null) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function cleanDate(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function dateOnly(value: unknown) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return cleanDate(String(value).slice(0, 10))
}

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function cleanStatus(value: unknown, fallback = "active") {
  if (typeof value !== "string") return fallback
  return projectStatuses.has(value) ? value : fallback
}

function cleanPriority(value: unknown, fallback = "medium") {
  if (typeof value !== "string") return fallback
  return priorities.has(value) ? value : fallback
}

function cleanProgress(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(0, Math.round(parsed)))
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

async function addActivity(
  projectId: number | string,
  userId: string,
  action: string,
  message: string,
  metadata: Record<string, unknown> = {},
) {
  await sql`
    INSERT INTO project_activity (project_id, user_id, action, message, metadata)
    VALUES (${projectId}, ${userId}, ${action}, ${message}, ${JSON.stringify(metadata)}::jsonb)
  `
}

async function getProject(projectId: number | string, userId: string) {
  const rows = await sql`
    SELECT
      p.*,
      la.name AS life_area_name,
      la.icon AS life_area_icon,
      la.color AS life_area_color,
      COUNT(pi.id)::int AS item_count,
      COUNT(CASE WHEN pi.item_type = 'task' AND t.completed = FALSE THEN 1 END)::int AS next_action_count
    FROM projects p
    LEFT JOIN life_areas la
      ON p.life_area_id = la.id
      AND la.user_id = ${userId}
    LEFT JOIN project_items pi
      ON pi.project_id = p.id
      AND pi.user_id = ${userId}
    LEFT JOIN tasks t
      ON pi.item_type = 'task'
      AND pi.item_id = t.id
      AND t.user_id = ${userId}
    WHERE p.id = ${projectId} AND p.user_id = ${userId}
    GROUP BY p.id, la.name, la.icon, la.color
    LIMIT 1
  `

  return rows[0]
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const lifeAreaId = normalizeLifeAreaId(searchParams.get("life_area_id"))

    if (id) {
      const project = await getProject(id, user.id)
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      return NextResponse.json(project)
    }

    const projects = await sql`
      SELECT
        p.*,
        la.name AS life_area_name,
        la.icon AS life_area_icon,
        la.color AS life_area_color,
        COUNT(pi.id)::int AS item_count,
        COUNT(CASE WHEN pi.item_type = 'task' AND t.completed = FALSE THEN 1 END)::int AS next_action_count
      FROM projects p
      LEFT JOIN life_areas la
        ON p.life_area_id = la.id
        AND la.user_id = ${user.id}
      LEFT JOIN project_items pi
        ON pi.project_id = p.id
        AND pi.user_id = ${user.id}
      LEFT JOIN tasks t
        ON pi.item_type = 'task'
        AND pi.item_id = t.id
        AND t.user_id = ${user.id}
      WHERE p.user_id = ${user.id}
      GROUP BY p.id, la.name, la.icon, la.color
      ORDER BY
        CASE p.status
          WHEN 'active' THEN 0
          WHEN 'paused' THEN 1
          WHEN 'completed' THEN 2
          ELSE 3
        END,
        p.due_date ASC NULLS LAST,
        p.updated_at DESC
    `

    return NextResponse.json(
      lifeAreaId ? projects.filter((project) => normalizeLifeAreaId(project.life_area_id) === lifeAreaId) : projects
    )
  } catch (error) {
    console.error("[projects] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as ProjectBody
    const title = cleanText(body.title)
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(body.life_area_id), user.id)
    if (lifeAreaId === undefined) {
      return NextResponse.json({ error: "Life area not found" }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO projects (
        user_id,
        title,
        description,
        life_area_id,
        status,
        priority,
        start_date,
        due_date,
        progress
      )
      VALUES (
        ${user.id},
        ${title},
        ${cleanText(body.description)},
        ${lifeAreaId},
        ${cleanStatus(body.status)},
        ${cleanPriority(body.priority)},
        ${cleanDate(body.start_date)},
        ${cleanDate(body.due_date)},
        ${cleanProgress(body.progress)}
      )
      RETURNING *
    `

    await addActivity(result[0].id, user.id, "project_created", "Project created", { title })
    const project = await getProject(result[0].id, user.id)

    return NextResponse.json(project)
  } catch (error) {
    console.error("[projects] POST error:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as ProjectBody
    const id = cleanId(body.id)
    if (!id) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const existingRows = await sql`
      SELECT *
      FROM projects
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `

    if (existingRows.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const existing = existingRows[0]
    const nextTitle = hasField(body, "title") ? cleanText(body.title, existing.title) : existing.title
    const nextDescription = hasField(body, "description") ? cleanText(body.description) : existing.description
    const nextStatus = hasField(body, "status") ? cleanStatus(body.status, existing.status) : cleanStatus(existing.status)
    const nextPriority = hasField(body, "priority") ? cleanPriority(body.priority, existing.priority) : cleanPriority(existing.priority)
    const nextStartDate = hasField(body, "start_date") ? cleanDate(body.start_date) : dateOnly(existing.start_date)
    const nextDueDate = hasField(body, "due_date") ? cleanDate(body.due_date) : dateOnly(existing.due_date)
    const nextProgress = hasField(body, "progress") ? cleanProgress(body.progress, cleanProgress(existing.progress)) : cleanProgress(existing.progress)
    const nextLifeAreaId = hasField(body, "life_area_id")
      ? await validateLifeAreaId(normalizeLifeAreaId(body.life_area_id), user.id)
      : normalizeLifeAreaId(existing.life_area_id)

    if (nextLifeAreaId === undefined) {
      return NextResponse.json({ error: "Life area not found" }, { status: 404 })
    }

    const result = await sql`
      UPDATE projects
      SET
        title = ${nextTitle},
        description = ${nextDescription},
        life_area_id = ${nextLifeAreaId},
        status = ${nextStatus},
        priority = ${nextPriority},
        start_date = ${nextStartDate},
        due_date = ${nextDueDate},
        progress = ${nextProgress},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    const changes: string[] = []
    if (String(existing.status) !== nextStatus) changes.push(`status to ${nextStatus}`)
    if (cleanProgress(existing.progress) !== nextProgress) changes.push(`progress to ${nextProgress}%`)
    await addActivity(
      id,
      user.id,
      "project_updated",
      changes.length ? `Updated ${changes.join(" and ")}` : "Project updated",
      { title: nextTitle },
    )

    const project = await getProject(result[0].id, user.id)
    return NextResponse.json(project)
  } catch (error) {
    console.error("[projects] PUT error:", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const id = cleanId(body.id)
    if (!id) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const result = await sql`
      DELETE FROM projects
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING id
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[projects] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
