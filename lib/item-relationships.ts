import { z } from "zod"

import { sql } from "@/lib/db"

// Mirrors the CHECK constraints in scripts/migrations/2026-07-24-item-relationships.sql.
// AI_BUILD_PLAN.md Phase 0 / A6: the general backlink/mention/related/dependency graph.
// Existing typed links (project_items, space_items, life_area_id, goal_id,
// converted_type/id, promoted_type/id) stay authoritative for their own domains --
// this table never duplicates or overrides them.
export const itemRelationshipTypes = [
  "task",
  "goal",
  "project",
  "note",
  "life_area",
  "journal_entry",
  "whiteboard",
  "space",
  "person",
  "vault_item",
  "wishlist_item",
  "someday_item",
  "inbox_item",
  "waiting_item",
  "commitment",
  "maintenance_item",
  "custom_section",
] as const

export type ItemRelationshipType = (typeof itemRelationshipTypes)[number]

export const relationTypes = [
  "backlink",
  "mention",
  "related",
  "depends_on",
  "source_of",
  "converted_from",
] as const

export type RelationType = (typeof relationTypes)[number]

export type ItemRelationship = {
  id: string
  user_id: string
  from_type: ItemRelationshipType
  from_id: string
  to_type: ItemRelationshipType
  to_id: string
  relation: RelationType
  created_at: string
}

type MinimalUser = { id: string }

const TABLE_BY_TYPE: Record<ItemRelationshipType, string> = {
  task: "tasks",
  goal: "goals",
  project: "projects",
  note: "notes",
  life_area: "life_areas",
  journal_entry: "daily_journal_entries",
  whiteboard: "whiteboards",
  space: "spaces",
  person: "people",
  vault_item: "vault_items",
  wishlist_item: "wishlist_items",
  someday_item: "someday_items",
  inbox_item: "inbox_items",
  waiting_item: "waiting_items",
  commitment: "commitments",
  maintenance_item: "maintenance_items",
  custom_section: "custom_sections",
}

// Only the 5 types the "Related items" UI can actually create links between
// (AI_BUILD_PLAN.md Phase 1). Other types intentionally have no entry here --
// attachRelationshipLabels() falls back to a null label rather than guess an
// unverified column name for a type nothing writes yet.
const LABEL_COLUMN_BY_TYPE: Partial<Record<ItemRelationshipType, string>> = {
  task: "title",
  goal: "title",
  project: "title",
  note: "title",
  life_area: "name",
}

// Ownership check per linked type, matching the validateSpaceItemAccess pattern in
// lib/spaces.ts. Table names are drawn from a fixed internal map, never interpolated
// from user input, so this stays injection-safe despite the per-type branching.
export async function validateItemOwnership(
  user: MinimalUser,
  itemType: ItemRelationshipType,
  itemId: string,
): Promise<boolean> {
  const table = TABLE_BY_TYPE[itemType]
  if (!table) return false

  const rows = await sql`
    SELECT id FROM ${sql.unsafe(table)}
    WHERE id::text = ${itemId} AND user_id = ${user.id}
    LIMIT 1
  `
  return rows.length > 0
}

type DirectedRow = {
  from_type: ItemRelationshipType
  from_id: string
  to_type: ItemRelationshipType
  to_id: string
  direction: "incoming" | "outgoing"
}

// Resolves a display label for the "other side" of each relationship row (the item
// that isn't the one the caller queried by). One small query per row rather than a
// batched ANY() query per type -- relationship counts per item are small in practice
// (a handful, not hundreds), and this reuses the exact single-id query shape already
// proven safe in validateItemOwnership above instead of introducing a new pattern.
export async function attachRelationshipLabels<T extends DirectedRow>(
  user: MinimalUser,
  rows: T[],
): Promise<(T & { label: string | null })[]> {
  return Promise.all(
    rows.map(async (row) => {
      const otherType = row.direction === "outgoing" ? row.to_type : row.from_type
      const otherId = row.direction === "outgoing" ? row.to_id : row.from_id
      const table = TABLE_BY_TYPE[otherType]
      const column = LABEL_COLUMN_BY_TYPE[otherType]
      if (!table || !column) return { ...row, label: null }

      const labelRows = await sql`
        SELECT ${sql.unsafe(column)} AS label FROM ${sql.unsafe(table)}
        WHERE id::text = ${otherId} AND user_id = ${user.id}
      `
      return { ...row, label: (labelRows[0]?.label as string | undefined) ?? null }
    }),
  )
}

export const itemRelationshipCreateSchema = z.object({
  from_type: z.enum(itemRelationshipTypes),
  from_id: z.string().min(1).max(255),
  to_type: z.enum(itemRelationshipTypes),
  to_id: z.string().min(1).max(255),
  relation: z.enum(relationTypes),
})
