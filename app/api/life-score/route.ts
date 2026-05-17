import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { getLifeScoreData } from "@/lib/life-score"

export async function GET() {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const lifeScore = await getLifeScoreData(user.id)
    return NextResponse.json({ life_score: lifeScore })
  } catch (error) {
    console.error("[life-score] GET error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Failed to load LifeScore" }, { status: 500 })
  }
}
