import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"
import crypto from "crypto"

const sql = neon(process.env.DATABASE_URL!)

// Get shared content (public access)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  const type = searchParams.get("type") // 'folder' or 'link'

  if (!token) {
    return NextResponse.json({ error: "Share token required" }, { status: 400 })
  }

  try {
    if (type === "folder") {
      const folder = await sql`
        SELECT lf.*, u.name as owner_name 
        FROM link_folders lf
        JOIN users u ON lf.user_id = u.id
        WHERE lf.share_token = ${token} AND lf.is_public = true
      `
      
      if (folder.length === 0) {
        return NextResponse.json({ error: "Folder not found or not shared" }, { status: 404 })
      }

      // Get links in this folder
      const links = await sql`
        SELECT * FROM user_links 
        WHERE folder_id = ${folder[0].id.toString()} 
        AND user_id = ${folder[0].user_id}
        ORDER BY created_at DESC
      `

      // Get subfolders
      const subfolders = await sql`
        SELECT * FROM link_folders
        WHERE parent_id = ${folder[0].id} AND user_id = ${folder[0].user_id}
        ORDER BY name ASC
      `

      return NextResponse.json({
        folder: folder[0],
        links,
        subfolders,
        permission: folder[0].share_permission,
      })
    } else {
      // Single link/image
      const link = await sql`
        SELECT ul.*, u.name as owner_name 
        FROM user_links ul
        JOIN users u ON ul.user_id = u.id
        WHERE ul.share_token = ${token} AND ul.is_public = true
      `

      if (link.length === 0) {
        return NextResponse.json({ error: "Link not found or not shared" }, { status: 404 })
      }

      return NextResponse.json({
        link: link[0],
        permission: link[0].share_permission,
      })
    }
  } catch (error) {
    console.error("[v0] Error fetching shared content:", error)
    return NextResponse.json({ error: "Failed to fetch shared content" }, { status: 500 })
  }
}

// Update sharing settings
export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, type, is_public, share_permission } = await request.json()

    // Generate share token if making public
    const shareToken = is_public ? crypto.randomBytes(16).toString("hex") : null

    if (type === "folder") {
      const result = await sql`
        UPDATE link_folders 
        SET 
          is_public = ${is_public},
          share_token = ${shareToken},
          share_permission = ${share_permission || 'view'},
          updated_at = NOW()
        WHERE id = ${id} AND user_id = ${user.id}
        RETURNING *
      `
      return NextResponse.json(result[0])
    } else {
      const result = await sql`
        UPDATE user_links 
        SET 
          is_public = ${is_public},
          share_token = ${shareToken},
          share_permission = ${share_permission || 'view'},
          updated_at = NOW()
        WHERE id = ${id} AND user_id = ${user.id}
        RETURNING *
      `
      return NextResponse.json(result[0])
    }
  } catch (error) {
    console.error("[v0] Error updating share settings:", error)
    return NextResponse.json({ error: "Failed to update share settings" }, { status: 500 })
  }
}
