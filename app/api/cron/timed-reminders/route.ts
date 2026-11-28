import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"

import { sql } from "@/lib/db"
import { isPushConfigured, sendPushToUser } from "@/lib/push"
import {
  dueHabits,
  duePeopleReminders,
  localNow,
  nextRecurrence,
  timedPushPayload,
  timeZoneOrDefault,
  type CheckinRow,
  type HabitReminderRow,
  type PeopleReminderRow,
  type TimedItem,
} from "@/lib/timed-reminders"

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== "production"
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get("authorization") ?? "")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

// Vercel Cron calls this every two hours at :30 UTC, on the hour in India. It pushes habit reminder
// times and people reminders that fell in the last two hours, to people who turned push on.
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isPushConfigured()) return NextResponse.json({ ok: true, skipped: "push is not configured" })

  // The run's minute, so a run a few seconds late still lands in the same slot.
  const now = new Date(Math.floor(Date.now() / 60_000) * 60_000)

  try {
    const people = (await sql`
      SELECT ps.user_id,
             (SELECT ci.time_zone FROM calendar_integrations ci
               WHERE ci.user_id = ps.user_id AND ci.time_zone IS NOT NULL LIMIT 1) AS time_zone
      FROM push_subscriptions ps
      GROUP BY ps.user_id
    `) as { user_id: string; time_zone: string | null }[]
    if (people.length === 0) return NextResponse.json({ ok: true, people: 0, pushed: 0 })

    const userIds = people.map((p) => p.user_id)
    const [habits, checkins, reminders] = await Promise.all([
      sql`
        SELECT id, user_id, name, frequency, custom_days, target_count, to_char(reminder_time, 'HH24:MI') AS reminder_time
        FROM habits
        WHERE is_active = TRUE AND reminder_time IS NOT NULL AND user_id = ANY(${userIds})
      `,
      sql`
        SELECT habit_id, to_char(checkin_date, 'YYYY-MM-DD') AS checkin_date, count
        FROM habit_checkins
        WHERE user_id = ANY(${userIds}) AND checkin_date >= CURRENT_DATE - 8
      `,
      // Stored as wall-clock times, so a day either side of now covers every time zone.
      sql`
        SELECT id, user_id, title, to_char(remind_at, 'YYYY-MM-DD"T"HH24:MI') AS remind_at, is_recurring, recur_interval
        FROM people_reminders
        WHERE is_sent = FALSE AND user_id = ANY(${userIds})
          AND remind_at BETWEEN NOW() - INTERVAL '1 day' AND NOW() + INTERVAL '1 day'
      `,
    ])

    let pushed = 0
    let items = 0
    for (const person of people) {
      const timeZone = timeZoneOrDefault(person.time_zone)
      const habitsDue = dueHabits(
        (habits as HabitReminderRow[]).filter((h) => h.user_id === person.user_id),
        checkins as CheckinRow[],
        localNow(now, timeZone),
      )
      const remindersDue = duePeopleReminders(
        (reminders as PeopleReminderRow[]).filter((r) => r.user_id === person.user_id),
        now,
        timeZone,
      )

      // Marked before sending: a reminder that arrives twice is worse than one that is missed.
      for (const r of remindersDue) {
        if (r.is_recurring) {
          await sql`UPDATE people_reminders SET remind_at = ${nextRecurrence(r.remind_at, r.recur_interval, now, timeZone)}, updated_at = NOW() WHERE id = ${r.id}`
        } else {
          await sql`UPDATE people_reminders SET is_sent = TRUE, updated_at = NOW() WHERE id = ${r.id}`
        }
      }

      const due: TimedItem[] = [
        ...habitsDue.map((h) => ({ kind: "habit" as const, title: h.name })),
        ...remindersDue.map((r) => ({ kind: "person" as const, title: r.title })),
      ]
      const payload = timedPushPayload(due)
      if (!payload) continue
      items += due.length
      pushed += (await sendPushToUser(person.user_id, payload)).sent
    }

    return NextResponse.json({ ok: true, people: people.length, items, pushed })
  } catch (error) {
    console.error("[cron/timed-reminders] error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Timed reminders failed" }, { status: 500 })
  }
}
