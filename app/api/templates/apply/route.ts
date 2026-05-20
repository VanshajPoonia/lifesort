import { randomUUID } from "node:crypto"

import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { makeSpaceId } from "@/lib/spaces"
import {
  dateFromOffset,
  hasTemplateContent,
  isSafeGeneratedUrl,
  templateApplySchema,
  type CreatedTemplateItem,
  type GeneratedTemplate,
} from "@/lib/template-builder"
import { makeWhiteboardId, makeWhiteboardRoomId, normalizeEmail } from "@/lib/whiteboards"

function isMissingTable(error: unknown) {
  const err = error as { code?: string; message?: string }
  const message = err.message?.toLowerCase() ?? ""
  return err.code === "42P01" || message.includes("does not exist")
}

function customFields(fields: GeneratedTemplate["sections"][number]["fields"]) {
  return fields.map((field) => ({
    id: `field_${randomUUID()}`,
    name: field.name,
    type: field.type,
    options: field.type === "select" ? field.options : [],
    required: field.required,
  }))
}

function spaceItemOrder(index: number) {
  return index + 1
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => null)
    const parsed = templateApplySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Template is invalid", issues: parsed.error.issues }, { status: 400 })
    }

    const template = parsed.data.template
    if (!hasTemplateContent(template)) {
      return NextResponse.json({ error: "Template has no createable content" }, { status: 400 })
    }

    const unsafeLink = template.starter_links.find((link) => !isSafeGeneratedUrl(link.url))
    if (unsafeLink) {
      return NextResponse.json({ error: `Link URL is not allowed: ${unsafeLink.title}` }, { status: 400 })
    }

    const spaceId = template.space.create ? makeSpaceId() : null
    let linkedOrder = 0

    const results = await sql.transaction((tx) => {
      const queries: ReturnType<typeof tx>[] = []

      if (spaceId) {
        queries.push(tx`
          INSERT INTO spaces (id, user_id, name, description, color, icon, favorite)
          VALUES (
            ${spaceId},
            ${user.id},
            ${template.space.name},
            ${template.space.description || null},
            ${template.space.color},
            ${template.space.icon},
            FALSE
          )
          RETURNING 'space' AS type, id::text AS id, name AS title, ${`/spaces/${spaceId}`} AS href, FALSE AS linked_to_space
        `)
      }

      template.sections.forEach((section) => {
        const fieldsJson = JSON.stringify(customFields(section.fields))
        const order = spaceItemOrder(linkedOrder++)
        queries.push(tx`
          WITH created AS (
            INSERT INTO custom_sections (user_id, title, icon, color, description, fields, position)
            VALUES (
              ${user.id},
              ${section.title},
              ${section.icon || "FolderKanban"},
              ${section.color || "primary"},
              ${section.description || null},
              ${fieldsJson}::jsonb,
              0
            )
            RETURNING id::text AS id, title
          ),
          linked AS (
            INSERT INTO space_items (space_id, item_type, item_id, sort_order)
            SELECT ${spaceId}, 'custom_section', created.id, ${order}
            FROM created
            WHERE ${spaceId}::text IS NOT NULL
            ON CONFLICT (space_id, item_type, item_id) DO NOTHING
          )
          SELECT 'custom_section' AS type, id, title, '/custom-sections' AS href, ${Boolean(spaceId)} AS linked_to_space
          FROM created
        `)
      })

      template.starter_tasks.forEach((task) => {
        const order = spaceItemOrder(linkedOrder++)
        queries.push(tx`
          WITH created AS (
            INSERT INTO tasks (user_id, title, description, priority, due_date, category, completed, sort_order)
            VALUES (
              ${user.id},
              ${task.title},
              ${task.description || null},
              ${task.priority},
              ${dateFromOffset(task.due_in_days)},
              ${task.category || null},
              FALSE,
              0
            )
            RETURNING id::text AS id, title
          ),
          linked AS (
            INSERT INTO space_items (space_id, item_type, item_id, sort_order)
            SELECT ${spaceId}, 'task', created.id, ${order}
            FROM created
            WHERE ${spaceId}::text IS NOT NULL
            ON CONFLICT (space_id, item_type, item_id) DO NOTHING
          )
          SELECT 'task' AS type, id, title, '/tasks' AS href, ${Boolean(spaceId)} AS linked_to_space
          FROM created
        `)
      })

      template.starter_notes.forEach((note) => {
        const order = spaceItemOrder(linkedOrder++)
        queries.push(tx`
          WITH created AS (
            INSERT INTO notes (user_id, title, content)
            VALUES (${user.id}, ${note.title}, ${note.content || ""})
            RETURNING id::text AS id, title
          ),
          linked AS (
            INSERT INTO space_items (space_id, item_type, item_id, sort_order)
            SELECT ${spaceId}, 'note', created.id, ${order}
            FROM created
            WHERE ${spaceId}::text IS NOT NULL
            ON CONFLICT (space_id, item_type, item_id) DO NOTHING
          )
          SELECT 'note' AS type, id, title, ('/notes?note=' || id) AS href, ${Boolean(spaceId)} AS linked_to_space
          FROM created
        `)
      })

      template.starter_habits.forEach((habit) => {
        queries.push(tx`
          INSERT INTO habits (
            user_id, name, description, frequency, custom_days, target_count,
            is_active, color, icon, sort_order
          ) VALUES (
            ${user.id},
            ${habit.name},
            ${habit.description || null},
            ${habit.frequency},
            ARRAY[]::integer[],
            ${habit.target_count},
            TRUE,
            ${habit.color || "#2563EB"},
            ${habit.icon || "CheckSquare"},
            0
          )
          RETURNING 'habit' AS type, id::text AS id, name AS title, '/habits' AS href, FALSE AS linked_to_space
        `)
      })

      template.starter_links.forEach((link) => {
        const order = spaceItemOrder(linkedOrder++)
        queries.push(tx`
          WITH created AS (
            INSERT INTO user_links (user_id, title, url, description, position, link_type)
            VALUES (${user.id}, ${link.title}, ${link.url || ""}, ${link.description || null}, 0, 'link')
            RETURNING id::text AS id, title
          ),
          linked AS (
            INSERT INTO space_items (space_id, item_type, item_id, sort_order)
            SELECT ${spaceId}, 'link', created.id, ${order}
            FROM created
            WHERE ${spaceId}::text IS NOT NULL
            ON CONFLICT (space_id, item_type, item_id) DO NOTHING
          )
          SELECT 'link' AS type, id, title, '/links' AS href, ${Boolean(spaceId)} AS linked_to_space
          FROM created
        `)
      })

      if (template.whiteboard.create) {
        const boardId = makeWhiteboardId()
        const roomId = makeWhiteboardRoomId(boardId)
        const order = spaceItemOrder(linkedOrder++)
        queries.push(tx`
          WITH board AS (
            INSERT INTO whiteboards (id, user_id, title, description, liveblocks_room_id)
            VALUES (${boardId}, ${user.id}, ${template.whiteboard.title}, ${template.whiteboard.description || null}, ${roomId})
            RETURNING id::text AS id, title
          ),
          owner_collaborator AS (
            INSERT INTO whiteboard_collaborators (whiteboard_id, user_id, email, role, invited_by, accepted_at)
            SELECT board.id, ${user.id}, ${normalizeEmail(user.email)}, 'owner', ${user.id}, NOW()
            FROM board
          ),
          linked AS (
            INSERT INTO space_items (space_id, item_type, item_id, sort_order)
            SELECT ${spaceId}, 'whiteboard', board.id, ${order}
            FROM board
            WHERE ${spaceId}::text IS NOT NULL
            ON CONFLICT (space_id, item_type, item_id) DO NOTHING
          )
          SELECT 'whiteboard' AS type, id, title, ('/whiteboard/' || id) AS href, ${Boolean(spaceId)} AS linked_to_space
          FROM board
        `)
      }

      template.budget_categories.forEach((category) => {
        queries.push(tx`
          INSERT INTO budget_categories (user_id, name, color, icon, budget_limit)
          VALUES (
            ${user.id},
            ${category.name},
            ${category.color || "#3B82F6"},
            ${category.icon || "Wallet"},
            ${category.budget_limit}
          )
          RETURNING 'budget_category' AS type, id::text AS id, name AS title, '/budget' AS href, FALSE AS linked_to_space
        `)
      })

      return queries
    })

    const created = results.flat().map((row) => ({
      type: String(row.type) as CreatedTemplateItem["type"],
      id: String(row.id),
      title: String(row.title),
      href: String(row.href),
      linkedToSpace: Boolean(row.linked_to_space),
    }))

    return NextResponse.json({ created }, { status: 201 })
  } catch (error) {
    console.error("[templates/apply] failed:", error)
    if (isMissingTable(error)) {
      return NextResponse.json(
        { error: "Template Builder needs the latest LifeSort database migrations before it can create this system." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "Failed to create template items" }, { status: 500 })
  }
}
