import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { getTimelineData } from "@/lib/timeline"

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const data = await getTimelineData(user.id, {
      search: searchParams.get("search") || "",
      type: searchParams.get("type") || "all",
      lifeAreaId: searchParams.get("life_area_id") || "all",
      startDate: searchParams.get("start_date"),
      endDate: searchParams.get("end_date"),
      limit: Number.parseInt(searchParams.get("limit") || "200", 10) || 200,
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error("[timeline] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 })
  }
}
