import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)
const DAILY_REFRESH_LIMIT = 2

// Helper function to get user
async function getUser() {
  const sessionUser = await getUserFromSession()
  if (!sessionUser) {
    return null
  }

  const users = await sql`
    SELECT id, last_refresh_date, refresh_count_today 
    FROM users 
    WHERE id = ${sessionUser.id}
  `
  return users[0] || null
}

// GET - Check refresh status
export async function GET() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date().toISOString().split("T")[0]
  const lastRefreshDate = user.last_refresh_date ? new Date(user.last_refresh_date).toISOString().split("T")[0] : null

  // Reset count if it's a new day
  let refreshCount = user.refresh_count_today || 0
  if (lastRefreshDate !== today) {
    refreshCount = 0
  }

  return NextResponse.json({
    refreshesUsed: refreshCount,
    refreshesRemaining: Math.max(0, DAILY_REFRESH_LIMIT - refreshCount),
    limit: DAILY_REFRESH_LIMIT,
    canRefresh: refreshCount < DAILY_REFRESH_LIMIT
  })
}

// POST - Use a refresh
export async function POST() {
  const user = await getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = new Date().toISOString().split("T")[0]
  const lastRefreshDate = user.last_refresh_date ? new Date(user.last_refresh_date).toISOString().split("T")[0] : null

  // Reset count if it's a new day
  let currentCount = user.refresh_count_today || 0
  if (lastRefreshDate !== today) {
    currentCount = 0
  }

  // Check if limit reached
  if (currentCount >= DAILY_REFRESH_LIMIT) {
    return NextResponse.json({ 
      error: "Daily refresh limit reached", 
      refreshesRemaining: 0,
      canRefresh: false 
    }, { status: 429 })
  }

  // Increment refresh count
  const newCount = currentCount + 1
  await sql`
    UPDATE users 
    SET refresh_count_today = ${newCount}, last_refresh_date = ${today}
    WHERE id = ${user.id}
  `

  return NextResponse.json({
    refreshesUsed: newCount,
    refreshesRemaining: Math.max(0, DAILY_REFRESH_LIMIT - newCount),
    limit: DAILY_REFRESH_LIMIT,
    canRefresh: newCount < DAILY_REFRESH_LIMIT
  })
}
