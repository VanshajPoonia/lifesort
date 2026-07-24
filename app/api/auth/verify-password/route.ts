import { NextResponse } from "next/server"
import { neon } from "@/lib/neon-client"

import { getUserFromSession, verifyPassword } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

// Re-verifies the signed-in user's password without a second auth system, for
// requires_reauth-gated surfaces like a private Life Domain (AI_LIFE_DOMAINS_SPEC.md section 15).
export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { password } = await request.json()
    if (typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 })
    }

    const rows = await sql`SELECT password_hash FROM users WHERE id = ${user.id} LIMIT 1`
    const passwordHash = rows[0]?.password_hash
    if (!passwordHash || !(await verifyPassword(password, passwordHash))) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 })
    }

    return NextResponse.json({ verified: true })
  } catch (error) {
    console.error("[auth] verify-password failed:", error)
    return NextResponse.json({ error: "Could not verify password" }, { status: 500 })
  }
}
