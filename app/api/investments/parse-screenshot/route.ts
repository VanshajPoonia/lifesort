import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"

const sql = neon(process.env.DATABASE_URL!)

const GROQ_VISION_MODEL = "llama-3.2-90b-vision-preview"
const MAX_SCREENSHOT_FILES = 3
const MAX_SCREENSHOT_SIZE_BYTES = 5 * 1024 * 1024
const MAX_IMPORT_ITEMS = 50
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])

interface ParsedInvestment {
  name?: unknown
  symbol?: unknown
  type?: unknown
  quantity?: unknown
  total_invested?: unknown
  current_value?: unknown
  currency?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getString(value: unknown, fallback: string | null = null) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function getNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""))
  return Number.isFinite(parsed) ? parsed : null
}

function parsePortfolioJson(content: string) {
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

// Parse portfolio screenshot using AI
export async function POST(request: Request) {
  let usageEventId: number | null = null

  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured", parsed: false },
        { status: 503 },
      )
    }

    const limit = await checkAiUsageLimit(user.id, "investment_screenshot_parse")
    if (!limit.allowed) {
      await createAiUsageEvent({
        userId: user.id,
        route: "investment_screenshot_parse",
        provider: "groq",
        model: GROQ_VISION_MODEL,
        status: "rate_limited",
      })
      return NextResponse.json(
        {
          error: "Daily screenshot parsing limit reached",
          parsed: false,
          limit: limit.limit,
          used: limit.used,
          remaining: limit.remaining,
        },
        { status: 429 },
      )
    }

    const formData = await request.formData()
    const files = formData.getAll("screenshots").filter((value): value is File => value instanceof File)
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No screenshots provided" }, { status: 400 })
    }

    if (files.length > MAX_SCREENSHOT_FILES) {
      return NextResponse.json({ error: `Upload up to ${MAX_SCREENSHOT_FILES} screenshots at a time` }, { status: 400 })
    }

    for (const file of files) {
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return NextResponse.json({ error: "Only PNG, JPEG, and WebP screenshots are supported" }, { status: 400 })
      }

      if (file.size > MAX_SCREENSHOT_SIZE_BYTES) {
        return NextResponse.json({ error: "Each screenshot must be 5MB or smaller" }, { status: 400 })
      }
    }

    // Convert files to base64 for AI processing
    const imageContents = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer()
        const base64 = Buffer.from(bytes).toString('base64')
        const mimeType = file.type
        return { base64, mimeType }
      })
    )

    usageEventId = await createAiUsageEvent({
      userId: user.id,
      route: "investment_screenshot_parse",
      provider: "groq",
      model: GROQ_VISION_MODEL,
    })

    // Use Groq AI (free tier) to parse the screenshot
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
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
      await updateAiUsageEvent(usageEventId, "provider_error", `Groq returned ${response.status}`)
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
    
    const portfolioData = parsePortfolioJson(content)
    if (!portfolioData) {
      await updateAiUsageEvent(usageEventId, "provider_error", "Groq response did not include parseable JSON")
      return NextResponse.json({
        parsed: false,
        message: "Could not parse portfolio data from screenshot",
      })
    }

    const investments = Array.isArray(portfolioData.investments) ? portfolioData.investments : []
    await updateAiUsageEvent(usageEventId, "success")
    
    return NextResponse.json({
      parsed: true,
      data: portfolioData,
      investments,
      message: `Found ${investments.length || 0} investments`
    })
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Screenshot parsing failed",
    )
    console.error("Screenshot parse error:", error instanceof Error ? error.message : error)
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

    if (investments.length > MAX_IMPORT_ITEMS) {
      return NextResponse.json({ error: `Import up to ${MAX_IMPORT_ITEMS} investments at a time` }, { status: 400 })
    }

    const imported = []
    for (const inv of investments as ParsedInvestment[]) {
      const name = getString(inv.name)
      if (!name) continue

      const totalInvested = getNumber(inv.total_invested)
      const currentValue = getNumber(inv.current_value)
      const quantity = getNumber(inv.quantity)

      const result = await sql`
        INSERT INTO investments (
          user_id, name, type, symbol, amount, current_value, 
          purchase_date, notes, quantity
        )
        VALUES (
          ${user.id},
          ${name},
          ${getString(inv.type, 'Other')},
          ${getString(inv.symbol)},
          ${totalInvested ?? currentValue ?? 0},
          ${currentValue ?? totalInvested ?? 0},
          ${new Date().toISOString().split('T')[0]},
          ${getString(inv.currency) ? `Currency: ${getString(inv.currency)}` : null},
          ${quantity}
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
