import { generateText } from "ai"
import { neon } from "@neondatabase/serverless"
import { NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import { getPersonalRulesContext } from "@/lib/personal-rules"

const sql = neon(process.env.DATABASE_URL!)
import { gemini } from "@/lib/ai-provider"
const LIFE_BALANCE_MODEL = "gemini-3.5-flash"


type AreaMetrics = {
  key: string
  life_area_id: string | null
  name: string
  icon: string
  color: string
  sort_order: number
  tasks: { active: number; completed: number; overdue: number; recent_updates: number }
  goals: { active: number; completed: number; overdue: number; recent_updates: number }
  habits: { active: number; total: number; checkins_7d: number; completed_7d: number }
  projects: { active: number; overdue: number; completed: number; recent_updates: number }
  notes: { total: number; recent_updates: number }
  budget: { categories: number; income_30d: number; expenses_30d: number }
  score: number
  desired_attention: "low" | "medium" | "high" | null
  attention_nudge: string | null
}

// Gentle desired-vs-actual attention nudges (AI_LIFE_DOMAINS_SPEC.md section 11/12). Deterministic,
// not AI-generated -- must never use guilt framing ("you are failing"), only specific, kind observations.
function buildAttentionNudge(area: Pick<AreaMetrics, "name" | "desired_attention" | "score" | "habits">): string | null {
  if (!area.desired_attention || area.desired_attention === "low") return null
  if (area.score > 0) return null
  if (area.desired_attention === "high") {
    return `You wanted to prioritize ${area.name}, but no activity has been tracked there this week.`
  }
  return `You wanted to give ${area.name} more attention, but nothing has been tracked there recently.`
}

type WeeklyReviewContext = {
  week_start: string | null
  week_end: string | null
  wins: string
  challenges: string
  lessons: string
  next_week_focus: string
}

type LifeBalanceMetrics = {
  generated_at: string
  areas: AreaMetrics[]
  summary: {
    total_areas: number
    tracked_areas: number
    ignored_areas: string[]
    top_area: string | null
    unassigned_score: number
  }
  weekly_reviews: WeeklyReviewContext[]
  unavailable: string[]
}

type AiLifeBalanceResult = {
  summary: string
  over_focused_areas: Array<{ area: string; reason: string; evidence: string }>
  ignored_areas: Array<{ area: string; reason: string; suggested_attention: string }>
  potential_stress_points: Array<{ title: string; reason: string }>
  suggested_small_actions: Array<{
    title: string
    description: string
    life_area_id: string | null
    life_area_name: string | null
    priority: "low" | "medium" | "high"
  }>
  suggested_next_week_balance: Array<{ area: string; focus: string }>
}

function n(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0))
  return Number.isFinite(parsed) ? parsed : 0
}

