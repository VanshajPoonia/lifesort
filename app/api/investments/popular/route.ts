import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category') || 'all'
    const search = searchParams.get('search') || ''

    let query
    if (search) {
      query = sql`
        SELECT * FROM popular_investments 
        WHERE 
          (LOWER(name) LIKE ${`%${search.toLowerCase()}%`} OR 
           LOWER(symbol) LIKE ${`%${search.toLowerCase()}%`})
        ORDER BY category, name
        LIMIT 50
      `
    } else if (category && category !== 'all') {
      query = sql`
        SELECT * FROM popular_investments 
        WHERE category = ${category}
        ORDER BY name
      `
    } else {
      query = sql`
        SELECT * FROM popular_investments 
        ORDER BY category, name
      `
    }

    const investments = await query

    // Group by category
    const grouped = investments.reduce((acc: Record<string, typeof investments>, inv) => {
      const cat = inv.category || 'Other'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(inv)
      return acc
    }, {})

    return NextResponse.json({ 
      investments,
      grouped,
      categories: Object.keys(grouped)
    })
  } catch (error) {
    console.error("Error fetching popular investments:", error)
    return NextResponse.json({ error: "Failed to fetch investments" }, { status: 500 })
  }
}
