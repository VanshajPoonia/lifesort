import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const targetTypes = new Set(["project", "goal", "task", "wishlist_item", "note"])
const priorities = new Set(["low", "medium", "high"])
const projectStatuses = new Set(["active", "paused", "completed", "archived"])
const goalStatuses = new Set(["active", "completed", "paused"])

type PromoteBody = {
  id?: number | string | null
  target_type?: string | null
  payload?: Record<string, unknown> | null
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

function cleanNumber(value: unknown, fallback: number | null = null) {
  if (value === null || value === undefined || value === "") return fallback
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function cleanPriority(value: unknown) {
  return typeof value === "string" && priorities.has(value) ? value : "medium"
}

function cleanProjectStatus(value: unknown) {
  return typeof value === "string" && projectStatuses.has(value) ? value : "active"
}

function cleanGoalStatus(value: unknown) {
  return typeof value === "string" && goalStatuses.has(value) ? value : "active"
}

function cleanUrl(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed
  return trimmed.includes(".") ? `https://${trimmed}` : null
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

async function createTarget(
  userId: string,
  targetType: string,
  payload: Record<string, unknown>,
  fallbackTitle: string,
  fallbackDescription: string,
  fallbackLifeAreaId: number | null,
) {
  const requestedLifeAreaId = Object.prototype.hasOwnProperty.call(payload, "life_area_id")
    ? normalizeLifeAreaId(payload.life_area_id)
    : fallbackLifeAreaId
  const lifeAreaId = await validateLifeAreaId(requestedLifeAreaId, userId)
  if (lifeAreaId === undefined) throw new Error("Life domain not found")

  if (targetType === "project") {
    const title = cleanText(payload.title, fallbackTitle, 255)
    if (!title) throw new Error("Project title is required")

    const result = await sql`
      INSERT INTO projects (user_id, title, description, life_area_id, status, priority, start_date, due_date, progress)
      VALUES (
        ${userId},
        ${title},
        ${cleanText(payload.description, fallbackDescription)},
        ${lifeAreaId},
        ${cleanProjectStatus(payload.status)},
        ${cleanPriority(payload.priority)},
        ${cleanDate(payload.start_date)},
        ${cleanDate(payload.due_date)},
        ${Math.min(100, Math.max(0, Math.round(cleanNumber(payload.progress, 0) || 0)))}
      )
      RETURNING id, title
    `
    await sql`
      INSERT INTO project_activity (project_id, user_id, action, message, metadata)
      VALUES (${result[0].id}, ${userId}, 'project_created', 'Project promoted from Someday', ${JSON.stringify({ source: "someday" })}::jsonb)
    `
    return { id: result[0].id as number, title: result[0].title as string, href: `/projects/${result[0].id}` }
  }

  if (targetType === "goal") {
    const title = cleanText(payload.title, fallbackTitle, 255)
    if (!title) throw new Error("Goal title is required")

    const result = await sql`
      INSERT INTO goals (user_id, title, description, category, target_date, status, priority, progress, life_area_id)
      VALUES (
        ${userId},
        ${title},
        ${cleanText(payload.description, fallbackDescription)},
        ${cleanText(payload.category, "personal", 100)},
        ${cleanDate(payload.target_date)},
        ${cleanGoalStatus(payload.status)},
        ${cleanPriority(payload.priority)},
        ${Math.min(100, Math.max(0, Math.round(cleanNumber(payload.progress, 0) || 0)))},
        ${lifeAreaId}
      )
      RETURNING id, title
    `
    return { id: result[0].id as number, title: result[0].title as string, href: "/goals" }
  }

  if (targetType === "task") {
    const title = cleanText(payload.title, fallbackTitle, 255)
    if (!title) throw new Error("Task title is required")

    const result = await sql`
      INSERT INTO tasks (user_id, title, description, priority, due_date, due_time, completed, category, life_area_id)
      VALUES (
        ${userId},
        ${title},
        ${cleanText(payload.description, fallbackDescription)},
        ${cleanPriority(payload.priority)},
        ${cleanDate(payload.due_date)},
        NULL,
        false,
        ${cleanText(payload.category, "someday", 100)},
        ${lifeAreaId}
      )
      RETURNING id, title
    `
    return { id: result[0].id as number, title: result[0].title as string, href: "/tasks" }
  }

  if (targetType === "wishlist_item") {
    const title = cleanText(payload.title, fallbackTitle, 255)
    if (!title) throw new Error("Wishlist title is required")

    const result = await sql`
      INSERT INTO wishlist_items (user_id, title, description, price, url, category, priority, life_area_id)
      VALUES (
        ${userId},
        ${title},
        ${cleanText(payload.description, fallbackDescription)},
        ${cleanNumber(payload.price)},
        ${cleanUrl(payload.link ?? payload.url)},
        ${cleanText(payload.category, "general", 100)},
        ${cleanPriority(payload.priority)},
        ${lifeAreaId}
      )
      RETURNING id, title
    `
    return { id: result[0].id as number, title: result[0].title as string, href: "/money?tab=wishlist" }
  }

  if (targetType === "note") {
    const title = cleanText(payload.title, fallbackTitle, 255) || "Someday note"
    const result = await sql`
      INSERT INTO notes (user_id, title, content, life_area_id)
      VALUES (${userId}, ${title}, ${cleanText(payload.content, fallbackDescription, 10000) || ""}, ${lifeAreaId})
      RETURNING id, title
    `
    return { id: result[0].id as number, title: result[0].title as string, href: "/notes" }
  }

  throw new Error("Unsupported promotion type")
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    let body: PromoteBody
    try {
      body = (await request.json()) as PromoteBody
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const id = cleanId(body.id)
    const targetType = typeof body.target_type === "string" ? body.target_type : ""
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {}
    if (!id || !targetTypes.has(targetType)) {
      return NextResponse.json({ error: "Someday item ID and valid promotion type are required" }, { status: 400 })
    }

    const rows = await sql`
      SELECT *
      FROM someday_items
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `
    if (rows.length === 0) return NextResponse.json({ error: "Someday item not found" }, { status: 404 })
    const item = rows[0]
    if (item.status !== "someday") return NextResponse.json({ error: "Only someday items can be promoted" }, { status: 400 })

    const fallbackTitle = cleanText(item.title, "Someday item", 255) || "Someday item"
    const fallbackDescription = cleanText(item.description, "", 10000) || ""
    const target = await createTarget(
      user.id,
      targetType,
      payload,
      fallbackTitle,
      fallbackDescription,
      normalizeLifeAreaId(item.life_area_id),
    )

    const updatedRows = await sql`
      UPDATE someday_items
      SET
        status = 'promoted',
        promoted_type = ${targetType},
        promoted_id = ${target.id},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json({ someday_item: updatedRows[0], target })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to promote Someday item"
    console.error("[someday/promote] POST error:", error)
    const status = message.includes("required") || message.includes("not found") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
