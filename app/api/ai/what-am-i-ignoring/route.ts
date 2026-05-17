import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { NextResponse } from "next/server"

import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import { getUserFromSession } from "@/lib/auth"
import { getIgnoringInsightsData, type IgnoringInsightsData } from "@/lib/ignoring-insights"
import { getPersonalRulesContext } from "@/lib/personal-rules"

const IGNORING_MODEL = "google/gemini-2.0-flash-exp:free"

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  headers: {
    "HTTP-Referer": "https://lifesort.app",
    "X-Title": "LifeSort",
  },
})

type AiIgnoringResult = {
  summary: string
  ignored_items: Array<{ title: string; why_it_may_matter: string; evidence: string }>
  hidden_risks: Array<{ title: string; why_it_matters: string; severity: "low" | "medium" | "high" }>
  suggested_actions: Array<{
    title: string
    description: string
    priority: "low" | "medium" | "high"
    life_area_id: string | null
    life_area_name: string | null
  }>
}

function safeText(value: unknown, max = 320) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function priority(value: unknown): "low" | "medium" | "high" {
  return value === "low" || value === "high" || value === "medium" ? value : "medium"
}

function buildPrompt(data: IgnoringInsightsData, rulesContextPreview: string) {
  const payload = {
    summary: data.summary,
    unavailable: data.unavailable,
    visible_personal_operating_rules: rulesContextPreview,
    signals: data.signals.slice(0, 50).map((signal) => ({
      id: signal.id,
      source: signal.source,
      title: signal.title,
      description: signal.description,
      evidence: signal.evidence,
      severity: signal.severity,
      date: signal.date,
      days_inactive: signal.days_inactive,
      life_area_id: signal.life_area_id,
      life_area_name: signal.life_area_name,
    })),
  }

  return `You are a careful LifeSort planning assistant helping a user notice what they may be ignoring.

Privacy and safety rules:
- Read-only analysis only. Do not claim anything was created, changed, scheduled, archived, or completed.
- Use only the provided signals. Do not invent records, hidden facts, or diagnoses.
- Use "may", "could", and practical language for risks.
- Respect the visible personal operating rules in the input.
- Suggested actions must be tiny tasks the user can confirm later.

Return ONLY valid JSON. No markdown, no code fences:
{
  "summary": "2 concise sentences",
  "ignored_items": [
    { "title": "specific ignored item or area", "why_it_may_matter": "one sentence", "evidence": "specific evidence from input" }
  ],
  "hidden_risks": [
    { "title": "short risk label", "why_it_matters": "one sentence", "severity": "low|medium|high" }
  ],
  "suggested_actions": [
    { "title": "task title", "description": "one sentence", "priority": "low|medium|high", "life_area_id": "exact id or null", "life_area_name": "exact name or null" }
  ]
}

Rules:
- ignored_items: 1-6 items unless there are no signals.
- hidden_risks: 0-5 items.
- suggested_actions: 1-6 small actions unless there are no signals.
- Use life_area_id only when it exactly matches an input signal. Otherwise use null.
- If there are no signals, return a reassuring summary and empty arrays.

Input:
${JSON.stringify(payload)}`
}

function parseResult(text: string, data: IgnoringInsightsData): AiIgnoringResult | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.ignored_items) ||
      !Array.isArray(parsed.hidden_risks) ||
      !Array.isArray(parsed.suggested_actions)
    ) {
      return null
    }

    const areaById = new Map(data.signals.filter((signal) => signal.life_area_id).map((signal) => [signal.life_area_id, signal]))
    const areaByName = new Map(data.signals.filter((signal) => signal.life_area_name).map((signal) => [signal.life_area_name!.toLowerCase(), signal]))

    return {
      summary: safeText(parsed.summary, 700) || "Your ignored-life signals are ready to review.",
      ignored_items: parsed.ignored_items.slice(0, 6).flatMap((item) => {
        const obj = typeof item === "object" && item !== null ? item as Record<string, unknown> : {}
        const title = safeText(obj.title, 180)
        if (!title) return []
        return [{
          title,
          why_it_may_matter: safeText(obj.why_it_may_matter, 360) || "This may deserve a quick review.",
          evidence: safeText(obj.evidence, 240) || "Flagged by LifeSort signals.",
        }]
      }),
      hidden_risks: parsed.hidden_risks.slice(0, 5).flatMap((item) => {
        const obj = typeof item === "object" && item !== null ? item as Record<string, unknown> : {}
        const title = safeText(obj.title, 160)
        if (!title) return []
        return [{
          title,
          why_it_matters: safeText(obj.why_it_matters, 360) || "This could become harder if ignored.",
          severity: priority(obj.severity),
        }]
      }),
      suggested_actions: parsed.suggested_actions.slice(0, 6).flatMap((item) => {
        const obj = typeof item === "object" && item !== null ? item as Record<string, unknown> : {}
        const title = safeText(obj.title, 180)
        if (!title) return []
        const rawId = safeText(obj.life_area_id, 40) || null
        const rawName = safeText(obj.life_area_name, 100) || null
        const matched = (rawId && areaById.get(rawId)) || (rawName && areaByName.get(rawName.toLowerCase())) || null
        return [{
          title,
          description: safeText(obj.description, 500) || "Take one small step to review this area.",
          priority: priority(obj.priority),
          life_area_id: matched?.life_area_id ?? null,
          life_area_name: matched?.life_area_name ?? rawName,
        }]
      }),
    }
  } catch {
    return null
  }
}

export async function GET() {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const insights = await getIgnoringInsightsData(user.id)
  return NextResponse.json({ insights })
}

export async function POST() {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "AI features are not configured" }, { status: 503 })
  }

  const limit = await checkAiUsageLimit(user.id, "ignoring_insights")
  if (!limit.allowed) {
    await createAiUsageEvent({
      userId: user.id,
      route: "ignoring_insights",
      provider: "openrouter",
      model: IGNORING_MODEL,
      status: "rate_limited",
    })
    return NextResponse.json(
      { error: "Daily ignored-life insight limit reached", limit: limit.limit, used: limit.used, remaining: 0 },
      { status: 429 },
    )
  }

  const insights = await getIgnoringInsightsData(user.id)
  const usageEventId = await createAiUsageEvent({
    userId: user.id,
    route: "ignoring_insights",
    provider: "openrouter",
    model: IGNORING_MODEL,
  })

  try {
    const rulesContext = await getPersonalRulesContext(user.id)
    const { text } = await generateText({
      model: openrouter(IGNORING_MODEL),
      prompt: buildPrompt(insights, rulesContext.preview),
      temperature: 0.25,
    })

    const analysis = parseResult(text, insights)
    if (!analysis) {
      await updateAiUsageEvent(usageEventId, "provider_error", "Failed to parse ignored-life insight response")
      return NextResponse.json({ error: "The AI returned an unexpected format. Please try again." }, { status: 502 })
    }

    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json({ analysis, insights, remaining: Math.max(0, limit.remaining - 1) })
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Provider request failed",
    )
    return NextResponse.json({ error: "Failed to analyze ignored-life signals" }, { status: 502 })
  }
}
