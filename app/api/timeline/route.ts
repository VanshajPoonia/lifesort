import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

export type EventType =
  | "task_completed"
  | "goal_completed"
  | "project_completed"
  | "note_created"
  | "weekly_review"
  | "habit_streak"
  | "wishlist_purchased"
  | "investment_added"
  | "budget_milestone"

export type TimelineEvent = {
  id: string
  type: EventType
  label: string
  title: string
  occurred_at: string
  life_area_id: number | null
  life_area_name: string | null
  life_area_icon: string | null
  life_area_color: string | null
  meta: Record<string, unknown>
}

export type LifeAreaRow = {
  id: number
  name: string
  icon: string
  color: string
}

function isMissingTable(error: unknown): boolean {
  const err = error as { code?: string; message?: string }
  const msg = err.message?.toLowerCase() ?? ""
  return err.code === "42P01" || err.code === "42703" || msg.includes("does not exist")
}

async function safe<T>(query: Promise<T[]>): Promise<T[]> {
  try {
    return await query
  } catch (err) {
    if (isMissingTable(err)) return []
    throw err
  }
}

function ns(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === "string") {
    const d = new Date(v)
    return isNaN(d.getTime()) ? "" : d.toISOString()
  }
  return ""
}

function makeEvent(
  type: EventType,
  label: string,
  row: Record<string, unknown>,
  idSuffix?: string,
  meta: Record<string, unknown> = {},
): TimelineEvent {
  return {
    id: `${type}-${idSuffix ?? String(row.source_id)}`,
    type,
    label,
    title: String(row.title ?? ""),
    occurred_at: toIso(row.occurred_at),
    life_area_id: row.life_area_id != null ? Number(row.life_area_id) : null,
    life_area_name: ns(row.life_area_name),
    life_area_icon: ns(row.life_area_icon),
    life_area_color: ns(row.life_area_color),
    meta,
  }
}

function computeStreakMilestones(checkins: Record<string, unknown>[]): TimelineEvent[] {
  const MILESTONES = new Set([7, 14, 21, 30, 50, 100])
  const byHabit = new Map<number, { dates: string[]; meta: Record<string, unknown> }>()

  for (const row of checkins) {
    const habitId = Number(row.habit_id)
    const rawDate = row.checkin_date instanceof Date
      ? row.checkin_date.toISOString().slice(0, 10)
      : String(row.checkin_date ?? "").slice(0, 10)
    if (!rawDate) continue

    if (!byHabit.has(habitId)) byHabit.set(habitId, { dates: [], meta: row })
    const entry = byHabit.get(habitId)!
    if (!entry.dates.includes(rawDate)) entry.dates.push(rawDate)
  }

  const events: TimelineEvent[] = []

  for (const [habitId, { dates, meta }] of byHabit) {
    dates.sort()
    dates.forEach((dateStr, idx) => {
      const count = idx + 1
      if (!MILESTONES.has(count)) return
      events.push({
        id: `habit_streak-${habitId}-${count}`,
        type: "habit_streak",
        label: `${count}-checkin milestone`,
        title: String(meta.habit_name ?? "Habit"),
        occurred_at: new Date(dateStr + "T12:00:00Z").toISOString(),
        life_area_id: meta.life_area_id != null ? Number(meta.life_area_id) : null,
        life_area_name: ns(meta.life_area_name),
        life_area_icon: ns(meta.life_area_icon),
        life_area_color: ns(meta.life_area_color),
        meta: { milestone: count },
      })
    })
  }

  return events
}

