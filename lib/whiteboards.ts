import { randomBytes, randomUUID } from "node:crypto"

import { z } from "zod"

import { sql } from "@/lib/db"

export const whiteboardRoles = ["owner", "editor", "viewer"] as const
export const whiteboardVisibilities = ["private", "shared", "public_link"] as const

export type WhiteboardRole = (typeof whiteboardRoles)[number]
export type WhiteboardVisibility = (typeof whiteboardVisibilities)[number]

export type Whiteboard = {
  id: string
  user_id: string
  title: string
  description: string | null
  liveblocks_room_id: string
  visibility: WhiteboardVisibility
  share_token: string | null
  created_at: string
  updated_at: string
  last_opened_at: string | null
  archived_at: string | null
  role: WhiteboardRole
  owner_name?: string | null
  collaborator_count?: number
}

type WhiteboardRow = Record<string, unknown> & {
  id: string
  user_id: string
  title: string
  description: string | null
  liveblocks_room_id: string
  visibility: WhiteboardVisibility
  share_token: string | null
  created_at: string
  updated_at: string
  last_opened_at: string | null
  archived_at: string | null
  role?: WhiteboardRole | null
  owner_name?: string | null
  collaborator_count?: number | string | null
}

export type WhiteboardUser = {
  id: string
  email?: string | null
  name?: string | null
}

export const whiteboardCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120).default("Untitled whiteboard"),
  description: z.string().trim().max(1000).optional().nullable(),
  template: z.enum(["blank", "weekly_plan", "goal_map", "project_brainstorm", "budget_map", "study_board"]).optional(),
})

export const whiteboardPatchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  visibility: z.enum(whiteboardVisibilities).optional(),
})

export const whiteboardShareSchema = z.object({
  visibility: z.enum(["shared", "public_link"]).default("public_link"),
  rotate: z.boolean().optional().default(false),
})

export const whiteboardCollaboratorCreateSchema = z
  .object({
    email: z.string().trim().email().optional(),
    user_id: z.string().trim().min(1).optional(),
    role: z.enum(["editor", "viewer"]).default("viewer"),
  })
  .refine((value) => value.email || value.user_id, "Email or user_id is required")

export const whiteboardCollaboratorPatchSchema = z.object({
  role: z.enum(["editor", "viewer"]),
})

export function makeWhiteboardId() {
  return randomUUID()
}

export function makeWhiteboardRoomId(whiteboardId: string) {
  return `lifesort:whiteboard:${whiteboardId}`
}

export function makeShareToken() {
  return randomBytes(24).toString("hex")
}

export function canEditWhiteboard(role: WhiteboardRole | null | undefined) {
  return role === "owner" || role === "editor"
}

export function canOwnWhiteboard(role: WhiteboardRole | null | undefined) {
  return role === "owner"
}

export function normalizeEmail(email: string | null | undefined) {
  const trimmed = email?.trim().toLowerCase()
  return trimmed || null
}

export function stableUserColor(seed: string) {
  const colors = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626", "#db2777", "#4f46e5"]
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return colors[hash % colors.length]
}

export function mapWhiteboardRow(row: WhiteboardRow): Whiteboard {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    title: String(row.title || "Untitled whiteboard"),
    description: row.description || null,
    liveblocks_room_id: String(row.liveblocks_room_id),
    visibility: row.visibility,
    share_token: row.share_token || null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    last_opened_at: row.last_opened_at ? String(row.last_opened_at) : null,
    archived_at: row.archived_at ? String(row.archived_at) : null,
    role: row.role || "viewer",
    owner_name: row.owner_name || null,
    collaborator_count: Number(row.collaborator_count || 0),
  }
}

export async function getWhiteboardAccess(
  user: WhiteboardUser,
  identifier: { id: string } | { roomId: string } | { token: string },
) {
  const email = normalizeEmail(user.email)
  const rows = await sql`
    SELECT
      w.*,
      owner.name AS owner_name,
      (
        SELECT COUNT(*)::int
        FROM whiteboard_collaborators wc_count
        WHERE wc_count.whiteboard_id = w.id
      ) AS collaborator_count,
      CASE
        WHEN w.user_id = ${user.id} THEN 'owner'
        WHEN wc.role = 'owner' THEN 'owner'
        WHEN wc.role = 'editor' THEN 'editor'
        WHEN wc.role = 'viewer' THEN 'viewer'
        ELSE NULL
      END AS role
    FROM whiteboards w
    LEFT JOIN users owner ON owner.id = w.user_id
    LEFT JOIN whiteboard_collaborators wc
      ON wc.whiteboard_id = w.id
      AND (
        wc.user_id = ${user.id}
        OR (${email}::text IS NOT NULL AND lower(wc.email) = ${email})
      )
    WHERE
      w.archived_at IS NULL
      AND (
        (w.id = ${"id" in identifier ? identifier.id : null})
        OR (w.liveblocks_room_id = ${"roomId" in identifier ? identifier.roomId : null})
        OR (w.share_token = ${"token" in identifier ? identifier.token : null})
      )
      AND (w.user_id = ${user.id} OR wc.id IS NOT NULL)
    ORDER BY
      CASE
        WHEN w.user_id = ${user.id} THEN 0
        WHEN wc.role = 'owner' THEN 1
        WHEN wc.role = 'editor' THEN 2
        ELSE 3
      END
    LIMIT 1
  `

  return rows[0] ? mapWhiteboardRow(rows[0] as WhiteboardRow) : null
}

export async function touchWhiteboardOpened(whiteboardId: string, userId: string) {
  await sql`
    UPDATE whiteboards
    SET last_opened_at = NOW()
    WHERE id = ${whiteboardId}
      AND archived_at IS NULL
      AND (
        user_id = ${userId}
        OR EXISTS (
          SELECT 1
          FROM whiteboard_collaborators wc
          WHERE wc.whiteboard_id = whiteboards.id
            AND wc.user_id = ${userId}
        )
      )
  `
}
