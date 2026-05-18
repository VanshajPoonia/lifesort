import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { NextResponse } from "next/server"

import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import { getUserFromSession } from "@/lib/auth"
import { getLifeScoreData, type LifeScoreData } from "@/lib/life-score"

const LIFE_SCORE_MODEL = "google/gemini-2.0-flash-exp:free"

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  headers: {
    "HTTP-Referer": "https://lifesort.app",
    "X-Title": "LifeSort",
  },
})

type LifeScoreAiExplanation = {
  summary: string
  what_helped: string[]
  gentle_watchouts: string[]
  next_small_steps: string[]
}

function safeText(value: unknown, max = 420) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function safeTextList(value: unknown, limit: number) {
  return Array.isArray(value)
    ? value.slice(0, limit).flatMap((item) => {
        const text = safeText(item, 240)
        return text ? [text] : []
      })
    : []
}

function buildPrompt(data: LifeScoreData) {
  const payload = {
    score: data.score,
    label: data.label,
    change: data.change,
    reasons: data.reasons,
    top_improvements: data.top_improvements,
    unavailable: data.unavailable,
    components: data.components.map((component) => ({
      key: component.key,
      label: component.label,
      score: component.score,
      status: component.status,
      explanation: component.explanation,
    })),
    history: data.history.slice(-7),
  }

  return `You are explaining a LifeSort LifeScore to the logged-in user.

Rules:
- Read-only explanation only. Do not claim that you changed tasks, goals, habits, or any records.
- Use practical, calm, non-shaming language.
- Avoid diagnosis, health claims, moral judgment, and gimmicky praise.
- Use only the provided LifeScore data. Do not invent records or private details.
- Be concise.

Return ONLY valid JSON with this shape:
{
  "summary": "2 concise sentences explaining the score",
  "what_helped": ["1-3 calm bullets"],
  "gentle_watchouts": ["0-3 practical bullets"],
  "next_small_steps": ["1-3 small actions"]
}

Input:
${JSON.stringify(payload)}`
}

function parseExplanation(text: string): LifeScoreAiExplanation | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const summary = safeText(parsed.summary, 700)
    if (!summary) return null

    return {
      summary,
      what_helped: safeTextList(parsed.what_helped, 3),
      gentle_watchouts: safeTextList(parsed.gentle_watchouts, 3),
      next_small_steps: safeTextList(parsed.next_small_steps, 3),
    }
  } catch {
    return null
  }
}

export async function POST() {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let lifeScore: LifeScoreData
  try {
    lifeScore = await getLifeScoreData(user.id)
  } catch {
    return NextResponse.json({ error: "LifeScore is unavailable right now" }, { status: 500 })
  }
  if (!lifeScore.ready) {
    return NextResponse.json(
      { error: "LifeScore will be explainable after you add some LifeSort data.", life_score: lifeScore },
      { status: 400 },
    )
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "AI features are not configured" }, { status: 503 })
  }

  const limit = await checkAiUsageLimit(user.id, "life_score_explanation")
  if (!limit.allowed) {
    await createAiUsageEvent({
      userId: user.id,
      route: "life_score_explanation",
      provider: "openrouter",
      model: LIFE_SCORE_MODEL,
      status: "rate_limited",
    })
    return NextResponse.json(
      { error: "Daily LifeScore explanation limit reached", limit: limit.limit, used: limit.used, remaining: 0 },
      { status: 429 },
    )
  }

  const usageEventId = await createAiUsageEvent({
    userId: user.id,
    route: "life_score_explanation",
    provider: "openrouter",
    model: LIFE_SCORE_MODEL,
  })

  try {
    const { text } = await generateText({
      model: openrouter(LIFE_SCORE_MODEL),
      prompt: buildPrompt(lifeScore),
      temperature: 0.25,
    })
    const explanation = parseExplanation(text)

    if (!explanation) {
      await updateAiUsageEvent(usageEventId, "provider_error", "Failed to parse LifeScore explanation response")
      return NextResponse.json({ error: "The AI returned an unexpected format. Please try again." }, { status: 502 })
    }

    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json({ explanation, life_score: lifeScore, remaining: Math.max(0, limit.remaining - 1) })
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Provider request failed",
    )
    return NextResponse.json({ error: "Failed to explain LifeScore" }, { status: 502 })
  }
}
