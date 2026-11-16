import { randomUUID } from "crypto"

import { addDaysToDate, daysBetweenDates } from "@/lib/date-math"
import { sql } from "@/lib/db"
import { DEFAULT_LIFE_AREAS } from "@/lib/life-areas"
import { getKitDefinition, kitProgress, planKit, type KitInputs, type KitProgress } from "@/lib/life-kits"

// Database side of Life Kits. Every query is scoped by user_id. "Untouched" means the
// item's updated_at is not later than kit_updated_at, the value the kit itself last wrote.

export type KitTask = { id: number; title: string; due_date: string | null; completed: boolean; status: string }

export type KitSummary = {
  id: string
  kit_key: string
  title: string
  status: "active" | "paused" | "finished"
  anchor_date: string
  start_date: string
  life_area_id: number | null
  domain_name: string | null
  domain_color: string | null
  progress: KitProgress
  tasks_done: number
  tasks_total: number
  next_tasks: KitTask[]
}

type KitRow = {
  id: string
  kit_key: string
  title: string
  status: KitSummary["status"]
  anchor_date: string
  start_date: string
  paused_on: string | null
  life_area_id: number | null
  domain_name: string | null
  domain_color: string | null
}

async function resolveDomain(userId: string, domainName: string, lifeAreaId: number | null) {
  if (lifeAreaId) {
    const owned = await sql`SELECT id FROM life_areas WHERE id = ${lifeAreaId} AND user_id = ${userId}`
    if (owned.length) return lifeAreaId
  }
  const existing = await sql`
    SELECT id FROM life_areas WHERE user_id = ${userId} AND lower(name) = lower(${domainName})
    ORDER BY sort_order ASC LIMIT 1
  `
  if (existing.length) return Number(existing[0].id)
  const preset = DEFAULT_LIFE_AREAS.find((area) => area.name === domainName)
  const created = await sql`
    INSERT INTO life_areas (user_id, name, icon, color, description, sort_order)
    VALUES (${userId}, ${domainName}, ${preset?.icon ?? "Target"}, ${preset?.color ?? "#2563EB"}, ${preset?.description ?? null}, 100)
    ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `
  return Number(created[0].id)
}

export type StartKitInput = {
  kitKey: string
  anchorDate: string
  today: string
  inputs: KitInputs
  lifeAreaId: number | null
  skip: string[]
}

