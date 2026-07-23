import { generateText } from "ai"
import { NextResponse } from "next/server"
import { z } from "zod"
import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import { getPersonalRulesContext } from "@/lib/personal-rules"
import { gemini } from "@/lib/ai-provider"

const CAPTURE_MODEL = "gemini-3.5-flash"

// ─── Input validation ───────────────────────────────────────────────────────

const inputSchema = z.object({
  text: z.string().min(1, "Text is required").max(1000, "Text must be 1000 characters or fewer"),
})

// ─── Per-type payload schemas ────────────────────────────────────────────────

const dateRe = /^\d{4}-\d{2}-\d{2}$/
const timeRe = /^\d{2}:\d{2}$/
const priorities = z.enum(["low", "medium", "high"])

const taskPayloadSchema = z.object({
  title: z.string().min(1).max(255),
  due_date: z.string().regex(dateRe).nullable().optional(),
  priority: priorities.default("medium"),
  description: z.string().max(2000).optional(),
})

const goalPayloadSchema = z.object({
  title: z.string().min(1).max(255),
  target_date: z.string().regex(dateRe).nullable().optional(),
  priority: priorities.default("medium"),
})

const habitPayloadSchema = z.object({
  name: z.string().min(1).max(255),
  frequency: z.enum(["daily", "weekly", "custom"]).default("daily"),
  custom_days: z.array(z.number().int().min(0).max(6)).optional(),
  target_count: z.number().int().min(1).max(100).default(1),
})

const notePayloadSchema = z.object({
  title: z.string().max(255).optional(),
  content: z.string().max(10000).optional(),
})

const projectPayloadSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  due_date: z.string().regex(dateRe).nullable().optional(),
  priority: priorities.default("medium"),
})

const VAULT_CATEGORIES = [
  "documents", "subscriptions", "warranty", "insurance",
  "vehicle", "home", "medical", "education", "work", "other",
] as const

const vaultItemPayloadSchema = z.object({
  title: z.string().min(1).max(255),
  category: z.enum(VAULT_CATEGORIES).default("other"),
  expiry_date: z.string().regex(dateRe).nullable().optional(),
  renewal_date: z.string().regex(dateRe).nullable().optional(),
  description: z.string().max(2000).optional(),
})

const wishlistPayloadSchema = z.object({
  title: z.string().min(1).max(255),
  price: z.number().min(0).max(10_000_000).nullable().optional(),
  priority: priorities.default("medium"),
})

const calendarEventPayloadSchema = z.object({
  title: z.string().min(1).max(255),
  event_date: z.string().regex(dateRe),
  start_time: z.string().regex(timeRe).nullable().optional(),
  end_time: z.string().regex(timeRe).nullable().optional(),
  description: z.string().max(2000).optional(),
})

const waitingItemPayloadSchema = z.object({
  title: z.string().min(1).max(255),
  waiting_on_name: z.string().min(1).max(255),
  waiting_on_type: z.enum(["person", "company", "school", "bank", "government", "delivery", "refund", "job", "other"]).default("other"),
  expected_date: z.string().regex(dateRe).nullable().optional(),
  follow_up_date: z.string().regex(dateRe).nullable().optional(),
  description: z.string().max(2000).optional(),
})

const somedayItemPayloadSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  category: z.enum(["idea", "project", "purchase", "travel", "learning", "relationship", "finance", "health", "other"]).default("idea"),
  review_date: z.string().regex(dateRe).nullable().optional(),
})

// ─── Exported types ──────────────────────────────────────────────────────────

export type TaskPayload = z.infer<typeof taskPayloadSchema>
export type GoalPayload = z.infer<typeof goalPayloadSchema>
export type HabitPayload = z.infer<typeof habitPayloadSchema>
export type NotePayload = z.infer<typeof notePayloadSchema>
export type ProjectPayload = z.infer<typeof projectPayloadSchema>
export type VaultItemPayload = z.infer<typeof vaultItemPayloadSchema>
export type WishlistPayload = z.infer<typeof wishlistPayloadSchema>
export type CalendarEventPayload = z.infer<typeof calendarEventPayloadSchema>
export type WaitingItemPayload = z.infer<typeof waitingItemPayloadSchema>
export type SomedayItemPayload = z.infer<typeof somedayItemPayloadSchema>

