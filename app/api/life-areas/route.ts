import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

import { getUserFromSession } from "@/lib/auth"
import {
  DEFAULT_LIFE_AREAS,
  normalizeLifeAreaId,
  type DomainAttention,
  type DomainHealthStatus,
  type DomainImportance,
  type DomainReviewFrequency,
  type DomainStatus,
} from "@/lib/life-areas"

const sql = neon(process.env.DATABASE_URL!)

const STATUS_VALUES: DomainStatus[] = ["active", "paused", "archived", "hidden"]
const IMPORTANCE_VALUES: DomainImportance[] = ["low", "medium", "high"]
const ATTENTION_VALUES: DomainAttention[] = ["low", "medium", "high"]
const REVIEW_FREQUENCY_VALUES: DomainReviewFrequency[] = ["weekly", "monthly", "quarterly", "custom", "none"]
const HEALTH_STATUS_VALUES: DomainHealthStatus[] = ["thriving", "stable", "needs_attention", "paused", "not_assessed"]

function cleanText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function cleanSortOrder(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function cleanEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : fallback
}

function cleanNullableEnum<T extends string>(value: unknown, allowed: T[]): T | null {
  return typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : null
}

function cleanNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function cleanParentDomainId(value: unknown): number | null {
  return normalizeLifeAreaId(value)
}

async function seedDefaultLifeAreas(userId: string) {
  for (const [index, area] of DEFAULT_LIFE_AREAS.entries()) {
    await sql`
      INSERT INTO life_areas (user_id, name, icon, color, description, sort_order)
      VALUES (${userId}, ${area.name}, ${area.icon}, ${area.color}, ${area.description}, ${index})
      ON CONFLICT (user_id, name) DO NOTHING
    `
  }
}

