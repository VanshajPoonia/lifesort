import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { createDownloadUrl, deleteObject } from "@/lib/r2"

// GET -> a short-lived presigned download URL for this attachment.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const rows = await sql`
      SELECT storage_key, file_name
      FROM attachments
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `
    if (rows.length === 0) return NextResponse.json({ error: "Attachment not found" }, { status: 404 })

    const url = await createDownloadUrl(rows[0].storage_key, rows[0].file_name)
    return NextResponse.json({ url })
  } catch (error) {
    console.error("[attachments/:id] GET failed:", error)
    return NextResponse.json({ error: "Could not load attachment" }, { status: 500 })
  }
}

// DELETE -> removes the R2 object and the metadata row.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const rows = await sql`
      SELECT storage_key
      FROM attachments
      WHERE id = ${id} AND user_id = ${user.id}
      LIMIT 1
    `
    if (rows.length === 0) return NextResponse.json({ error: "Attachment not found" }, { status: 404 })

    await deleteObject(rows[0].storage_key)
    await sql`DELETE FROM attachments WHERE id = ${id} AND user_id = ${user.id}`

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[attachments/:id] DELETE failed:", error)
    return NextResponse.json({ error: "Could not delete attachment" }, { status: 500 })
  }
}
