import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await sql`
      SELECT id, name, email, avatar, bio, phone, location, date_of_birth, subscription_tier, subscription_end_date, created_at
      FROM users WHERE id = ${user.id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get content preferences
    const prefs = await sql`
      SELECT * FROM user_content_preferences WHERE user_id = ${user.id}
    `

    return NextResponse.json({ 
      ...result[0],
      content_preferences: prefs[0] || null
    })
  } catch (error) {
    console.error("[v0] Get profile error:", error)
    return NextResponse.json({ error: "Failed to get profile" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, avatar, bio, phone, location, date_of_birth } = body

    const result = await sql`
      UPDATE users SET
        name = COALESCE(${name}, name),
        avatar = COALESCE(${avatar}, avatar),
        bio = COALESCE(${bio}, bio),
        phone = COALESCE(${phone}, phone),
        location = COALESCE(${location}, location),
        date_of_birth = COALESCE(${date_of_birth}, date_of_birth)
      WHERE id = ${user.id}
      RETURNING id, name, email, avatar, bio, phone, location, date_of_birth, subscription_tier, created_at
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[v0] Update profile error:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
