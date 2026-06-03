import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const targetTypes = new Set(["task", "goal", "note", "project", "habit", "wishlist_item", "vault_item", "calendar_event"])
const priorities = new Set(["low", "medium", "high"])
const goalStatuses = new Set(["active", "completed", "paused"])
const projectStatuses = new Set(["active", "paused", "completed", "archived"])
const habitFrequencies = new Set(["daily", "weekly", "custom"])
const vaultCategories = new Set([
  "documents",
  "subscriptions",
  "warranty",
  "insurance",
  "vehicle",
  "home",
  "medical",
  "education",
  "work",
  "other",
])

type ConvertBody = {
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
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function cleanDate(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function cleanTime(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  const match = trimmed.match(/^(\d{2}):(\d{2})(?::\d{2})?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return `${match[1]}:${match[2]}`
}

function cleanNumber(value: unknown, fallback: number | null = null) {
  if (value === null || value === undefined || value === "") return fallback
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function cleanIntegerArray(value: unknown) {
  if (!Array.isArray(value)) return "{}"
  const days = value
    .map((day) => (typeof day === "number" ? day : Number.parseInt(String(day), 10)))
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  return `{${Array.from(new Set(days)).join(",")}}`
}

function cleanPriority(value: unknown) {
  return typeof value === "string" && priorities.has(value) ? value : "medium"
}

function cleanGoalStatus(value: unknown) {
  return typeof value === "string" && goalStatuses.has(value) ? value : "active"
}

function cleanProjectStatus(value: unknown) {
  return typeof value === "string" && projectStatuses.has(value) ? value : "active"
}

function cleanHabitFrequency(value: unknown) {
  return typeof value === "string" && habitFrequencies.has(value) ? value : "daily"
}

function cleanVaultCategory(value: unknown) {
  return typeof value === "string" && vaultCategories.has(value) ? value : "other"
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

async function createTarget(userId: string, targetType: string, payload: Record<string, unknown>, fallbackTitle: string, fallbackText: string) {
  const lifeAreaId = await validateLifeAreaId(normalizeLifeAreaId(payload.life_area_id), userId)
  if (lifeAreaId === undefined) {
    throw new Error("Life area not found")
  }

  if (targetType === "task") {
    const title = cleanText(payload.title, fallbackTitle, 255)
    if (!title) throw new Error("Task title is required")

    const result = await sql`
      INSERT INTO tasks (user_id, title, description, priority, due_date, due_time, completed, category, life_area_id)
      VALUES (
        ${userId},
        ${title},
        ${cleanText(payload.description, fallbackText)},
        ${cleanPriority(payload.priority)},
        ${cleanDate(payload.due_date)},
        ${cleanTime(payload.due_time)},
        false,
        ${cleanText(payload.category)},
        ${lifeAreaId}
      )
      RETURNING id, title
    `
    return { id: result[0].id as number, title: result[0].title as string, href: "/tasks" }
  }

  if (targetType === "goal") {
    const title = cleanText(payload.title, fallbackTitle, 255)
    if (!title) throw new Error("Goal title is required")

    const result = await sql`
      INSERT INTO goals (user_id, title, description, category, target_date, status, priority, progress, life_area_id)
      VALUES (
        ${userId},
        ${title},
        ${cleanText(payload.description, fallbackText)},
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

  if (targetType === "note") {
    const title = cleanText(payload.title, fallbackTitle, 255) || "Untitled"
    const result = await sql`
      INSERT INTO notes (user_id, title, content, life_area_id)
      VALUES (${userId}, ${title}, ${cleanText(payload.content, fallbackText, 10000) || ""}, ${lifeAreaId})
      RETURNING id, title
    `
    return { id: result[0].id as number, title: result[0].title as string, href: "/notes" }
  }

  if (targetType === "project") {
    const title = cleanText(payload.title, fallbackTitle, 255)
    if (!title) throw new Error("Project title is required")

    const result = await sql`
      INSERT INTO projects (user_id, title, description, life_area_id, status, priority, start_date, due_date, progress)
      VALUES (
        ${userId},
        ${title},
        ${cleanText(payload.description, fallbackText)},
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
      VALUES (${result[0].id}, ${userId}, 'project_created', 'Project created from Inbox', ${JSON.stringify({ source: "inbox" })}::jsonb)
    `
    return { id: result[0].id as number, title: result[0].title as string, href: `/projects/${result[0].id}` }
  }

  if (targetType === "habit") {
    const name = cleanText(payload.name ?? payload.title, fallbackTitle, 255)
    if (!name) throw new Error("Habit name is required")

    const result = await sql`
      INSERT INTO habits (
        user_id, name, description, frequency, custom_days, target_count,
        reminder_time, life_area_id, is_active, color, icon, sort_order
      )
      VALUES (
        ${userId},
        ${name},
        ${cleanText(payload.description, fallbackText)},
        ${cleanHabitFrequency(payload.frequency)},
        ${cleanIntegerArray(payload.custom_days)}::integer[],
        ${Math.min(100, Math.max(1, Math.round(cleanNumber(payload.target_count, 1) || 1)))},
        ${cleanTime(payload.reminder_time)},
        ${lifeAreaId},
        true,
        ${cleanText(payload.color, "#2563EB", 20)},
        ${cleanText(payload.icon, "CheckSquare", 50)},
        0
      )
      RETURNING id, name
    `
    return { id: result[0].id as number, title: result[0].name as string, href: "/habits" }
  }

  if (targetType === "wishlist_item") {
    const title = cleanText(payload.title, fallbackTitle, 255)
    if (!title) throw new Error("Wishlist title is required")

    const result = await sql`
      INSERT INTO wishlist_items (user_id, title, description, price, url, category, priority, life_area_id)
      VALUES (
        ${userId},
        ${title},
        ${cleanText(payload.description, fallbackText)},
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

  if (targetType === "vault_item") {
    const title = cleanText(payload.title, fallbackTitle, 255)
    if (!title) throw new Error("Vault item title is required")

    const result = await sql`
      INSERT INTO vault_items (
        user_id, title, category, description, notes, start_date,
        expiry_date, renewal_date, reminder_date, url, life_area_id, tags
      )
      VALUES (
        ${userId},
        ${title},
        ${cleanVaultCategory(payload.category)},
        ${cleanText(payload.description, fallbackText)},
        ${cleanText(payload.notes)},
        ${cleanDate(payload.start_date)},
        ${cleanDate(payload.expiry_date)},
        ${cleanDate(payload.renewal_date)},
        ${cleanDate(payload.reminder_date)},
        ${cleanUrl(payload.url)},
        ${lifeAreaId},
        ARRAY[]::text[]
      )
      RETURNING id, title
    `
    return { id: result[0].id as number, title: result[0].title as string, href: "/vault" }
  }

  if (targetType === "calendar_event") {
    const title = cleanText(payload.title, fallbackTitle, 255)
    const eventDate = cleanDate(payload.event_date)
    const startTime = cleanTime(payload.start_time)
    const endTime = cleanTime(payload.end_time)

    if (!title || !eventDate || !startTime || !endTime) {
      throw new Error("Calendar conversion requires title, date, start time, and end time")
    }

    const result = await sql`
      INSERT INTO calendar_events (user_id, title, description, event_date, start_time, end_time)
      VALUES (${userId}, ${title}, ${cleanText(payload.description, fallbackText)}, ${eventDate}, ${startTime}, ${endTime})
      RETURNING id, title
    `
    return { id: result[0].id as number, title: result[0].title as string, href: "/calendar" }
  }

  throw new Error("Unsupported conversion type")
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: ConvertBody
    try {
      body = (await request.json()) as ConvertBody
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const id = cleanId(body.id)
    const targetType = typeof body.target_type === "string" ? body.target_type : ""
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {}

    if (!id || !targetTypes.has(targetType)) {
      return NextResponse.json({ error: "Inbox item ID and valid target type are required" }, { status: 400 })
    }

    const inboxRows = await sql`
      SELECT *
      FROM inbox_items
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `

    if (inboxRows.length === 0) {
      return NextResponse.json({ error: "Inbox item not found" }, { status: 404 })
    }

    const inboxItem = inboxRows[0]
    if (inboxItem.status !== "unsorted") {
      return NextResponse.json({ error: "Only unsorted inbox items can be converted" }, { status: 400 })
    }

    const fallbackTitle = cleanText(inboxItem.title, "Inbox item", 255) || "Inbox item"
    const fallbackText = cleanText(inboxItem.raw_text, "", 10000) || ""
    const target = await createTarget(user.id, targetType, payload, fallbackTitle, fallbackText)

    const updatedRows = await sql`
      UPDATE inbox_items
      SET
        status = 'converted',
        converted_type = ${targetType},
        converted_id = ${target.id},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json({ inbox_item: updatedRows[0], target })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to convert inbox item"
    console.error("[inbox/convert] POST error:", error)
    const status = message.includes("required") || message.includes("not found") ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
