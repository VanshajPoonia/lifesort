import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { buildStorageKey, createUploadUrl } from "@/lib/r2"

const ITEM_TYPES = new Set(["task", "goal", "project", "note", "vault_item"])
const MAX_FILE_SIZE = 25 * 1024 * 1024

function cleanItemType(value: unknown): string | null {
  return typeof value === "string" && ITEM_TYPES.has(value) ? value : null
}

function cleanItemId(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

async function itemBelongsToUser(itemType: string, itemId: number, userId: string): Promise<boolean> {
  let rows: unknown[]
  switch (itemType) {
    case "task":
      rows = await sql`SELECT 1 FROM tasks WHERE id = ${itemId} AND user_id = ${userId} LIMIT 1`
      break
    case "goal":
      rows = await sql`SELECT 1 FROM goals WHERE id = ${itemId} AND user_id = ${userId} LIMIT 1`
      break
    case "project":
      rows = await sql`SELECT 1 FROM projects WHERE id = ${itemId} AND user_id = ${userId} LIMIT 1`
      break
    case "note":
      rows = await sql`SELECT 1 FROM notes WHERE id = ${itemId} AND user_id = ${userId} LIMIT 1`
      break
    case "vault_item":
      rows = await sql`SELECT 1 FROM vault_items WHERE id = ${itemId} AND user_id = ${userId} LIMIT 1`
      break
    default:
      return false
  }
  return rows.length > 0
}

// GET ?item_type=task&item_id=123 -> attachment metadata for one item.
export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const itemType = cleanItemType(searchParams.get("item_type"))
    const itemId = cleanItemId(searchParams.get("item_id"))
    if (!itemType || !itemId) {
      return NextResponse.json({ error: "item_type and item_id are required" }, { status: 400 })
    }

    const rows = await sql`
      SELECT id, file_name, file_size, mime_type, created_at
      FROM attachments
      WHERE user_id = ${user.id} AND item_type = ${itemType} AND item_id = ${itemId}
      ORDER BY created_at DESC
    `
    return NextResponse.json(rows)
  } catch (error) {
    console.error("[attachments] GET failed:", error)
    return NextResponse.json({ error: "Could not load attachments" }, { status: 500 })
  }
}

// POST { item_type, item_id, file_name, file_size, mime_type } -> creates the attachment
// row and returns a presigned R2 upload URL. The browser then PUTs the file bytes directly
// to R2 (see components/attachment-list.tsx) -- file contents never pass through this API.
export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const itemType = cleanItemType(body.item_type)
    const itemId = cleanItemId(body.item_id)
    const fileName = typeof body.file_name === "string" ? body.file_name.trim().slice(0, 200) : ""
    const fileSize = Number.parseInt(String(body.file_size), 10)
    const mimeType = typeof body.mime_type === "string" ? body.mime_type.trim().slice(0, 120) : "application/octet-stream"

    if (!itemType || !itemId) {
      return NextResponse.json({ error: "item_type and item_id are required" }, { status: 400 })
    }
    if (!fileName) {
      return NextResponse.json({ error: "file_name is required" }, { status: 400 })
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File must be under ${MAX_FILE_SIZE / (1024 * 1024)}MB` }, { status: 400 })
    }
    if (!(await itemBelongsToUser(itemType, itemId, user.id))) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 })
    }

    const storageKey = buildStorageKey(user.id, itemType, itemId, fileName)
    const rows = await sql`
      INSERT INTO attachments (user_id, item_type, item_id, storage_key, file_name, file_size, mime_type)
      VALUES (${user.id}, ${itemType}, ${itemId}, ${storageKey}, ${fileName}, ${fileSize}, ${mimeType})
      RETURNING id, file_name, file_size, mime_type, created_at
    `
    const uploadUrl = await createUploadUrl(storageKey, mimeType)

    return NextResponse.json({ attachment: rows[0], upload_url: uploadUrl })
  } catch (error) {
    console.error("[attachments] POST failed:", error)
    return NextResponse.json({ error: "Could not create attachment" }, { status: 500 })
  }
}