// Creates the kit and everything it plans in one transaction, recording each item.
export async function startKit(userId: string, input: StartKitInput) {
  const definition = getKitDefinition(input.kitKey)
  if (!definition) throw new Error("Unknown kit")

  const plan = planKit(definition, input.anchorDate, input.today, input.inputs)
  const items = plan.items.filter((item) => !input.skip.includes(item.key))
  const areaId = await resolveDomain(userId, definition.domainName, input.lifeAreaId)
  const kitId = randomUUID()
  const details = JSON.stringify({ label: input.inputs.label, amount: input.inputs.amount, skipped_past: plan.skippedPast })

  await sql.transaction((tx) => {
    const queries = [
      tx`
        INSERT INTO life_kits (id, user_id, kit_key, title, life_area_id, anchor_date, start_date, details)
        VALUES (${kitId}, ${userId}, ${definition.key}, ${plan.title}, ${areaId}, ${input.anchorDate}, ${input.today}, ${details}::jsonb)
      `,
    ]
    for (const item of items) {
      if (item.type === "goal") {
        queries.push(tx`
          WITH created AS (
            INSERT INTO goals (user_id, title, target_date, status, priority, target_value, current_value, life_area_id)
            VALUES (${userId}, ${item.title}, ${item.targetDate}, 'active', 'high', ${item.targetValue}, 0, ${areaId})
            RETURNING id, updated_at
          )
          INSERT INTO life_kit_items (kit_id, item_type, item_id, planned_date, kit_updated_at)
          SELECT ${kitId}, 'goal', id, ${item.targetDate}, updated_at FROM created
        `)
      } else if (item.type === "task") {
        queries.push(tx`
          WITH created AS (
            INSERT INTO tasks (user_id, title, priority, due_date, status, completed, life_area_id, goal_id, sort_order)
            VALUES (${userId}, ${item.title}, ${item.priority}, ${item.date}, 'next', FALSE, ${areaId},
              (SELECT item_id FROM life_kit_items WHERE kit_id = ${kitId} AND item_type = 'goal' LIMIT 1), 0)
            RETURNING id, updated_at
          )
          INSERT INTO life_kit_items (kit_id, item_type, item_id, planned_date, kit_updated_at)
          SELECT ${kitId}, 'task', id, ${item.date}, updated_at FROM created
        `)
      } else if (item.type === "habit") {
        queries.push(tx`
          WITH created AS (
            INSERT INTO habits (user_id, name, frequency, custom_days, target_count, is_active, life_area_id, sort_order)
            VALUES (${userId}, ${item.name}, ${item.frequency}, ${item.customDays}::integer[], 1, TRUE, ${areaId}, 0)
            RETURNING id, updated_at
          )
          INSERT INTO life_kit_items (kit_id, item_type, item_id, kit_updated_at)
          SELECT ${kitId}, 'habit', id, updated_at FROM created
        `)
      } else if (item.type === "budget_category") {
        queries.push(tx`
          WITH created AS (
            INSERT INTO budget_categories (user_id, name, color, icon, budget_limit, life_area_id)
            VALUES (${userId}, ${item.name}, ${item.color}, ${item.icon}, 0, ${areaId})
            RETURNING id
          )
          INSERT INTO life_kit_items (kit_id, item_type, item_id)
          SELECT ${kitId}, 'budget_category', id FROM created
        `)
      } else {
        queries.push(tx`
          WITH created AS (
            INSERT INTO vault_items (user_id, title, category, expiry_date, reminder_date, life_area_id)
            VALUES (${userId}, ${item.title}, ${item.category}, ${item.expiryDate}, ${item.reminderDate}, ${areaId})
            RETURNING id, updated_at
          )
          INSERT INTO life_kit_items (kit_id, item_type, item_id, planned_date, kit_updated_at)
          SELECT ${kitId}, 'vault_item', id, ${item.expiryDate}, updated_at FROM created
        `)
      }
    }
    return queries
  })

  return { id: kitId, title: plan.title, created: items.length, skipped_past: plan.skippedPast }
}

export async function listKits(userId: string, today: string, lifeAreaId: number | null): Promise<KitSummary[]> {
  const kits = (await sql`
    SELECT k.id, k.kit_key, k.title, k.status, k.anchor_date::text AS anchor_date, k.start_date::text AS start_date,
      k.paused_on::text AS paused_on, k.life_area_id, la.name AS domain_name, la.color AS domain_color
    FROM life_kits k
    LEFT JOIN life_areas la ON la.id = k.life_area_id
    WHERE k.user_id = ${userId} AND (${lifeAreaId}::integer IS NULL OR k.life_area_id = ${lifeAreaId})
    ORDER BY CASE k.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, k.created_at DESC
  `) as KitRow[]
  if (kits.length === 0) return []

  const kitIds = kits.map((kit) => kit.id)
  const taskRows = (await sql`
    SELECT i.kit_id, t.id, t.title, t.due_date::text AS due_date, t.completed, t.status
    FROM life_kit_items i
    JOIN tasks t ON t.id = i.item_id AND t.user_id = ${userId}
    WHERE i.item_type = 'task' AND i.kit_id = ANY(${kitIds})
    ORDER BY t.due_date ASC NULLS LAST, t.id ASC
  `) as Array<KitTask & { kit_id: string }>

  return kits.flatMap((kit) => {
    const definition = getKitDefinition(kit.kit_key)
    if (!definition) return []
    const tasks = taskRows.filter((task) => task.kit_id === kit.id)
    const counted = tasks.filter((task) => task.status !== "cancelled")
    return [
      {
        id: kit.id,
        kit_key: kit.kit_key,
        title: kit.title,
        status: kit.status,
        anchor_date: kit.anchor_date,
        start_date: kit.start_date,
        life_area_id: kit.life_area_id,
        domain_name: kit.domain_name,
        domain_color: kit.domain_color,
        progress: kitProgress(definition, kit.anchor_date, kit.start_date, today),
        tasks_done: counted.filter((task) => task.completed).length,
        tasks_total: counted.length,
        next_tasks: counted
          .filter((task) => !task.completed)
          .slice(0, 3)
          .map((task) => ({ id: task.id, title: task.title, due_date: task.due_date, completed: task.completed, status: task.status })),
      },
    ]
  })
}

