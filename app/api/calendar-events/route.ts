import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const events = await sql`
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
    const { title, description, event_date, start_time, end_time } = body

    const result = await sql`
      INSERT INTO calendar_events (user_id, title, description, event_date, start_time, end_time)
      VALUES (${user.id}, ${title}, ${description || null}, ${event_date}, ${start_time}, ${end_time})
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
    const { id, title, description, event_date, start_time, end_time } = body

    const result = await sql`
      UPDATE calendar_events
      SET title = ${title}, description = ${description || null}, 
          event_date = ${event_date}, start_time = ${start_time}, end_time = ${end_time},
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
