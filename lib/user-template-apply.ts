import { sql } from "@/lib/db"
import { makeSpaceId } from "@/lib/spaces"
import { makeWhiteboardId, makeWhiteboardRoomId, normalizeEmail } from "@/lib/whiteboards"
import type { UserTemplateItem } from "@/lib/user-templates"

export type CreatedUserTemplateItem = {
  type: UserTemplateItem["type"]
  id: string
  title: string
  href: string
}

function itemDescription(item: UserTemplateItem) {
  return item.description?.trim() || null
}

type TemplateApplyUser = {
  id: string
  email: string
}

export async function applyUserTemplateItems(user: TemplateApplyUser, items: UserTemplateItem[]) {
  const results = await sql.transaction((tx) => {
    const queries: ReturnType<typeof tx>[] = []

    items.forEach((item) => {
      if (item.type === "space") {
        const spaceId = makeSpaceId()
        queries.push(tx`
          INSERT INTO spaces (id, user_id, name, description, color, icon, favorite)
          VALUES (${spaceId}, ${user.id}, ${item.title}, ${itemDescription(item)}, ${item.color || "primary"}, ${item.icon || "FolderKanban"}, FALSE)
          RETURNING 'space' AS type, id::text AS id, name AS title, ${`/spaces/${spaceId}`} AS href
        `)
        return
      }

      if (item.type === "project") {
        queries.push(tx`
          WITH created AS (
            INSERT INTO projects (user_id, title, description, status, priority, progress)
            VALUES (${user.id}, ${item.title}, ${itemDescription(item)}, 'active', ${item.priority || "medium"}, 0)
            RETURNING id, title
          ),
          activity AS (
            INSERT INTO project_activity (project_id, user_id, action, message, metadata)
            SELECT created.id, ${user.id}, 'project_created', 'Project created from template', ${JSON.stringify({ source: "user_template" })}::jsonb
            FROM created
          )
          SELECT 'project' AS type, id::text AS id, title, ('/projects/' || id::text) AS href
          FROM created
        `)
        return
      }

      if (item.type === "task") {
        queries.push(tx`
          INSERT INTO tasks (user_id, title, description, priority, category, completed, sort_order)
          VALUES (${user.id}, ${item.title}, ${itemDescription(item)}, ${item.priority || "medium"}, ${item.category || null}, FALSE, 0)
          RETURNING 'task' AS type, id::text AS id, title, '/tasks' AS href
        `)
        return
      }

      if (item.type === "goal") {
        queries.push(tx`
          INSERT INTO goals (user_id, title, description, category, status, priority, progress, current_value, email_reminder, reminder_days, reminder_sent)
          VALUES (${user.id}, ${item.title}, ${itemDescription(item)}, ${item.category || "personal"}, 'active', ${item.priority || "medium"}, 0, NULL, FALSE, 3, FALSE)
          RETURNING 'goal' AS type, id::text AS id, title, '/goals' AS href
        `)
        return
      }

      if (item.type === "habit") {
        queries.push(tx`
          INSERT INTO habits (
            user_id, name, description, frequency, custom_days, target_count,
            is_active, color, icon, sort_order
          )
          VALUES (
            ${user.id},
            ${item.title},
            ${itemDescription(item)},
            ${item.frequency || "daily"},
            ARRAY[]::integer[],
            ${item.target_count || 1},
            TRUE,
            ${item.color || "#2563EB"},
            ${item.icon || "CheckSquare"},
            0
          )
          RETURNING 'habit' AS type, id::text AS id, name AS title, '/habits' AS href
        `)
        return
      }

      if (item.type === "note") {
        queries.push(tx`
          INSERT INTO notes (user_id, title, content, tags, is_pinned)
          VALUES (${user.id}, ${item.title}, ${item.content || item.description || ""}, ARRAY[]::text[], FALSE)
          RETURNING 'note' AS type, id::text AS id, title, ('/notes?note=' || id::text) AS href
        `)
        return
      }

      if (item.type === "link") {
        queries.push(tx`
          INSERT INTO user_links (user_id, title, url, description, position, link_type)
          VALUES (${user.id}, ${item.title}, ${item.url || ""}, ${itemDescription(item)}, 0, 'link')
          RETURNING 'link' AS type, id::text AS id, title, '/links' AS href
        `)
        return
      }

      if (item.type === "custom_section") {
        queries.push(tx`
          INSERT INTO custom_sections (user_id, title, icon, color, description, fields, position)
          VALUES (${user.id}, ${item.title}, ${item.icon || "Folder"}, ${item.color || "primary"}, ${itemDescription(item)}, '[]'::jsonb, 0)
          RETURNING 'custom_section' AS type, id::text AS id, title, '/custom-sections' AS href
        `)
        return
      }

      if (item.type === "whiteboard") {
        const boardId = makeWhiteboardId()
        const roomId = makeWhiteboardRoomId(boardId)
        queries.push(tx`
          WITH board AS (
            INSERT INTO whiteboards (id, user_id, title, description, liveblocks_room_id)
            VALUES (${boardId}, ${user.id}, ${item.title}, ${itemDescription(item)}, ${roomId})
            RETURNING id::text AS id, title
          ),
          owner_collaborator AS (
            INSERT INTO whiteboard_collaborators (whiteboard_id, user_id, email, role, invited_by, accepted_at)
            SELECT board.id, ${user.id}, ${normalizeEmail(user.email)}, 'owner', ${user.id}, NOW()
            FROM board
          )
          SELECT 'whiteboard' AS type, id, title, ('/whiteboard/' || id) AS href
          FROM board
        `)
        return
      }

      if (item.type === "budget_category") {
        queries.push(tx`
          INSERT INTO budget_categories (user_id, name, color, icon, budget_limit)
          VALUES (${user.id}, ${item.title}, ${item.color || "#3B82F6"}, ${item.icon || "Wallet"}, ${item.budget_limit || 0})
          RETURNING 'budget_category' AS type, id::text AS id, name AS title, '/money?tab=budget' AS href
        `)
        return
      }

      if (item.type === "vault_item") {
        queries.push(tx`
          INSERT INTO vault_items (
            user_id, title, category, description, notes,
            expiry_date, renewal_date, reminder_date, tags
          )
          VALUES (
            ${user.id},
            ${item.title},
            ${item.category || "other"},
            ${itemDescription(item)},
            NULL,
            NULL,
            NULL,
            NULL,
            ARRAY[]::text[]
          )
          RETURNING 'vault_item' AS type, id::text AS id, title, '/vault' AS href
        `)
      }
    })

    return queries
  })

  return results.flat().map((row) => ({
    type: String(row.type) as CreatedUserTemplateItem["type"],
    id: String(row.id),
    title: String(row.title),
    href: String(row.href),
  }))
}

export function isMissingUserTemplateSchema(error: unknown) {
  const err = error as { code?: string; message?: string }
  const message = err.message?.toLowerCase() ?? ""
  return err.code === "42P01" || err.code === "42703" || message.includes("does not exist")
}
