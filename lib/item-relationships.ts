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

export const itemRelationshipCreateSchema = z.object({
  from_type: z.enum(itemRelationshipTypes),
  from_id: z.string().min(1).max(255),
  to_type: z.enum(itemRelationshipTypes),
  to_id: z.string().min(1).max(255),
  relation: z.enum(relationTypes),
})
