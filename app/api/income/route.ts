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

    const sources = await sql`
      SELECT * FROM income_sources 
      WHERE user_id = ${user.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json(sources)
  } catch (error) {
    console.error('[v0] Get income sources error:', error)
    return NextResponse.json({ error: 'Failed to fetch income sources' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { name, type, amount, frequency, description, active } = await request.json()

    if (!name || !type) {
      return NextResponse.json({ error: 'Name and type are required' }, { status: 400 })
    }

    const result = await sql`
      INSERT INTO income_sources (user_id, source_name, category, amount, frequency, active)
      VALUES (${user.id}, ${name}, ${type}, ${amount || 0}, ${frequency || 'monthly'}, ${active !== false})
      RETURNING *
    `

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Create income source error:', error)
    return NextResponse.json({ error: 'Failed to create income source' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, name, type, amount, frequency, description, active } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'Income source ID is required' }, { status: 400 })
    }

    const result = await sql`
      UPDATE income_sources 
      SET 
        source_name = COALESCE(${name}, source_name),
        category = COALESCE(${type}, category),
        amount = COALESCE(${amount}, amount),
        frequency = COALESCE(${frequency}, frequency),
        active = COALESCE(${active}, active),
        updated_at = NOW()
      WHERE id = ${id} AND user_id = ${user.id}
      RETURNING *
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'Income source not found' }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error('[v0] Update income source error:', error)
    return NextResponse.json({ error: 'Failed to update income source' }, { status: 500 })
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
      return NextResponse.json({ error: 'Income source ID is required' }, { status: 400 })
    }

    await sql`
      DELETE FROM income_sources 
      WHERE id = ${id} AND user_id = ${user.id}
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Delete income source error:', error)
    return NextResponse.json({ error: 'Failed to delete income source' }, { status: 500 })
  }
}
