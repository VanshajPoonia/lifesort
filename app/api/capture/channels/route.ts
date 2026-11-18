import { NextResponse } from "next/server"

import { getUserFromSession } from "@/lib/auth"
import { captureConfig, emailToken, startWhatsAppLink, unlinkWhatsApp, whatsappStatus } from "@/lib/capture-server"

const noStore = { "Cache-Control": "no-store" }

async function snapshot(userId: string) {
  const config = captureConfig()
  return {
    email: config.emailReady ? { ready: true, address: `${await emailToken(userId)}@${config.emailDomain}` } : { ready: false, address: null },
    whatsapp: config.whatsappReady
      ? { ready: true, number: config.whatsappNumber, ...(await whatsappStatus(userId)) }
      : { ready: false, number: null, linked: false, phoneEnding: null, linkCode: null },
  }
}

// GET: this person's capture address and WhatsApp link, creating the address the first time.
export async function GET() {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore })
  return NextResponse.json(await snapshot(user.id), { headers: noStore })
}

// POST { action }: reset_email, link_whatsapp (a fresh code) or unlink_whatsapp.
export async function POST(request: Request) {
  const user = await getUserFromSession()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: noStore })
  const config = captureConfig()
  const { action } = (await request.json().catch(() => ({}))) as { action?: string }

  if (action === "reset_email" && config.emailReady) await emailToken(user.id, true)
  else if (action === "link_whatsapp" && config.whatsappReady) await startWhatsAppLink(user.id)
  else if (action === "unlink_whatsapp") await unlinkWhatsApp(user.id)
  else return NextResponse.json({ error: "That isn't available." }, { status: 400, headers: noStore })

  return NextResponse.json(await snapshot(user.id), { headers: noStore })
}
