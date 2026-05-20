import { randomUUID } from "node:crypto"

import { z } from "zod"

import { sql } from "@/lib/db"
import { makeWhiteboardId, makeWhiteboardRoomId, normalizeEmail, type WhiteboardUser } from "@/lib/whiteboards"

export const spaceItemTypes = ["note", "whiteboard", "task", "project", "link", "custom_section"] as const

export type SpaceItemType = (typeof spaceItemTypes)[number]

export type Space = {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string
  icon: string
  favorite: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
  item_count?: number
  activity_at?: string | null
}

export type HydratedSpaceItem = {
  id: string
  space_id: string
  item_type: SpaceItemType
  item_id: string
  sort_order: number
  created_at: string
  title: string
  subtitle: string
  href: string
  updated_at: string | null
  missing: boolean
}

type SpaceRow = Record<string, unknown> & {
  id: string
  user_id: string
  name: string
  description: string | null
  color: string
  icon: string
  favorite: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
  item_count?: number | string | null
  activity_at?: string | null
}

type SpaceItemRow = Record<string, unknown> & {
  id: string
  space_id: string
  item_type: SpaceItemType
  item_id: string
  sort_order: number | string | null
  created_at: string
}

export const spaceCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  color: z.string().trim().max(40).optional(),
  icon: z.string().trim().max(50).optional(),
  favorite: z.boolean().optional(),
})

export const spacePatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  color: z.string().trim().max(40).optional(),
  icon: z.string().trim().max(50).optional(),
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
})

export const spaceItemCreateSchema = z
  .object({
    item_type: z.enum(spaceItemTypes),
    item_id: z.string().trim().min(1).optional(),
    create_new: z.boolean().optional().default(false),
    title: z.string().trim().max(255).optional(),
    url: z.string().trim().max(2000).optional(),
    description: z.string().trim().max(1000).optional(),
  })
  .refine((value) => value.create_new || value.item_id, "item_id is required unless create_new is true")

export const spaceItemDeleteSchema = z.object({
  item_type: z.enum(spaceItemTypes),
  item_id: z.string().trim().min(1),
})

export function makeSpaceId() {
  return randomUUID()
}

export function mapSpaceRow(row: SpaceRow): Space {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    name: String(row.name || "Untitled space"),
    description: row.description || null,
    color: String(row.color || "primary"),
    icon: String(row.icon || "FolderKanban"),
    favorite: Boolean(row.favorite),
    archived_at: row.archived_at ? String(row.archived_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    item_count: Number(row.item_count || 0),
    activity_at: row.activity_at ? String(row.activity_at) : null,
  }
}

export async function getSpaceForUser(spaceId: string, userId: string, includeArchived = false) {
  const rows = await sql`
    SELECT
      s.*,
      COUNT(si.id)::int AS item_count,
      GREATEST(s.updated_at, COALESCE(MAX(si.created_at), s.updated_at)) AS activity_at
    FROM spaces s
    LEFT JOIN space_items si ON si.space_id = s.id
    WHERE s.id = ${spaceId}
      AND s.user_id = ${userId}
      AND (${includeArchived}::boolean = TRUE OR s.archived_at IS NULL)
    GROUP BY s.id
    LIMIT 1
  `

  return rows[0] ? mapSpaceRow(rows[0] as SpaceRow) : null
}

export async function validateSpaceItemAccess(user: WhiteboardUser, itemType: SpaceItemType, itemId: string) {
  const email = normalizeEmail(user.email)

  if (itemType === "note") {
    const rows = await sql`SELECT id FROM notes WHERE id::text = ${itemId} AND user_id = ${user.id} LIMIT 1`
    return rows.length > 0
  }

  if (itemType === "task") {
    const rows = await sql`SELECT id FROM tasks WHERE id::text = ${itemId} AND user_id = ${user.id} LIMIT 1`
    return rows.length > 0
  }

  if (itemType === "project") {
    const rows = await sql`SELECT id FROM projects WHERE id::text = ${itemId} AND user_id = ${user.id} LIMIT 1`
    return rows.length > 0
  }

  if (itemType === "link") {
    const rows = await sql`SELECT id FROM user_links WHERE id::text = ${itemId} AND user_id = ${user.id} LIMIT 1`
    return rows.length > 0
  }

  if (itemType === "custom_section") {
    const rows = await sql`SELECT id FROM custom_sections WHERE id::text = ${itemId} AND user_id = ${user.id} LIMIT 1`
    return rows.length > 0
  }

  const rows = await sql`
    SELECT w.id
    FROM whiteboards w
    LEFT JOIN whiteboard_collaborators wc
      ON wc.whiteboard_id = w.id
      AND (
        wc.user_id = ${user.id}
        OR (${email}::text IS NOT NULL AND lower(wc.email) = ${email})
      )
    WHERE w.id = ${itemId}
      AND w.archived_at IS NULL
      AND (w.user_id = ${user.id} OR wc.id IS NOT NULL)
    LIMIT 1
  `
  return rows.length > 0
}

