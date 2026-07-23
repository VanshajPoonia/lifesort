import { generateText } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"

import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import { getUserFromSession } from "@/lib/auth"

import { gemini } from "@/lib/ai-provider"
const REFINE_MODEL = "gemini-3.5-flash"


const refineActionSchema = z.enum([
  "improve_grammar",
  "rephrase",
  "make_shorter",
  "make_longer",
  "simplify_language",
  "change_tone",
])

const inputSchema = z.object({
  text: z.string().trim().min(1, "Select text to refine.").max(5000, "Selected text must be 5000 characters or fewer."),
  action: refineActionSchema,
  tone: z.string().trim().max(80).optional(),
})

const actionInstructions: Record<z.infer<typeof refineActionSchema>, string> = {
  improve_grammar: "Improve grammar, spelling, punctuation, and clarity while preserving meaning.",
  rephrase: "Rephrase the text with fresh wording while preserving meaning and length.",
  make_shorter: "Make the text shorter and tighter while preserving the key meaning.",
  make_longer: "Expand the text with useful detail while preserving the user's meaning and voice.",
  simplify_language: "Simplify the language so it is easier to understand while preserving meaning.",
  change_tone: "Change the tone as requested while preserving the facts and meaning.",
}

function cleanRefinedText(value: string) {
  return value
    .replace(/^```(?:text)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim()
    .slice(0, 8000)
}

function buildPrompt(input: z.infer<typeof inputSchema>) {
  const toneInstruction =
    input.action === "change_tone" && input.tone
      ? `\nRequested tone: ${input.tone}`
      : ""

  return `You are a writing assistant inside LifeSort Notes and Journal.

Task:
${actionInstructions[input.action]}${toneInstruction}

Rules:
- Return only the refined text.
- Do not include markdown fences, explanations, labels, or alternatives.
- Preserve the user's meaning.
- Do not invent facts, dates, names, promises, or private details.
- Keep line breaks only when they help the writing.

Selected text:
${input.text}`
}

export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "AI writing assistance is not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid refine request" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const limit = await checkAiUsageLimit(user.id, "refine_text")
  if (!limit.allowed) {
    await createAiUsageEvent({
      userId: user.id,
      route: "refine_text",
      provider: "gemini",
      model: REFINE_MODEL,
      status: "rate_limited",
    })
    return NextResponse.json(
      { error: "Daily AI refine limit reached", limit: limit.limit, used: limit.used, remaining: 0 },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    )
  }

  const usageEventId = await createAiUsageEvent({
    userId: user.id,
    route: "refine_text",
    provider: "gemini",
    model: REFINE_MODEL,
  })

  try {
    const { text } = await generateText({
      model: gemini(REFINE_MODEL),
      prompt: buildPrompt(parsed.data),
    })

    const refinedText = cleanRefinedText(text)
    if (!refinedText) {
      await updateAiUsageEvent(usageEventId, "rejected", "Provider returned empty refined text")
      return NextResponse.json(
        { error: "The selected text could not be refined. Try a shorter selection." },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      )
    }

    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json(
      { refined_text: refinedText, remaining: Math.max(0, limit.remaining - 1) },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Provider request failed",
    )
    return NextResponse.json(
      { error: "Failed to refine the selected text." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    )
  }
}
