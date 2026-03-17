import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL!)
const DAILY_LIMIT = 25
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY

// This endpoint can be called by a cron job or manually
// It fairly distributes API calls among users
export async function POST() {
  try {
    // Get today's usage count
    const today = new Date().toISOString().split('T')[0]
    const usageResult = await sql`
      SELECT COALESCE(SUM(request_count), 0) as total_requests
      FROM api_usage
      WHERE api_name = 'alpha_vantage' AND DATE(date) = ${today}
    `
    const usedToday = parseInt(usageResult[0]?.total_requests || '0')
    const remainingRequests = DAILY_LIMIT - usedToday

    if (remainingRequests <= 0) {
      return NextResponse.json({ 
        message: "Daily API limit reached", 
        used: usedToday, 
        limit: DAILY_LIMIT 
      })
    }

    // Get users who need updates, prioritizing those not fetched recently
    // Use random ordering among users with same fetch time for fairness
    const usersToUpdate = await sql`
      SELECT DISTINCT u.id as user_id, i.symbol, i.type, i.id as investment_id
      FROM users u
      JOIN investments i ON i.user_id = u.id
      WHERE i.symbol IS NOT NULL
        AND i.symbol != ''
        AND (i.last_price_fetch IS NULL OR i.last_price_fetch < NOW() - INTERVAL '24 hours')
      ORDER BY 
        COALESCE(u.last_investment_fetch, '1970-01-01'::timestamp) ASC,
        RANDOM()
      LIMIT ${remainingRequests}
    `

    if (usersToUpdate.length === 0) {
      return NextResponse.json({ message: "No investments need updating" })
    }

    const updates: Array<{symbol: string, price: number, success: boolean}> = []
    let requestsMade = 0

    for (const investment of usersToUpdate) {
      if (requestsMade >= remainingRequests) break

      try {
        const isCrypto = investment.type === 'Crypto'
        let url: string
        
        if (isCrypto) {
          url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${investment.symbol}&to_currency=USD&apikey=${ALPHA_VANTAGE_API_KEY}`
        } else {
          url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${investment.symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
        }

        const response = await fetch(url)
        const data = await response.json()
        requestsMade++

        let price = 0
        if (isCrypto && data['Realtime Currency Exchange Rate']) {
          price = parseFloat(data['Realtime Currency Exchange Rate']['5. Exchange Rate'] || '0')
        } else if (data['Global Quote']) {
          price = parseFloat(data['Global Quote']['05. price'] || '0')
        }

        if (price > 0) {
          // Update investment with new price
          await sql`
            UPDATE investments 
            SET 
              cached_price = ${price},
              last_price_fetch = NOW()
            WHERE id = ${investment.investment_id}
          `

          // Update user's last fetch time
          await sql`
            UPDATE users 
            SET last_investment_fetch = NOW()
            WHERE id = ${investment.user_id}
          `

          updates.push({ symbol: investment.symbol, price, success: true })
        } else {
          updates.push({ symbol: investment.symbol, price: 0, success: false })
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Error fetching ${investment.symbol}:`, error)
        updates.push({ symbol: investment.symbol, price: 0, success: false })
      }
    }

    // Record API usage
    if (requestsMade > 0) {
      await sql`
        INSERT INTO api_usage (api_name, request_count, date)
        VALUES ('alpha_vantage', ${requestsMade}, NOW())
        ON CONFLICT (api_name, date) 
        DO UPDATE SET request_count = api_usage.request_count + ${requestsMade}
      `
    }

    return NextResponse.json({
      message: "Background fetch completed",
      requestsMade,
      remainingToday: remainingRequests - requestsMade,
      updates
    })
  } catch (error) {
    console.error("Background fetch error:", error)
    return NextResponse.json({ error: "Background fetch failed" }, { status: 500 })
  }
}

// Get API usage stats
export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const usageResult = await sql`
      SELECT COALESCE(SUM(request_count), 0) as total_requests
      FROM api_usage
      WHERE api_name = 'alpha_vantage' AND DATE(date) = ${today}
    `
    const usedToday = parseInt(usageResult[0]?.total_requests || '0')

    return NextResponse.json({
      usedToday,
      limit: DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - usedToday)
    })
  } catch (error) {
    return NextResponse.json({ error: "Failed to get usage" }, { status: 500 })
  }
}
