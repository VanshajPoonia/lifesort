import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { hashPassword } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    // Find the token
    const tokens = await sql`
      SELECT * FROM password_reset_tokens 
      WHERE token = ${token} 
      AND used = false 
      AND expires_at > NOW()
    `

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired reset link. Please request a new one." },
        { status: 400 }
      )
    }

    const resetToken = tokens[0]

    // Hash the new password
    const passwordHash = await hashPassword(password)

    // Update the user's password
    await sql`
      UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE id = ${resetToken.user_id}
    `

    // Mark the token as used
    await sql`
      UPDATE password_reset_tokens SET used = true WHERE id = ${resetToken.id}
    `

    // Invalidate all existing sessions for security
    await sql`
      DELETE FROM sessions WHERE user_id = ${resetToken.user_id}
    `

    return NextResponse.json({ 
      message: "Password has been reset successfully. You can now log in with your new password." 
    })
  } catch (error) {
    console.error("Reset password error:", error)
    return NextResponse.json(
      { error: "Failed to reset password" },
      { status: 500 }
    )
  }
}

// GET to validate token
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ valid: false, error: "No token provided" })
    }

    const tokens = await sql`
      SELECT * FROM password_reset_tokens 
      WHERE token = ${token} 
      AND used = false 
      AND expires_at > NOW()
    `

    return NextResponse.json({ valid: tokens.length > 0 })
  } catch (error) {
    console.error("Token validation error:", error)
    return NextResponse.json({ valid: false, error: "Validation failed" })
  }
}
