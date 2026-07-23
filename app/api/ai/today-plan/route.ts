import { generateText } from "ai"
import { NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import { getPersonalRulesContext } from "@/lib/personal-rules"

import { gemini } from "@/lib/ai-provider"
const TODAY_PLAN_MODEL = "gemini-3.5-flash"


export type AiTodayPlanResult = {
  top_priorities: Array<{ id: string; title: string; reason: string }>
  schedule_blocks: Array<{ label: string; suggestion: string }>
  defer: Array<{ id: string; title: string; reason: string }>
  risks: string[]
  small_win: string
}

type InputItem = { id?: unknown; title?: unknown; subtitle?: unknown; date?: unknown }
type InputHabit = { id?: unknown; name?: unknown; done?: unknown }

type TodayPlanInput = {
  plan_date?: unknown
  capacity?: {
    energy_level?: unknown
    available_focus_minutes?: unknown
    mood?: unknown
    day_type?: unknown
    recommended_focus_count?: unknown
    overload?: unknown
    warnings?: Array<{ message?: unknown }>
  }
  must_do?: InputItem[]
  should_do?: InputItem[]
  could_do?: InputItem[]
  calendar_today?: InputItem[]
  habits_today?: InputHabit[]
  upcoming_deadlines?: InputItem[]
}

function safeStr(value: unknown, maxLen = 120): string {
  if (typeof value !== "string") return ""
  return value.slice(0, maxLen)
}

function formatItem(item: InputItem): string {
  const id = safeStr(item.id, 40)
  const title = safeStr(item.title)
  const subtitle = item.subtitle ? ` (${safeStr(item.subtitle, 60)})` : ""
  const date = item.date ? ` · due ${safeStr(item.date, 12)}` : ""
  return `- [${id}] ${title}${subtitle}${date}`
}

function capacityLine(data: TodayPlanInput) {
  const capacity = data.capacity
  if (!capacity || typeof capacity !== "object") return "No capacity details saved yet."
  const energy = safeStr(capacity.energy_level, 20) || "medium"
  const minutes =
    typeof capacity.available_focus_minutes === "number"
      ? `${capacity.available_focus_minutes} minutes`
      : typeof capacity.available_focus_minutes === "string" && capacity.available_focus_minutes
        ? `${safeStr(capacity.available_focus_minutes, 20)} minutes`
        : "not set"
  const mood = safeStr(capacity.mood, 80) || "not set"
  const dayType = safeStr(capacity.day_type, 40) || "normal"
  const recommended =
    typeof capacity.recommended_focus_count === "number"
      ? capacity.recommended_focus_count
      : Number.parseInt(String(capacity.recommended_focus_count || 0), 10)
  const warnings = Array.isArray(capacity.warnings)
    ? capacity.warnings.map((warning) => safeStr(warning.message, 160)).filter(Boolean).slice(0, 3)
    : []
  return [
    `Energy: ${energy}`,
    `Available focus time: ${minutes}`,
    `Mood: ${mood}`,
    `Day type: ${dayType}`,
    `Recommended focus count from capacity: ${Number.isFinite(recommended) && recommended > 0 ? recommended : "not set"}`,
    warnings.length ? `Overload warnings: ${warnings.join(" | ")}` : "Overload warnings: none",
  ].join("\n")
}

function buildPrompt(planDate: string, data: TodayPlanInput, rulesContextPreview: string, maxFocusItems: number): string {
  const date = new Date(`${planDate}T00:00:00`)
  const dow = Number.isNaN(date.getTime()) ? planDate : date.toLocaleDateString("en-US", { weekday: "long" })

  const mustDo = (data.must_do ?? []).slice(0, 12)
  const calendarToday = (data.calendar_today ?? []).slice(0, 8)
  const habitsToday = (data.habits_today ?? []).slice(0, 10)
  const shouldDo = (data.should_do ?? []).slice(0, 6)
  const couldDo = (data.could_do ?? []).slice(0, 5)
  const deadlines = (data.upcoming_deadlines ?? []).slice(0, 6)

  const mustDoLines = mustDo.length > 0 ? mustDo.map(formatItem).join("\n") : "- None"
  const calendarLines = calendarToday.length > 0 ? calendarToday.map(formatItem).join("\n") : "- No events"
  const habitLines =
    habitsToday.length > 0
      ? habitsToday.map((h) => `- ${safeStr(h.name)}${h.done ? " (already done)" : ""}`).join("\n")
      : "- No habits tracked today"
  const shouldLines = shouldDo.length > 0 ? shouldDo.map(formatItem).join("\n") : "- None"
  const couldLines = couldDo.length > 0 ? couldDo.map(formatItem).join("\n") : "- None"
  const deadlineLines = deadlines.length > 0 ? deadlines.map(formatItem).join("\n") : "- None"

  return `You are a concise day planner for LifeSort, a personal life-management app.
Today: ${planDate} (${dow})

VISIBLE PERSONAL OPERATING RULES AND PREFERENCES:
${rulesContextPreview}

TODAY'S ENERGY AND CAPACITY:
${capacityLine(data)}

MUST DO — overdue or high-priority items due today:
${mustDoLines}

CALENDAR — today's events:
${calendarLines}

HABITS DUE TODAY:
${habitLines}

SHOULD DO — helpful but not urgent:
${shouldLines}

COULD DO — optional:
${couldLines}

UPCOMING DEADLINES — next 14 days:
${deadlineLines}

Return ONLY valid JSON. No markdown, no code fences:
{
  "top_priorities": [
    { "id": "<exact ID from MUST DO or CALENDAR above>", "title": "<item title>", "reason": "<1 sentence>" }
  ],
  "schedule_blocks": [
    { "label": "Morning", "suggestion": "<what to focus on, referencing specific items>" },
    { "label": "Afternoon", "suggestion": "<what to tackle next>" },
    { "label": "Evening", "suggestion": "<how to wind down and prepare for tomorrow>" }
  ],
  "defer": [
    { "id": "<exact ID from any list above>", "title": "<item title>", "reason": "<why defer to another day>" }
  ],
  "risks": ["<specific overload or scheduling concern>"],
  "small_win": "<one specific achievable action under 30 minutes>"
}

Rules:
- top_priorities: 1–${maxFocusItems} items only. Prioritise MUST DO first, then CALENDAR. Use the exact bracket IDs from the input.
- Respect today's energy and capacity. On low-energy, busy, travel, sick, or recovery days, choose fewer priorities and suggest a lighter schedule.
- schedule_blocks: exactly 3 (Morning, Afternoon, Evening). Name specific items in each suggestion.
- defer: 0–3 items the user should skip today. Exact IDs from input. Empty array if none.
- risks: 0–3 short warnings. Empty array if no concerns.
- small_win: one concrete sentence. May suggest a new action not in the input.
- Respect the visible personal operating rules and preferences above.
- Do NOT create or change personal rules.
- Do NOT fabricate item IDs. Only use IDs exactly as shown in the brackets above.`
}

type ParsedPriorityItem = { id: string; title: string; reason: string }
type ParsedBlockItem = { label: string; suggestion: string }

function parsePriorityItem(item: unknown): ParsedPriorityItem | null {
  if (typeof item !== "object" || item === null) return null
  const obj = item as Record<string, unknown>
  if (typeof obj.id !== "string" || typeof obj.title !== "string" || typeof obj.reason !== "string") return null
  return { id: obj.id, title: obj.title.slice(0, 200), reason: obj.reason.slice(0, 300) }
}

function parseBlockItem(block: unknown): ParsedBlockItem | null {
  if (typeof block !== "object" || block === null) return null
  const obj = block as Record<string, unknown>
  if (typeof obj.label !== "string" || typeof obj.suggestion !== "string") return null
  return { label: obj.label.slice(0, 60), suggestion: obj.suggestion.slice(0, 400) }
}

function parseAiResult(text: string): AiTodayPlanResult | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
    const parsed = JSON.parse(cleaned)
    if (
      !Array.isArray(parsed.top_priorities) ||
      !Array.isArray(parsed.schedule_blocks) ||
      !Array.isArray(parsed.defer) ||
      !Array.isArray(parsed.risks) ||
      typeof parsed.small_win !== "string"
    ) {
      return null
    }

    const priorities: Array<ParsedPriorityItem | null> = parsed.top_priorities.map(parsePriorityItem)
    const blocks: Array<ParsedBlockItem | null> = parsed.schedule_blocks.map(parseBlockItem)
    const deferred: Array<ParsedPriorityItem | null> = parsed.defer.map(parsePriorityItem)

    return {
      top_priorities: priorities.filter((x): x is ParsedPriorityItem => x !== null).slice(0, 3),
      schedule_blocks: blocks.filter((x): x is ParsedBlockItem => x !== null).slice(0, 3),
      defer: deferred.filter((x): x is ParsedPriorityItem => x !== null).slice(0, 5),
      risks: parsed.risks.filter((r: unknown): r is string => typeof r === "string").slice(0, 3),
      small_win: parsed.small_win.slice(0, 500),
    }
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI features are not configured" }, { status: 503 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
  }

  const { plan_date } = body as Record<string, unknown>
  if (typeof plan_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(plan_date)) {
    return NextResponse.json({ error: "plan_date must be a valid YYYY-MM-DD date" }, { status: 400 })
  }

  const data = body as TodayPlanInput

  const limit = await checkAiUsageLimit(user.id, "today_plan")
  if (!limit.allowed) {
    await createAiUsageEvent({
      userId: user.id,
      route: "today_plan",
      provider: "gemini",
      model: TODAY_PLAN_MODEL,
      status: "rate_limited",
    })
    return NextResponse.json(
      { error: "Daily AI plan limit reached", limit: limit.limit, used: limit.used, remaining: 0 },
      { status: 429 },
    )
  }

  const usageEventId = await createAiUsageEvent({
    userId: user.id,
    route: "today_plan",
    provider: "gemini",
    model: TODAY_PLAN_MODEL,
  })

  try {
    const rulesContext = await getPersonalRulesContext(user.id)
    const capacityRecommendation =
      typeof data.capacity?.recommended_focus_count === "number"
        ? data.capacity.recommended_focus_count
        : Number.parseInt(String(data.capacity?.recommended_focus_count || 0), 10)
    const maxFocusItems = Math.min(
      3,
      Math.max(1, rulesContext.preferences.max_daily_focus_items),
      Number.isFinite(capacityRecommendation) && capacityRecommendation > 0 ? capacityRecommendation : 3,
    )
    const prompt = buildPrompt(plan_date, data, rulesContext.preview, maxFocusItems)

    const { text } = await generateText({
      model: gemini(TODAY_PLAN_MODEL),
      prompt,
    })

    const result = parseAiResult(text)
    if (!result) {
      await updateAiUsageEvent(usageEventId, "provider_error", "Failed to parse structured JSON response")
      return NextResponse.json({ error: "The AI returned an unexpected format. Please try again." }, { status: 502 })
    }
    result.top_priorities = result.top_priorities.slice(0, maxFocusItems)

    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json({ result, remaining: Math.max(0, limit.remaining - 1) })
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Provider request failed",
    )
    return NextResponse.json({ error: "Failed to generate AI day plan" }, { status: 502 })
  }
}
