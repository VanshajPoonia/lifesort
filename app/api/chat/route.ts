import { streamText } from "ai"
import { createGroq } from "@ai-sdk/groq"

export const maxDuration = 30

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: groq("llama-3.1-8b-instant"),
    system: `You are a helpful AI assistant for LifeSort, a life organization app.
Help users with productivity tips, goal setting advice, time management strategies, and personal organization.
Be concise, encouraging, and actionable in your responses.`,
    messages,
  })

  return result.toUIMessageStreamResponse()
}
