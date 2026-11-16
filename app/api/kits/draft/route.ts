import { generateText, Output } from "ai"
import { NextResponse } from "next/server"

import { gemini, GEMINI_FLASH_MODEL } from "@/lib/ai-provider"
import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import { buildKitDraftPrompt, isPlausibleToday, kitDescriptionSchema, kitDraftSchema } from "@/lib/life-kit-input"

const noStore = { "Cache-Control": "no-store" }

// Drafts took 40 to 95 seconds in testing, mostly waiting on the API.
export const maxDuration = 60

// POST /api/kits/draft { description, today }: the AI drafts a kit. Nothing is saved;
// the person reviews the draft in the picker and starts it like any other kit.
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore })
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI isn't set up on this server yet." }, { status: 503, headers: noStore })
  }

  const parsed = kitDescriptionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !isPlausibleToday(parsed.data.today)) {
    return NextResponse.json({ error: parsed.error?.issues[0]?.message ?? "Your device date looks wrong." }, { status: 400, headers: noStore })
  }

  const limit = await checkAiUsageLimit(user.id, "kit_draft")
  if (!limit.allowed) {
    await createAiUsageEvent({ userId: user.id, route: "kit_draft", provider: "gemini", model: GEMINI_FLASH_MODEL, status: "rate_limited" })
    return NextResponse.json({ error: "That's today's 5 kit drafts. Pick a ready-made kit, or try again tomorrow." }, { status: 429, headers: noStore })
  }

  const usageEventId = await createAiUsageEvent({ userId: user.id, route: "kit_draft", provider: "gemini", model: GEMINI_FLASH_MODEL })
  try {
    const result = await generateText({
      model: gemini(GEMINI_FLASH_MODEL),
      output: Output.object({ schema: kitDraftSchema }),
      // Minimal thinking roughly halved the wait with no visible loss in quality.
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
      prompt: buildKitDraftPrompt(parsed.data.description, parsed.data.today),
    })
    const draft = kitDraftSchema.parse(result.output)
    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json({ draft, remaining: Math.max(0, limit.remaining - 1) }, { headers: noStore })
  } catch (error) {
    await updateAiUsageEvent(usageEventId, "provider_error", error instanceof Error ? error.message : "Kit draft failed")
    return NextResponse.json({ error: "Couldn't draft a kit. Try describing it a little differently." }, { status: 502, headers: noStore })
  }
}
