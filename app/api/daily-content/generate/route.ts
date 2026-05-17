"use server"

import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"

const DAILY_CONTENT_MODEL = "openai/gpt-4o-mini"
const MAX_CATEGORY_LENGTH = 40

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  headers: {
    "HTTP-Referer": "https://lifesort.app",
    "X-Title": "LifeSort",
  },
})

const JOKE_PROMPTS: Record<string, string> = {
  funny: "a clean, family-friendly, genuinely funny joke",
  dank: "a meme-style internet humor joke that's playful but not offensive",
  dad: "a classic groan-worthy dad joke with a pun",
  dark: "a dark humor joke that's clever but not graphic or hateful",
  tech: "a programmer or technology joke",
  pun: "a clever pun-based joke",
  oneliners: "a witty one-liner joke",
}

const QUOTE_PROMPTS: Record<string, string> = {
  motivational: "an inspiring motivational quote about success, perseverance, or growth",
  religious: "an uplifting religious or spiritual quote",
  philosophical: "a profound philosophical quote about life, existence, or wisdom",
  stoic: "a stoic philosophy quote about resilience and acceptance",
  funny: "a humorous but wise quote",
  love: "a beautiful quote about love, relationships, or connection",
  success: "a quote about achieving success and overcoming obstacles",
}

const TRIVIA_CATEGORIES = new Set([
  "general knowledge",
  "science",
  "history",
  "geography",
  "entertainment",
  "sports",
  "tech",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getSafeCategory(value: unknown) {
  if (typeof value !== "string") return undefined
  const category = value.trim().toLowerCase().slice(0, MAX_CATEGORY_LENGTH)
  return category || undefined
}

function parseGeneratedJson(text: string) {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  let usageEventId: number | null = null

  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured" }, { status: 503 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    if (!isRecord(body) || typeof body.type !== "string") {
      return NextResponse.json({ error: "type is required" }, { status: 400 })
    }

    const type = body.type
    const category = getSafeCategory(body.category)

    const limit = await checkAiUsageLimit(user.id, "daily_content_generate")
    if (!limit.allowed) {
      await createAiUsageEvent({
        userId: user.id,
        route: "daily_content_generate",
        provider: "openrouter",
        model: DAILY_CONTENT_MODEL,
        status: "rate_limited",
      })
      return NextResponse.json(
        {
          error: "Daily content generation limit reached",
          limit: limit.limit,
          used: limit.used,
          remaining: limit.remaining,
        },
        { status: 429 },
      )
    }

    let prompt = ""
    
    switch (type) {
      case "joke":
        if (category && !JOKE_PROMPTS[category]) {
          return NextResponse.json({ error: "Invalid joke category" }, { status: 400 })
        }
        prompt = `Generate ${JOKE_PROMPTS[category || "funny"]}. Return ONLY a JSON object with this exact format:
{"setup": "the setup of the joke", "punchline": "the punchline"}
Do not include any other text, just the JSON.`
        break
      
      case "quote":
        if (category && !QUOTE_PROMPTS[category]) {
          return NextResponse.json({ error: "Invalid quote category" }, { status: 400 })
        }
        prompt = `Generate ${QUOTE_PROMPTS[category || "motivational"]}. Return ONLY a JSON object with this exact format:
{"content": "the quote text", "author": "the author name or 'Unknown'"}
Do not include any other text, just the JSON.`
        break
      
      case "would_you_rather":
        prompt = `Generate a fun and thought-provoking "Would You Rather" question. Return ONLY a JSON object with this exact format:
{"option_a": "first option", "option_b": "second option"}
Make the options interesting and balanced. Do not include any other text, just the JSON.`
        break
      
      case "riddle":
        prompt = `Generate a clever riddle. Return ONLY a JSON object with this exact format:
{"question": "the riddle", "answer": "the answer"}
Do not include any other text, just the JSON.`
        break
      
      case "trivia":
        if (category && !TRIVIA_CATEGORIES.has(category)) {
          return NextResponse.json({ error: "Invalid trivia category" }, { status: 400 })
        }
        prompt = `Generate a ${category || "general knowledge"} trivia question with multiple choice answers. Return ONLY a JSON object with this exact format:
{"question": "the trivia question", "options": ["option1", "option2", "option3", "option4"], "correct_answer": "the correct option exactly as written in options"}
Do not include any other text, just the JSON.`
        break
      
      case "fun_fact":
        prompt = `Generate an interesting and surprising fun fact. Return ONLY a JSON object with this exact format:
{"fact": "the fun fact"}
Do not include any other text, just the JSON.`
        break
      
      default:
        return NextResponse.json({ error: "Invalid content type" }, { status: 400 })
    }

    usageEventId = await createAiUsageEvent({
      userId: user.id,
      route: "daily_content_generate",
      provider: "openrouter",
      model: DAILY_CONTENT_MODEL,
    })

    const result = await generateText({
      model: openrouter(DAILY_CONTENT_MODEL),
      prompt,
      temperature: 0.9,
    })

    const content = parseGeneratedJson(result.text)
    if (!content) {
      await updateAiUsageEvent(usageEventId, "provider_error", "Generated content was not valid JSON")
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
    }

    await updateAiUsageEvent(usageEventId, "success")

    return NextResponse.json({
      type,
      category,
      content,
      generated: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Daily content generation failed",
    )
    console.error("Error generating content:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 })
  }
}
