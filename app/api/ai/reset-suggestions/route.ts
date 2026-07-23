import { generateText } from "ai"
import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import { getPersonalRulesContext } from "@/lib/personal-rules"
import { getResetData, type ResetActionType, type ResetItem } from "@/lib/reset"

import { gemini } from "@/lib/ai-provider"
const RESET_MODEL = "gemini-3.5-flash"


type ResetSuggestion = {
  item_type: string
  id: string
  title: string
  recommendation: "prioritize" | "defer" | "archive" | "complete"
  action: ResetActionType
  reason: string
}

function buildPrompt(items: ResetItem[], rulesContextPreview: string) {
  const payload = items.slice(0, 80).map((item) => ({
    id: item.id,
    item_type: item.type,
    title: item.title.slice(0, 140),
    subtitle: item.subtitle.slice(0, 120),
    date: item.date,
    status: item.status,
    priority: item.priority,
    reason: item.reason.slice(0, 180),
    allowed_actions: item.actions,
  }))

  return `You are helping a LifeSort user recover from an overwhelming personal system.

Visible Personal Operating Rules and Preferences:
${rulesContextPreview}

Rules:
- Read-only analysis only. Do not claim anything has been changed.
- Recommend only actions listed in allowed_actions.
- Prefer tiny, conservative suggestions.
- Respect the visible personal operating rules and preferences above.
- Do not create, modify, or invent personal rules.
- "prioritize" should use action "reschedule" only when a date change is needed, otherwise explain why to keep it for today.
- "defer" should use "reschedule" when possible.
- "archive" should use "archive".
- "complete" should use "mark_complete".

Return ONLY valid JSON:
{
  "summary": "2 short sentences",
  "suggestions": [
    {
      "item_type": "exact item_type",
      "id": "exact id",
      "title": "exact or shortened title",
      "recommendation": "prioritize|defer|archive|complete",
      "action": "reschedule|mark_complete|archive|move_someday",
      "reason": "one practical sentence"
    }
  ],
  "today_focus": ["1-3 exact item ids that matter most today"]
}

Limit suggestions to 12. Use exact ids and item_type values from the input.

Input:
${JSON.stringify(payload)}`
}

function safeText(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function parseResult(text: string, items: ResetItem[]) {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const byKey = new Map(items.map((item) => [`${item.type}:${item.id}`, item]))
    const allowedRecommendations = new Set(["prioritize", "defer", "archive", "complete"])

    const suggestions: ResetSuggestion[] = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.slice(0, 12).flatMap((raw) => {
          if (!raw || typeof raw !== "object") return []
          const obj = raw as Record<string, unknown>
          const itemType = safeText(obj.item_type, 40)
          const id = safeText(obj.id, 40)
          const item = byKey.get(`${itemType}:${id}`)
          if (!item) return []
          const recommendation = safeText(obj.recommendation, 30)
          const action = safeText(obj.action, 30) as ResetActionType
          if (!allowedRecommendations.has(recommendation) || !item.actions.includes(action)) return []
          return [{
            item_type: item.type,
            id: item.id,
            title: item.title,
            recommendation: recommendation as ResetSuggestion["recommendation"],
            action,
            reason: safeText(obj.reason, 240) || "This looks like a practical reset action.",
          }]
        })
      : []

    return {
      summary: safeText(parsed.summary, 500) || "Your reset suggestions are ready.",
      suggestions,
      today_focus: Array.isArray(parsed.today_focus)
        ? parsed.today_focus.filter((value): value is string => typeof value === "string").slice(0, 3)
        : [],
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

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI features are not configured" }, { status: 503 })
  }

  const limit = await checkAiUsageLimit(user.id, "reset_suggestions")
  if (!limit.allowed) {
    await createAiUsageEvent({
      userId: user.id,
      route: "reset_suggestions",
      provider: "gemini",
      model: RESET_MODEL,
      status: "rate_limited",
    })
    return NextResponse.json(
      { error: "Daily reset suggestion limit reached", limit: limit.limit, used: limit.used, remaining: 0 },
      { status: 429 },
    )
  }

  const resetData = await getResetData(user.id)
  const items = resetData.sections.flatMap((section) => section.items)
  if (items.length === 0) {
    return NextResponse.json({
      analysis: {
        summary: "Your reset dashboard is clear. There is nothing for AI to triage right now.",
        suggestions: [],
        today_focus: [],
      },
      reset: resetData,
    })
  }

  const usageEventId = await createAiUsageEvent({
    userId: user.id,
    route: "reset_suggestions",
    provider: "gemini",
    model: RESET_MODEL,
  })

  try {
    const rulesContext = await getPersonalRulesContext(user.id)
    const { text } = await generateText({
      model: gemini(RESET_MODEL),
      prompt: buildPrompt(items, rulesContext.preview),
      temperature: 0.2,
    })
    const analysis = parseResult(text, items)
    if (!analysis) {
      await updateAiUsageEvent(usageEventId, "provider_error", "Failed to parse reset suggestions")
      return NextResponse.json({ error: "The AI returned an unexpected format. Please try again." }, { status: 502 })
    }

    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json({ analysis, reset: resetData, remaining: Math.max(0, limit.remaining - 1) })
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Provider request failed",
    )
    return NextResponse.json({ error: "Failed to generate reset suggestions" }, { status: 502 })
  }
}