export type DraftActionType =
  | "task"
  | "waiting_item"
  | "someday_item"
  | "goal"
  | "habit"
  | "note"
  | "project"
  | "vault_item"
  | "wishlist_item"
  | "calendar_event"

export type DraftAction =
  | { type: "task"; description: string; payload: TaskPayload }
  | { type: "waiting_item"; description: string; payload: WaitingItemPayload }
  | { type: "someday_item"; description: string; payload: SomedayItemPayload }
  | { type: "goal"; description: string; payload: GoalPayload }
  | { type: "habit"; description: string; payload: HabitPayload }
  | { type: "note"; description: string; payload: NotePayload }
  | { type: "project"; description: string; payload: ProjectPayload }
  | { type: "vault_item"; description: string; payload: VaultItemPayload }
  | { type: "wishlist_item"; description: string; payload: WishlistPayload }
  | { type: "calendar_event"; description: string; payload: CalendarEventPayload }

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildPrompt(text: string, today: string, dayOfWeek: string, rulesContextPreview: string): string {
  return `You are a structured data parser for LifeSort, a personal life-management app.
Today: ${today} (${dayOfWeek})

Visible Personal Operating Rules and Preferences:
${rulesContextPreview}

Parse the user's natural language input into structured LifeSort actions.

Supported action types and their fields:
- task: { title (required, string), due_date (YYYY-MM-DD or null), priority (low/medium/high, default medium), description (optional) }
- waiting_item: { title (required), waiting_on_name (required), waiting_on_type (person/company/school/bank/government/delivery/refund/job/other, default other), expected_date (YYYY-MM-DD or null), follow_up_date (YYYY-MM-DD or null), description (optional) }
- someday_item: { title (required), description (optional), category (idea/project/purchase/travel/learning/relationship/finance/health/other, default idea), review_date (YYYY-MM-DD or null) }
- goal: { title (required), target_date (YYYY-MM-DD or null), priority (low/medium/high, default medium) }
- habit: { name (required), frequency (daily/weekly/custom, default daily), custom_days (array of 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat for custom frequency), target_count (int, default 1) }
- note: { title (optional), content (optional) }
- project: { title (required), description (optional), due_date (YYYY-MM-DD or null), priority (low/medium/high, default medium) }
- vault_item: { title (required), category (documents/subscriptions/warranty/insurance/vehicle/home/medical/education/work/other, default other), expiry_date (YYYY-MM-DD or null), renewal_date (YYYY-MM-DD or null), description (optional) }
- wishlist_item: { title (required), price (number or null), priority (low/medium/high, default medium) }
- calendar_event: { title (required), event_date (YYYY-MM-DD, required), start_time (HH:MM or null), end_time (HH:MM or null), description (optional) }

Date resolution rules:
- "Friday" → next Friday from today (${today})
- "next month" → first day of next month
- "August" → ${today.slice(0, 4)}-08-01 unless that is in the past, then next year
- "in 3 weeks" → ${today} + 21 days

Examples:
Input: "Remind me to call mom Friday and add gym 4 times a week"
Output: [
  { "type": "task", "description": "Task: Call mom on Friday", "payload": { "title": "Call mom", "due_date": "<next Friday>", "priority": "medium" } },
  { "type": "habit", "description": "Habit: Gym workout 4 times a week", "payload": { "name": "Gym workout", "frequency": "custom", "custom_days": [1, 3, 5, 6], "target_count": 1 } }
]

Input: "I want to save $800 for a laptop by August"
Output: [
  { "type": "wishlist_item", "description": "Wishlist: Laptop ($800)", "payload": { "title": "Laptop", "price": 800, "priority": "medium" } },
  { "type": "goal", "description": "Goal: Save $800 for laptop by August", "payload": { "title": "Save $800 for a laptop", "target_date": "<August 1>", "priority": "medium" } }
]

Input: "Waiting for my bank to approve the credit card by next Friday, follow up Wednesday"
Output: [
  { "type": "waiting_item", "description": "Waiting for bank credit card approval", "payload": { "title": "Credit card approval", "waiting_on_name": "Bank", "waiting_on_type": "bank", "expected_date": "<next Friday>", "follow_up_date": "<Wednesday>", "description": "Waiting for my bank to approve the credit card." } }
]

Rules:
- Parse ALL mentioned items. One input may produce multiple actions.
- Return 1–8 actions maximum.
- Use only the supported types above. Drop anything that doesn't fit.
- Use someday_item for low-pressure possibilities, maybe-one-day ideas, future trips, vague purchases, or non-committal projects that should not become active work yet.
- description must be a single human-readable sentence summarising the action.
- Do NOT include fields not listed for each type.
- Respect visible personal operating rules when resolving dates or deciding whether something belongs as active work versus someday.
- Do NOT create, change, or infer personal operating rules.

Return ONLY valid JSON. No markdown, no preamble:
{ "actions": [ { "type": "...", "description": "...", "payload": { ... } } ] }

User input: "${text.replace(/"/g, '\\"')}"`
}