function safeText(value: unknown, max = 280): string {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

function isMissingSchema(error: unknown) {
  const err = error as { code?: string; message?: string }
  const message = err.message?.toLowerCase() ?? ""
  return err.code === "42P01" || err.code === "42703" || message.includes("does not exist") || message.includes("column")
}

async function safeRows<T>(label: string, query: Promise<unknown[]>, unavailable: string[]): Promise<T[]> {
  try {
    return (await query) as T[]
  } catch (error) {
    if (isMissingSchema(error)) {
      unavailable.push(label)
      return []
    }
    throw error
  }
}

function createEmptyArea(row?: Record<string, unknown>): AreaMetrics {
  const id = row?.id === undefined || row?.id === null ? null : String(row.id)
  return {
    key: id || "unassigned",
    life_area_id: id,
    name: safeText(row?.name, 80) || "Unassigned",
    icon: safeText(row?.icon, 40) || "Circle",
    color: safeText(row?.color, 20) || "#64748B",
    sort_order: n(row?.sort_order),
    tasks: { active: 0, completed: 0, overdue: 0, recent_updates: 0 },
    goals: { active: 0, completed: 0, overdue: 0, recent_updates: 0 },
    habits: { active: 0, total: 0, checkins_7d: 0, completed_7d: 0 },
    projects: { active: 0, overdue: 0, completed: 0, recent_updates: 0 },
    notes: { total: 0, recent_updates: 0 },
    budget: { categories: 0, income_30d: 0, expenses_30d: 0 },
    score: 0,
    desired_attention: (row?.desired_attention as "low" | "medium" | "high" | null) ?? null,
    attention_nudge: null,
  }
}

function calculateScore(area: AreaMetrics) {
  return (
    area.tasks.active +
    area.tasks.overdue +
    area.goals.active * 2 +
    area.goals.overdue * 2 +
    area.habits.active +
    area.habits.completed_7d +
    area.projects.active * 2 +
    area.projects.overdue * 2 +
    area.projects.recent_updates +
    area.notes.recent_updates +
    area.budget.categories
  )
}

async function buildLifeBalanceMetrics(userId: string): Promise<LifeBalanceMetrics> {
  const unavailable: string[] = []
  const areas = new Map<string, AreaMetrics>()
  const ensure = (key: unknown) => {
    const normalized = key === null || key === undefined || key === "" ? "unassigned" : String(key)
    if (!areas.has(normalized)) {
      areas.set(normalized, createEmptyArea(normalized === "unassigned" ? undefined : { id: normalized, name: "Unknown area" }))
    }
    return areas.get(normalized)!
  }

  const lifeAreaRows = await safeRows<Record<string, unknown>>("life_areas", sql`
    SELECT id::text AS id, name, icon, color, sort_order, is_ai_excluded, desired_attention
    FROM life_areas
    WHERE user_id = ${userId}
    ORDER BY sort_order ASC, name ASC
  `, unavailable)

  // Domains marked is_ai_excluded (AI_LIFE_DOMAINS_SPEC.md section 15/16) never appear in Life Balance,
  // since its non-AI metrics feed directly into the AI prompt built from this same map below.
  const excludedAreaIds = new Set(lifeAreaRows.filter((row) => row.is_ai_excluded === true).map((row) => String(row.id)))

  for (const row of lifeAreaRows) {
    if (excludedAreaIds.has(String(row.id))) continue
    const area = createEmptyArea(row)
    areas.set(area.key, area)
  }
  ensure("unassigned")

  const [taskRows, goalRows, habitRows, habitCheckinRows, projectRows, noteRows, budgetRows, reviewRows] = await Promise.all([
    safeRows<Record<string, unknown>>("tasks", sql`
      SELECT
        COALESCE(life_area_id::text, 'unassigned') AS area_key,
        COUNT(*) FILTER (WHERE completed IS NOT TRUE)::int AS active,
        COUNT(*) FILTER (WHERE completed IS TRUE)::int AS completed,
        COUNT(*) FILTER (WHERE completed IS NOT TRUE AND due_date < CURRENT_DATE)::int AS overdue,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '14 days')::int AS recent_updates
      FROM tasks
      WHERE user_id = ${userId}
      GROUP BY COALESCE(life_area_id::text, 'unassigned')
    `, unavailable),
    safeRows<Record<string, unknown>>("goals", sql`
      SELECT
        COALESCE(life_area_id::text, 'unassigned') AS area_key,
        COUNT(*) FILTER (WHERE status IS DISTINCT FROM 'completed')::int AS active,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status IS DISTINCT FROM 'completed' AND target_date < CURRENT_DATE)::int AS overdue,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '14 days')::int AS recent_updates
      FROM goals
      WHERE user_id = ${userId}
      GROUP BY COALESCE(life_area_id::text, 'unassigned')
    `, unavailable),
    safeRows<Record<string, unknown>>("habits", sql`
      SELECT
        COALESCE(life_area_id::text, 'unassigned') AS area_key,
        COUNT(*) FILTER (WHERE is_active IS NOT FALSE)::int AS active,
        COUNT(*)::int AS total
      FROM habits
      WHERE user_id = ${userId}
      GROUP BY COALESCE(life_area_id::text, 'unassigned')
    `, unavailable),
    safeRows<Record<string, unknown>>("habit_checkins", sql`
      SELECT
        COALESCE(h.life_area_id::text, 'unassigned') AS area_key,
        COUNT(hc.id)::int AS checkins_7d,
        COUNT(hc.id) FILTER (WHERE hc.count >= h.target_count)::int AS completed_7d
      FROM habits h
      LEFT JOIN habit_checkins hc
        ON hc.habit_id = h.id
       AND hc.user_id = ${userId}
       AND hc.checkin_date >= CURRENT_DATE - INTERVAL '7 days'
      WHERE h.user_id = ${userId}
      GROUP BY COALESCE(h.life_area_id::text, 'unassigned')
    `, unavailable),
    safeRows<Record<string, unknown>>("projects", sql`
      SELECT
        COALESCE(life_area_id::text, 'unassigned') AS area_key,
        COUNT(*) FILTER (WHERE status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
        COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived') AND due_date < CURRENT_DATE)::int AS overdue,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '14 days')::int AS recent_updates
      FROM projects
      WHERE user_id = ${userId}
      GROUP BY COALESCE(life_area_id::text, 'unassigned')
    `, unavailable),
    safeRows<Record<string, unknown>>("notes", sql`
      SELECT
        COALESCE(life_area_id::text, 'unassigned') AS area_key,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '14 days')::int AS recent_updates
      FROM notes
      WHERE user_id = ${userId}
      GROUP BY COALESCE(life_area_id::text, 'unassigned')
    `, unavailable),
    safeRows<Record<string, unknown>>("budget", sql`
      SELECT
        COALESCE(c.life_area_id::text, 'unassigned') AS area_key,
        COUNT(DISTINCT c.id)::int AS categories,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income' AND t.date >= CURRENT_DATE - INTERVAL '30 days'), 0)::float AS income_30d,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense' AND t.date >= CURRENT_DATE - INTERVAL '30 days'), 0)::float AS expenses_30d
      FROM budget_categories c
      LEFT JOIN budget_transactions t
        ON t.category_id = c.id
       AND t.user_id = ${userId}
      WHERE c.user_id = ${userId}
      GROUP BY COALESCE(c.life_area_id::text, 'unassigned')
    `, unavailable),
    safeRows<Record<string, unknown>>("weekly_reviews", sql`
      SELECT week_start::text, week_end::text, reflection_wins, reflection_challenges, reflection_lessons, reflection_next_week_focus
      FROM weekly_reviews
      WHERE user_id = ${userId}
      ORDER BY week_start DESC
      LIMIT 2
    `, unavailable),
  ])

  for (const row of taskRows) {
    const area = ensure(row.area_key)
    area.tasks = {
      active: n(row.active),
      completed: n(row.completed),
      overdue: n(row.overdue),
      recent_updates: n(row.recent_updates),
    }
  }
  for (const row of goalRows) {
    const area = ensure(row.area_key)
    area.goals = {
      active: n(row.active),
      completed: n(row.completed),
      overdue: n(row.overdue),
      recent_updates: n(row.recent_updates),
    }
  }
  for (const row of habitRows) {
    const area = ensure(row.area_key)
    area.habits.active = n(row.active)
    area.habits.total = n(row.total)
  }
  for (const row of habitCheckinRows) {
    const area = ensure(row.area_key)
    area.habits.checkins_7d = n(row.checkins_7d)
    area.habits.completed_7d = n(row.completed_7d)
  }
  for (const row of projectRows) {
    const area = ensure(row.area_key)
    area.projects = {
      active: n(row.active),
      completed: n(row.completed),
      overdue: n(row.overdue),
      recent_updates: n(row.recent_updates),
    }
  }
  for (const row of noteRows) {
    const area = ensure(row.area_key)
    area.notes = {
      total: n(row.total),
      recent_updates: n(row.recent_updates),
    }
  }
  for (const row of budgetRows) {
    const area = ensure(row.area_key)
    area.budget = {
      categories: n(row.categories),
      income_30d: n(row.income_30d),
      expenses_30d: n(row.expenses_30d),
    }
  }

  for (const id of excludedAreaIds) areas.delete(id)

  const rows = Array.from(areas.values()).map((area) => {
    const scored = { ...area, score: calculateScore(area) }
    return { ...scored, attention_nudge: buildAttentionNudge(scored) }
  })
  const sortedRows = rows.sort((a, b) => {
    if (a.key === "unassigned") return 1
    if (b.key === "unassigned") return -1
    return a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  })
  const activeRows = sortedRows.filter((area) => area.key !== "unassigned")
  const ignoredAreas = activeRows.filter((area) => area.score === 0).map((area) => area.name)
  const topArea = [...activeRows].sort((a, b) => b.score - a.score)[0]
  const unassigned = areas.get("unassigned")

  return {
    generated_at: new Date().toISOString(),
    areas: sortedRows,
    summary: {
      total_areas: activeRows.length,
      tracked_areas: activeRows.filter((area) => area.score > 0).length,
      ignored_areas: ignoredAreas,
      top_area: topArea && topArea.score > 0 ? topArea.name : null,
      unassigned_score: unassigned?.score ?? 0,
    },
    weekly_reviews: reviewRows.map((row) => ({
      week_start: safeText(row.week_start, 20) || null,
      week_end: safeText(row.week_end, 20) || null,
      wins: safeText(row.reflection_wins),
      challenges: safeText(row.reflection_challenges),
      lessons: safeText(row.reflection_lessons),
      next_week_focus: safeText(row.reflection_next_week_focus),
    })),
    unavailable: Array.from(new Set(unavailable)),
  }
}

function buildPrompt(metrics: LifeBalanceMetrics, rulesContextPreview: string) {
  const payload = {
    instructions: "Use only these aggregate LifeSort metrics and short weekly review reflections. Do not assume diagnoses. Be concrete, kind, and concise.",
    visible_personal_operating_rules: rulesContextPreview,
    areas: metrics.areas.map((area) => ({
      id: area.life_area_id,
      name: area.name,
      score: area.score,
      tasks: area.tasks,
      goals: area.goals,
      habits: area.habits,
      projects: area.projects,
      notes: area.notes,
      budget: area.budget,
    })),
    summary: metrics.summary,
    weekly_reviews: metrics.weekly_reviews,
  }

  return `You are analyzing life balance for a LifeSort user.

Privacy rules:
- You are receiving aggregate counts and short weekly review reflections only.
- The analysis is read-only. Do not claim you created, changed, or scheduled anything.
- Do not mention medical, financial, or legal certainty. Use "may", "could", and practical next steps.
- Respect the visible personal operating rules in the input when suggesting actions.
- Do not create, modify, or invent personal rules.

Return ONLY valid JSON, no markdown:
{
  "summary": "2 concise sentences",
  "over_focused_areas": [{ "area": "area name", "reason": "why it looks over-focused", "evidence": "specific counts from input" }],
  "ignored_areas": [{ "area": "area name", "reason": "why it looks ignored", "suggested_attention": "small attention shift" }],
  "potential_stress_points": [{ "title": "short label", "reason": "specific evidence" }],
  "suggested_small_actions": [{ "title": "task title", "description": "one sentence", "life_area_id": "exact area id or null", "life_area_name": "exact area name or null", "priority": "low|medium|high" }],
  "suggested_next_week_balance": [{ "area": "area name", "focus": "what to do next week" }]
}

Rules:
- over_focused_areas: 0-3 items.
- ignored_areas: 0-5 items.
- potential_stress_points: 0-4 items.
- suggested_small_actions: 2-5 tiny, confirmable actions. Prefer low or medium priority.
- suggested_next_week_balance: 3-5 items.
- Use life_area_id only when it exactly matches an id in the input. Otherwise use null.

Input:
${JSON.stringify(payload)}`
}

function parseAiResult(text: string, metrics: LifeBalanceMetrics): AiLifeBalanceResult | null {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    const areaById = new Map(metrics.areas.filter((area) => area.life_area_id).map((area) => [area.life_area_id, area]))
    const areaByName = new Map(metrics.areas.map((area) => [area.name.toLowerCase(), area]))
    const priority = (value: unknown): "low" | "medium" | "high" =>
      value === "low" || value === "high" || value === "medium" ? value : "medium"

    const simpleList = (value: unknown, keys: string[], limit: number) => {
      if (!Array.isArray(value)) return []
      return value.slice(0, limit).map((item) => {
        const obj = typeof item === "object" && item !== null ? item as Record<string, unknown> : {}
        return Object.fromEntries(keys.map((key) => [key, safeText(obj[key], 320)]))
      })
    }

    const actions = Array.isArray(parsed.suggested_small_actions)
      ? parsed.suggested_small_actions.slice(0, 5).map((item) => {
          const obj = typeof item === "object" && item !== null ? item as Record<string, unknown> : {}
          const rawId = safeText(obj.life_area_id, 40) || null
          const name = safeText(obj.life_area_name, 100) || null
          const matchedArea = (rawId && areaById.get(rawId)) || (name && areaByName.get(name.toLowerCase())) || null
          return {
            title: safeText(obj.title, 180) || "Balance check-in",
            description: safeText(obj.description, 500) || "Take one small step toward a better life balance.",
            life_area_id: matchedArea?.life_area_id ?? null,
            life_area_name: matchedArea?.name ?? name,
            priority: priority(obj.priority),
          }
        })
      : []

    return {
      summary: safeText(parsed.summary, 600) || "Your LifeSort balance is ready to review.",
      over_focused_areas: simpleList(parsed.over_focused_areas, ["area", "reason", "evidence"], 3) as AiLifeBalanceResult["over_focused_areas"],
      ignored_areas: simpleList(parsed.ignored_areas, ["area", "reason", "suggested_attention"], 5) as AiLifeBalanceResult["ignored_areas"],
      potential_stress_points: simpleList(parsed.potential_stress_points, ["title", "reason"], 4) as AiLifeBalanceResult["potential_stress_points"],
      suggested_small_actions: actions,
      suggested_next_week_balance: simpleList(parsed.suggested_next_week_balance, ["area", "focus"], 5) as AiLifeBalanceResult["suggested_next_week_balance"],
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

  const metrics = await buildLifeBalanceMetrics(user.id)
  return NextResponse.json({ metrics })
}

export async function POST() {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI features are not configured" }, { status: 503 })
  }

  const metrics = await buildLifeBalanceMetrics(user.id)
  const limit = await checkAiUsageLimit(user.id, "life_balance_insights")
  if (!limit.allowed) {
    await createAiUsageEvent({
      userId: user.id,
      route: "life_balance_insights",
      provider: "gemini",
      model: LIFE_BALANCE_MODEL,
      status: "rate_limited",
    })
    return NextResponse.json(
      { error: "Daily life balance analysis limit reached", limit: limit.limit, used: limit.used, remaining: 0 },
      { status: 429 },
    )
  }

  const usageEventId = await createAiUsageEvent({
    userId: user.id,
    route: "life_balance_insights",
    provider: "gemini",
    model: LIFE_BALANCE_MODEL,
  })

  try {
    const { text } = await generateText({
      model: gemini(LIFE_BALANCE_MODEL),
      prompt: buildPrompt(metrics, (await getPersonalRulesContext(user.id)).preview),
      temperature: 0.3,
    })

    const analysis = parseAiResult(text, metrics)
    if (!analysis) {
      await updateAiUsageEvent(usageEventId, "provider_error", "Failed to parse structured JSON response")
      return NextResponse.json({ error: "The AI returned an unexpected format. Please try again." }, { status: 502 })
    }

    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json({ analysis, metrics, remaining: Math.max(0, limit.remaining - 1) })
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Provider request failed",
    )
    return NextResponse.json({ error: "Failed to analyze life balance" }, { status: 502 })
  }
}