export async function GET(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")?.trim().toLowerCase() ?? ""
  const typeFilter = searchParams.get("type") ?? "all"
  const lifeAreaFilter = searchParams.get("life_area_id") ?? "all"
  const limit = Math.min(500, parseInt(searchParams.get("limit") ?? "200") || 200)

  const uid = user.id

  const [taskRows, goalRows, projectRows, noteRows, reviewRows, wishlistRows, investmentRows, budgetRows, checkinRows, areaRows] =
    await Promise.all([
      safe(sql`
        SELECT t.id::text AS source_id, t.title, t.updated_at AS occurred_at,
               t.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
               t.priority AS meta1
        FROM tasks t
        LEFT JOIN life_areas la ON t.life_area_id = la.id AND la.user_id = ${uid}
        WHERE t.user_id = ${uid} AND t.completed = TRUE
      ` as Promise<Record<string, unknown>[]>),

      safe(sql`
        SELECT g.id::text AS source_id, g.title, g.updated_at AS occurred_at,
               g.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
               g.priority AS meta1
        FROM goals g
        LEFT JOIN life_areas la ON g.life_area_id = la.id AND la.user_id = ${uid}
        WHERE g.user_id = ${uid} AND g.status = 'completed'
      ` as Promise<Record<string, unknown>[]>),

      safe(sql`
        SELECT p.id::text AS source_id, p.title, p.updated_at AS occurred_at,
               p.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
               p.priority AS meta1
        FROM projects p
        LEFT JOIN life_areas la ON p.life_area_id = la.id AND la.user_id = ${uid}
        WHERE p.user_id = ${uid} AND p.status = 'completed'
      ` as Promise<Record<string, unknown>[]>),

      safe(sql`
        SELECT n.id::text AS source_id, COALESCE(NULLIF(n.title, ''), 'Untitled') AS title,
               n.created_at AS occurred_at,
               n.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
               NULL AS meta1
        FROM notes n
        LEFT JOIN life_areas la ON n.life_area_id = la.id AND la.user_id = ${uid}
        WHERE n.user_id = ${uid}
      ` as Promise<Record<string, unknown>[]>),

      safe(sql`
        SELECT wr.id::text AS source_id,
               'Week of ' || to_char(wr.week_start, 'Mon DD, YYYY') AS title,
               wr.updated_at AS occurred_at,
               NULL::int AS life_area_id, NULL AS life_area_name, NULL AS life_area_icon, NULL AS life_area_color,
               NULL AS meta1
        FROM weekly_reviews wr
        WHERE wr.user_id = ${uid}
      ` as Promise<Record<string, unknown>[]>),

      safe(sql`
        SELECT wi.id::text AS source_id, wi.title, wi.updated_at AS occurred_at,
               wi.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
               wi.price::text AS meta1
        FROM wishlist_items wi
        LEFT JOIN life_areas la ON wi.life_area_id = la.id AND la.user_id = ${uid}
        WHERE wi.user_id = ${uid} AND wi.purchased = TRUE
      ` as Promise<Record<string, unknown>[]>),

      safe(sql`
        SELECT i.id::text AS source_id,
               CASE WHEN i.symbol IS NOT NULL AND i.symbol != ''
                    THEN i.name || ' (' || i.symbol || ')'
                    ELSE i.name END AS title,
               COALESCE(i.purchase_date::timestamp, i.created_at) AS occurred_at,
               i.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
               i.symbol AS meta1
        FROM investments i
        LEFT JOIN life_areas la ON i.life_area_id = la.id AND la.user_id = ${uid}
        WHERE i.user_id = ${uid}
      ` as Promise<Record<string, unknown>[]>),

      safe(sql`
        SELECT bc.id::text AS source_id, bc.name AS title, bc.created_at AS occurred_at,
               bc.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
               NULL AS meta1
        FROM budget_categories bc
        LEFT JOIN life_areas la ON bc.life_area_id = la.id AND la.user_id = ${uid}
        WHERE bc.user_id = ${uid}
      ` as Promise<Record<string, unknown>[]>),

      safe(sql`
        SELECT hc.checkin_date, hc.habit_id,
               h.name AS habit_name, h.life_area_id,
               la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color
        FROM habit_checkins hc
        JOIN habits h ON hc.habit_id = h.id AND h.user_id = ${uid}
        LEFT JOIN life_areas la ON h.life_area_id = la.id AND la.user_id = ${uid}
        WHERE hc.user_id = ${uid}
        ORDER BY hc.habit_id, hc.checkin_date
      ` as Promise<Record<string, unknown>[]>),

      safe(sql`
        SELECT id, name, icon, color FROM life_areas WHERE user_id = ${uid} ORDER BY sort_order
      ` as unknown as Promise<LifeAreaRow[]>),
    ])

  const allEvents: TimelineEvent[] = [
    ...taskRows.map((r) => makeEvent("task_completed", "Completed task", r, undefined, { priority: r.meta1 })),
    ...goalRows.map((r) => makeEvent("goal_completed", "Achieved goal", r, undefined, { priority: r.meta1 })),
    ...projectRows.map((r) => makeEvent("project_completed", "Completed project", r, undefined, { priority: r.meta1 })),
    ...noteRows.map((r) => makeEvent("note_created", "Created note", r)),
    ...reviewRows.map((r) => makeEvent("weekly_review", "Completed weekly review", r)),
    ...wishlistRows.map((r) => makeEvent("wishlist_purchased", "Purchased wishlist item", r, undefined, { price: r.meta1 })),
    ...investmentRows.map((r) => makeEvent("investment_added", "Added investment", r, undefined, { symbol: r.meta1 })),
    ...budgetRows.map((r) => makeEvent("budget_milestone", "Started budget category", r)),
    ...computeStreakMilestones(checkinRows),
  ]

  let filtered = allEvents.filter((e) => e.occurred_at.length > 0)

  if (search) {
    filtered = filtered.filter((e) => e.title.toLowerCase().includes(search))
  }
  if (typeFilter !== "all") {
    filtered = filtered.filter((e) => e.type === typeFilter)
  }
  if (lifeAreaFilter !== "all" && lifeAreaFilter !== "0") {
    const laId = parseInt(lifeAreaFilter)
    if (!isNaN(laId)) {
      filtered = filtered.filter((e) => e.life_area_id === laId)
    }
  }

  filtered.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  return NextResponse.json({
    events: filtered.slice(0, limit),
    total: filtered.length,
    life_areas: areaRows,
  })
}
