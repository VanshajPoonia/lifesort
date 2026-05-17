import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { getTimelineData } from "@/lib/timeline"

type SearchType =
  | "inbox"
  | "someday"
  | "waiting"
  | "commitments"
  | "maintenance"
  | "timeline"
  | "tasks"
  | "goals"
  | "notes"
  | "projects"
  | "people"
  | "vault"
  | "links"
  | "wishlist"
  | "investments"
  | "income"
  | "budget"

type SearchRow = {
  id: string | number
  title: string | null
  subtitle: string | null
  href: string
  updated_at?: string | Date | null
  created_at?: string | Date | null
}

type SearchResult = {
  type: SearchType
  id: string
  title: string
  subtitle: string
  href: string
  updated_at: string | null
}

const groupLabels: Record<SearchType, string> = {
  inbox: "Inbox",
  someday: "Someday / Maybe",
  waiting: "Waiting For",
  commitments: "Commitments",
  maintenance: "Maintenance",
  timeline: "Timeline",
  tasks: "Tasks",
  goals: "Goals",
  notes: "Notes",
  projects: "Projects",
  people: "People",
  vault: "Vault",
  links: "Links",
  wishlist: "Wishlist",
  investments: "Investments",
  income: "Income",
  budget: "Budget",
}

const emptyGroups = () =>
  (Object.keys(groupLabels) as SearchType[]).map((type) => ({
    type,
    label: groupLabels[type],
    results: [] as SearchResult[],
  }))

