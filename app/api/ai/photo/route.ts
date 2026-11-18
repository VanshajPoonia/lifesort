import { generateText, Output } from "ai"
import { NextResponse } from "next/server"

import { gemini, GEMINI_FLASH_MODEL } from "@/lib/ai-provider"
import { getUserFromSession } from "@/lib/auth"
import { checkAiUsageLimit, createAiUsageEvent, updateAiUsageEvent } from "@/lib/ai-usage"
import { isPlausibleToday } from "@/lib/life-kit-input"
import { buildPhotoPrompt, cleanDraft, MAX_PHOTO_BYTES, PHOTO_TYPES, photoDraftSchema } from "@/lib/photo-scan"

const noStore = { "Cache-Control": "no-store" }

// Other Gemini routes took 16 to 105 seconds in tests.
export const maxDuration = 60

// POST /api/ai/photo (multipart: photo, today): a draft of what the photo is.
// Nothing is saved here; /api/vault/photo saves what the person confirms.
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore })
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI isn't set up on this server yet." }, { status: 503, headers: noStore })
  }

  const form = await request.formData().catch(() => null)
  const photo = form?.get("photo")
  const todayValue = form?.get("today")
  const today = typeof todayValue === "string" && isPlausibleToday(todayValue) ? todayValue : new Date().toISOString().slice(0, 10)
  if (!(photo instanceof File)) {
    return NextResponse.json({ error: "Send a photo." }, { status: 400, headers: noStore })
  }
  if (!PHOTO_TYPES.has(photo.type)) {
    return NextResponse.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 400, headers: noStore })
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return NextResponse.json({ error: "That photo is too big. Try a smaller one." }, { status: 413, headers: noStore })
  }

  const limit = await checkAiUsageLimit(user.id, "photo_scan")
  if (!limit.allowed) {
    await createAiUsageEvent({ userId: user.id, route: "photo_scan", provider: "gemini", model: GEMINI_FLASH_MODEL, status: "rate_limited" })
    return NextResponse.json({ error: "That's today's 10 photo scans. You can still fill it in yourself." }, { status: 429, headers: noStore })
  }

  const usageEventId = await createAiUsageEvent({ userId: user.id, route: "photo_scan", provider: "gemini", model: GEMINI_FLASH_MODEL })
  try {
    const image = new Uint8Array(await photo.arrayBuffer())
    const result = await generateText({
      model: gemini(GEMINI_FLASH_MODEL),
      output: Output.object({ schema: photoDraftSchema }),
      // Three tries under load took over 60 seconds; one retry leaves time for the manual form.
      maxRetries: 1,
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPhotoPrompt(today) },
            { type: "image", image, mediaType: photo.type },
          ],
        },
      ],
    })
    const draft = cleanDraft(photoDraftSchema.parse(result.output))
    await updateAiUsageEvent(usageEventId, "success")
    return NextResponse.json({ draft, remaining: Math.max(0, limit.remaining - 1) }, { headers: noStore })
  } catch (error) {
    await updateAiUsageEvent(usageEventId, "provider_error", error instanceof Error ? error.message : "Photo scan failed")
    return NextResponse.json({ error: "Couldn't read that photo. You can fill it in yourself." }, { status: 502, headers: noStore })
  }
}
