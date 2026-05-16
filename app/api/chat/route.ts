import { streamText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/ai-models"

export const maxDuration = 60

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  headers: {
    "HTTP-Referer": "https://lifesort.app",
    "X-Title": "LifeSort",
  },
})

const SYSTEM_PROMPT = `You are a helpful AI assistant for LifeSort, a personal life management app.
Help users with productivity tips, goal setting, time management, habit building, and personal organisation.
Be concise, encouraging, and actionable. Tailor advice to real-world situations.`

export async function GET() {
  return Response.json({ models: AVAILABLE_MODELS, default: DEFAULT_MODEL })
}

export async function POST(req: Request) {
  const { messages, modelId } = await req.json()

  const isValid = AVAILABLE_MODELS.some(m => m.id === modelId)
  const model = isValid ? modelId : DEFAULT_MODEL

  const result = streamText({
    model: openrouter(model),
    system: SYSTEM_PROMPT,
    messages,
  })

  return result.toUIMessageStreamResponse()
}
