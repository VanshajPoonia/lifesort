"use server"

import { NextResponse } from "next/server"
import { neon } from "@neondatabase/serverless"
import { getUserFromSession } from "@/lib/auth"

const sql = neon(process.env.DATABASE_URL!)

const QUOTES = {
  motivational: [
    "The only way to do great work is to love what you do. - Steve Jobs",
    "Believe you can and you're halfway there. - Theodore Roosevelt",
    "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill",
    "The future belongs to those who believe in the beauty of their dreams. - Eleanor Roosevelt",
    "It does not matter how slowly you go as long as you do not stop. - Confucius",
  ],
  religious: [
    "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you. - Jeremiah 29:11",
    "Trust in the Lord with all your heart and lean not on your own understanding. - Proverbs 3:5",
    "Be strong and courageous. Do not be afraid; do not be discouraged. - Joshua 1:9",
    "The Lord is my shepherd; I shall not want. - Psalm 23:1",
    "I can do all things through Christ who strengthens me. - Philippians 4:13",
  ],
  philosophical: [
    "The unexamined life is not worth living. - Socrates",
    "Happiness is not something ready made. It comes from your own actions. - Dalai Lama",
    "In the middle of difficulty lies opportunity. - Albert Einstein",
    "The only true wisdom is in knowing you know nothing. - Socrates",
    "Life must be understood backward. But it must be lived forward. - Søren Kierkegaard",
  ],
}

const JOKES = {
  funny: [
    { setup: "Why don't scientists trust atoms?", punchline: "Because they make up everything!" },
    { setup: "Why did the scarecrow win an award?", punchline: "He was outstanding in his field!" },
    { setup: "Why don't eggs tell jokes?", punchline: "They'd crack each other up!" },
    { setup: "What do you call a fake noodle?", punchline: "An impasta!" },
    { setup: "Why did the coffee file a police report?", punchline: "It got mugged!" },
  ],
  dank: [
    { setup: "Why did the WiFi break up with the computer?", punchline: "There was no connection anymore." },
    { setup: "What's a programmer's favorite hangout place?", punchline: "Foo Bar!" },
    { setup: "Why do Java developers wear glasses?", punchline: "Because they don't C#!" },
    { setup: "Why was the JavaScript developer sad?", punchline: "Because he didn't Node how to Express himself!" },
    { setup: "What's a computer's least favorite food?", punchline: "Spam!" },
  ],
  dad: [
    { setup: "I'm reading a book about anti-gravity.", punchline: "It's impossible to put down!" },
    { setup: "Did you hear about the claustrophobic astronaut?", punchline: "He just needed a little space." },
    { setup: "Why don't skeletons fight each other?", punchline: "They don't have the guts!" },
    { setup: "What do you call a fish without eyes?", punchline: "A fsh!" },
    { setup: "I used to hate facial hair...", punchline: "But then it grew on me." },
  ],
}