async function ownedKit(userId: string, kitId: string) {
  const rows = (await sql`
    SELECT id, kit_key, status, anchor_date::text AS anchor_date, paused_on::text AS paused_on
    FROM life_kits WHERE id = ${kitId} AND user_id = ${userId}
  `) as Array<{ id: string; kit_key: string; status: KitSummary["status"]; anchor_date: string; paused_on: string | null }>
  return rows[0] ?? null
}

// Pausing turns off the kit's habits and moves its dated, open steps to Later.
// Kit writes only refresh kit_updated_at on items the person hadn't changed, so a
// pause never makes a changed item look untouched, or the other way round.
export async function pauseKit(userId: string, kitId: string, today: string) {
  const kit = await ownedKit(userId, kitId)
  if (!kit) return null
  if (kit.status !== "active") return kit

  await sql.transaction((tx) => [
    tx`
      WITH targets AS (
        SELECT i.id AS link_id, h.id, h.updated_at <= i.kit_updated_at AS untouched
        FROM life_kit_items i JOIN habits h ON h.id = i.item_id AND h.user_id = ${userId}
        WHERE i.kit_id = ${kitId} AND i.item_type = 'habit' AND h.is_active
      ), changed AS (
        UPDATE habits h SET is_active = FALSE, updated_at = NOW() FROM targets t WHERE h.id = t.id
        RETURNING h.id, h.updated_at
      )
      UPDATE life_kit_items i SET kit_updated_at = c.updated_at
      FROM targets t JOIN changed c ON c.id = t.id
      WHERE i.id = t.link_id AND t.untouched
    `,
    tx`
      WITH targets AS (
        SELECT i.id AS link_id, t.id, t.updated_at <= i.kit_updated_at AS untouched
        FROM life_kit_items i JOIN tasks t ON t.id = i.item_id AND t.user_id = ${userId}
        WHERE i.kit_id = ${kitId} AND i.item_type = 'task' AND NOT t.completed AND t.status <> 'someday' AND t.due_date IS NOT NULL
      ), changed AS (
        UPDATE tasks t SET status = 'someday', due_date = NULL, updated_at = NOW() FROM targets x WHERE t.id = x.id
        RETURNING t.id, t.updated_at
      )
      UPDATE life_kit_items i
      SET moved_by_pause = TRUE, kit_updated_at = CASE WHEN t.untouched THEN c.updated_at ELSE i.kit_updated_at END
      FROM targets t JOIN changed c ON c.id = t.id
      WHERE i.id = t.link_id
    `,
    tx`UPDATE life_kits SET status = 'paused', paused_on = ${today}, updated_at = NOW() WHERE id = ${kitId} AND user_id = ${userId}`,
  ])
  return { ...kit, status: "paused" as const }
}

