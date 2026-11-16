import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { isPlausibleToday } from "@/lib/life-kit-input"
import { getPatternFeed } from "@/lib/life-patterns-server"

// GET /api/patterns?today=YYYY-MM-DD: the "What I noticed" feed for Reflect.
export async function GET(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = new URL(request.url).searchParams.get("today") ?? ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !isPlausibleToday(today)) {
    return NextResponse.json({ error: "Send today's date as YYYY-MM-DD" }, { status: 400 })
  }

  try {
    return NextResponse.json(await getPatternFeed(user.id, today))
  } catch (error) {
    console.error("[patterns] GET error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Couldn't look for patterns right now." }, { status: 500 })
  }
}
