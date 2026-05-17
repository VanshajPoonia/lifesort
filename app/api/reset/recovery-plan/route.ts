import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { sql } from "@/lib/db"
import { applyResetAction, cleanDate, localDateString, toFocusItem, type ResetActionInput, type ResetItem } from "@/lib/reset"

type FocusInput = Pick<ResetItem, "id" | "type" | "title" | "href">

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const planDate = cleanDate(body.plan_date) || localDateString()
    const deferDate = cleanDate(body.defer_date) || localDateString(7)
    const focusItems = Array.isArray(body.focus_items) ? (body.focus_items as FocusInput[]).slice(0, 3) : []
    const deferItems = Array.isArray(body.defer_items) ? (body.defer_items as FocusInput[]).slice(0, 100) : []

    if (focusItems.length < 1 || focusItems.length > 3) {
      return NextResponse.json({ error: "Choose 1-3 focus items" }, { status: 400 })
    }

    const normalizedFocus = focusItems
      .filter((item) => item?.id && item?.type && item?.title)
      .map(toFocusItem)
      .slice(0, 3)

    if (normalizedFocus.length === 0) {
      return NextResponse.json({ error: "Choose at least one valid focus item" }, { status: 400 })
    }

    const planRows = await sql`
      INSERT INTO daily_plans (
        user_id,
        plan_date,
        focus_items,
        reflection_went_well,
        reflection_did_not_go_well,
        reflection_improve_tomorrow
      )
      VALUES (${user.id}, ${planDate}, ${JSON.stringify(normalizedFocus)}::jsonb, NULL, NULL, NULL)
      ON CONFLICT (user_id, plan_date)
      DO UPDATE SET
        focus_items = EXCLUDED.focus_items,
        updated_at = NOW()
      RETURNING id, plan_date, focus_items
    `

    const deferResults = []
    const focusKeys = new Set(focusItems.map((item) => `${item.type}:${item.id}`))
    for (const item of deferItems) {
      if (!item?.id || !item?.type || focusKeys.has(`${item.type}:${item.id}`)) continue
      const action: ResetActionInput = {
        item_type: item.type,
        id: item.id,
        action: "reschedule",
        date: deferDate,
      }
      const result = await applyResetAction(user.id, action)
      if (!result.ok && result.error === "Action is not supported for this item") {
        deferResults.push({ item_type: item.type, id: item.id, ...(await applyResetAction(user.id, {
          item_type: item.type,
          id: item.id,
          action: "move_someday",
        })) })
      } else {
        deferResults.push({ item_type: item.type, id: item.id, ...result })
      }
    }

    return NextResponse.json({
      plan: planRows[0],
      deferred: deferResults.filter((result) => result.ok).length,
      failed: deferResults.filter((result) => !result.ok).length,
      results: deferResults,
    })
  } catch (error) {
    console.error("[reset/recovery-plan] POST error:", error)
    return NextResponse.json({ error: "Failed to create recovery plan" }, { status: 500 })
  }
}
