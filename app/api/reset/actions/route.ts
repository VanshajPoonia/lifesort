import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { applyResetAction, type ResetActionInput } from "@/lib/reset"

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const actions = Array.isArray(body.actions) ? body.actions.slice(0, 100) as ResetActionInput[] : []
    if (actions.length === 0) {
      return NextResponse.json({ error: "At least one action is required" }, { status: 400 })
    }

    const results = []
    for (const action of actions) {
      try {
        const result = await applyResetAction(user.id, action)
        results.push({ ...action, ...result })
      } catch (error) {
        results.push({
          ...action,
          ok: false,
          error: error instanceof Error ? error.message : "Action failed",
        })
      }
    }

    const applied = results.filter((result) => result.ok).length
    return NextResponse.json({
      applied,
      failed: results.length - applied,
      results,
    })
  } catch (error) {
    console.error("[reset/actions] POST error:", error)
    return NextResponse.json({ error: "Failed to apply reset actions" }, { status: 500 })
  }
}