function toIsoDate(value: string | Date | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeRows(type: SearchType, rows: SearchRow[]): SearchResult[] {
  return rows.map((row) => ({
    type,
    id: String(row.id),
    title: row.title?.trim() || "Untitled",
    subtitle: row.subtitle?.trim() || groupLabels[type],
    href: row.href,
    updated_at: toIsoDate(row.updated_at || row.created_at || null),
  }))
}

async function safeRows(label: string, query: Promise<Record<string, any>[]>): Promise<SearchRow[]> {
  try {
    return (await query) as SearchRow[]
  } catch (error) {
    console.error(`[search] ${label} query failed:`, error)
    return []
  }
}

export async function GET(request: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get("q") || "").trim().slice(0, 80)

  if (query.length < 2) {
    return NextResponse.json({ query, groups: emptyGroups() })
  }

  const pattern = `%${query}%`

  const [
    inbox,
    someday,
    waiting,
    commitments,
    maintenance,
    timeline,
    tasks,
    goals,
    notes,
    projects,
    people,
    vault,
    links,
    wishlist,
    investments,
    income,
    budgetTransactions,
    budgetCategories,
    budgetGoals,
  ] = await Promise.all([
    safeRows("inbox", sql`
      SELECT
        inbox_items.id,
        inbox_items.title,
        COALESCE(life_areas.name, inbox_items.suggested_type, inbox_items.status) as subtitle,
        '/inbox' as href,
        inbox_items.updated_at,
        inbox_items.created_at
      FROM inbox_items
      LEFT JOIN life_areas
        ON inbox_items.life_area_id = life_areas.id
        AND life_areas.user_id = ${user.id}
      WHERE inbox_items.user_id = ${user.id}
      AND (
        inbox_items.title ILIKE ${pattern}
        OR inbox_items.raw_text ILIKE ${pattern}
        OR COALESCE(inbox_items.suggested_type, '') ILIKE ${pattern}
        OR COALESCE(inbox_items.status, '') ILIKE ${pattern}
        OR COALESCE(inbox_items.source, '') ILIKE ${pattern}
        OR COALESCE(life_areas.name, '') ILIKE ${pattern}
      )
      ORDER BY inbox_items.updated_at DESC, inbox_items.created_at DESC
      LIMIT 5
    `),
    safeRows("someday", sql`
      SELECT
        si.id,
        si.title,
        COALESCE(la.name, si.category, si.status) as subtitle,
        '/someday' as href,
        si.updated_at,
        si.created_at
      FROM someday_items si
      LEFT JOIN life_areas la
        ON si.life_area_id = la.id
        AND la.user_id = ${user.id}
      WHERE si.user_id = ${user.id}
      AND (
        si.title ILIKE ${pattern}
        OR COALESCE(si.description, '') ILIKE ${pattern}
        OR si.category ILIKE ${pattern}
        OR si.status ILIKE ${pattern}
        OR COALESCE(la.name, '') ILIKE ${pattern}
      )
      ORDER BY si.updated_at DESC, si.created_at DESC
      LIMIT 5
    `),
    safeRows("waiting", sql`
      SELECT
        wi.id,
        wi.title,
        COALESCE(la.name, p.title, pe.name, wi.waiting_on_name, wi.status) as subtitle,
        '/waiting' as href,
        wi.updated_at,
        wi.created_at
      FROM waiting_items wi
      LEFT JOIN life_areas la
        ON wi.life_area_id = la.id
        AND la.user_id = ${user.id}
      LEFT JOIN projects p
        ON wi.project_id = p.id
        AND p.user_id = ${user.id}
      LEFT JOIN people pe
        ON wi.person_id = pe.id
        AND pe.user_id = ${user.id}
      WHERE wi.user_id = ${user.id}
      AND (
        wi.title ILIKE ${pattern}
        OR COALESCE(wi.description, '') ILIKE ${pattern}
        OR wi.waiting_on_name ILIKE ${pattern}
        OR wi.waiting_on_type ILIKE ${pattern}
        OR wi.status ILIKE ${pattern}
        OR COALESCE(wi.notes, '') ILIKE ${pattern}
        OR COALESCE(la.name, '') ILIKE ${pattern}
        OR COALESCE(p.title, '') ILIKE ${pattern}
        OR COALESCE(pe.name, '') ILIKE ${pattern}
      )
      ORDER BY wi.updated_at DESC, wi.created_at DESC
      LIMIT 5
    `),
    safeRows("commitments", sql`
      SELECT
        c.id,
        c.title,
        COALESCE(la.name, p.title, pe.name, t.title, c.committed_to, c.status) as subtitle,
        '/commitments' as href,
        c.updated_at,
        c.created_at
      FROM commitments c
      LEFT JOIN life_areas la
        ON c.life_area_id = la.id
        AND la.user_id = ${user.id}
      LEFT JOIN projects p
        ON c.project_id = p.id
        AND p.user_id = ${user.id}
      LEFT JOIN people pe
        ON c.person_id = pe.id
        AND pe.user_id = ${user.id}
      LEFT JOIN tasks t
        ON c.related_task_id = t.id
        AND t.user_id = ${user.id}
      WHERE c.user_id = ${user.id}
      AND (
        c.title ILIKE ${pattern}
        OR COALESCE(c.description, '') ILIKE ${pattern}
        OR c.committed_to ILIKE ${pattern}
        OR c.commitment_type ILIKE ${pattern}
        OR c.status ILIKE ${pattern}
        OR COALESCE(la.name, '') ILIKE ${pattern}
        OR COALESCE(p.title, '') ILIKE ${pattern}
        OR COALESCE(pe.name, '') ILIKE ${pattern}
        OR COALESCE(t.title, '') ILIKE ${pattern}
      )
      ORDER BY c.updated_at DESC, c.created_at DESC
      LIMIT 5
    `),
    safeRows("maintenance", sql`
      SELECT
        mi.id,
        mi.title,
        COALESCE(la.name, vi.title, mi.category, mi.recurrence, mi.status) as subtitle,
        '/maintenance' as href,
        mi.updated_at,
        mi.created_at
      FROM maintenance_items mi
      LEFT JOIN life_areas la
        ON mi.life_area_id = la.id
        AND la.user_id = ${user.id}
      LEFT JOIN vault_items vi
        ON mi.vault_item_id = vi.id
        AND vi.user_id = ${user.id}
      WHERE mi.user_id = ${user.id}
      AND (
        mi.title ILIKE ${pattern}
        OR mi.category ILIKE ${pattern}
        OR mi.recurrence ILIKE ${pattern}
        OR mi.status ILIKE ${pattern}
        OR COALESCE(mi.notes, '') ILIKE ${pattern}
        OR COALESCE(la.name, '') ILIKE ${pattern}
        OR COALESCE(vi.title, '') ILIKE ${pattern}
      )
      ORDER BY mi.updated_at DESC, mi.created_at DESC
      LIMIT 5
    `),
    getTimelineData(user.id, { search: query, limit: 5 })
      .then((data) => data.events.map((event) => ({
        id: event.id,
        title: event.title,
        subtitle: event.label,
        href: "/timeline",
        updated_at: event.occurred_at,
        created_at: event.occurred_at,
      }))),
    safeRows("tasks", sql`
      SELECT id, title, COALESCE(description, category, priority) as subtitle, '/tasks' as href, updated_at, created_at
      FROM tasks
      WHERE user_id = ${user.id}
      AND (title ILIKE ${pattern} OR COALESCE(description, '') ILIKE ${pattern} OR COALESCE(category, '') ILIKE ${pattern})
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 5
    `),
    safeRows("goals", sql`
      SELECT id, title, COALESCE(description, category, status) as subtitle, '/goals' as href, updated_at, created_at
      FROM goals
      WHERE user_id = ${user.id}
      AND (title ILIKE ${pattern} OR COALESCE(description, '') ILIKE ${pattern} OR COALESCE(category, '') ILIKE ${pattern})
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 5
    `),
    safeRows("notes", sql`
      SELECT notes.id, notes.title, notes.content as subtitle, '/notes' as href, notes.updated_at, notes.created_at
      FROM notes
      LEFT JOIN note_folders
        ON notes.folder_id = note_folders.id
        AND note_folders.user_id = ${user.id}
      WHERE notes.user_id = ${user.id}
      AND (
        notes.title ILIKE ${pattern}
        OR COALESCE(notes.content, '') ILIKE ${pattern}
        OR COALESCE(note_folders.name, '') ILIKE ${pattern}
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(notes.tags, ARRAY[]::text[])) AS tag
          WHERE tag ILIKE ${pattern}
        )
      )
      ORDER BY notes.updated_at DESC, notes.created_at DESC
      LIMIT 5
    `),
    safeRows("projects", sql`
      SELECT
        projects.id,
        projects.title,
        COALESCE(projects.description, life_areas.name, projects.status) as subtitle,
        '/projects/' || projects.id::text as href,
        projects.updated_at,
        projects.created_at
      FROM projects
      LEFT JOIN life_areas
        ON projects.life_area_id = life_areas.id
        AND life_areas.user_id = ${user.id}
      WHERE projects.user_id = ${user.id}
      AND (
        projects.title ILIKE ${pattern}
        OR COALESCE(projects.description, '') ILIKE ${pattern}
        OR COALESCE(projects.status, '') ILIKE ${pattern}
        OR COALESCE(projects.priority, '') ILIKE ${pattern}
        OR COALESCE(life_areas.name, '') ILIKE ${pattern}
      )
      ORDER BY projects.updated_at DESC, projects.created_at DESC
      LIMIT 5
    `),
    safeRows("people", sql`
      SELECT id, name as title,
        COALESCE(relationship_type, 'other') || CASE WHEN email IS NOT NULL THEN ' · ' || email ELSE '' END as subtitle,
        '/people' as href, updated_at, created_at
      FROM people
      WHERE user_id = ${user.id}
      AND (
        name ILIKE ${pattern}
        OR COALESCE(email, '') ILIKE ${pattern}
        OR COALESCE(phone, '') ILIKE ${pattern}
        OR COALESCE(location, '') ILIKE ${pattern}
        OR COALESCE(notes, '') ILIKE ${pattern}
        OR relationship_type ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(tags, ARRAY[]::text[])) AS tag
          WHERE tag ILIKE ${pattern}
        )
      )
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 5
    `),
    safeRows("vault", sql`
      SELECT id, title,
        COALESCE(description, category) as subtitle,
        '/vault' as href, updated_at, created_at
      FROM vault_items
      WHERE user_id = ${user.id}
      AND (
        title ILIKE ${pattern}
        OR COALESCE(description, '') ILIKE ${pattern}
        OR COALESCE(notes, '') ILIKE ${pattern}
        OR category ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(tags, ARRAY[]::text[])) AS tag
          WHERE tag ILIKE ${pattern}
        )
      )
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 5
    `),
    safeRows("links", sql`
      SELECT id, title, COALESCE(description, url) as subtitle, '/links' as href, updated_at, created_at
      FROM user_links
      WHERE user_id = ${user.id}
      AND (title ILIKE ${pattern} OR COALESCE(url, '') ILIKE ${pattern} OR COALESCE(description, '') ILIKE ${pattern})
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 5
    `),
    safeRows("wishlist", sql`
      SELECT id, title, COALESCE(description, category, url) as subtitle, '/wishlist' as href, updated_at, created_at
      FROM wishlist_items
      WHERE user_id = ${user.id}
      AND (title ILIKE ${pattern} OR COALESCE(description, '') ILIKE ${pattern} OR COALESCE(category, '') ILIKE ${pattern} OR COALESCE(url, '') ILIKE ${pattern})
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 5
    `),
    safeRows("investments", sql`
      SELECT id, name as title, COALESCE(symbol, type, notes) as subtitle, '/investments' as href, updated_at, created_at
      FROM investments
      WHERE user_id = ${user.id}
      AND (name ILIKE ${pattern} OR COALESCE(type, '') ILIKE ${pattern} OR COALESCE(symbol, '') ILIKE ${pattern} OR COALESCE(notes, '') ILIKE ${pattern})
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 5
    `),
    safeRows("income", sql`
      SELECT id, source_name as title, COALESCE(category, frequency) as subtitle, '/income' as href, updated_at, created_at
      FROM income_sources
      WHERE user_id = ${user.id}
      AND (source_name ILIKE ${pattern} OR COALESCE(category, '') ILIKE ${pattern} OR COALESCE(frequency, '') ILIKE ${pattern})
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 5
    `),
    safeRows("budget transactions", sql`
      SELECT ('transaction-' || id)::text as id, COALESCE(description, type) as title, type || ' · $' || amount::text as subtitle, '/budget' as href, updated_at, created_at
      FROM budget_transactions
      WHERE user_id = ${user.id}
      AND (COALESCE(description, '') ILIKE ${pattern} OR COALESCE(type, '') ILIKE ${pattern})
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 3
    `),
    safeRows("budget categories", sql`
      SELECT ('category-' || id)::text as id, name as title, 'Budget category' as subtitle, '/budget' as href, created_at as updated_at, created_at
      FROM budget_categories
      WHERE user_id = ${user.id}
      AND name ILIKE ${pattern}
      ORDER BY created_at DESC
      LIMIT 3
    `),
    safeRows("budget goals", sql`
      SELECT ('goal-' || id)::text as id, name as title, 'Budget goal · $' || target_amount::text as subtitle, '/budget' as href, created_at as updated_at, created_at
      FROM budget_goals
      WHERE user_id = ${user.id}
      AND name ILIKE ${pattern}
      ORDER BY created_at DESC
      LIMIT 3
    `),
  ])

  const budget = [...budgetTransactions, ...budgetCategories, ...budgetGoals].slice(0, 5)

  const groups = emptyGroups().map((group) => {
    const rowsByType: Record<SearchType, SearchRow[]> = {
      inbox,
      someday,
      waiting,
      commitments,
      maintenance,
      timeline,
      tasks,
      goals,
      notes,
      projects,
      people,
      vault,
      links,
      wishlist,
      investments,
      income,
      budget,
    }

    return {
      ...group,
      results: normalizeRows(group.type, rowsByType[group.type]),
    }
  })

  return NextResponse.json({ query, groups })
}
