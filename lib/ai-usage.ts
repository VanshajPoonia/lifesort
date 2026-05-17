import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export type AiUsageRoute = "chat" | "daily_content_generate" | "investment_screenshot_parse" | "weekly_summary" | "today_plan"
export type AiUsageStatus = "accepted" | "success" | "provider_error" | "rate_limited" | "rejected"

const DAILY_LIMITS: Record<AiUsageRoute, number> = {
  chat: 50,
  daily_content_generate: 15,
  investment_screenshot_parse: 10,
  weekly_summary: 5,
  today_plan: 3,
}

const COUNTED_STATUSES: AiUsageStatus[] = ["accepted", "success", "provider_error"]

interface AiUsageLimitResult {
  allowed: boolean
  limit: number
  used: number
  remaining: number
  disabled?: boolean
}

interface AiUsageEventInput {
  userId: string
  route: AiUsageRoute
  provider: string
  model: string
  status?: AiUsageStatus
  errorMessage?: string | null
}

function isMissingUsageTable(error: unknown) {
  const err = error as { code?: string; message?: string }
  const message = err.message?.toLowerCase() ?? ""
  return err.code === "42P01" || message.includes("ai_usage_events") || message.includes("does not exist")
}

function truncateError(message?: string | null) {
  if (!message) return null
  return message.slice(0, 500)
}

export function getAiDailyLimit(route: AiUsageRoute) {
  return DAILY_LIMITS[route]
}

export async function checkAiUsageLimit(userId: string, route: AiUsageRoute): Promise<AiUsageLimitResult> {
  const limit = DAILY_LIMITS[route]

  try {
    const result = await sql`
      SELECT COUNT(*)::int AS used
      FROM ai_usage_events
      WHERE user_id = ${userId}
        AND route = ${route}
        AND status = ANY(${COUNTED_STATUSES})
        AND created_at >= CURRENT_DATE
        AND created_at < CURRENT_DATE + INTERVAL '1 day'
    `
    const used = Number(result[0]?.used ?? 0)

    return {
      allowed: used < limit,
      limit,
      used,
      remaining: Math.max(0, limit - used),
    }
  } catch (error) {
    if (isMissingUsageTable(error)) {
      console.warn("[ai-usage] ai_usage_events table is missing; usage limits are disabled until migration runs.")
      return { allowed: true, limit, used: 0, remaining: limit, disabled: true }
    }
    throw error
  }
}

export async function createAiUsageEvent(input: AiUsageEventInput): Promise<number | null> {
  try {
    const result = await sql`
      INSERT INTO ai_usage_events (user_id, route, provider, model, status, error_message)
      VALUES (
        ${input.userId},
        ${input.route},
        ${input.provider},
        ${input.model},
        ${input.status ?? "accepted"},
        ${truncateError(input.errorMessage)}
      )
      RETURNING id
    `
    return Number(result[0]?.id ?? null)
  } catch (error) {
    if (isMissingUsageTable(error)) {
      return null
    }
    throw error
  }
}

export async function updateAiUsageEvent(
  id: number | null,
  status: AiUsageStatus,
  errorMessage?: string | null,
) {
  if (!id) return

  try {
    await sql`
      UPDATE ai_usage_events
      SET status = ${status}, error_message = ${truncateError(errorMessage)}
      WHERE id = ${id}
    `
  } catch (error) {
    if (isMissingUsageTable(error)) {
      return
    }
    throw error
  }
}
