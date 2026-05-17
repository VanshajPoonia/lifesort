import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"

const WEEKLY_SUMMARY_MODEL = "google/gemini-2.0-flash-exp:free"

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  headers: {
    "HTTP-Referer": "https://lifesort.app",
    "X-Title": "LifeSort",
  },
})

export type AiWeeklySummaryResult = {
  summary: string
  wins: string[]
  risks: string[]
  ignored_areas: string[]
  next_week_focus: string
  next_actions: string[]
}

type BudgetCategory = { name: string; spent: number; budget_limit: number; percent_used: number }
type LifeArea = { name: string; activity_count: number }

type WeeklySummaryInput = {
  week_start?: string
  week_end?: string
  tasks?: { completed?: number; overdue?: number; created_updated?: number }
  goals?: { progressed?: number; upcoming_deadlines?: number }
  habits?: { completed_checkins?: number; habits_completed?: number; total_checkins?: number }
  projects?: { updated?: number; active?: number; overdue?: number; activity?: number }
  notes?: { created?: number; updated?: number }
  finance?: {
    income?: number
    expenses?: number
    net?: number
    transactions?: number
    near_budget_categories?: BudgetCategory[]
  }
  life_areas?: LifeArea[]
}

function n(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || 0))
  return Number.isFinite(parsed) ? parsed : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

function buildPrompt(weekStart: string, weekEnd: string, data: WeeklySummaryInput): string {
  const tasks = data.tasks ?? {}
  const goals = data.goals ?? {}
  const habits = data.habits ?? {}
  const projects = data.projects ?? {}
  const notes = data.notes ?? {}
  const finance = data.finance ?? {}
  const lifeAreas = data.life_areas ?? []

  const lifeAreaLines = lifeAreas.length > 0
    ? lifeAreas.map((a) => `  - ${a.name}: ${a.activity_count} actions`).join("\n")
    : "  - No life area activity tracked"

  const budgetWarning = (finance.near_budget_categories ?? []).length > 0
    ? `\n  Budget categories near/over limit: ${finance.near_budget_categories!.map((c) => `${c.name} (${c.percent_used}%)`).join(", ")}`
    : ""

  return `You are a productivity coach reviewing a LifeSort user's week.

Week: ${weekStart} to ${weekEnd}

Activity (numbers only — no personal names or content):
- Tasks: ${n(tasks.completed)} completed, ${n(tasks.overdue)} overdue, ${n(tasks.created_updated)} touched this week
- Goals: ${n(goals.progressed)} progressed, ${n(goals.upcoming_deadlines)} with upcoming deadlines
- Habits: ${n(habits.habits_completed)} habits fully completed (${n(habits.completed_checkins)} total check-ins)
- Projects: ${n(projects.updated)} updated, ${n(projects.active)} active, ${n(projects.overdue)} overdue
- Notes: ${n(notes.created)} created, ${n(notes.updated)} updated
- Finance: ${formatCurrency(n(finance.income))} income, ${formatCurrency(n(finance.expenses))} expenses (net ${formatCurrency(n(finance.net))}), ${n(finance.transactions)} transactions${budgetWarning}
- Life area activity:
${lifeAreaLines}

Instructions:
- Only reference the numbers above. Do NOT invent details.
- Be specific and encouraging where results are positive.
- Identify genuine risks (overdue items, ignored areas, budget pressure).
- ignored_areas: list life area names or modules (tasks/habits/notes/finance) with zero activity; empty array if none.
- next_week_focus: one clear sentence based on the data.
- next_actions: exactly 3 practical items.

Respond with ONLY valid JSON. No markdown, no code fences, no preamble:
{
  "summary": "2-3 sentence overview of the week",
  "wins": ["specific win from data"],
  "risks": ["specific risk from data"],
  "ignored_areas": ["area or module with zero activity"],
  "next_week_focus": "single recommended direction",
  "next_actions": ["action 1", "action 2", "action 3"]
}`
}

function parseAiResult(text: string): AiWeeklySummaryResult | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
    const parsed = JSON.parse(cleaned)
    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.wins) ||
      !Array.isArray(parsed.risks) ||
      !Array.isArray(parsed.ignored_areas) ||
      typeof parsed.next_week_focus !== "string" ||
      !Array.isArray(parsed.next_actions)
    ) {
      return null
    }
    return {
      summary: parsed.summary,
      wins: parsed.wins.filter((w: unknown) => typeof w === "string"),
      risks: parsed.risks.filter((r: unknown) => typeof r === "string"),
      ignored_areas: parsed.ignored_areas.filter((a: unknown) => typeof a === "string"),
      next_week_focus: parsed.next_week_focus,
      next_actions: parsed.next_actions.filter((a: unknown) => typeof a === "string").slice(0, 3),
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

  if (!process.env.OPENROUTER_API_KEY) {
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

  const { week_start, summary: summaryData } = body as Record<string, unknown>

  if (typeof week_start !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
    return NextResponse.json({ error: "week_start must be a valid YYYY-MM-DD date" }, { status: 400 })
  }

  if (typeof summaryData !== "object" || summaryData === null) {
    return NextResponse.json({ error: "summary data is required" }, { status: 400 })
  }

  const data = summaryData as WeeklySummaryInput
  const weekEnd = typeof data.week_end === "string" ? data.week_end : week_start

  const limit = await checkAiUsageLimit(user.id, "weekly_summary")
  if (!limit.allowed) {
    await createAiUsageEvent({
      userId: user.id,
      route: "weekly_summary",
      provider: "openrouter",
      model: WEEKLY_SUMMARY_MODEL,
      status: "rate_limited",
    })
    return NextResponse.json(
      { error: "Daily AI summary limit reached", limit: limit.limit, used: limit.used, remaining: 0 },
      { status: 429 },
    )
  }

  const usageEventId = await createAiUsageEvent({
    userId: user.id,
    route: "weekly_summary",
    provider: "openrouter",
    model: WEEKLY_SUMMARY_MODEL,
  })

  try {
    const prompt = buildPrompt(week_start, weekEnd, data)

    const { text } = await generateText({
      model: openrouter(WEEKLY_SUMMARY_MODEL),
      prompt,
    })

    const result = parseAiResult(text)
    if (!result) {
      await updateAiUsageEvent(usageEventId, "provider_error", "Failed to parse structured JSON response")
      return NextResponse.json({ error: "The AI returned an unexpected format. Please try again." }, { status: 502 })
    }

    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json({ result, remaining: Math.max(0, limit.remaining - 1) })
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Provider request failed",
    )
    return NextResponse.json({ error: "Failed to generate AI summary" }, { status: 502 })
  }
}
