import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { isPushConfigured, sendPushToUser } from "@/lib/push"

// Sends one push to the signed-in user's devices so they can see it works.
export async function POST() {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isPushConfigured()) return NextResponse.json({ error: "Push isn't set up on this server." }, { status: 503 })

  try {
    const result = await sendPushToUser(user.id, {
      title: "LifeSort",
      body: "Push reminders are on. You'll get a nudge before things are due.",
      url: "/",
      tag: "push-test",
    })
    if (result.sent === 0) {
      return NextResponse.json({ error: "No device got it. Turn push off and on again on this device.", ...result }, { status: 409 })
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error("[push/test] POST error:", error instanceof Error ? error.message : error)
    return NextResponse.json({ error: "Couldn't send a test push." }, { status: 500 })
  }
}
