import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { getResetData } from "@/lib/reset"

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await getResetData(user.id)
    return NextResponse.json(data)
  } catch (error) {
    console.error("[reset] GET error:", error)
    return NextResponse.json({ error: "Failed to load reset dashboard" }, { status: 500 })
  }
}