// Resuming puts paused steps back on their planned dates. Dates that passed while
// paused are spread one a day from today, the same rule as starting a kit.
export async function resumeKit(userId: string, kitId: string, today: string) {
  const kit = await ownedKit(userId, kitId)
  if (!kit) return null
  if (kit.status !== "paused") return kit

  const moved = (await sql`
    SELECT i.id AS link_id, t.id, i.planned_date::text AS planned_date, t.updated_at <= i.kit_updated_at AS untouched
    FROM life_kit_items i JOIN tasks t ON t.id = i.item_id AND t.user_id = ${userId}
    WHERE i.kit_id = ${kitId} AND i.item_type = 'task' AND i.moved_by_pause AND NOT t.completed AND t.status = 'someday'
    ORDER BY i.planned_date ASC NULLS LAST, t.id ASC
  `) as Array<{ link_id: number; id: number; planned_date: string | null; untouched: boolean }>

  let late = 0
  const dated = moved.map((row) => {
    if (row.planned_date && row.planned_date >= today) return { ...row, date: row.planned_date }
    return { ...row, date: addDaysToDate(today, late++) }
  })

  await sql.transaction((tx) => [
    ...dated.map(
      (row) => tx`
        WITH changed AS (
          UPDATE tasks SET status = 'next', due_date = ${row.date}, updated_at = NOW()
          WHERE id = ${row.id} AND user_id = ${userId}
          RETURNING updated_at
        )
        UPDATE life_kit_items
        SET moved_by_pause = FALSE,
          kit_updated_at = CASE WHEN ${row.untouched} THEN (SELECT updated_at FROM changed) ELSE kit_updated_at END
        WHERE id = ${row.link_id}
      `,
    ),
    tx`
      WITH targets AS (
        SELECT i.id AS link_id, h.id
        FROM life_kit_items i JOIN habits h ON h.id = i.item_id AND h.user_id = ${userId}
        WHERE i.kit_id = ${kitId} AND i.item_type = 'habit' AND NOT h.is_active AND h.updated_at <= i.kit_updated_at
      ), changed AS (
        UPDATE habits h SET is_active = TRUE, updated_at = NOW() FROM targets t WHERE h.id = t.id
        RETURNING h.id, h.updated_at
      )
      UPDATE life_kit_items i SET kit_updated_at = c.updated_at
      FROM targets t JOIN changed c ON c.id = t.id
      WHERE i.id = t.link_id
    `,
    tx`UPDATE life_kits SET status = 'active', paused_on = NULL, updated_at = NOW() WHERE id = ${kitId} AND user_id = ${userId}`,
  ])
  return { ...kit, status: "active" as const, days_paused: kit.paused_on ? daysBetweenDates(kit.paused_on, today) : 0 }
}

export async function finishKit(userId: string, kitId: string) {
  const rows = await sql`
    UPDATE life_kits SET status = 'finished', paused_on = NULL, updated_at = NOW()
    WHERE id = ${kitId} AND user_id = ${userId}
    RETURNING id
  `
  return rows.length > 0
}

// Removing a kit lets go of steps the person never touched, turns off unused habits,
// and deletes an unused goal, budget line or Vault entry. Anything changed or used stays.
export async function removeKit(userId: string, kitId: string) {
  const kit = await ownedKit(userId, kitId)
  if (!kit) return null

  const [tasks, habits, goals, budgets, vault] = await sql.transaction((tx) => [
    tx`
      UPDATE tasks t SET status = 'cancelled', completed = TRUE, updated_at = NOW()
      FROM life_kit_items i
      WHERE i.kit_id = ${kitId} AND i.item_type = 'task' AND t.id = i.item_id AND t.user_id = ${userId}
        AND NOT t.completed AND t.updated_at <= i.kit_updated_at
      RETURNING t.id
    `,
    tx`
      UPDATE habits h SET is_active = FALSE, updated_at = NOW()
      FROM life_kit_items i
      WHERE i.kit_id = ${kitId} AND i.item_type = 'habit' AND h.id = i.item_id AND h.user_id = ${userId}
        AND h.updated_at <= i.kit_updated_at
        AND NOT EXISTS (SELECT 1 FROM habit_checkins c WHERE c.habit_id = h.id)
      RETURNING h.id
    `,
    tx`
      DELETE FROM goals g
      USING life_kit_items i
      WHERE i.kit_id = ${kitId} AND i.item_type = 'goal' AND g.id = i.item_id AND g.user_id = ${userId}
        AND g.updated_at <= i.kit_updated_at
      RETURNING g.id
    `,
    tx`
      DELETE FROM budget_categories b
      USING life_kit_items i
      WHERE i.kit_id = ${kitId} AND i.item_type = 'budget_category' AND b.id = i.item_id AND b.user_id = ${userId}
        AND NOT EXISTS (SELECT 1 FROM budget_transactions bt WHERE bt.category_id = b.id)
      RETURNING b.id
    `,
    tx`
      DELETE FROM vault_items v
      USING life_kit_items i
      WHERE i.kit_id = ${kitId} AND i.item_type = 'vault_item' AND v.id = i.item_id AND v.user_id = ${userId}
        AND v.updated_at <= i.kit_updated_at
      RETURNING v.id
    `,
    tx`DELETE FROM life_kits WHERE id = ${kitId} AND user_id = ${userId}`,
  ])

  return {
    let_go_tasks: tasks.length,
    stopped_habits: habits.length,
    deleted: goals.length + budgets.length + vault.length,
  }
}
