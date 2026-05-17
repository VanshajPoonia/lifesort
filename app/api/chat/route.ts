import { convertToModelMessages, streamText, type UIMessage } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import {
  checkAiUsageLimit,
  createAiUsageEvent,
  getAiDailyLimit,
  updateAiUsageEvent,
} from "@/lib/ai-usage"
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/ai-models"

export const maxDuration = 60

const MAX_CHAT_MESSAGES = 30
const MAX_CHAT_TEXT_LENGTH = 12000

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
    .map(part => part.text)
    .join("")
}

function validateMessages(value: unknown): { ok: true; messages: UIMessage[] } | { ok: false; error: string } {
  if (!Array.isArray(value)) {
    return { ok: false, error: "messages must be an array" }
  }

  if (value.length === 0 || value.length > MAX_CHAT_MESSAGES) {
    return { ok: false, error: `messages must include 1-${MAX_CHAT_MESSAGES} messages` }
  }

  let totalTextLength = 0
  const messages: UIMessage[] = []

  for (const rawMessage of value) {
    if (!isRecord(rawMessage)) {
      return { ok: false, error: "Each message must be an object" }
    }

    const role = rawMessage.role
    if (role !== "user" && role !== "assistant") {
      return { ok: false, error: "Only user and assistant messages are accepted" }
    }

    if (!Array.isArray(rawMessage.parts)) {
      return { ok: false, error: "Each message must include parts" }
    }

    const textParts = rawMessage.parts
      .filter((part): part is { type: "text"; text: string } => {
        return isRecord(part) && part.type === "text" && typeof part.text === "string"
      })
      .map(part => ({ type: "text" as const, text: part.text.slice(0, MAX_CHAT_TEXT_LENGTH) }))

    if (textParts.length === 0) {
      return { ok: false, error: "Each message must include text content" }
    }

    totalTextLength += textParts.reduce((sum, part) => sum + part.text.length, 0)
    if (totalTextLength > MAX_CHAT_TEXT_LENGTH) {
      return { ok: false, error: `Conversation text is limited to ${MAX_CHAT_TEXT_LENGTH} characters` }
    }

    messages.push({
      id: typeof rawMessage.id === "string" && rawMessage.id ? rawMessage.id : crypto.randomUUID(),
      role,
      parts: textParts,
    })
  }

  const lastMessage = messages[messages.length - 1]
  if (!lastMessage || lastMessage.role !== "user" || !getMessageText(lastMessage).trim()) {
    return { ok: false, error: "The latest message must be a non-empty user message" }
  }

  return { ok: true, messages }
}

export async function GET() {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({
    models: AVAILABLE_MODELS,
    default: DEFAULT_MODEL,
    dailyLimit: getAiDailyLimit("chat"),
    available: Boolean(process.env.OPENROUTER_API_KEY),
  })
}

export async function POST(req: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured" }, { status: 503 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 })
  }

  const modelId = typeof body.modelId === "string" ? body.modelId : DEFAULT_MODEL
  const selectedModel = AVAILABLE_MODELS.find(model => model.id === modelId)
  if (!selectedModel) {
    return NextResponse.json({ error: "Invalid modelId" }, { status: 400 })
  }

  const validatedMessages = validateMessages(body.messages)
  if (!validatedMessages.ok) {
    return NextResponse.json({ error: validatedMessages.error }, { status: 400 })
  }

  const limit = await checkAiUsageLimit(user.id, "chat")
  if (!limit.allowed) {
    await createAiUsageEvent({
      userId: user.id,
      route: "chat",
      provider: "openrouter",
      model: selectedModel.id,
      status: "rate_limited",
    })
    return NextResponse.json(
      {
        error: "Daily AI chat limit reached",
        limit: limit.limit,
        used: limit.used,
        remaining: limit.remaining,
      },
      { status: 429 },
    )
  }

  const usageEventId = await createAiUsageEvent({
    userId: user.id,
    route: "chat",
    provider: "openrouter",
    model: selectedModel.id,
  })

  try {
    const modelMessages = await convertToModelMessages(validatedMessages.messages)

    const result = streamText({
      model: openrouter(selectedModel.id),
      system: SYSTEM_PROMPT,
      messages: modelMessages,
      onFinish: async () => {
        await updateAiUsageEvent(usageEventId, "success")
      },
      onError: async ({ error }) => {
        await updateAiUsageEvent(
          usageEventId,
          "provider_error",
          error instanceof Error ? error.message : "Provider stream error",
        )
      },
    })

    return result.toUIMessageStreamResponse({
      onError: () => "The AI provider could not complete the response. Please try again.",
    })
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Provider request failed",
    )
    return NextResponse.json({ error: "Failed to start AI response" }, { status: 502 })
  }
}
