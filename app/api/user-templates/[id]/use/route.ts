import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { applyUserTemplateItems, isMissingUserTemplateSchema } from "@/lib/user-template-apply"
import { userTemplateItemSchema } from "@/lib/user-templates"

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await context.params
    const rows = await sql`
      SELECT id, items
      FROM user_templates
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `

    if (!rows[0]) return NextResponse.json({ error: "Template not found" }, { status: 404 })

    const rawItems = Array.isArray(rows[0].items) ? rows[0].items : []
    const items = rawItems
      .map((item) => userTemplateItemSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data)

    if (items.length === 0) {
      return NextResponse.json({ error: "Template has no createable items" }, { status: 400 })
    }

    const created = await applyUserTemplateItems(user, items)

    await sql`
      UPDATE user_templates
      SET last_used_at = NOW(), updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ created }, { status: 201 })
  } catch (error) {
    console.error("[user-templates] use failed:", error)
    if (isMissingUserTemplateSchema(error)) {
      return NextResponse.json(
        { error: "My Templates needs the latest LifeSort database migrations before this template can be used." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "Failed to use template" }, { status: 500 })
  }
}
