"use server"

import { generateText } from "ai"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { type, category, userId } = await request.json()

    let prompt = ""
    
    switch (type) {
      case "joke":
        const jokeStyle = category || "funny"
        const jokePrompts: Record<string, string> = {
          funny: "a clean, family-friendly, genuinely funny joke",
          dank: "a dank meme-style internet humor joke that's edgy but not offensive",
          dad: "a classic groan-worthy dad joke with a pun",
          dark: "a dark humor joke that's clever but not too offensive",
          tech: "a programmer or technology joke",
          pun: "a clever pun-based joke",
          oneliners: "a witty one-liner joke",
        }
        prompt = `Generate ${jokePrompts[jokeStyle] || "a funny joke"}. Return ONLY a JSON object with this exact format:
{"setup": "the setup of the joke", "punchline": "the punchline"}
Do not include any other text, just the JSON.`
        break
      
      case "quote":
        const quoteStyle = category || "motivational"
        const quotePrompts: Record<string, string> = {
          motivational: "an inspiring motivational quote about success, perseverance, or growth",
          religious: "an uplifting religious or spiritual quote (can be from any faith tradition)",
          philosophical: "a profound philosophical quote about life, existence, or wisdom",
          stoic: "a stoic philosophy quote about resilience and acceptance",
          funny: "a humorous but wise quote",
          love: "a beautiful quote about love, relationships, or connection",
          success: "a quote about achieving success and overcoming obstacles",
        }
        prompt = `Generate ${quotePrompts[quoteStyle] || "a motivational quote"}. Return ONLY a JSON object with this exact format:
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

    const result = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
      temperature: 0.9,
    })

    // Parse the JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
    }

    const content = JSON.parse(jsonMatch[0])

    return NextResponse.json({
      type,
      category,
      content,
      generated: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Error generating content:", error)
    return NextResponse.json({ error: "Failed to generate content" }, { status: 500 })
  }
}
