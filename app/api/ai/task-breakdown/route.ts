import { generateText, Output } from "ai"
import { NextResponse } from "next/server"

import { gemini, GEMINI_FLASH_MODEL } from "@/lib/ai-provider"
import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import { sql } from "@/lib/db"
import { breakdownSchema, buildBreakdownPrompt, totalMinutes } from "@/lib/task-breakdown"

const noStore = { "Cache-Control": "no-store" }

// Gemini replies took 40 to 105 seconds in earlier tests.
export const maxDuration = 60

// POST /api/ai/task-breakdown { task_id }: suggested steps with minutes. Nothing is
// saved here; the checklist adds the steps the person keeps.
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore })
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI isn't set up on this server yet." }, { status: 503, headers: noStore })
  }

  const body = await request.json().catch(() => null)
  const taskId = Number(body?.task_id)
  if (!Number.isInteger(taskId) || taskId <= 0) {
    return NextResponse.json({ error: "Send a task id." }, { status: 400, headers: noStore })
  }

  const rows = await sql`
    SELECT t.title, t.description, COALESCE(la.is_ai_excluded, FALSE) AS excluded
    FROM tasks t LEFT JOIN life_areas la ON la.id = t.life_area_id
    WHERE t.id = ${taskId} AND t.user_id = ${user.id}
  `
  const task = rows[0]
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404, headers: noStore })
  if (task.excluded) {
    return NextResponse.json({ error: "This task's domain is kept away from AI." }, { status: 403, headers: noStore })
  }
  const existing = await sql`
    SELECT title FROM task_checklist_items WHERE task_id = ${taskId} ORDER BY sort_order ASC, id ASC LIMIT 20
  `

  const limit = await checkAiUsageLimit(user.id, "task_breakdown")
  if (!limit.allowed) {
    await createAiUsageEvent({ userId: user.id, route: "task_breakdown", provider: "gemini", model: GEMINI_FLASH_MODEL, status: "rate_limited" })
    return NextResponse.json({ error: "That's today's 10 breakdowns. Try again tomorrow." }, { status: 429, headers: noStore })
  }

  const usageEventId = await createAiUsageEvent({ userId: user.id, route: "task_breakdown", provider: "gemini", model: GEMINI_FLASH_MODEL })
  try {
    const result = await generateText({
      model: gemini(GEMINI_FLASH_MODEL),
      output: Output.object({ schema: breakdownSchema }),
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
      prompt: buildBreakdownPrompt(
        { title: String(task.title), description: task.description ? String(task.description) : null },
        existing.map((row) => String(row.title)),
      ),
    })
    const { steps } = breakdownSchema.parse(result.output)
    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json({ steps, total_minutes: totalMinutes(steps), remaining: Math.max(0, limit.remaining - 1) }, { headers: noStore })
  } catch (error) {
    await updateAiUsageEvent(usageEventId, "provider_error", error instanceof Error ? error.message : "Task breakdown failed")
    return NextResponse.json({ error: "Couldn't break that down right now. Try again in a moment." }, { status: 502, headers: noStore })
  }
}
