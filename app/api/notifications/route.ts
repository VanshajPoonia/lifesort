import { NextResponse } from "next/server"
import { neon } from "@/lib/neon-client"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

export type NotificationType =
  | "task_due"
  | "goal_deadline"
  | "habit_missed"
  | "project_deadline"
  | "vault_expiring"
  | "people_followup"
  | "weekly_review"
  | "budget_warning"
  | "journal_streak_milestone"
  | "habit_streak_milestone"
  | "weekly_task_record"
  | "goal_completed"
  | "budget_success"

export type Notification = {
  id: number
  type: NotificationType
  related_item_type: string
  related_item_id: string
  title: string
  message: string
  is_read: boolean
  read_at: string | null
  created_at: string
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

async function generateNotifications(uid: string): Promise<void> {
  // Cleanup: remove read notifications older than 30 days
  await safe(sql`
    DELETE FROM notifications
    WHERE user_id = ${uid} AND is_read = TRUE AND created_at < NOW() - INTERVAL '30 days'
  ` as Promise<unknown[]>)

  await Promise.allSettled([
    // task_due: incomplete tasks due in next 3 days
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      SELECT
        ${uid}, 'task_due', 'tasks', t.id::text,
        'Task due: ' || t.title,
        'Due ' || to_char(t.due_date, 'Mon DD, YYYY')
      FROM tasks t
      WHERE t.user_id = ${uid}
        AND t.completed = FALSE
        AND t.due_date IS NOT NULL
        AND t.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days'
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // goal_deadline: active goals with target_date in next 7 days
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      SELECT
        ${uid}, 'goal_deadline', 'goals', g.id::text,
        'Goal deadline: ' || g.title,
        'Target date: ' || to_char(g.target_date, 'Mon DD, YYYY')
      FROM goals g
      WHERE g.user_id = ${uid}
        AND g.status != 'completed'
        AND g.target_date IS NOT NULL
        AND g.target_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // habit_missed: active daily habits with no checkin today
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      SELECT
        ${uid}, 'habit_missed', 'habits', h.id::text || '-' || CURRENT_DATE::text,
        'Habit check-in: ' || h.name,
        'You haven''t logged "' || h.name || '" today'
      FROM habits h
      WHERE h.user_id = ${uid}
        AND h.is_active = TRUE
        AND h.frequency = 'daily'
        AND NOT EXISTS (
          SELECT 1 FROM habit_checkins hc
          WHERE hc.habit_id = h.id
            AND hc.user_id = ${uid}
            AND hc.checkin_date = CURRENT_DATE
        )
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // project_deadline: active projects with due_date in next 7 days
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      SELECT
        ${uid}, 'project_deadline', 'projects', p.id::text,
        'Project deadline: ' || p.title,
        'Due ' || to_char(p.due_date, 'Mon DD, YYYY')
      FROM projects p
      WHERE p.user_id = ${uid}
        AND p.status NOT IN ('completed', 'archived')
        AND p.due_date IS NOT NULL
        AND p.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // vault_expiring: vault items expiring in next 30 days
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      SELECT
        ${uid}, 'vault_expiring', 'vault_items', vi.id::text,
        'Expiring soon: ' || vi.title,
        'Expires ' || to_char(vi.expiry_date, 'Mon DD, YYYY')
      FROM vault_items vi
      WHERE vi.user_id = ${uid}
        AND vi.expiry_date IS NOT NULL
        AND vi.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // people_followup: people reminders due within the next day
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      SELECT
        ${uid}, 'people_followup', 'people_reminders', pr.id::text,
        'Follow-up: ' || pr.title,
        'For ' || p.name || ' · ' || to_char(pr.remind_at, 'Mon DD')
      FROM people_reminders pr
      JOIN people p ON pr.person_id = p.id AND p.user_id = ${uid}
      WHERE pr.user_id = ${uid}
        AND pr.is_sent = FALSE
        AND pr.remind_at <= NOW() + INTERVAL '1 day'
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // weekly_review: nudge when no review exists for the previous full week
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      SELECT
        ${uid}, 'weekly_review', 'weekly_reviews', prev_monday::text,
        'Time for your weekly review',
        'Reflect on the week of ' || to_char(prev_monday, 'Mon DD, YYYY')
      FROM (
        SELECT
          (CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::int + 6) % 7) * INTERVAL '1 day')::date AS this_monday,
          (CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::int + 6) % 7) * INTERVAL '1 day' - INTERVAL '7 days')::date AS prev_monday
      ) dates
      WHERE NOT EXISTS (
        SELECT 1 FROM weekly_reviews wr
        WHERE wr.user_id = ${uid}
          AND wr.week_start = dates.prev_monday
      )
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // budget_warning: categories where current-month spending >= 80% of budget_limit
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      SELECT
        ${uid}, 'budget_warning', 'budget_categories',
        bc.id::text || '-' || to_char(NOW(), 'YYYY-MM'),
        'Budget warning: ' || bc.name,
        ROUND((spent.total / bc.budget_limit * 100)::numeric, 0)::text || '% of your ' || bc.name || ' budget used this month'
      FROM budget_categories bc
      JOIN (
        SELECT category_id, SUM(amount) AS total
        FROM budget_transactions
        WHERE user_id = ${uid}
          AND type = 'expense'
          AND date >= date_trunc('month', CURRENT_DATE)
          AND date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        GROUP BY category_id
      ) spent ON bc.id = spent.category_id
      WHERE bc.user_id = ${uid}
        AND bc.budget_limit IS NOT NULL
        AND bc.budget_limit > 0
        AND spent.total / bc.budget_limit >= 0.8
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // journal_streak_milestone: 7/14/30/60/100 consecutive journal days ending today
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      SELECT
        ${uid}, 'journal_streak_milestone', 'daily_journal_entries', 'journal-' || milestones.days::text,
        'Journal streak: ' || milestones.days::text || ' days',
        'You have journaled for ' || milestones.days::text || ' days in a row.'
      FROM (VALUES (7), (14), (30), (60), (100)) AS milestones(days)
      WHERE NOT EXISTS (
        SELECT 1
        FROM generate_series(CURRENT_DATE - (milestones.days - 1) * INTERVAL '1 day', CURRENT_DATE, INTERVAL '1 day') AS required_days(day)
        WHERE NOT EXISTS (
          SELECT 1
          FROM daily_journal_entries dje
          WHERE dje.user_id = ${uid}
            AND dje.journal_date = required_days.day::date
        )
      )
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // habit_streak_milestone: individual habit streaks ending today
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      SELECT
        ${uid}, 'habit_streak_milestone', 'habits', h.id::text || '-' || milestones.days::text,
        'Habit streak: ' || h.name,
        'You have kept "' || h.name || '" going for ' || milestones.days::text || ' days.'
      FROM habits h
      CROSS JOIN (VALUES (7), (14), (30), (50), (100)) AS milestones(days)
      WHERE h.user_id = ${uid}
        AND h.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1
          FROM generate_series(CURRENT_DATE - (milestones.days - 1) * INTERVAL '1 day', CURRENT_DATE, INTERVAL '1 day') AS required_days(day)
          WHERE NOT EXISTS (
            SELECT 1
            FROM habit_checkins hc
            WHERE hc.user_id = ${uid}
              AND hc.habit_id = h.id
              AND hc.checkin_date = required_days.day::date
              AND hc.count > 0
          )
        )
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // weekly_task_record: current week beats every previous week
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      WITH current_week AS (
        SELECT COUNT(*)::int AS completed
        FROM tasks
        WHERE user_id = ${uid}
          AND completed = TRUE
          AND updated_at >= date_trunc('week', CURRENT_DATE)
          AND updated_at < date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
      ),
      previous_best AS (
        SELECT COALESCE(MAX(weekly_count), 0)::int AS best
        FROM (
          SELECT COUNT(*)::int AS weekly_count
          FROM tasks
          WHERE user_id = ${uid}
            AND completed = TRUE
            AND updated_at < date_trunc('week', CURRENT_DATE)
          GROUP BY date_trunc('week', updated_at)
        ) weeks
      )
      SELECT
        ${uid}, 'weekly_task_record', 'tasks', to_char(date_trunc('week', CURRENT_DATE), 'YYYY-MM-DD'),
        'Best task week yet',
        'You completed ' || current_week.completed::text || ' tasks this week - your best week yet.'
      FROM current_week, previous_best
      WHERE current_week.completed > 0
        AND current_week.completed > previous_best.best
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // goal_completed: recent completed goals
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      SELECT
        ${uid}, 'goal_completed', 'goals', g.id::text,
        'Goal completed',
        'You completed your "' || g.title || '" goal!'
      FROM goals g
      WHERE g.user_id = ${uid}
        AND g.status = 'completed'
        AND g.updated_at >= NOW() - INTERVAL '30 days'
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),

    // budget_success: all current-month category spending is under budget
    safe(sql`
      INSERT INTO notifications (user_id, type, related_item_type, related_item_id, title, message)
      WITH category_usage AS (
        SELECT
          bc.id,
          bc.budget_limit,
          COALESCE(SUM(CASE WHEN bt.type = 'expense' THEN bt.amount ELSE 0 END), 0) AS spent
        FROM budget_categories bc
        LEFT JOIN budget_transactions bt
          ON bt.category_id = bc.id
          AND bt.user_id = ${uid}
          AND bt.date >= date_trunc('month', CURRENT_DATE)
          AND bt.date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
        WHERE bc.user_id = ${uid}
          AND bc.budget_limit IS NOT NULL
          AND bc.budget_limit > 0
        GROUP BY bc.id
      )
      SELECT
        ${uid}, 'budget_success', 'budget_categories', to_char(CURRENT_DATE, 'YYYY-MM'),
        'Budgets on track',
        'You stayed under budget this month in all tracked categories.'
      WHERE EXISTS (SELECT 1 FROM category_usage)
        AND NOT EXISTS (SELECT 1 FROM category_usage WHERE spent >= budget_limit)
      ON CONFLICT (user_id, type, related_item_type, related_item_id) DO NOTHING
    ` as Promise<unknown[]>),
  ])
}

