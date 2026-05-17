import { sql } from "@/lib/db"

export const RULE_CATEGORIES = ["time", "energy", "work", "health", "finance", "learning", "relationships", "planning", "AI", "other"] as const
export const PLANNING_STYLES = ["strict", "balanced", "flexible"] as const
export const REMINDER_TIMINGS = ["morning", "midday", "afternoon", "evening", "night"] as const
export const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const

export type RuleCategory = (typeof RULE_CATEGORIES)[number]
export type PlanningStyle = (typeof PLANNING_STYLES)[number]
export type ReminderTiming = (typeof REMINDER_TIMINGS)[number]
export type WeekDay = (typeof WEEK_DAYS)[number]

export type PersonalRule = {
  id: number
  title: string
  description: string | null
  category: RuleCategory
  active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export type PersonalRulePreferences = {
  working_hours_start: string
  working_hours_end: string
  max_daily_focus_items: number
  reminder_timing: ReminderTiming
  heavy_days: WeekDay[]
  light_days: WeekDay[]
  planning_style: PlanningStyle
}

export type PersonalRulesContext = {
  rules: PersonalRule[]
  preferences: PersonalRulePreferences
  preview: string
  unavailable: boolean
}

export const DEFAULT_PERSONAL_RULE_PREFERENCES: PersonalRulePreferences = {
  working_hours_start: "09:00",
  working_hours_end: "17:00",
  max_daily_focus_items: 3,
  reminder_timing: "morning",
  heavy_days: [],
  light_days: [],
  planning_style: "balanced",
}

function isMissingSchema(error: unknown) {
  const err = error as { code?: string; message?: string }
  const message = err.message?.toLowerCase() ?? ""
  return err.code === "42P01" || err.code === "42703" || message.includes("does not exist") || message.includes("column")
}

function cleanTime(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed) ? trimmed : fallback
}

function cleanStringEnum<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T[number] : fallback
}

function cleanDayList(value: unknown) {
  if (!Array.isArray(value)) return []
  const days = value.filter((day): day is WeekDay => typeof day === "string" && (WEEK_DAYS as readonly string[]).includes(day))
  return Array.from(new Set(days))
}

export function normalizePersonalRulePreferences(value: unknown): PersonalRulePreferences {
  const raw = typeof value === "object" && value !== null ? value as Record<string, unknown> : {}
  const maxFocus = Number.parseInt(String(raw.max_daily_focus_items ?? ""), 10)
  return {
    working_hours_start: cleanTime(raw.working_hours_start, DEFAULT_PERSONAL_RULE_PREFERENCES.working_hours_start),
    working_hours_end: cleanTime(raw.working_hours_end, DEFAULT_PERSONAL_RULE_PREFERENCES.working_hours_end),
    max_daily_focus_items: Number.isInteger(maxFocus) ? Math.min(5, Math.max(1, maxFocus)) : DEFAULT_PERSONAL_RULE_PREFERENCES.max_daily_focus_items,
    reminder_timing: cleanStringEnum(raw.reminder_timing, REMINDER_TIMINGS, DEFAULT_PERSONAL_RULE_PREFERENCES.reminder_timing),
    heavy_days: cleanDayList(raw.heavy_days),
    light_days: cleanDayList(raw.light_days),
    planning_style: cleanStringEnum(raw.planning_style, PLANNING_STYLES, DEFAULT_PERSONAL_RULE_PREFERENCES.planning_style),
  }
}

export function buildPersonalRulesPreview(rules: PersonalRule[], preferences: PersonalRulePreferences) {
  const dayLabel = (days: WeekDay[]) => days.length > 0 ? days.map((day) => day[0].toUpperCase() + day.slice(1)).join(", ") : "None set"
  const ruleLines = rules.length > 0
    ? rules.map((rule) => `- [${rule.category}] ${rule.title}${rule.description ? `: ${rule.description}` : ""}`).join("\n")
    : "- No active personal rules."

  return `Planning preferences:
- Working hours: ${preferences.working_hours_start}-${preferences.working_hours_end}
- Max daily focus items: ${preferences.max_daily_focus_items}
- Preferred reminder timing: ${preferences.reminder_timing}
- Planning style: ${preferences.planning_style}
- Heavy days: ${dayLabel(preferences.heavy_days)}
- Light days: ${dayLabel(preferences.light_days)}

Active personal operating rules:
${ruleLines}`
}

export async function getPersonalRulesContext(userId: string): Promise<PersonalRulesContext> {
  try {
    const rows = await sql`
      SELECT id, title, description, category, active, preferences, rule_type, created_at, updated_at
      FROM personal_rules
      WHERE user_id = ${userId}
      ORDER BY
        CASE WHEN rule_type = 'preferences' THEN 0 ELSE 1 END,
        active DESC,
        category ASC,
        updated_at DESC
    `

    const rules = rows
      .filter((row) => row.rule_type === "rule" && row.active === true)
      .map((row): PersonalRule => ({
        id: Number(row.id),
        title: typeof row.title === "string" ? row.title : "Untitled rule",
        description: typeof row.description === "string" ? row.description : null,
        category: cleanStringEnum(row.category, RULE_CATEGORIES, "other"),
        active: row.active === true,
        created_at: row.created_at ? String(row.created_at) : null,
        updated_at: row.updated_at ? String(row.updated_at) : null,
      }))

    const preferenceRow = rows.find((row) => row.rule_type === "preferences")
    const preferences = normalizePersonalRulePreferences(preferenceRow?.preferences)
    return {
      rules,
      preferences,
      preview: buildPersonalRulesPreview(rules, preferences),
      unavailable: false,
    }
  } catch (error) {
    if (!isMissingSchema(error)) throw error
    const preferences = DEFAULT_PERSONAL_RULE_PREFERENCES
    return {
      rules: [],
      preferences,
      preview: buildPersonalRulesPreview([], preferences),
      unavailable: true,
    }
  }
}
