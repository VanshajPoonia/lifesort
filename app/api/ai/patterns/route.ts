import { generateText, Output } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"

import { gemini, GEMINI_FLASH_MODEL } from "@/lib/ai-provider"
import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import { isPlausibleToday } from "@/lib/life-kit-input"
import { getPatternFeed } from "@/lib/life-patterns-server"

const noStore = { "Cache-Control": "no-store" }

// Gemini replies took 40 to 105 seconds in earlier tests.
export const maxDuration = 60

const explanationSchema = z.object({
  summary: z.string().trim().min(1).max(600),
  suggestions: z.array(z.string().trim().min(1).max(200)).max(2),
})

// POST /api/ai/patterns { today }: a short, gentle read of this week's patterns. The
// feed is rebuilt on the server, so only its titles and details reach the AI, and the
// feed already leaves out AI-excluded domains.
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore })
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI isn't set up on this server yet." }, { status: 503, headers: noStore })
  }

  const body = await request.json().catch(() => null)
  const today = typeof body?.today === "string" ? body.today : ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !isPlausibleToday(today)) {
    return NextResponse.json({ error: "Send today's date as YYYY-MM-DD" }, { status: 400, headers: noStore })
  }

  const feed = await getPatternFeed(user.id, today)
  const notes = [...feed.patterns, ...feed.worth_a_look]
  if (notes.length === 0) {
    return NextResponse.json({ error: "There's nothing to explain yet." }, { status: 400, headers: noStore })
  }

  const limit = await checkAiUsageLimit(user.id, "life_patterns")
  if (!limit.allowed) {
    await createAiUsageEvent({ userId: user.id, route: "life_patterns", provider: "gemini", model: GEMINI_FLASH_MODEL, status: "rate_limited" })
    return NextResponse.json({ error: "That's today's 5 explanations. Try again tomorrow." }, { status: 429, headers: noStore })
  }

  const usageEventId = await createAiUsageEvent({ userId: user.id, route: "life_patterns", provider: "gemini", model: GEMINI_FLASH_MODEL })
  try {
    const result = await generateText({
      model: gemini(GEMINI_FLASH_MODEL),
      output: Output.object({ schema: explanationSchema }),
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
      prompt: `These are things a personal planner noticed about someone's last few weeks:
${notes.map((note) => `- ${note.title}. ${note.detail}`).join("\n")}

Write a short, warm read of these for them.
- summary: 2 or 3 sentences in plain words. Say what showed up together, never that one thing caused another.
- suggestions: up to 2 small, optional ideas for this week, each one sentence.
- No guilt, no pressure, no diagnosis, no medical or money advice. Don't invent anything that isn't in the list.`,
    })
    const explanation = explanationSchema.parse(result.output)
    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json({ explanation, remaining: Math.max(0, limit.remaining - 1) }, { headers: noStore })
  } catch (error) {
    await updateAiUsageEvent(usageEventId, "provider_error", error instanceof Error ? error.message : "Patterns explanation failed")
    return NextResponse.json({ error: "Couldn't explain these right now. Try again in a moment." }, { status: 502, headers: noStore })
  }
}