export async function createSpaceBackedItem(
  user: WhiteboardUser,
  itemType: SpaceItemType,
  input: { title?: string; url?: string; description?: string },
) {
  const title = input.title?.trim() || defaultTitleFor(itemType)
  const description = input.description?.trim() || null

  if (itemType === "note") {
    const rows = await sql`
      INSERT INTO notes (user_id, title, content)
      VALUES (${user.id}, ${title}, '')
      RETURNING id::text AS id
    `
    return String(rows[0].id)
  }

  if (itemType === "task") {
    const rows = await sql`
      INSERT INTO tasks (user_id, title, description)
      VALUES (${user.id}, ${title}, ${description})
      RETURNING id::text AS id
    `
    return String(rows[0].id)
  }

  if (itemType === "project") {
    const rows = await sql`
      INSERT INTO projects (user_id, title, description)
      VALUES (${user.id}, ${title}, ${description})
      RETURNING id::text AS id
    `
    await sql`
      INSERT INTO project_activity (project_id, user_id, action, message, metadata)
      VALUES (${Number(rows[0].id)}, ${user.id}, 'project_created', 'Project created from Space', ${JSON.stringify({ title })}::jsonb)
    `
    return String(rows[0].id)
  }

  if (itemType === "link") {
    const rows = await sql`
      INSERT INTO user_links (user_id, title, url, description)
      VALUES (${user.id}, ${title}, ${input.url?.trim() || ""}, ${description})
      RETURNING id::text AS id
    `
    return String(rows[0].id)
  }

  if (itemType === "custom_section") {
    const rows = await sql`
      INSERT INTO custom_sections (user_id, title, icon, color, description)
      VALUES (${user.id}, ${title}, 'FolderKanban', 'primary', ${description})
      RETURNING id::text AS id
    `
    return String(rows[0].id)
  }

  const id = makeWhiteboardId()
  const roomId = makeWhiteboardRoomId(id)
  const rows = await sql`
    WITH board AS (
      INSERT INTO whiteboards (id, user_id, title, description, liveblocks_room_id)
      VALUES (${id}, ${user.id}, ${title}, ${description}, ${roomId})
      RETURNING id
    ),
    owner_collaborator AS (
      INSERT INTO whiteboard_collaborators (whiteboard_id, user_id, email, role, invited_by, accepted_at)
      SELECT board.id, ${user.id}, ${normalizeEmail(user.email)}, 'owner', ${user.id}, NOW()
      FROM board
      RETURNING id
    )
    SELECT id FROM board
  `
  return String(rows[0].id)
}

export function defaultTitleFor(itemType: SpaceItemType) {
  const labels: Record<SpaceItemType, string> = {
    note: "Untitled note",
    whiteboard: "Untitled whiteboard",
    task: "Untitled task",
    project: "Untitled project",
    link: "Untitled link",
    custom_section: "Untitled section",
  }
  return labels[itemType]
}

export function itemTypeLabel(itemType: SpaceItemType) {
  const labels: Record<SpaceItemType, string> = {
    note: "Note",
    whiteboard: "Whiteboard",
    task: "Task",
    project: "Project",
    link: "Link",
    custom_section: "Custom Section",
  }
  return labels[itemType]
}

export function itemHref(itemType: SpaceItemType, itemId: string) {
  const hrefs: Record<SpaceItemType, string> = {
    note: `/notes?note=${itemId}`,
    whiteboard: `/whiteboard/${itemId}`,
    task: "/tasks",
    project: `/projects/${itemId}`,
    link: "/links",
    custom_section: "/custom-sections",
  }
  return hrefs[itemType]
}

