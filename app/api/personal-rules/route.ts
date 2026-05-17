import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import {
  buildPersonalRulesPreview,
  DEFAULT_PERSONAL_RULE_PREFERENCES,
  normalizePersonalRulePreferences,
  RULE_CATEGORIES,
  type PersonalRule,
} from "@/lib/personal-rules"

type RuleBody = {
  id?: number | string | null
  title?: string | null
  description?: string | null
  category?: string | null
  active?: boolean | null
  preferences?: Record<string, unknown> | null
}

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === "" || value === "none") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function cleanText(value: unknown, fallback: string | null = null, max = 2000) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, max) : fallback
}

function cleanCategory(value: unknown) {
  return typeof value === "string" && (RULE_CATEGORIES as readonly string[]).includes(value) ? value : "other"
}

function normalizeRule(row: Record<string, unknown>): PersonalRule {
  return {
    id: Number(row.id),
    title: cleanText(row.title, "Untitled rule", 255) || "Untitled rule",
    description: cleanText(row.description),
    category: cleanCategory(row.category) as PersonalRule["category"],
    active: row.active === true,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  }
}

async function getRulesPayload(userId: string) {
  const rows = await sql`
    SELECT id, title, description, category, active, rule_type, preferences, created_at, updated_at
    FROM personal_rules
    WHERE user_id = ${userId}
    ORDER BY active DESC, category ASC, updated_at DESC
  `
  const rules = rows.filter((row) => row.rule_type === "rule").map((row) => normalizeRule(row))
  const activeRules = rules.filter((rule) => rule.active)
  const preferenceRow = rows.find((row) => row.rule_type === "preferences")
  const preferences = normalizePersonalRulePreferences(preferenceRow?.preferences ?? DEFAULT_PERSONAL_RULE_PREFERENCES)
  return {
    rules,
    preferences,
    preview: buildPersonalRulesPreview(activeRules, preferences),
  }
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    return NextResponse.json(await getRulesPayload(user.id))
  } catch (error) {
    console.error("[personal-rules] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch personal rules" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as RuleBody
    const title = cleanText(body.title, null, 255)
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const result = await sql`
      INSERT INTO personal_rules (user_id, title, description, category, active, rule_type)
      VALUES (
        ${user.id},
        ${title},
        ${cleanText(body.description)},
        ${cleanCategory(body.category)},
        ${body.active !== false},
        'rule'
      )
      RETURNING id, title, description, category, active, created_at, updated_at
    `
    return NextResponse.json(normalizeRule(result[0]))
  } catch (error) {
    console.error("[personal-rules] POST error:", error)
    return NextResponse.json({ error: "Failed to create personal rule" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = (await request.json()) as RuleBody
    if (body.preferences && typeof body.preferences === "object") {
      const preferences = normalizePersonalRulePreferences(body.preferences)
      await sql`
        INSERT INTO personal_rules (user_id, title, description, category, active, rule_type, preferences)
        VALUES (${user.id}, 'Planning preferences', 'Visible preferences used by LifeSort AI planning features.', 'planning', true, 'preferences', ${JSON.stringify(preferences)}::jsonb)
        ON CONFLICT (user_id) WHERE rule_type = 'preferences'
        DO UPDATE SET preferences = EXCLUDED.preferences, active = true, updated_at = NOW()
      `
      return NextResponse.json(await getRulesPayload(user.id))
    }

    const id = cleanId(body.id)
    if (!id) return NextResponse.json({ error: "Personal rule ID is required" }, { status: 400 })
    const title = cleanText(body.title, null, 255)
    if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 })

    const result = await sql`
      UPDATE personal_rules
      SET
        title = ${title},
        description = ${cleanText(body.description)},
        category = ${cleanCategory(body.category)},
        active = ${body.active !== false},
        updated_at = NOW()
      WHERE id = ${id}
        AND user_id = ${user.id}
        AND rule_type = 'rule'
      RETURNING id, title, description, category, active, created_at, updated_at
    `
    if (result.length === 0) return NextResponse.json({ error: "Personal rule not found" }, { status: 404 })
    return NextResponse.json(normalizeRule(result[0]))
  } catch (error) {
    console.error("[personal-rules] PUT error:", error)
    return NextResponse.json({ error: "Failed to update personal rules" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: rawId } = await request.json()
    const id = cleanId(rawId)
    if (!id) return NextResponse.json({ error: "Personal rule ID is required" }, { status: 400 })

    const result = await sql`
      DELETE FROM personal_rules
      WHERE id = ${id}
        AND user_id = ${user.id}
        AND rule_type = 'rule'
      RETURNING id
    `
    if (result.length === 0) return NextResponse.json({ error: "Personal rule not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[personal-rules] DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete personal rule" }, { status: 500 })
  }
}
