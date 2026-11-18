import { captureConfig, captureToInbox, userForEmailToken } from "@/lib/capture-server"
import { emailToInbox, tokenFromRecipients, verifySvixSignature } from "@/lib/capture"

type ReceivedEmail = { subject?: string | null; text?: string | null; html?: string | null; from?: string | null }

// Resend's webhook only carries metadata; the body comes from its receiving API.
async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail | null> {
  const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
  })
  if (!response.ok) {
    console.error(`[capture/email] Resend returned ${response.status} for a received email`)
    return null
  }
  return response.json()
}

// POST: Resend's email.received webhook. Mail to someone's private address lands in their
// Inbox. Unknown addresses get a quiet 200 so senders can't probe for valid ones.
export async function POST(request: Request) {
  const config = captureConfig()
  if (!config.emailReady) return new Response("Email capture isn't set up.", { status: 503 })

  const body = await request.text()
  const signed = verifySvixSignature(
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    body,
    process.env.RESEND_WEBHOOK_SECRET!,
  )
  if (!signed) return new Response("Bad signature", { status: 401 })

  const event = JSON.parse(body) as { type?: string; data?: { email_id?: string; to?: unknown; received_for?: unknown; subject?: string; from?: string } }
  if (event.type !== "email.received" || !event.data?.email_id) return new Response(null, { status: 204 })

  const recipients = [
    ...(Array.isArray(event.data.to) ? event.data.to : []),
    ...(Array.isArray(event.data.received_for) ? event.data.received_for : []),
  ]
  const token = tokenFromRecipients(recipients, config.emailDomain)
  const userId = token ? await userForEmailToken(token) : null
  if (!userId) return new Response(null, { status: 204 })

  const email = (await fetchReceivedEmail(event.data.email_id)) ?? {
    subject: event.data.subject,
    from: event.data.from,
    text: "LifeSort couldn't read this email's text. Open it in your mail app.",
  }
  const { title, rawText } = emailToInbox({ ...email, subject: email.subject ?? event.data.subject, from: email.from ?? event.data.from })
  const result = await captureToInbox(userId, "email", title, rawText)
  if (result === "limit") console.warn("[capture/email] daily limit reached for a user; email dropped")
  return new Response(null, { status: 204 })
}
