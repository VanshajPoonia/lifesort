import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { isMissingUserTemplateSchema } from "@/lib/user-template-apply"
import {
  userTemplatePayloadSchema,
  userTemplateItemSchema,
  type UserTemplate,
  type UserTemplateItem,
  type UserTemplateSource,
} from "@/lib/user-templates"

function normalizeItems(value: unknown): UserTemplateItem[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => userTemplateItemSchema.safeParse(item))
    .filter((result) => result.success)
    .map((result) => result.data)
}

function mapTemplateRow(row: Record<string, unknown>): UserTemplate {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: String(row.description ?? ""),
    items: normalizeItems(row.items),
    source: String(row.source ?? "manual") as UserTemplateSource,
    forked_from: row.forked_from ? String(row.forked_from) : null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ""),
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at ? String(row.updated_at) : null,
    last_used_at: row.last_used_at instanceof Date ? row.last_used_at.toISOString() : row.last_used_at ? String(row.last_used_at) : null,
  }
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rows = await sql`
      SELECT id, name, description, items, source, forked_from, created_at, updated_at, last_used_at
      FROM user_templates
      WHERE user_id = ${user.id}
      ORDER BY COALESCE(last_used_at, updated_at, created_at) DESC
    `

    return NextResponse.json({ templates: rows.map((row) => mapTemplateRow(row as Record<string, unknown>)) })
  } catch (error) {
    console.error("[user-templates] GET failed:", error)
    if (isMissingUserTemplateSchema(error)) {
      return NextResponse.json(
        { templates: [], migration_required: true },
        { status: 200 },
      )
    }
    return NextResponse.json({ error: "Failed to load templates" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = userTemplatePayloadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Template is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    const payload = parsed.data
    const rows = await sql`
      INSERT INTO user_templates (user_id, name, description, items, source, forked_from)
      VALUES (
        ${user.id},
        ${payload.name},
        ${payload.description || null},
        ${JSON.stringify(payload.items)}::jsonb,
        ${payload.source},
        ${payload.forked_from || null}
      )
      RETURNING id, name, description, items, source, forked_from, created_at, updated_at, last_used_at
    `

    return NextResponse.json({ template: mapTemplateRow(rows[0] as Record<string, unknown>) }, { status: 201 })
  } catch (error) {
    console.error("[user-templates] POST failed:", error)
    if (isMissingUserTemplateSchema(error)) {
      return NextResponse.json(
        { error: "My Templates needs the user_templates migration before templates can be saved." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "Failed to save template" }, { status: 500 })
  }
}
