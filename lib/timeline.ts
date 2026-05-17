import { sql } from "@/lib/db"

export type EventType =
  | "task_completed"
  | "goal_completed"
  | "project_completed"
  | "project_milestone"
  | "note_created"
  | "weekly_review"
  | "habit_streak"
  | "wishlist_purchased"
  | "investment_added"
  | "budget_milestone"
  | "maintenance_completed"
  | "vault_renewal_completed"
  | "people_followup_completed"
  | "commitment_completed"

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

export type TimelineFilters = {
  search?: string
  type?: string
  lifeAreaId?: string
  startDate?: string | null
  endDate?: string | null
  limit?: number
}

export type TimelineData = {
  events: TimelineEvent[]
  total: number
  life_areas: LifeAreaRow[]
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

function ns(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? "" : date.toISOString()
  }
  return ""
}

function cleanDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null
}

function dateBound(value: string | null | undefined, endOfDay = false) {
  const clean = cleanDate(value)
  if (!clean) return null
  return new Date(`${clean}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`)
}

function stringifyMeta(meta: Record<string, unknown>) {
  return Object.values(meta)
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase())
    .join(" ")
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
  const milestones = new Set([7, 14, 21, 30, 50, 100])
  const byHabit = new Map<number, { dates: string[]; meta: Record<string, unknown> }>()

  for (const row of checkins) {
    const habitId = Number(row.habit_id)
    const rawDate = row.checkin_date instanceof Date
      ? row.checkin_date.toISOString().slice(0, 10)
      : String(row.checkin_date ?? "").slice(0, 10)
    if (!habitId || !rawDate) continue

    if (!byHabit.has(habitId)) byHabit.set(habitId, { dates: [], meta: row })
    const entry = byHabit.get(habitId)!
    if (!entry.dates.includes(rawDate)) entry.dates.push(rawDate)
  }

  const events: TimelineEvent[] = []
  for (const [habitId, { dates, meta }] of byHabit) {
    dates.sort()
    dates.forEach((dateStr, index) => {
      const count = index + 1
      if (!milestones.has(count)) return
      events.push({
        id: `habit_streak-${habitId}-${count}`,
        type: "habit_streak",
        label: `${count}-checkin milestone`,
        title: String(meta.habit_name ?? "Habit"),
        occurred_at: new Date(`${dateStr}T12:00:00Z`).toISOString(),
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

export async function getTimelineData(userId: string, filters: TimelineFilters = {}): Promise<TimelineData> {
  const search = filters.search?.trim().toLowerCase() ?? ""
  const typeFilter = filters.type ?? "all"
  const lifeAreaFilter = filters.lifeAreaId ?? "all"
  const start = dateBound(filters.startDate, false)
  const end = dateBound(filters.endDate, true)
  const limit = Math.min(500, Math.max(1, filters.limit || 200))
  const uid = userId

  const [
    taskRows,
    goalRows,
    projectRows,
    projectActivityRows,
    noteRows,
    reviewRows,
    wishlistRows,
    investmentRows,
    budgetCategoryRows,
    budgetGoalRows,
    maintenanceRows,
    vaultRenewalRows,
    peopleFollowupRows,
    commitmentRows,
    checkinRows,
    areaRows,
  ] = await Promise.all([
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
      SELECT pa.id::text AS source_id,
             COALESCE(NULLIF(pa.message, ''), pa.action) AS title,
             pa.created_at AS occurred_at,
             p.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
             p.title AS meta1,
             pa.action AS meta2
      FROM project_activity pa
      JOIN projects p ON pa.project_id = p.id AND p.user_id = ${uid}
      LEFT JOIN life_areas la ON p.life_area_id = la.id AND la.user_id = ${uid}
      WHERE pa.user_id = ${uid}
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
      SELECT bg.id::text AS source_id, bg.name AS title, bg.created_at AS occurred_at,
             bc.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
             bg.target_amount::text AS meta1,
             bg.current_amount::text AS meta2
      FROM budget_goals bg
      LEFT JOIN budget_categories bc ON bg.category_id = bc.id AND bc.user_id = ${uid}
      LEFT JOIN life_areas la ON bc.life_area_id = la.id AND la.user_id = ${uid}
      WHERE bg.user_id = ${uid}
        AND bg.current_amount >= bg.target_amount
    ` as Promise<Record<string, unknown>[]>),
    safe(sql`
      SELECT mi.id::text AS source_id, mi.title,
             (mi.last_completed_date::timestamp + TIME '12:00') AS occurred_at,
             mi.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
             mi.category AS meta1,
             mi.recurrence AS meta2
      FROM maintenance_items mi
      LEFT JOIN life_areas la ON mi.life_area_id = la.id AND la.user_id = ${uid}
      WHERE mi.user_id = ${uid}
        AND mi.last_completed_date IS NOT NULL
    ` as Promise<Record<string, unknown>[]>),
    safe(sql`
      SELECT mi.id::text AS source_id,
             COALESCE(vi.title, mi.title) AS title,
             (mi.last_completed_date::timestamp + TIME '12:00') AS occurred_at,
             COALESCE(mi.life_area_id, vi.life_area_id) AS life_area_id,
             la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
             mi.title AS meta1,
             vi.category AS meta2
      FROM maintenance_items mi
      JOIN vault_items vi ON mi.vault_item_id = vi.id AND vi.user_id = ${uid}
      LEFT JOIN life_areas la ON COALESCE(mi.life_area_id, vi.life_area_id) = la.id AND la.user_id = ${uid}
      WHERE mi.user_id = ${uid}
        AND mi.last_completed_date IS NOT NULL
        AND mi.vault_item_id IS NOT NULL
    ` as Promise<Record<string, unknown>[]>),
    safe(sql`
      SELECT pr.id::text AS source_id,
             COALESCE(NULLIF(pr.title, ''), 'Follow up with ' || p.name) AS title,
             COALESCE(pr.updated_at, pr.remind_at) AS occurred_at,
             p.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
             p.name AS meta1
      FROM people_reminders pr
      JOIN people p ON pr.person_id = p.id AND p.user_id = ${uid}
      LEFT JOIN life_areas la ON p.life_area_id = la.id AND la.user_id = ${uid}
      WHERE pr.user_id = ${uid}
        AND pr.reminder_type = 'follow_up'
        AND pr.is_sent = TRUE
    ` as Promise<Record<string, unknown>[]>),
    safe(sql`
      SELECT c.id::text AS source_id, c.title, c.updated_at AS occurred_at,
             c.life_area_id, la.name AS life_area_name, la.icon AS life_area_icon, la.color AS life_area_color,
             c.committed_to AS meta1,
             c.commitment_type AS meta2
      FROM commitments c
      LEFT JOIN life_areas la ON c.life_area_id = la.id AND la.user_id = ${uid}
      WHERE c.user_id = ${uid}
        AND c.status = 'completed'
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
    ...projectActivityRows.map((r) => makeEvent("project_milestone", "Project milestone", r, undefined, { project: r.meta1, action: r.meta2 })),
    ...noteRows.map((r) => makeEvent("note_created", "Created note", r)),
    ...reviewRows.map((r) => makeEvent("weekly_review", "Completed weekly review", r)),
    ...wishlistRows.map((r) => makeEvent("wishlist_purchased", "Purchased wishlist item", r, undefined, { price: r.meta1 })),
    ...investmentRows.map((r) => makeEvent("investment_added", "Added investment", r, undefined, { symbol: r.meta1 })),
    ...budgetCategoryRows.map((r) => makeEvent("budget_milestone", "Started budget category", r)),
    ...budgetGoalRows.map((r) => makeEvent("budget_milestone", "Reached budget goal", r, `goal-${r.source_id}`, { target_amount: r.meta1, current_amount: r.meta2 })),
    ...maintenanceRows.map((r) => makeEvent("maintenance_completed", "Completed maintenance", r, undefined, { category: r.meta1, recurrence: r.meta2 })),
    ...vaultRenewalRows.map((r) => makeEvent("vault_renewal_completed", "Completed vault renewal", r, undefined, { maintenance_item: r.meta1, category: r.meta2 })),
    ...peopleFollowupRows.map((r) => makeEvent("people_followup_completed", "Completed people follow-up", r, undefined, { person: r.meta1 })),
    ...commitmentRows.map((r) => makeEvent("commitment_completed", "Completed commitment", r, undefined, { committed_to: r.meta1, commitment_type: r.meta2 })),
    ...computeStreakMilestones(checkinRows),
  ]

  let filtered = allEvents.filter((event) => event.occurred_at.length > 0)

  if (search) {
    filtered = filtered.filter((event) => {
      const haystack = [
        event.title,
        event.label,
        event.type,
        event.life_area_name,
        stringifyMeta(event.meta),
      ].join(" ").toLowerCase()
      return haystack.includes(search)
    })
  }

  if (typeFilter !== "all") {
    filtered = filtered.filter((event) => event.type === typeFilter)
  }

  if (lifeAreaFilter !== "all" && lifeAreaFilter !== "0") {
    const lifeAreaId = Number.parseInt(lifeAreaFilter, 10)
    if (!Number.isNaN(lifeAreaId)) {
      filtered = filtered.filter((event) => event.life_area_id === lifeAreaId)
    }
  }

  if (start) {
    filtered = filtered.filter((event) => new Date(event.occurred_at) >= start)
  }

  if (end) {
    filtered = filtered.filter((event) => new Date(event.occurred_at) <= end)
  }

  filtered.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())

  return {
    events: filtered.slice(0, limit),
    total: filtered.length,
    life_areas: areaRows,
  }
}
