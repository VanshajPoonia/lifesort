import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

const itemTypes = new Set([
  "task",
  "goal",
  "note",
  "link",
  "wishlist",
  "budget_category",
  "budget_transaction",
  "budget_goal",
])

type ProjectItemType =
  | "task"
  | "goal"
  | "note"
  | "link"
  | "wishlist"
  | "budget_category"
  | "budget_transaction"
  | "budget_goal"

type ProjectItemBody = {
  id?: number | string | null
  project_id?: number | string | null
  item_type?: string | null
  item_id?: number | string | null
}

type CandidateRow = {
  id: number | string
  title: string | null
  subtitle: string | null
  href: string
  updated_at?: string | Date | null
  created_at?: string | Date | null
}

function cleanId(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function cleanItemType(value: unknown): ProjectItemType | null {
  if (typeof value !== "string") return null
  return itemTypes.has(value) ? (value as ProjectItemType) : null
}

function typeLabel(type: ProjectItemType) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function hrefFor(type: ProjectItemType, itemId?: number | string) {
  if (type === "task") return "/tasks"
  if (type === "goal") return "/goals"
  if (type === "note") return "/notes"
  if (type === "link") return "/links"
  if (type === "wishlist") return "/wishlist"
  if (type.startsWith("budget_")) return "/budget"
  return itemId ? `/projects/${itemId}` : "/projects"
}

async function getProject(projectId: number, userId: string) {
  const rows = await sql`
    SELECT id
    FROM projects
    WHERE id = ${projectId} AND user_id = ${userId}
    LIMIT 1
  `
  return rows[0]
}

async function addActivity(
  projectId: number,
  userId: string,
  action: string,
  message: string,
  itemType: ProjectItemType,
  itemId: number,
) {
  await sql`
    INSERT INTO project_activity (project_id, user_id, action, item_type, item_id, message)
    VALUES (${projectId}, ${userId}, ${action}, ${itemType}, ${itemId}, ${message})
  `
}

async function validateItemOwnership(type: ProjectItemType, itemId: number, userId: string): Promise<CandidateRow | null> {
  if (type === "task") {
    const rows = await sql`
      SELECT id, title, COALESCE(priority, category, 'Task') AS subtitle, '/tasks' AS href, updated_at, created_at
      FROM tasks
      WHERE id = ${itemId} AND user_id = ${userId}
      LIMIT 1
    `
    return (rows[0] as CandidateRow) || null
  }

  if (type === "goal") {
    const rows = await sql`
      SELECT id, title, COALESCE(status, category, 'Goal') AS subtitle, '/goals' AS href, updated_at, created_at
      FROM goals
      WHERE id = ${itemId} AND user_id = ${userId}
      LIMIT 1
    `
    return (rows[0] as CandidateRow) || null
  }

  if (type === "note") {
    const rows = await sql`
      SELECT id, title, COALESCE(content, 'Note') AS subtitle, '/notes' AS href, updated_at, created_at
      FROM notes
      WHERE id = ${itemId} AND user_id = ${userId}
      LIMIT 1
    `
    return (rows[0] as CandidateRow) || null
  }

  if (type === "link") {
    const rows = await sql`
      SELECT id, title, COALESCE(description, url, 'Link') AS subtitle, '/links' AS href, updated_at, created_at
      FROM user_links
      WHERE id = ${itemId} AND user_id = ${userId}
      LIMIT 1
    `
    return (rows[0] as CandidateRow) || null
  }

  if (type === "wishlist") {
    const rows = await sql`
      SELECT id, title, COALESCE(category, priority, 'Wishlist') AS subtitle, '/wishlist' AS href, updated_at, created_at
      FROM wishlist_items
      WHERE id = ${itemId} AND user_id = ${userId}
      LIMIT 1
    `
    return (rows[0] as CandidateRow) || null
  }

  if (type === "budget_category") {
    const rows = await sql`
      SELECT id, name AS title, 'Budget category' AS subtitle, '/budget' AS href, created_at AS updated_at, created_at
      FROM budget_categories
      WHERE id = ${itemId} AND user_id = ${userId}
      LIMIT 1
    `
    return (rows[0] as CandidateRow) || null
  }

  if (type === "budget_transaction") {
    const rows = await sql`
      SELECT id, COALESCE(description, type) AS title, type || ' · $' || amount::text AS subtitle, '/budget' AS href, updated_at, created_at
      FROM budget_transactions
      WHERE id = ${itemId} AND user_id = ${userId}
      LIMIT 1
    `
    return (rows[0] as CandidateRow) || null
  }

  const rows = await sql`
    SELECT id, name AS title, 'Budget goal · $' || target_amount::text AS subtitle, '/budget' AS href, created_at AS updated_at, created_at
    FROM budget_goals
    WHERE id = ${itemId} AND user_id = ${userId}
    LIMIT 1
  `
  return (rows[0] as CandidateRow) || null
}

async function getCandidates(type: ProjectItemType, userId: string, query: string, projectId: number | null) {
  const pattern = `%${query}%`

  if (type === "task") {
    return sql`
      SELECT id, title, COALESCE(priority, category, 'Task') AS subtitle, '/tasks' AS href, updated_at, created_at
      FROM tasks
      WHERE user_id = ${userId}
        AND (${query.length === 0} OR title ILIKE ${pattern} OR COALESCE(description, '') ILIKE ${pattern})
        AND (${!projectId} OR NOT EXISTS (
          SELECT 1 FROM project_items pi
          WHERE pi.project_id = ${projectId} AND pi.user_id = ${userId} AND pi.item_type = 'task' AND pi.item_id = tasks.id
        ))
      ORDER BY completed ASC, updated_at DESC, created_at DESC
      LIMIT 15
    `
  }

  if (type === "goal") {
    return sql`
      SELECT id, title, COALESCE(status, category, 'Goal') AS subtitle, '/goals' AS href, updated_at, created_at
      FROM goals
      WHERE user_id = ${userId}
        AND (${query.length === 0} OR title ILIKE ${pattern} OR COALESCE(description, '') ILIKE ${pattern})
        AND (${!projectId} OR NOT EXISTS (
          SELECT 1 FROM project_items pi
          WHERE pi.project_id = ${projectId} AND pi.user_id = ${userId} AND pi.item_type = 'goal' AND pi.item_id = goals.id
        ))
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 15
    `
  }

  if (type === "note") {
    return sql`
      SELECT id, title, COALESCE(content, 'Note') AS subtitle, '/notes' AS href, updated_at, created_at
      FROM notes
      WHERE user_id = ${userId}
        AND (${query.length === 0} OR title ILIKE ${pattern} OR COALESCE(content, '') ILIKE ${pattern})
        AND (${!projectId} OR NOT EXISTS (
          SELECT 1 FROM project_items pi
          WHERE pi.project_id = ${projectId} AND pi.user_id = ${userId} AND pi.item_type = 'note' AND pi.item_id = notes.id
        ))
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 15
    `
  }

  if (type === "link") {
    return sql`
      SELECT id, title, COALESCE(description, url, 'Link') AS subtitle, '/links' AS href, updated_at, created_at
      FROM user_links
      WHERE user_id = ${userId}
        AND (${query.length === 0} OR title ILIKE ${pattern} OR COALESCE(url, '') ILIKE ${pattern} OR COALESCE(description, '') ILIKE ${pattern})
        AND (${!projectId} OR NOT EXISTS (
          SELECT 1 FROM project_items pi
          WHERE pi.project_id = ${projectId} AND pi.user_id = ${userId} AND pi.item_type = 'link' AND pi.item_id = user_links.id
        ))
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 15
    `
  }

  if (type === "wishlist") {
    return sql`
      SELECT id, title, COALESCE(category, priority, 'Wishlist') AS subtitle, '/wishlist' AS href, updated_at, created_at
      FROM wishlist_items
      WHERE user_id = ${userId}
        AND (${query.length === 0} OR title ILIKE ${pattern} OR COALESCE(description, '') ILIKE ${pattern} OR COALESCE(category, '') ILIKE ${pattern})
        AND (${!projectId} OR NOT EXISTS (
          SELECT 1 FROM project_items pi
          WHERE pi.project_id = ${projectId} AND pi.user_id = ${userId} AND pi.item_type = 'wishlist' AND pi.item_id = wishlist_items.id
        ))
      ORDER BY purchased ASC, updated_at DESC, created_at DESC
      LIMIT 15
    `
  }

  if (type === "budget_category") {
    return sql`
      SELECT id, name AS title, 'Budget category' AS subtitle, '/budget' AS href, created_at AS updated_at, created_at
      FROM budget_categories
      WHERE user_id = ${userId}
        AND (${query.length === 0} OR name ILIKE ${pattern})
        AND (${!projectId} OR NOT EXISTS (
          SELECT 1 FROM project_items pi
          WHERE pi.project_id = ${projectId} AND pi.user_id = ${userId} AND pi.item_type = 'budget_category' AND pi.item_id = budget_categories.id
        ))
      ORDER BY name ASC
      LIMIT 15
    `
  }

  if (type === "budget_transaction") {
    return sql`
      SELECT id, COALESCE(description, type) AS title, type || ' · $' || amount::text AS subtitle, '/budget' AS href, updated_at, created_at
      FROM budget_transactions
      WHERE user_id = ${userId}
        AND (${query.length === 0} OR COALESCE(description, '') ILIKE ${pattern} OR COALESCE(type, '') ILIKE ${pattern})
        AND (${!projectId} OR NOT EXISTS (
          SELECT 1 FROM project_items pi
          WHERE pi.project_id = ${projectId} AND pi.user_id = ${userId} AND pi.item_type = 'budget_transaction' AND pi.item_id = budget_transactions.id
        ))
      ORDER BY date DESC, updated_at DESC, created_at DESC
      LIMIT 15
    `
  }

  return sql`
    SELECT id, name AS title, 'Budget goal · $' || target_amount::text AS subtitle, '/budget' AS href, created_at AS updated_at, created_at
    FROM budget_goals
    WHERE user_id = ${userId}
      AND (${query.length === 0} OR name ILIKE ${pattern})
      AND (${!projectId} OR NOT EXISTS (
        SELECT 1 FROM project_items pi
        WHERE pi.project_id = ${projectId} AND pi.user_id = ${userId} AND pi.item_type = 'budget_goal' AND pi.item_id = budget_goals.id
      ))
    ORDER BY deadline ASC NULLS LAST, created_at DESC
    LIMIT 15
  `
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = cleanItemType(searchParams.get("type"))
    const query = (searchParams.get("q") || "").trim().slice(0, 80)
    const projectId = cleanId(searchParams.get("project_id"))

    if (projectId) {
      const project = await getProject(projectId, user.id)
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
    }

    if (type) {
      const candidates = await getCandidates(type, user.id, query, projectId)
      return NextResponse.json({
        candidates: (candidates as CandidateRow[]).map((row) => ({
          ...row,
          item_type: type,
          title: row.title?.trim() || "Untitled",
          subtitle: row.subtitle?.trim() || typeLabel(type),
          href: hrefFor(type),
        })),
      })
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required" }, { status: 400 })
    }

    const rows = await sql`
      SELECT
        pi.*,
        COALESCE(
          t.title,
          g.title,
          n.title,
          ul.title,
          wi.title,
          bc.name,
          COALESCE(bt.description, bt.type),
          bg.name
        ) AS title,
        COALESCE(
          t.priority,
          g.status,
          LEFT(n.content, 120),
          COALESCE(ul.description, ul.url),
          wi.category,
          'Budget category',
          CASE WHEN bt.id IS NOT NULL THEN bt.type || ' · $' || bt.amount::text ELSE NULL END,
          CASE WHEN bg.id IS NOT NULL THEN 'Budget goal · $' || bg.target_amount::text ELSE NULL END
        ) AS subtitle,
        COALESCE(t.updated_at, g.updated_at, n.updated_at, ul.updated_at, wi.updated_at, bt.updated_at, t.created_at, g.created_at, n.created_at, ul.created_at, wi.created_at, bc.created_at, bt.created_at, bg.created_at) AS source_updated_at,
        t.completed AS task_completed,
        g.status AS goal_status,
        (
          (pi.item_type = 'task' AND t.id IS NULL) OR
          (pi.item_type = 'goal' AND g.id IS NULL) OR
          (pi.item_type = 'note' AND n.id IS NULL) OR
          (pi.item_type = 'link' AND ul.id IS NULL) OR
          (pi.item_type = 'wishlist' AND wi.id IS NULL) OR
          (pi.item_type = 'budget_category' AND bc.id IS NULL) OR
          (pi.item_type = 'budget_transaction' AND bt.id IS NULL) OR
          (pi.item_type = 'budget_goal' AND bg.id IS NULL)
        ) AS missing
      FROM project_items pi
      LEFT JOIN tasks t ON pi.item_type = 'task' AND pi.item_id = t.id AND t.user_id = ${user.id}
      LEFT JOIN goals g ON pi.item_type = 'goal' AND pi.item_id = g.id AND g.user_id = ${user.id}
      LEFT JOIN notes n ON pi.item_type = 'note' AND pi.item_id = n.id AND n.user_id = ${user.id}
      LEFT JOIN user_links ul ON pi.item_type = 'link' AND pi.item_id = ul.id AND ul.user_id = ${user.id}
      LEFT JOIN wishlist_items wi ON pi.item_type = 'wishlist' AND pi.item_id = wi.id AND wi.user_id = ${user.id}
      LEFT JOIN budget_categories bc ON pi.item_type = 'budget_category' AND pi.item_id = bc.id AND bc.user_id = ${user.id}
      LEFT JOIN budget_transactions bt ON pi.item_type = 'budget_transaction' AND pi.item_id = bt.id AND bt.user_id = ${user.id}
      LEFT JOIN budget_goals bg ON pi.item_type = 'budget_goal' AND pi.item_id = bg.id AND bg.user_id = ${user.id}
      WHERE pi.project_id = ${projectId} AND pi.user_id = ${user.id}
      ORDER BY pi.created_at DESC
    `

    return NextResponse.json({
      items: rows.map((row) => {
        const rowType = cleanItemType(row.item_type) || "task"
        return {
          ...row,
          label: typeLabel(rowType),
          title: row.title?.trim() || "Missing item",
          subtitle: row.subtitle?.trim() || (row.missing ? "The source record may have been deleted." : typeLabel(rowType)),
          href: hrefFor(rowType),
          missing: Boolean(row.missing),
        }
      }),
    })
  } catch (error) {
    console.error("[project-items] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch project items" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as ProjectItemBody
    const projectId = cleanId(body.project_id)
    const itemType = cleanItemType(body.item_type)
    const itemId = cleanId(body.item_id)

    if (!projectId || !itemType || !itemId) {
      return NextResponse.json({ error: "Project, item type, and item ID are required" }, { status: 400 })
    }

    const project = await getProject(projectId, user.id)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const source = await validateItemOwnership(itemType, itemId, user.id)
    if (!source) {
      return NextResponse.json({ error: "Linked item not found" }, { status: 404 })
    }

    const result = await sql`
      INSERT INTO project_items (project_id, user_id, item_type, item_id)
      VALUES (${projectId}, ${user.id}, ${itemType}, ${itemId})
      ON CONFLICT (project_id, item_type, item_id) DO NOTHING
      RETURNING *
    `

    if (result.length > 0) {
      await addActivity(projectId, user.id, "item_linked", `Linked ${typeLabel(itemType).toLowerCase()}: ${source.title || "Untitled"}`, itemType, itemId)
    }

    return NextResponse.json({ success: true, item: result[0] || null })
  } catch (error) {
    console.error("[project-items] POST error:", error)
    return NextResponse.json({ error: "Failed to link item" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as ProjectItemBody
    const id = cleanId(body.id)
    const projectId = cleanId(body.project_id)
    const itemType = cleanItemType(body.item_type)
    const itemId = cleanId(body.item_id)

    if (!id && (!projectId || !itemType || !itemId)) {
      return NextResponse.json({ error: "Project item ID or project/item pair is required" }, { status: 400 })
    }

    const rows = id
      ? await sql`
          DELETE FROM project_items
          WHERE id = ${id} AND user_id = ${user.id}
          RETURNING *
        `
      : await sql`
          DELETE FROM project_items
          WHERE project_id = ${projectId} AND user_id = ${user.id} AND item_type = ${itemType} AND item_id = ${itemId}
          RETURNING *
        `

    if (rows.length === 0) {
      return NextResponse.json({ error: "Project item not found" }, { status: 404 })
    }

    const removed = rows[0]
    const removedType = cleanItemType(removed.item_type)
    if (removedType) {
      await addActivity(removed.project_id, user.id, "item_unlinked", `Unlinked ${typeLabel(removedType).toLowerCase()}`, removedType, removed.item_id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[project-items] DELETE error:", error)
    return NextResponse.json({ error: "Failed to unlink item" }, { status: 500 })
  }
}
