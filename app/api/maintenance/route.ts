import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const categories = new Set(["home", "vehicle", "health", "finance", "digital", "school", "work", "business", "other"])
const recurrences = new Set(["weekly", "monthly", "quarterly", "yearly", "custom"])
const statuses = new Set(["active", "paused", "completed"])
const views = new Set(["all", "upcoming", "overdue", "paused", "completed", "category"])

type MaintenanceBody = {
  id?: number | string | null
  title?: string | null
  category?: string | null
  recurrence?: string | null
  custom_interval_days?: number | string | null
  next_due_date?: string | null
  last_completed_date?: string | null
  reminder_days_before?: number | string | null
  life_area_id?: number | string | null
  vault_item_id?: number | string | null
  notes?: string | null
  status?: string | null
}

function hasField(body: MaintenanceBody, field: keyof MaintenanceBody) {
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

function cleanDate(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === "" || value === "none") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function cleanNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function cleanCategory(value: unknown, fallback = "other") {
  if (typeof value !== "string") return fallback
  return categories.has(value) ? value : fallback
}

function cleanRecurrence(value: unknown, fallback = "monthly") {
  if (typeof value !== "string") return fallback
  return recurrences.has(value) ? value : fallback
}

function cleanStatus(value: unknown, fallback = "active") {
  if (typeof value !== "string") return fallback
  return statuses.has(value) ? value : fallback
}

async function vaultTableExists() {
  const rows = await sql`SELECT to_regclass('public.vault_items') AS table_name`
  return Boolean(rows[0]?.table_name)
}

async function validateLifeAreaId(lifeAreaId: number | null, userId: string) {
  if (!lifeAreaId) return null
  const rows = await sql`SELECT id FROM life_areas WHERE id = ${lifeAreaId} AND user_id = ${userId} LIMIT 1`
  return rows.length > 0 ? lifeAreaId : undefined
}

async function validateVaultItemId(vaultItemId: number | null, userId: string) {
  if (!vaultItemId) return null
  if (!(await vaultTableExists())) return undefined
  const rows = await sql`SELECT id FROM vault_items WHERE id = ${vaultItemId} AND user_id = ${userId} LIMIT 1`
  return rows.length > 0 ? vaultItemId : undefined
}

async function getValidatedLinks(body: MaintenanceBody, userId: string, existing?: Record<string, unknown>) {
  const lifeAreaId = hasField(body, "life_area_id")
    ? await validateLifeAreaId(normalizeLifeAreaId(body.life_area_id), userId)
    : normalizeLifeAreaId(existing?.life_area_id)
  if (lifeAreaId === undefined) return { error: "Life area not found" }

  const vaultItemId = hasField(body, "vault_item_id")
    ? await validateVaultItemId(cleanId(body.vault_item_id), userId)
    : cleanId(existing?.vault_item_id)
  if (vaultItemId === undefined) return { error: "Vault item not found" }

  return { lifeAreaId, vaultItemId }
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const viewParam = searchParams.get("view") || "all"
    const view = views.has(viewParam) ? viewParam : "all"
    const categoryParam = searchParams.get("category")
    const category = categoryParam && categories.has(categoryParam) ? categoryParam : null
    const statusParam = searchParams.get("status")
    const status = statusParam && statuses.has(statusParam) ? statusParam : null
    const lifeAreaId = normalizeLifeAreaId(searchParams.get("life_area_id"))
    const search = (searchParams.get("q") || "").trim().slice(0, 80)
    const limit = Math.min(200, Math.max(1, Number.parseInt(searchParams.get("limit") || "100", 10) || 100))
    const pattern = `%${search}%`

    if (await vaultTableExists()) {
      const rows = await sql`
        SELECT
          mi.*,
          la.name AS life_area_name,
          la.icon AS life_area_icon,
          la.color AS life_area_color,
          vi.title AS vault_item_title,
          (
            mi.status = 'active'
            AND mi.next_due_date IS NOT NULL
            AND mi.next_due_date < CURRENT_DATE
          ) AS is_overdue,
          (
            mi.status = 'active'
            AND mi.next_due_date IS NOT NULL
            AND mi.next_due_date >= CURRENT_DATE
            AND mi.next_due_date <= CURRENT_DATE + INTERVAL '30 days'
          ) AS is_upcoming
        FROM maintenance_items mi
        LEFT JOIN life_areas la
          ON mi.life_area_id = la.id
          AND la.user_id = ${user.id}
        LEFT JOIN vault_items vi
          ON mi.vault_item_id = vi.id
          AND vi.user_id = ${user.id}
        WHERE mi.user_id = ${user.id}
          AND (${status}::text IS NULL OR mi.status = ${status})
          AND (${lifeAreaId}::integer IS NULL OR mi.life_area_id = ${lifeAreaId})
          AND (${category}::text IS NULL OR mi.category = ${category})
          AND (
            ${view} = 'all'
            OR (${view} = 'upcoming' AND mi.status = 'active' AND mi.next_due_date IS NOT NULL AND mi.next_due_date >= CURRENT_DATE AND mi.next_due_date <= CURRENT_DATE + INTERVAL '30 days')
            OR (${view} = 'overdue' AND mi.status = 'active' AND mi.next_due_date IS NOT NULL AND mi.next_due_date < CURRENT_DATE)
            OR (${view} = 'paused' AND mi.status = 'paused')
            OR (${view} = 'completed' AND mi.status = 'completed')
            OR (${view} = 'category' AND ${category}::text IS NOT NULL AND mi.category = ${category})
          )
          AND (
            ${search} = ''
            OR mi.title ILIKE ${pattern}
            OR mi.category ILIKE ${pattern}
            OR mi.recurrence ILIKE ${pattern}
            OR mi.status ILIKE ${pattern}
            OR COALESCE(mi.notes, '') ILIKE ${pattern}
            OR COALESCE(la.name, '') ILIKE ${pattern}
            OR COALESCE(vi.title, '') ILIKE ${pattern}
          )
        ORDER BY
          CASE
            WHEN mi.status = 'active' AND mi.next_due_date IS NOT NULL AND mi.next_due_date < CURRENT_DATE THEN 0
            WHEN mi.status = 'active' AND mi.next_due_date IS NOT NULL AND mi.next_due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1
            WHEN mi.status = 'active' THEN 2
            WHEN mi.status = 'paused' THEN 3
            ELSE 4
          END,
          mi.next_due_date ASC NULLS LAST,
          mi.updated_at DESC
        LIMIT ${limit}
      `
      return NextResponse.json(rows)
    }

    const rows = await sql`
      SELECT
        mi.*,
        la.name AS life_area_name,
        la.icon AS life_area_icon,
        la.color AS life_area_color,
        NULL::text AS vault_item_title,
        (
          mi.status = 'active'
          AND mi.next_due_date IS NOT NULL
          AND mi.next_due_date < CURRENT_DATE
        ) AS is_overdue,
        (
          mi.status = 'active'
          AND mi.next_due_date IS NOT NULL
          AND mi.next_due_date >= CURRENT_DATE
          AND mi.next_due_date <= CURRENT_DATE + INTERVAL '30 days'
        ) AS is_upcoming
      FROM maintenance_items mi
      LEFT JOIN life_areas la
        ON mi.life_area_id = la.id
        AND la.user_id = ${user.id}
      WHERE mi.user_id = ${user.id}
        AND (${status}::text IS NULL OR mi.status = ${status})
        AND (${lifeAreaId}::integer IS NULL OR mi.life_area_id = ${lifeAreaId})
        AND (${category}::text IS NULL OR mi.category = ${category})
        AND (
          ${view} = 'all'
          OR (${view} = 'upcoming' AND mi.status = 'active' AND mi.next_due_date IS NOT NULL AND mi.next_due_date >= CURRENT_DATE AND mi.next_due_date <= CURRENT_DATE + INTERVAL '30 days')
          OR (${view} = 'overdue' AND mi.status = 'active' AND mi.next_due_date IS NOT NULL AND mi.next_due_date < CURRENT_DATE)
          OR (${view} = 'paused' AND mi.status = 'paused')
          OR (${view} = 'completed' AND mi.status = 'completed')
          OR (${view} = 'category' AND ${category}::text IS NOT NULL AND mi.category = ${category})
        )
        AND (
          ${search} = ''
          OR mi.title ILIKE ${pattern}
          OR mi.category ILIKE ${pattern}
          OR mi.recurrence ILIKE ${pattern}
          OR mi.status ILIKE ${pattern}
          OR COALESCE(mi.notes, '') ILIKE ${pattern}
          OR COALESCE(la.name, '') ILIKE ${pattern}
        )
      ORDER BY
        CASE
          WHEN mi.status = 'active' AND mi.next_due_date IS NOT NULL AND mi.next_due_date < CURRENT_DATE THEN 0
          WHEN mi.status = 'active' AND mi.next_due_date IS NOT NULL AND mi.next_due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 1
          WHEN mi.status = 'active' THEN 2
          WHEN mi.status = 'paused' THEN 3
          ELSE 4
        END,
        mi.next_due_date ASC NULLS LAST,
        mi.updated_at DESC
      LIMIT ${limit}
    `

    return NextResponse.json(rows)
  } catch (error) {
    console.error("[maintenance] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch maintenance items" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as MaintenanceBody
    const title = cleanLimitedText(body.title, 255)
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const recurrence = cleanRecurrence(body.recurrence)
    const customIntervalDays = recurrence === "custom"
      ? cleanNumber(body.custom_interval_days, 30, 1, 3650)
      : null
    const links = await getValidatedLinks(body, user.id)
    if ("error" in links) return NextResponse.json({ error: links.error }, { status: 404 })

    const result = await sql`
      INSERT INTO maintenance_items (
        user_id,
        title,
        category,
        recurrence,
        custom_interval_days,
        next_due_date,
        last_completed_date,
        reminder_days_before,
        life_area_id,
        vault_item_id,
        notes,
        status
      ) VALUES (
        ${user.id},
        ${title},
        ${cleanCategory(body.category)},
        ${recurrence},
        ${customIntervalDays},
        ${cleanDate(body.next_due_date)},
        ${cleanDate(body.last_completed_date)},
        ${cleanNumber(body.reminder_days_before, 7, 0, 365)},
        ${links.lifeAreaId},
        ${links.vaultItemId},
        ${cleanText(body.notes)},
        ${cleanStatus(body.status)}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[maintenance] POST error:", error)
    return NextResponse.json({ error: "Failed to create maintenance item" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as MaintenanceBody
    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 })

    const existing = await sql`SELECT * FROM maintenance_items WHERE id = ${id} AND user_id = ${user.id} LIMIT 1`
    if (existing.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const current = existing[0]
    const title = hasField(body, "title") ? cleanLimitedText(body.title, 255, current.title) : current.title
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const recurrence = hasField(body, "recurrence") ? cleanRecurrence(body.recurrence, current.recurrence) : current.recurrence
    const customIntervalDays = recurrence === "custom"
      ? cleanNumber(
          hasField(body, "custom_interval_days") ? body.custom_interval_days : current.custom_interval_days,
          30,
          1,
          3650,
        )
      : null
    const links = await getValidatedLinks(body, user.id, current)
    if ("error" in links) return NextResponse.json({ error: links.error }, { status: 404 })

    const result = await sql`
      UPDATE maintenance_items SET
        title = ${title},
        category = ${hasField(body, "category") ? cleanCategory(body.category, current.category) : current.category},
        recurrence = ${recurrence},
        custom_interval_days = ${customIntervalDays},
        next_due_date = ${hasField(body, "next_due_date") ? cleanDate(body.next_due_date) : current.next_due_date},
        last_completed_date = ${hasField(body, "last_completed_date") ? cleanDate(body.last_completed_date) : current.last_completed_date},
        reminder_days_before = ${hasField(body, "reminder_days_before") ? cleanNumber(body.reminder_days_before, 7, 0, 365) : current.reminder_days_before},
        life_area_id = ${links.lifeAreaId},
        vault_item_id = ${links.vaultItemId},
        notes = ${hasField(body, "notes") ? cleanText(body.notes) : current.notes},
        status = ${hasField(body, "status") ? cleanStatus(body.status, current.status) : current.status},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[maintenance] PUT error:", error)
    return NextResponse.json({ error: "Failed to update maintenance item" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = (await request.json()) as { id?: number | string | null }
    const cleanItemId = cleanId(id)
    if (!cleanItemId) return NextResponse.json({ error: "ID is required" }, { status: 400 })

    await sql`DELETE FROM maintenance_items WHERE id = ${cleanItemId} AND user_id = ${user.id}`
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[maintenance] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete maintenance item" }, { status: 500 })
  }
}
