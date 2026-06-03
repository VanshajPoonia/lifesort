import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { isMissingUserTemplateSchema } from "@/lib/user-template-apply"
import { userTemplateUpdateSchema } from "@/lib/user-templates"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const body = await request.json().catch(() => null)
    const parsed = userTemplateUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Template is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    const payload = parsed.data
    const rows = await sql`
      UPDATE user_templates
      SET name = ${payload.name},
          description = ${payload.description || null},
          items = ${JSON.stringify(payload.items)}::jsonb,
          source = ${payload.source},
          forked_from = ${payload.forked_from || null},
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING id, name, description, items, source, forked_from, created_at, updated_at, last_used_at
    `

    if (!rows[0]) return NextResponse.json({ error: "Template not found" }, { status: 404 })
    return NextResponse.json({ template: rows[0] })
  } catch (error) {
    console.error("[user-templates] PUT failed:", error)
    if (isMissingUserTemplateSchema(error)) {
      return NextResponse.json(
        { error: "My Templates needs the user_templates migration before templates can be edited." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "Failed to update template" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const rows = await sql`
      DELETE FROM user_templates
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING id
    `

    if (!rows[0]) return NextResponse.json({ error: "Template not found" }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[user-templates] DELETE failed:", error)
    if (isMissingUserTemplateSchema(error)) {
      return NextResponse.json(
        { error: "My Templates needs the user_templates migration before templates can be deleted." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "Failed to delete template" }, { status: 500 })
  }
}
