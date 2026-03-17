import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { cookies } from "next/headers"
import { jwtVerify } from "jose"

const sql = neon(process.env.DATABASE_URL!)

async function getUserFromSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value
  if (!token) return null

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key")
    const { payload } = await jwtVerify(token, secret)
    return payload as { id: string; email: string }
  } catch {
    return null
  }
}

// Parse portfolio screenshot using AI
export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const files = formData.getAll('screenshots') as File[]
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No screenshots provided" }, { status: 400 })
    }

    // Convert files to base64 for AI processing
    const imageContents = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer()
        const base64 = Buffer.from(bytes).toString('base64')
        const mimeType = file.type || 'image/png'
        return { base64, mimeType }
      })
    )

    // Use Groq AI (free tier) to parse the screenshot
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.2-90b-vision-preview',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting investment portfolio data from screenshots. 
            
Extract all investments you can find and return them in this exact JSON format:
{
  "investments": [
    {
      "name": "Company/Asset Name",
      "symbol": "TICKER or null if not visible",
      "type": "Stocks|Crypto|ETF|Mutual Fund|Bonds|Real Estate|Gold|Fixed Deposit|Other",
      "quantity": number or null,
      "average_cost": number or null (per unit cost),
      "current_price": number or null,
      "total_invested": number or null,
      "current_value": number or null,
      "currency": "USD|INR|EUR|etc"
    }
  ],
  "platform": "Zerodha|Groww|Robinhood|etc or Unknown",
  "notes": "Any important observations"
}

For Indian stocks, include the .NSE or .BSE suffix in the symbol.
If you can't determine a value, use null.
Calculate total_invested = quantity * average_cost if possible.
Calculate current_value = quantity * current_price if possible.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Please extract all investment data from these portfolio screenshots:'
              },
              ...imageContents.map(img => ({
                type: 'image_url' as const,
                image_url: {
                  url: `data:${img.mimeType};base64,${img.base64}`
                }
              }))
            ]
          }
        ],
        max_tokens: 4000
      })
    })

    if (!response.ok) {
      // Fallback: Return a template for manual entry
      return NextResponse.json({
        parsed: false,
        message: "AI parsing unavailable. Please add investments manually or try again later.",
        template: {
          investments: []
        }
      })
    }

    const aiResult = await response.json()
    const content = aiResult.choices?.[0]?.message?.content || ''
    
    // Extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({
        parsed: false,
        message: "Could not parse portfolio data from screenshot",
        raw: content
      })
    }

    const portfolioData = JSON.parse(jsonMatch[0])
    
    return NextResponse.json({
      parsed: true,
      data: portfolioData,
      message: `Found ${portfolioData.investments?.length || 0} investments`
    })
  } catch (error) {
    console.error("Screenshot parse error:", error)
    return NextResponse.json({ 
      error: "Failed to parse screenshot",
      parsed: false 
    }, { status: 500 })
  }
}

// Bulk import parsed investments
export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { investments } = await request.json()
    
    if (!investments || !Array.isArray(investments)) {
      return NextResponse.json({ error: "Invalid investments data" }, { status: 400 })
    }

    const imported = []
    for (const inv of investments) {
      if (!inv.name) continue

      const result = await sql`
        INSERT INTO investments (
          user_id, name, type, symbol, amount, current_value, 
          purchase_date, notes, quantity
        )
        VALUES (
          ${user.id},
          ${inv.name},
          ${inv.type || 'Other'},
          ${inv.symbol || null},
          ${inv.total_invested || inv.current_value || 0},
          ${inv.current_value || inv.total_invested || 0},
          ${new Date().toISOString().split('T')[0]},
          ${inv.currency ? `Currency: ${inv.currency}` : null},
          ${inv.quantity || null}
        )
        RETURNING *
      `
      imported.push(result[0])
    }

    return NextResponse.json({
      success: true,
      imported: imported.length,
      investments: imported
    })
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json({ error: "Failed to import investments" }, { status: 500 })
  }
}
