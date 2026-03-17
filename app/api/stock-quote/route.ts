import { NextResponse } from "next/server"

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY

interface QuoteData {
  symbol: string
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  volume: number
  previousClose: number
  currency: string
}

// Get real-time stock quote
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get("symbol")
  const type = searchParams.get("type") || "stock" // stock, crypto, forex

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 })
  }

  if (!ALPHA_VANTAGE_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 })
  }

  try {
    let url: string
    let data: QuoteData

    if (type === "crypto") {
      // Crypto quote
      url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol}&to_currency=USD&apikey=${ALPHA_VANTAGE_API_KEY}`
      const response = await fetch(url)
      const result = await response.json()

      if (result["Realtime Currency Exchange Rate"]) {
        const quote = result["Realtime Currency Exchange Rate"]
        data = {
          symbol: symbol.toUpperCase(),
          price: parseFloat(quote["5. Exchange Rate"]),
          change: 0,
          changePercent: 0,
          high: parseFloat(quote["5. Exchange Rate"]),
          low: parseFloat(quote["5. Exchange Rate"]),
          volume: 0,
          previousClose: parseFloat(quote["5. Exchange Rate"]),
          currency: "USD"
        }
      } else {
        throw new Error("Invalid crypto response")
      }
    } else if (type === "forex") {
      // Forex quote (e.g., USD to INR)
      const [from, to] = symbol.split("/")
      url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${ALPHA_VANTAGE_API_KEY}`
      const response = await fetch(url)
      const result = await response.json()

      if (result["Realtime Currency Exchange Rate"]) {
        const quote = result["Realtime Currency Exchange Rate"]
        data = {
          symbol: symbol.toUpperCase(),
          price: parseFloat(quote["5. Exchange Rate"]),
          change: 0,
          changePercent: 0,
          high: parseFloat(quote["5. Exchange Rate"]),
          low: parseFloat(quote["5. Exchange Rate"]),
          volume: 0,
          previousClose: parseFloat(quote["5. Exchange Rate"]),
          currency: to
        }
      } else {
        throw new Error("Invalid forex response")
      }
    } else {
      // Stock/ETF quote
      url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
      const response = await fetch(url)
      const result = await response.json()

      if (result["Global Quote"] && Object.keys(result["Global Quote"]).length > 0) {
        const quote = result["Global Quote"]
        data = {
          symbol: quote["01. symbol"],
          price: parseFloat(quote["05. price"]),
          change: parseFloat(quote["09. change"]),
          changePercent: parseFloat(quote["10. change percent"]?.replace("%", "") || "0"),
          high: parseFloat(quote["03. high"]),
          low: parseFloat(quote["04. low"]),
          volume: parseInt(quote["06. volume"]),
          previousClose: parseFloat(quote["08. previous close"]),
          currency: symbol.includes(".NSE") || symbol.includes(".BSE") ? "INR" : "USD"
        }
      } else if (result["Note"]) {
        return NextResponse.json({ 
          error: "API rate limit reached (25 requests/day for free tier). Try again tomorrow.",
          rateLimited: true 
        }, { status: 429 })
      } else {
        throw new Error("Invalid stock response or symbol not found")
      }
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Alpha Vantage error:", error)
    return NextResponse.json({ error: "Failed to fetch quote" }, { status: 500 })
  }
}

// Search for symbols
export async function POST(request: Request) {
  const { query } = await request.json()

  if (!query) {
    return NextResponse.json({ error: "Search query is required" }, { status: 400 })
  }

  if (!ALPHA_VANTAGE_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 })
  }

  try {
    const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${ALPHA_VANTAGE_API_KEY}`
    const response = await fetch(url)
    const result = await response.json()

    if (result.bestMatches) {
      const matches = result.bestMatches.map((match: Record<string, string>) => ({
        symbol: match["1. symbol"],
        name: match["2. name"],
        type: match["3. type"],
        region: match["4. region"],
        currency: match["8. currency"]
      }))
      return NextResponse.json({ results: matches })
    }

    return NextResponse.json({ results: [] })
  } catch (error) {
    console.error("Symbol search error:", error)
    return NextResponse.json({ error: "Failed to search symbols" }, { status: 500 })
  }
}