const GAMES = [
  { type: "riddle", question: "What has keys but no locks, space but no room, and you can enter but can't go inside?", answer: "A keyboard" },
  { type: "riddle", question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", answer: "An echo" },
  { type: "riddle", question: "The more you take, the more you leave behind. What am I?", answer: "Footsteps" },
  { type: "trivia", question: "What is the capital of Australia?", options: ["Sydney", "Melbourne", "Canberra", "Perth"], answer: "Canberra" },
  { type: "trivia", question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: "Mars" },
  { type: "trivia", question: "What year did the Titanic sink?", options: ["1910", "1912", "1914", "1916"], answer: "1912" },
  { type: "math", question: "What is 15% of 80?", answer: "12" },
  { type: "math", question: "If a train travels 60 miles in 45 minutes, what is its speed in mph?", answer: "80" },
]

export async function GET(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const checkOnly = searchParams.get("check") === "true"

    // Check if user already saw content today
    const today = new Date().toISOString().split("T")[0]
    const existing = await sql`
      SELECT * FROM daily_content 
      WHERE user_id = ${user.id} AND DATE(shown_at) = ${today}
      ORDER BY shown_at DESC
      LIMIT 1
    `

    if (existing.length > 0 && checkOnly) {
      return NextResponse.json({ already_shown: true })
    }

    if (existing.length > 0 && !checkOnly) {
      return NextResponse.json({ already_shown: true, content: existing[0] })
    }

    // Get user preferences
    const prefs = await sql`
      SELECT * FROM user_content_preferences WHERE user_id = ${user.id}
    `

    let preferences = {
      quote_types: ["motivational"],
      joke_types: ["funny"],
      show_quotes: true,
      show_jokes: true,
      show_games: true,
    }

    if (prefs.length > 0) {
      preferences = {
        quote_types: prefs[0].quote_types || ["motivational"],
        joke_types: prefs[0].joke_types || ["funny"],
        show_quotes: prefs[0].show_quotes !== false,
        show_jokes: prefs[0].show_jokes !== false,
        show_games: prefs[0].show_games !== false,
      }
    }

    // Determine content type based on preferences
    const contentTypes: string[] = []
    if (preferences.show_quotes) contentTypes.push("quote")
    if (preferences.show_jokes) contentTypes.push("joke")
    if (preferences.show_games) contentTypes.push("game")

    if (contentTypes.length === 0) {
      return NextResponse.json({ already_shown: true })
    }

    const contentType = contentTypes[Math.floor(Math.random() * contentTypes.length)]
    let content: { type: string; category?: string; content: string; extra_data?: object } = { type: contentType, content: "" }

    if (contentType === "quote") {
      const category = preferences.quote_types[Math.floor(Math.random() * preferences.quote_types.length)] as keyof typeof QUOTES
      const quotes = QUOTES[category] || QUOTES.motivational
      content = {
        type: "quote",
        category,
        content: quotes[Math.floor(Math.random() * quotes.length)],
      }
    } else if (contentType === "joke") {
      const category = preferences.joke_types[Math.floor(Math.random() * preferences.joke_types.length)] as keyof typeof JOKES
      const jokes = JOKES[category] || JOKES.funny
      const joke = jokes[Math.floor(Math.random() * jokes.length)]
      content = {
        type: "joke",
        category,
        content: joke.setup,
        extra_data: { punchline: joke.punchline },
      }
    } else if (contentType === "game") {
      const game = GAMES[Math.floor(Math.random() * GAMES.length)]
      content = {
        type: "game",
        category: game.type,
        content: game.question,
        extra_data: { answer: game.answer, options: (game as { options?: string[] }).options },
      }
    }

    // Save to database
    const saved = await sql`
      INSERT INTO daily_content (user_id, content_type, category, content, extra_data)
      VALUES (${user.id}, ${content.type}, ${content.category || null}, ${content.content}, ${JSON.stringify(content.extra_data || {})})
      RETURNING *
    `

    return NextResponse.json({ content: saved[0], already_shown: false })
  } catch (error) {
    console.error("[v0] Daily content error:", error)
    return NextResponse.json({ error: "Failed to get daily content" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { content_type, content, extra_data } = body

    if (typeof content_type !== "string" || !content_type.trim()) {
      return NextResponse.json({ error: "content_type is required" }, { status: 400 })
    }

    const safeContent = typeof content === "string" ? content : ""

    const saved = await sql`
      INSERT INTO daily_content (user_id, content_type, category, content, extra_data)
      VALUES (${user.id}, ${content_type}, ${content_type}, ${safeContent}, ${JSON.stringify(extra_data || {})})
      RETURNING *
    `

    return NextResponse.json({ success: true, content: saved[0] })
  } catch (error) {
    console.error("[daily-content] Save error:", error)
    return NextResponse.json({ error: "Failed to save game" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { quote_types, joke_types, show_quotes, show_jokes, show_games } = body

    // Upsert preferences
    await sql`
      INSERT INTO user_content_preferences (user_id, quote_types, joke_types, show_quotes, show_jokes, show_games)
      VALUES (${user.id}, ${quote_types || ["motivational"]}, ${joke_types || ["funny"]}, ${show_quotes !== false}, ${show_jokes !== false}, ${show_games !== false})
      ON CONFLICT (user_id) DO UPDATE SET
        quote_types = EXCLUDED.quote_types,
        joke_types = EXCLUDED.joke_types,
        show_quotes = EXCLUDED.show_quotes,
        show_jokes = EXCLUDED.show_jokes,
        show_games = EXCLUDED.show_games,
        updated_at = NOW()
    `

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Update preferences error:", error)
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 })
  }
}
