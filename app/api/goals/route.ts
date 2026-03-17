import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromSession } from '@/lib/auth'

const sql = neon(process.env.DATABASE_URL!)

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const goals = await sql`
      SELECT * FROM goals 
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json(goals)
  } catch (error) {
    console.error('[v0] Get goals error:', error)
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { title, description, category, target_date, status, target_value, current_value, value_unit, email_reminder, reminder_days } = await request.json()

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    // Convert empty string to null for target_date
    const deadlineValue = target_date && target_date.trim() !== '' ? target_date : null

    const result = await sql`
      INSERT INTO goals (user_id, title, description, category, target_date, status, target_value, current_value, value_unit, email_reminder, reminder_days)
      VALUES (${user.id}, ${title}, ${description || null}, ${category || 'personal'}, ${deadlineValue}, ${status || 'in_progress'}, ${target_value || null}, ${current_value || 0}, ${value_unit || null}, ${email_reminder ?? false}, ${reminder_days ?? 3})
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Create goal error:', error)
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, title, description, category, target_date, status, progress, target_value, current_value, value_unit, email_reminder, reminder_days } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 })
    }

    // Convert empty string to null for target_date
    const deadlineValue = target_date === '' ? null : target_date

    const result = await sql`
      UPDATE goals 
      SET 
        title = COALESCE(${title}, title),
        description = COALESCE(${description}, description),
        category = COALESCE(${category}, category),
        target_date = ${deadlineValue !== undefined ? deadlineValue : null},
        status = COALESCE(${status}, status),
        progress = COALESCE(${progress}, progress),
        target_value = ${target_value !== undefined ? target_value : null},
        current_value = ${current_value !== undefined ? current_value : null},
        value_unit = ${value_unit !== undefined ? value_unit : null},
        email_reminder = ${email_reminder !== undefined ? email_reminder : false},
        reminder_days = ${reminder_days !== undefined ? reminder_days : 3},
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Update goal error:', error)
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Goal ID is required' }, { status: 400 })
    }

    await sql`
      DELETE FROM goals 
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Delete goal error:', error)
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 })
  }
}