// ─── Per-type payload validation ─────────────────────────────────────────────

function validatePayload(type: string, payload: unknown): DraftAction["payload"] | null {
  try {
    switch (type) {
      case "task":          return taskPayloadSchema.parse(payload)
      case "waiting_item":  return waitingItemPayloadSchema.parse(payload)
      case "someday_item":  return somedayItemPayloadSchema.parse(payload)
      case "goal":          return goalPayloadSchema.parse(payload)
      case "habit":         return habitPayloadSchema.parse(payload)
      case "note":          return notePayloadSchema.parse(payload)
      case "project":       return projectPayloadSchema.parse(payload)
      case "vault_item":    return vaultItemPayloadSchema.parse(payload)
      case "wishlist_item": return wishlistPayloadSchema.parse(payload)
      case "calendar_event": return calendarEventPayloadSchema.parse(payload)
      default: return null
    }
  } catch {
    return null
  }
}

const VALID_TYPES = new Set<DraftActionType>([
  "task", "waiting_item", "someday_item", "goal", "habit", "note", "project", "vault_item", "wishlist_item", "calendar_event",
])

function parseAiResult(text: string): DraftAction[] {
  try {
    const cleaned = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed.actions)) return []

    const actions: DraftAction[] = []
    for (const raw of parsed.actions) {
      if (typeof raw !== "object" || raw === null) continue
      const type = raw.type as string
      if (!VALID_TYPES.has(type as DraftActionType)) continue
      const description = typeof raw.description === "string" ? raw.description.slice(0, 500) : "No description"
      const payload = validatePayload(type, raw.payload)
      if (!payload) continue
      actions.push({ type: type as DraftActionType, description, payload } as DraftAction)
      if (actions.length >= 8) break
    }

    return actions
  } catch {
    return []
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

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

  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 })
  }

  const { text } = parsed.data

  const limit = await checkAiUsageLimit(user.id, "capture")
  if (!limit.allowed) {
    await createAiUsageEvent({
      userId: user.id,
      route: "capture",
      provider: "gemini",
      model: CAPTURE_MODEL,
      status: "rate_limited",
    })
    return NextResponse.json(
      { error: "Daily AI capture limit reached", limit: limit.limit, used: limit.used, remaining: 0 },
      { status: 429 },
    )
  }

  const usageEventId = await createAiUsageEvent({
    userId: user.id,
    route: "capture",
    provider: "gemini",
    model: CAPTURE_MODEL,
  })

  try {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" })
    const rulesContext = await getPersonalRulesContext(user.id)
    const prompt = buildPrompt(text, today, dayOfWeek, rulesContext.preview)

    const { text: aiText } = await generateText({
      model: gemini(CAPTURE_MODEL),
      prompt,
    })

    const actions = parseAiResult(aiText)
    await updateAiUsageEvent(usageEventId, "success")

    return NextResponse.json({ actions, remaining: Math.max(0, limit.remaining - 1) })
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Provider request failed",
    )
    return NextResponse.json({ error: "Failed to parse input" }, { status: 502 })
  }
}
