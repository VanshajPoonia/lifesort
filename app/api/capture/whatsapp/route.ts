import { after } from "next/server"

import { captureToInbox, linkWhatsApp, userForPhone } from "@/lib/capture-server"
import { linkCodeFrom, parseWhatsAppMessages, textToInbox, verifyMetaSignature } from "@/lib/capture"

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0"

// Replies inside the 24-hour window a person's own message opens, which Meta doesn't charge for.
async function reply(to: string, text: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) return
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  })
  if (!response.ok) console.error(`[capture/whatsapp] reply failed with ${response.status}`)
}

// GET: Meta's one-time webhook check, answered with the challenge when the verify token matches.
export function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const expected = process.env.WHATSAPP_VERIFY_TOKEN
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 })
  }
  return new Response("Forbidden", { status: 403 })
}

// POST: incoming WhatsApp messages. A linked number's texts land in its owner's Inbox; an
// unlinked number can send the code from Settings to link itself.
export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET
  if (!secret) return new Response("WhatsApp capture isn't set up.", { status: 503 })

  const body = await request.text()
  if (!verifyMetaSignature(body, request.headers.get("x-hub-signature-256"), secret)) {
    return new Response("Bad signature", { status: 401 })
  }

  const replies: { to: string; text: string }[] = []
  for (const message of parseWhatsAppMessages(JSON.parse(body))) {
    const userId = await userForPhone(message.from)
    if (userId) {
      if (!message.text) {
        replies.push({ to: message.from, text: "LifeSort can only save text messages for now." })
        continue
      }
      const { title, rawText } = textToInbox(message.text)
      const result = await captureToInbox(userId, "whatsapp", title, rawText)
      replies.push({ to: message.from, text: result === "saved" ? "Saved to your LifeSort Inbox." : "That's 50 for today, so this one wasn't saved." })
      continue
    }
    const code = message.text ? linkCodeFrom(message.text) : null
    if (code && (await linkWhatsApp(code, message.from))) {
      replies.push({ to: message.from, text: "Linked. Anything you send here now lands in your LifeSort Inbox." })
    } else {
      replies.push({ to: message.from, text: "This number isn't linked to LifeSort yet. Open Settings > Account in LifeSort and send the code shown there." })
    }
  }

  if (replies.length) after(async () => {
    for (const item of replies) await reply(item.to, item.text)
  })
  return new Response(null, { status: 200 })
}
