import { convertToModelMessages, streamText, type UIMessage } from "ai"
import { NextResponse } from "next/server"
import { getUserFromSession } from "@/lib/auth"
import {
  checkAiUsageLimit,
  createAiUsageEvent,
  getAiDailyLimit,
  updateAiUsageEvent,
} from "@/lib/ai-usage"
import { AVAILABLE_MODELS, DEFAULT_MODEL } from "@/lib/ai-models"
import { getPersonalRulesContext } from "@/lib/personal-rules"
import {
  COACH_CONTEXT_MODES,
  getLifeSortCoachContext,
  normalizeCoachContextMode,
} from "@/lib/lifesort-coach-context"
import { gemini } from "@/lib/ai-provider"

export const maxDuration = 60

const MAX_CHAT_MESSAGES = 30
const MAX_CHAT_TEXT_LENGTH = 12000

const SYSTEM_PROMPT = `You are LifeSort Coach, a helpful AI coach inside LifeSort, a personal life-management app.
Answer using the logged-in user's provided LifeSort context when it is relevant.
Be concise, encouraging, and actionable. Tailor advice to the user's real tasks, goals, projects, habits, calendar, reviews, and life areas.
You are read-only: do not claim you changed, created, deleted, completed, rescheduled, or archived anything.`

const ACTION_INSTRUCTIONS = `If you suggest creating tasks, include them at the very end in this exact optional block:
\`\`\`lifesort-actions
{"tasks":[{"title":"Short task title","description":"Why this helps","priority":"medium","life_area_id":null}]}
\`\`\`

Rules for the actions block:
- Include at most 3 tasks.
- priority must be low, medium, or high.
- life_area_id must be a cited Life Area id only when clearly relevant, otherwise null.
- Do not include the block if there are no useful task drafts.
- The user must confirm drafts before anything is created.`

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
    contextModes: COACH_CONTEXT_MODES,
    dailyLimit: getAiDailyLimit("chat"),
    available: Boolean(process.env.GEMINI_API_KEY),
  })
}

export async function POST(req: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 503 })
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

  const contextMode = normalizeCoachContextMode(body.contextMode)

  const validatedMessages = validateMessages(body.messages)
  if (!validatedMessages.ok) {
    return NextResponse.json({ error: validatedMessages.error }, { status: 400 })
  }

  const limit = await checkAiUsageLimit(user.id, "chat")
  if (!limit.allowed) {
    await createAiUsageEvent({
      userId: user.id,
      route: "chat",
      provider: "gemini",
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
    provider: "gemini",
    model: selectedModel.id,
  })

  try {
    const modelMessages = await convertToModelMessages(validatedMessages.messages)
    const rulesContext = await getPersonalRulesContext(user.id)
    const coachContext = await getLifeSortCoachContext(user.id, contextMode)

    const result = streamText({
      model: gemini(selectedModel.id),
      system: `${SYSTEM_PROMPT}

Visible Personal Operating Rules and Preferences:
${rulesContext.preview}

Respect these visible rules when suggesting plans. Do not claim hidden rules exist, and do not create or change rules.

LifeSort app context:
${coachContext.prompt}

Citation rules:
- When you use a LifeSort item, cite it inline with the exact citation id from the context, such as [task:123].
- Do not cite ids that are not present in the context.
- If the user asks about something outside the selected context mode, answer from what is available and say what context might be better.

${ACTION_INSTRUCTIONS}`,
      messages: modelMessages,
      onFinish: async () => {
        await updateAiUsageEvent(usageEventId, "success")
      },
      onError: async ({ error }) => {
        console.error("[chat] provider stream failed:", error)
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
    console.error("[chat] failed to start AI response:", error)
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Provider request failed",
    )
    return NextResponse.json({ error: "Failed to start AI response" }, { status: 502 })
  }
}
