import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { disconnect, listConnections } from "@/lib/oauth-server"

const noStore = { "Cache-Control": "no-store" }

// GET: apps connected to this account through the connector. DELETE { client_id }: disconnect one.
export async function GET() {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore })
  return NextResponse.json({ connections: await listConnections(user.id) }, { headers: noStore })
}

export async function DELETE(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore })
  const body = await request.json().catch(() => null)
  if (typeof body?.client_id !== "string" || !body.client_id) {
    return NextResponse.json({ error: "Send client_id." }, { status: 400, headers: noStore })
  }
  await disconnect(user.id, body.client_id)
  return NextResponse.json({ success: true }, { headers: noStore })
}
