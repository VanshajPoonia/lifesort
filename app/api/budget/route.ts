import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

// GET - Fetch all budget data (categories, transactions, goals)
export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type") || "all"
    const month = searchParams.get("month")
    const year = searchParams.get("year")

    if (type === "categories" || type === "all") {
      const categories = await sql`
        SELECT * FROM budget_categories 
        WHERE user_id = ${user.id}
        ORDER BY name ASC
      `
      if (type === "categories") {
        return NextResponse.json({ categories })
      }
    }

    if (type === "transactions" || type === "all") {
      let transactions
      if (month && year) {
        transactions = await sql`
          SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
          FROM budget_transactions t
          LEFT JOIN budget_categories c ON t.category_id = c.id
          WHERE t.user_id = ${user.id}
          AND EXTRACT(MONTH FROM t.date) = ${parseInt(month)}
          AND EXTRACT(YEAR FROM t.date) = ${parseInt(year)}
          ORDER BY t.date DESC, t.created_at DESC
        `
      } else {
        transactions = await sql`
          SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
          FROM budget_transactions t
          LEFT JOIN budget_categories c ON t.category_id = c.id
          WHERE t.user_id = ${user.id}
          ORDER BY t.date DESC, t.created_at DESC
          LIMIT 100
        `
      }
      if (type === "transactions") {
        return NextResponse.json({ transactions })
      }
    }

    if (type === "goals" || type === "all") {
      const goals = await sql`
        SELECT g.*, c.name as category_name
        FROM budget_goals g
        LEFT JOIN budget_categories c ON g.category_id = c.id
        WHERE g.user_id = ${user.id}
        ORDER BY g.deadline ASC NULLS LAST
      `
      if (type === "goals") {
        return NextResponse.json({ goals })
      }
    }

    // Return all data
    const [categories, transactions, goals] = await Promise.all([
      sql`SELECT * FROM budget_categories WHERE user_id = ${user.id} ORDER BY name ASC`,
      sql`
        SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM budget_transactions t
        LEFT JOIN budget_categories c ON t.category_id = c.id
        WHERE t.user_id = ${user.id}
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT 100
      `,
      sql`
        SELECT g.*, c.name as category_name
        FROM budget_goals g
        LEFT JOIN budget_categories c ON g.category_id = c.id
        WHERE g.user_id = ${user.id}
        ORDER BY g.deadline ASC NULLS LAST
      `
    ])

    // Calculate summary
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    
    const monthlyStats = await sql`
      SELECT 
        type,
        SUM(amount) as total
      FROM budget_transactions
      WHERE user_id = ${user.id}
      AND EXTRACT(MONTH FROM date) = ${currentMonth}
      AND EXTRACT(YEAR FROM date) = ${currentYear}
      GROUP BY type
    `

    const income = monthlyStats.find(s => s.type === 'income')?.total || 0
    const expenses = monthlyStats.find(s => s.type === 'expense')?.total || 0

    return NextResponse.json({
      categories,
      transactions,
      goals,
      summary: {
        income: parseFloat(income),
        expenses: parseFloat(expenses),
        balance: parseFloat(income) - parseFloat(expenses)
      }
    })
  } catch (error) {
    console.error("[v0] Budget GET error:", error)
    return NextResponse.json({ error: "Failed to fetch budget data" }, { status: 500 })
  }
}

// POST - Create category, transaction, or goal
export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { type, ...data } = body

    if (type === "category") {
      const result = await sql`
        INSERT INTO budget_categories (user_id, name, color, icon, budget_limit)
        VALUES (${user.id}, ${data.name}, ${data.color || '#3B82F6'}, ${data.icon || 'folder'}, ${data.budget_limit || 0})
        RETURNING *
      `
      return NextResponse.json({ category: result[0] })
    }

    if (type === "transaction") {
      const result = await sql`
        INSERT INTO budget_transactions (user_id, category_id, type, amount, description, date, is_recurring, recurring_frequency)
        VALUES (${user.id}, ${data.category_id || null}, ${data.transaction_type}, ${data.amount}, ${data.description || ''}, ${data.date || new Date().toISOString().split('T')[0]}, ${data.is_recurring || false}, ${data.recurring_frequency || null})
        RETURNING *
      `
      return NextResponse.json({ transaction: result[0] })
    }

    if (type === "goal") {
      const result = await sql`
        INSERT INTO budget_goals (user_id, name, target_amount, current_amount, deadline, category_id)
        VALUES (${user.id}, ${data.name}, ${data.target_amount}, ${data.current_amount || 0}, ${data.deadline || null}, ${data.category_id || null})
        RETURNING *
      `
      return NextResponse.json({ goal: result[0] })
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  } catch (error) {
    console.error("[v0] Budget POST error:", error)
    return NextResponse.json({ error: "Failed to create" }, { status: 500 })
  }
}

// PUT - Update category, transaction, or goal
export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { type, id, ...data } = body

    if (type === "category") {
      const result = await sql`
        UPDATE budget_categories 
        SET name = ${data.name}, color = ${data.color}, icon = ${data.icon}, budget_limit = ${data.budget_limit}
        WHERE id = ${id} AND user_id = ${user.id}
        RETURNING *
      `
      return NextResponse.json({ category: result[0] })
    }

    if (type === "transaction") {
      const result = await sql`
        UPDATE budget_transactions 
        SET category_id = ${data.category_id}, type = ${data.transaction_type}, amount = ${data.amount}, 
            description = ${data.description}, date = ${data.date}, updated_at = NOW()
        WHERE id = ${id} AND user_id = ${user.id}
        RETURNING *
      `
      return NextResponse.json({ transaction: result[0] })
    }

    if (type === "goal") {
      const result = await sql`
        UPDATE budget_goals 
        SET name = ${data.name}, target_amount = ${data.target_amount}, 
            current_amount = ${data.current_amount}, deadline = ${data.deadline}
        WHERE id = ${id} AND user_id = ${user.id}
        RETURNING *
      `
      return NextResponse.json({ goal: result[0] })
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  } catch (error) {
    console.error("[v0] Budget PUT error:", error)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}

// DELETE - Delete category, transaction, or goal
export async function DELETE(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")
    const id = searchParams.get("id")

    if (!type || !id) {
      return NextResponse.json({ error: "Missing type or id" }, { status: 400 })
    }

    if (type === "category") {
      await sql`DELETE FROM budget_categories WHERE id = ${id} AND user_id = ${user.id}`
    } else if (type === "transaction") {
      await sql`DELETE FROM budget_transactions WHERE id = ${id} AND user_id = ${user.id}`
    } else if (type === "goal") {
      await sql`DELETE FROM budget_goals WHERE id = ${id} AND user_id = ${user.id}`
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Budget DELETE error:", error)
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }
}
