import { NextResponse } from "next/server"
import { neon } from "@/lib/neon-client"
import { getUserFromSession } from "@/lib/auth"
import { normalizeLifeAreaId } from "@/lib/life-areas"

const sql = neon(process.env.DATABASE_URL!)

const categories = new Set(["personal", "work", "health", "finance"])

function cleanText(value: unknown, fallback: string | null = null) {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function cleanCategory(value: unknown) {
  return typeof value === "string" && categories.has(value) ? value : "personal"
}

function cleanReminderDays(value: unknown, fallback = 1) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(365, Math.max(0, parsed))
}

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lifeAreaId = normalizeLifeAreaId(searchParams.get("life_area_id"))

    const events = lifeAreaId
      ? await sql`
          SELECT * FROM calendar_events
          WHERE user_id = ${user.id} AND life_area_id = ${lifeAreaId}
          ORDER BY event_date, start_time
        `
      : await sql`
          SELECT * FROM calendar_events
          WHERE user_id = ${user.id}
          ORDER BY event_date, start_time
        `

    return NextResponse.json(events)
  } catch (error) {
    console.error("[v0] Error fetching calendar events:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      event_date,
      start_time,
      end_time,
      category,
      location,
      attendees,
      email_reminder,
      reminder_days,
      life_area_id,
    } = body

    const eventTitle = cleanText(title)

    if (!eventTitle) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO calendar_events (
        user_id,
        title,
        description,
        event_date,
        start_time,
        end_time,
        category,
        location,
        attendees,
        email_reminder,
        reminder_days,
        life_area_id
      )
      VALUES (
        ${user.id},
        ${eventTitle},
        ${cleanText(description)},
        ${event_date},
        ${start_time},
        ${end_time},
        ${cleanCategory(category)},
        ${cleanText(location)},
        ${cleanText(attendees)},
        ${Boolean(email_reminder)},
        ${cleanReminderDays(reminder_days)},
        ${normalizeLifeAreaId(life_area_id)}
      )
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[v0] Error creating calendar event:", error)
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      id,
      title,
      description,
      event_date,
      start_time,
      end_time,
      category,
      location,
      attendees,
      email_reminder,
      reminder_days,
      life_area_id,
    } = body

    const eventTitle = cleanText(title)

    if (!id || !eventTitle) {
      return NextResponse.json({ error: "Event ID and title are required" }, { status: 400 })
    }

    // Only touch life_area_id when the caller explicitly sends it, so drag/resize
    // scheduling updates (which omit it) don't silently clear the domain assignment.
    let nextLifeAreaId: number | null = null
    if ("life_area_id" in body) {
      nextLifeAreaId = normalizeLifeAreaId(life_area_id)
    } else {
      const existing = await sql`SELECT life_area_id FROM calendar_events WHERE id = ${id} AND user_id = ${user.id} LIMIT 1`
      nextLifeAreaId = normalizeLifeAreaId(existing[0]?.life_area_id)
    }

    const result = await sql`
      UPDATE calendar_events
      SET title = ${eventTitle}, description = ${cleanText(description)},
          event_date = ${event_date}, start_time = ${start_time}, end_time = ${end_time},
          category = ${cleanCategory(category)},
          location = ${cleanText(location)},
          attendees = ${cleanText(attendees)},
          email_reminder = ${Boolean(email_reminder)},
          reminder_days = ${cleanReminderDays(reminder_days)},
          life_area_id = ${nextLifeAreaId},
          updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("[v0] Error updating calendar event:", error)
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }

    await sql`
      DELETE FROM calendar_events
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Error deleting calendar event:", error)
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 })
  }
}
