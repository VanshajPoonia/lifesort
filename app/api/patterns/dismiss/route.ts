import { NextResponse } from "next/server"
import { z } from "zod"

import { getUserFromSession } from "@/lib/auth"
import { isPlausibleToday } from "@/lib/life-kit-input"
import { dismissPattern } from "@/lib/life-patterns-server"

const dismissSchema = z.object({
  key: z.string().regex(/^[a-z0-9-]{1,80}$/),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// POST /api/patterns/dismiss { key, today }: hide one pattern for four weeks.
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = dismissSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !isPlausibleToday(parsed.data.today)) {
    return NextResponse.json({ error: "Send a pattern key and today's date." }, { status: 400 })
  }

  try {
    await dismissPattern(user.id, parsed.data.key, parsed.data.today)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[patterns/dismiss] POST error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Couldn't hide that." }, { status: 500 })
  }
}