export async function GET(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = Math.min(200, parseInt(searchParams.get("limit") ?? "100") || 100)
  const uid = user.id

  try {
    await generateNotifications(uid)
  } catch (err) {
    if (!isMissingTable(err)) throw err
    // notifications table not yet migrated — return empty gracefully
    return NextResponse.json({ notifications: [], unread_count: 0 })
  }

  const rows = await sql`
    SELECT id, type, related_item_type, related_item_id, title, message,
           is_read, read_at, created_at
    FROM notifications
    WHERE user_id = ${uid}
    ORDER BY is_read ASC, created_at DESC
    LIMIT ${limit}
  `

  const notifications = rows.map((r) => ({
    id: Number(r.id),
    type: r.type as NotificationType,
    related_item_type: String(r.related_item_type ?? ""),
    related_item_id: String(r.related_item_id ?? ""),
    title: String(r.title ?? ""),
    message: String(r.message ?? ""),
    is_read: Boolean(r.is_read),
    read_at: r.read_at ? new Date(r.read_at as string).toISOString() : null,
    created_at: new Date(r.created_at as string).toISOString(),
  })) as Notification[]

  const unread_count = notifications.filter((n) => !n.is_read).length

  return NextResponse.json({ notifications, unread_count })
}

export async function PUT(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const uid = user.id
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    if (body.mark_all_read === true) {
      await sql`
        UPDATE notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE user_id = ${uid} AND is_read = FALSE
      `
    } else if (typeof body.id === "number") {
      await sql`
        UPDATE notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE id = ${body.id} AND user_id = ${uid}
      `
    } else {
      return NextResponse.json({ error: "Provide id or mark_all_read" }, { status: 400 })
    }
  } catch (err) {
    if (isMissingTable(err)) return NextResponse.json({ success: true })
    throw err
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const uid = user.id
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  try {
    if (body.clear_read === true) {
      await sql`DELETE FROM notifications WHERE user_id = ${uid} AND is_read = TRUE`
    } else if (typeof body.id === "number") {
      await sql`DELETE FROM notifications WHERE id = ${body.id} AND user_id = ${uid}`
    } else {
      return NextResponse.json({ error: "Provide id or clear_read" }, { status: 400 })
    }
  } catch (err) {
    if (isMissingTable(err)) return NextResponse.json({ success: true })
    throw err
  }

  return NextResponse.json({ success: true })
}