async function listLifeAreas(userId: string) {
  const rows = await sql`
    SELECT *
    FROM life_areas
    WHERE user_id = ${userId}
    ORDER BY sort_order ASC, name ASC
  `

  if (rows.length === 0) {
    await seedDefaultLifeAreas(userId)
    return sql`
      SELECT *
      FROM life_areas
      WHERE user_id = ${userId}
      ORDER BY sort_order ASC, name ASC
    `
  }

  return rows
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    return NextResponse.json(await listLifeAreas(user.id))
  } catch (error) {
    console.error("[life-areas] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch life domains" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const name = cleanText(body.name)
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const countRows = await sql`
      SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
      FROM life_areas
      WHERE user_id = ${user.id}
    `
    const sortOrder = cleanSortOrder(body.sort_order, Number(countRows[0]?.next_sort_order || 0))
    const parentDomainId = cleanParentDomainId(body.parent_domain_id)

    const result = await sql`
      INSERT INTO life_areas (
        user_id, name, icon, color, description, sort_order,
        status, importance, desired_attention, review_frequency, health_status,
        parent_domain_id, definition_of_success, current_concerns, long_term_vision,
        current_focus, boundaries, is_ai_excluded, requires_reauth
      )
      VALUES (
        ${user.id},
        ${name},
        ${cleanText(body.icon, "Target")},
        ${cleanText(body.color, "#2563EB")},
        ${cleanText(body.description, "") || null},
        ${sortOrder},
        ${cleanEnum(body.status, STATUS_VALUES, "active")},
        ${cleanNullableEnum(body.importance, IMPORTANCE_VALUES)},
        ${cleanNullableEnum(body.desired_attention, ATTENTION_VALUES)},
        ${cleanEnum(body.review_frequency, REVIEW_FREQUENCY_VALUES, "none")},
        ${cleanEnum(body.health_status, HEALTH_STATUS_VALUES, "not_assessed")},
        ${parentDomainId},
        ${cleanNullableText(body.definition_of_success)},
        ${cleanNullableText(body.current_concerns)},
        ${cleanNullableText(body.long_term_vision)},
        ${cleanNullableText(body.current_focus)},
        ${cleanNullableText(body.boundaries)},
        ${body.is_ai_excluded === true},
        ${body.requires_reauth === true}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[life-areas] POST error:", error)
    return NextResponse.json({ error: "Failed to create life domain" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const id = normalizeLifeAreaId(body.id)
    const name = cleanText(body.name)

    if (!id || !name) {
      return NextResponse.json({ error: "ID and name are required" }, { status: 400 })
    }

    const parentDomainId = cleanParentDomainId(body.parent_domain_id)
    if (parentDomainId === id) {
      return NextResponse.json({ error: "A domain cannot be its own parent" }, { status: 400 })
    }

    // Subdomains go one level deep only (AI_LIFE_DOMAINS_SPEC.md section 14): a domain that already
    // has a parent can't become a parent itself, and a domain with children can't become a subdomain.
    if (parentDomainId) {
      const parentRow = await sql`SELECT parent_domain_id FROM life_areas WHERE id = ${parentDomainId} AND user_id = ${user.id} LIMIT 1`
      if (parentRow.length === 0) {
        return NextResponse.json({ error: "Parent domain not found" }, { status: 404 })
      }
      if (parentRow[0].parent_domain_id) {
        return NextResponse.json({ error: "Subdomains can only be one level deep" }, { status: 400 })
      }
      const childRow = await sql`SELECT id FROM life_areas WHERE parent_domain_id = ${id} AND user_id = ${user.id} LIMIT 1`
      if (childRow.length > 0) {
        return NextResponse.json({ error: "This domain already has subdomains and can't become one itself" }, { status: 400 })
      }
    }

    const result = await sql`
      UPDATE life_areas
      SET
        name = ${name},
        icon = ${cleanText(body.icon, "Target")},
        color = ${cleanText(body.color, "#2563EB")},
        description = ${cleanText(body.description, "") || null},
        sort_order = ${cleanSortOrder(body.sort_order, 0)},
        status = ${cleanEnum(body.status, STATUS_VALUES, "active")},
        importance = ${cleanNullableEnum(body.importance, IMPORTANCE_VALUES)},
        desired_attention = ${cleanNullableEnum(body.desired_attention, ATTENTION_VALUES)},
        review_frequency = ${cleanEnum(body.review_frequency, REVIEW_FREQUENCY_VALUES, "none")},
        health_status = ${cleanEnum(body.health_status, HEALTH_STATUS_VALUES, "not_assessed")},
        parent_domain_id = ${parentDomainId},
        definition_of_success = ${cleanNullableText(body.definition_of_success)},
        current_concerns = ${cleanNullableText(body.current_concerns)},
        long_term_vision = ${cleanNullableText(body.long_term_vision)},
        current_focus = ${cleanNullableText(body.current_focus)},
        boundaries = ${cleanNullableText(body.boundaries)},
        is_ai_excluded = ${body.is_ai_excluded === true},
        requires_reauth = ${body.requires_reauth === true},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Life domain not found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[life-areas] PUT error:", error)
    return NextResponse.json({ error: "Failed to update life domain" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orderedIds } = await request.json()
    if (!Array.isArray(orderedIds)) {
      return NextResponse.json({ error: "orderedIds must be an array" }, { status: 400 })
    }

    for (const [index, rawId] of orderedIds.entries()) {
      const id = normalizeLifeAreaId(rawId)
      if (!id) continue
      await sql`
        UPDATE life_areas
        SET sort_order = ${index}, updated_at = NOW()
        WHERE id = ${id} AND user_id = ${user.id}
      `
    }

    return NextResponse.json(await listLifeAreas(user.id))
  } catch (error) {
    console.error("[life-areas] PATCH error:", error)
    return NextResponse.json({ error: "Failed to reorder life domains" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: rawId } = await request.json()
    const id = normalizeLifeAreaId(rawId)
    if (!id) {
      return NextResponse.json({ error: "Life domain ID is required" }, { status: 400 })
    }

    await sql`
      DELETE FROM life_areas
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[life-areas] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete life domain" }, { status: 500 })
  }
}
