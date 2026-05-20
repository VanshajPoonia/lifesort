import { generateText, Output } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import {
  buildTemplateBuilderPrompt,
  generatedTemplateSchema,
  hasTemplateContent,
  templatePromptSchema,
  TEMPLATE_BUILDER_MODEL,
} from "@/lib/template-builder"

const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
})

export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "AI Template Builder is not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  const body = await request.json().catch(() => null)
  const parsed = templatePromptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid template prompt" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }

  const limit = await checkAiUsageLimit(user.id, "template_builder")
  if (!limit.allowed) {
    await createAiUsageEvent({
      userId: user.id,
      route: "template_builder",
      provider: "openrouter",
      model: TEMPLATE_BUILDER_MODEL,
      status: "rate_limited",
    })
    return NextResponse.json(
      { error: "Daily AI Template Builder limit reached", limit: limit.limit, used: limit.used, remaining: 0 },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    )
  }

  const usageEventId = await createAiUsageEvent({
    userId: user.id,
    route: "template_builder",
    provider: "openrouter",
    model: TEMPLATE_BUILDER_MODEL,
  })

  try {
    const result = await generateText({
      model: openrouter(TEMPLATE_BUILDER_MODEL),
      output: Output.object({ schema: generatedTemplateSchema }),
      prompt: buildTemplateBuilderPrompt(parsed.data.prompt),
    })

    const template = generatedTemplateSchema.parse(result.output)
    if (!hasTemplateContent(template)) {
      await updateAiUsageEvent(usageEventId, "rejected", "Generated template contained no createable content")
      return NextResponse.json(
        { error: "The generated template was empty. Try a more specific prompt." },
        { status: 422, headers: { "Cache-Control": "no-store" } },
      )
    }

    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json(
      { template, remaining: Math.max(0, limit.remaining - 1) },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    await updateAiUsageEvent(
      usageEventId,
      "provider_error",
      error instanceof Error ? error.message : "Template generation failed",
    )
    return NextResponse.json(
      { error: "Failed to generate a valid template. Please try a simpler prompt." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    )
  }
}
