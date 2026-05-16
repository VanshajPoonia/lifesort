import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"

type SearchType =
  | "tasks"
  | "goals"
  | "notes"
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
  tasks: "Tasks",
  goals: "Goals",
  notes: "Notes",
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
    tasks,
    goals,
    notes,
    links,
    wishlist,
    investments,
    income,
    budgetTransactions,
    budgetCategories,
    budgetGoals,
  ] = await Promise.all([
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
      tasks,
      goals,
      notes,
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
