import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { isPlausibleToday, startKitSchema } from "@/lib/life-kit-input"
import { getKitDefinition } from "@/lib/life-kits"
import { listKits, startKit } from "@/lib/life-kits-server"

// GET /api/kits?today=YYYY-MM-DD[&life_area_id=n]: the person's kits with progress.
export async function GET(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = new URL(request.url)
  const today = url.searchParams.get("today") ?? ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || !isPlausibleToday(today)) {
    return NextResponse.json({ error: "Send today's date as YYYY-MM-DD" }, { status: 400 })
  }
  const areaParam = Number(url.searchParams.get("life_area_id"))
  const lifeAreaId = Number.isInteger(areaParam) && areaParam > 0 ? areaParam : null

  try {
    return NextResponse.json({ kits: await listKits(user.id, today, lifeAreaId) })
  } catch (error) {
    console.error("[kits] GET error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Couldn't load your kits." }, { status: 500 })
  }
}

// POST /api/kits: start a kit. Items listed in skip (planner keys) are left out.
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = startKitSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "That kit isn't valid.", issues: parsed.error.issues }, { status: 400 })
  }
  const body = parsed.data
  if (!getKitDefinition(body.kit_key)) return NextResponse.json({ error: "That kit doesn't exist." }, { status: 400 })
  if (!isPlausibleToday(body.today)) return NextResponse.json({ error: "Your device date looks wrong." }, { status: 400 })

  try {
    const kit = await startKit(user.id, {
      kitKey: body.kit_key,
      anchorDate: body.anchor_date,
      today: body.today,
      inputs: { label: body.label ?? null, amount: body.amount ?? null },
      lifeAreaId: body.life_area_id ?? null,
      skip: body.skip,
    })
    return NextResponse.json({ kit }, { status: 201 })
  } catch (error) {
    console.error("[kits] POST error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Couldn't start that kit." }, { status: 500 })
  }
}
