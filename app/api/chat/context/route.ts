import { NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { getLifeSortCoachContext, normalizeCoachContextMode } from "@/lib/lifesort-coach-context"

export async function GET(request: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const mode = normalizeCoachContextMode(searchParams.get("mode"))
  const context = await getLifeSortCoachContext(user.id, mode)

  return NextResponse.json({ context })
}
