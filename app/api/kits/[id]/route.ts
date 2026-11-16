import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { isPlausibleToday, kitStatusSchema } from "@/lib/life-kit-input"
import { finishKit, pauseKit, removeKit, resumeKit } from "@/lib/life-kits-server"

type RouteContext = {
  params: Promise<{ id: string }>
}

// PATCH /api/kits/[id] { status, today }: pause, resume or finish a kit.
export async function PATCH(request: Request, context: RouteContext) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await context.params
  const parsed = kitStatusSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success || !isPlausibleToday(parsed.data.today)) {
    return NextResponse.json({ error: "Send a status and today's date." }, { status: 400 })
  }

  try {
    const { status, today } = parsed.data
    const result =
      status === "paused"
        ? await pauseKit(user.id, id, today)
        : status === "active"
          ? await resumeKit(user.id, id, today)
          : await finishKit(user.id, id)
    if (!result) return NextResponse.json({ error: "Kit not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[kits] PATCH error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Couldn't change that kit." }, { status: 500 })
  }
}

// DELETE /api/kits/[id]: remove a kit and tidy away what it added that was never used.
export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await context.params
  try {
    const result = await removeKit(user.id, id)
    if (!result) return NextResponse.json({ error: "Kit not found" }, { status: 404 })
    return NextResponse.json(result)
  } catch (error) {
    console.error("[kits] DELETE error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Couldn't remove that kit." }, { status: 500 })
  }
}