export async function hydrateSpaceItems(user: WhiteboardUser, items: SpaceItemRow[]): Promise<HydratedSpaceItem[]> {
  const grouped = new Map<SpaceItemType, string[]>()
  for (const item of items) {
    const current = grouped.get(item.item_type) || []
    current.push(String(item.item_id))
    grouped.set(item.item_type, current)
  }

  const lookups = new Map<string, { title: string; subtitle: string; updated_at: string | null }>()

  const noteIds = grouped.get("note")
  if (noteIds?.length) {
    const rows = await sql`
      SELECT id::text AS id, title, content AS subtitle, updated_at::text AS updated_at
      FROM notes
      WHERE user_id = ${user.id} AND id::text = ANY(${noteIds}::text[])
    `
    for (const row of rows) {
      lookups.set(`note:${row.id}`, {
        title: String(row.title || defaultTitleFor("note")),
        subtitle: row.subtitle ? String(row.subtitle) : itemTypeLabel("note"),
        updated_at: row.updated_at ? String(row.updated_at) : null,
      })
    }
  }

  const taskIds = grouped.get("task")
  if (taskIds?.length) {
    const rows = await sql`
      SELECT id::text AS id, title, description AS subtitle, updated_at::text AS updated_at
      FROM tasks
      WHERE user_id = ${user.id} AND id::text = ANY(${taskIds}::text[])
    `
    for (const row of rows) {
      lookups.set(`task:${row.id}`, {
        title: String(row.title || defaultTitleFor("task")),
        subtitle: row.subtitle ? String(row.subtitle) : itemTypeLabel("task"),
        updated_at: row.updated_at ? String(row.updated_at) : null,
      })
    }
  }

  const projectIds = grouped.get("project")
  if (projectIds?.length) {
    const rows = await sql`
      SELECT id::text AS id, title, status AS subtitle, updated_at::text AS updated_at
      FROM projects
      WHERE user_id = ${user.id} AND id::text = ANY(${projectIds}::text[])
    `
    for (const row of rows) {
      lookups.set(`project:${row.id}`, {
        title: String(row.title || defaultTitleFor("project")),
        subtitle: row.subtitle ? String(row.subtitle) : itemTypeLabel("project"),
        updated_at: row.updated_at ? String(row.updated_at) : null,
      })
    }
  }

  const linkIds = grouped.get("link")
  if (linkIds?.length) {
    const rows = await sql`
      SELECT id::text AS id, title, url AS subtitle, updated_at::text AS updated_at
      FROM user_links
      WHERE user_id = ${user.id} AND id::text = ANY(${linkIds}::text[])
    `
    for (const row of rows) {
      lookups.set(`link:${row.id}`, {
        title: String(row.title || defaultTitleFor("link")),
        subtitle: row.subtitle ? String(row.subtitle) : itemTypeLabel("link"),
        updated_at: row.updated_at ? String(row.updated_at) : null,
      })
    }
  }

  const sectionIds = grouped.get("custom_section")
  if (sectionIds?.length) {
    const rows = await sql`
      SELECT id::text AS id, title, description AS subtitle, updated_at::text AS updated_at
      FROM custom_sections
      WHERE user_id = ${user.id} AND id::text = ANY(${sectionIds}::text[])
    `
    for (const row of rows) {
      lookups.set(`custom_section:${row.id}`, {
        title: String(row.title || defaultTitleFor("custom_section")),
        subtitle: row.subtitle ? String(row.subtitle) : itemTypeLabel("custom_section"),
        updated_at: row.updated_at ? String(row.updated_at) : null,
      })
    }
  }

  const whiteboardIds = grouped.get("whiteboard")
  if (whiteboardIds?.length) {
    const email = normalizeEmail(user.email)
    const rows = await sql`
      SELECT DISTINCT w.id::text AS id, w.title, w.description AS subtitle, w.updated_at::text AS updated_at
      FROM whiteboards w
      LEFT JOIN whiteboard_collaborators wc
        ON wc.whiteboard_id = w.id
        AND (
          wc.user_id = ${user.id}
          OR (${email}::text IS NOT NULL AND lower(wc.email) = ${email})
        )
      WHERE w.id::text = ANY(${whiteboardIds}::text[])
        AND w.archived_at IS NULL
        AND (w.user_id = ${user.id} OR wc.id IS NOT NULL)
    `
    for (const row of rows) {
      lookups.set(`whiteboard:${row.id}`, {
        title: String(row.title || defaultTitleFor("whiteboard")),
        subtitle: row.subtitle ? String(row.subtitle) : itemTypeLabel("whiteboard"),
        updated_at: row.updated_at ? String(row.updated_at) : null,
      })
    }
  }

  return items.map((item) => {
    const itemId = String(item.item_id)
    const lookup = lookups.get(`${item.item_type}:${itemId}`)
    return {
      id: String(item.id),
      space_id: String(item.space_id),
      item_type: item.item_type,
      item_id: itemId,
      sort_order: Number(item.sort_order || 0),
      created_at: String(item.created_at),
      title: lookup?.title || "Unavailable item",
      subtitle: lookup?.subtitle || "The original item may have been deleted or you may no longer have access.",
      href: lookup ? itemHref(item.item_type, itemId) : "#",
      updated_at: lookup?.updated_at || null,
      missing: !lookup,
    }
  })
}
