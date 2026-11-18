import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

import { richTextToPlainText } from "@/lib/rich-text"

// Email and WhatsApp capture (AI_BUILD_PLAN.md Part 0, part D): anything sent to a
// person's private address or from their linked number lands in their Inbox.

export const MAX_CAPTURE_TEXT = 5000
export const DAILY_CAPTURE_LIMIT = 50
export const LINK_CODE_MINUTES = 30
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60

const TOKEN_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const TOKEN_LENGTH = 12
const CODE_LENGTH = 6

function randomFrom(alphabet: string, length: number) {
  const bytes = randomBytes(length)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")
}

// The private part of someone's capture address, like k3x9pm7qa2hd@<domain>.
export function newAddressToken() {
  return randomFrom(TOKEN_ALPHABET, TOKEN_LENGTH)
}

export function newLinkCode() {
  return randomFrom(CODE_ALPHABET, CODE_LENGTH)
}

const TOKEN_RE = new RegExp(`^[${TOKEN_ALPHABET}]{${TOKEN_LENGTH}}$`)
const CODE_RE = new RegExp(`^\\s*(?:link\\s+)?([${CODE_ALPHABET}]{${CODE_LENGTH}})\\s*$`, "i")

// Finds our token among the recipients. "Name <token@domain>" and token+tag@domain both work.
export function tokenFromRecipients(recipients: unknown, domain: string): string | null {
  if (!Array.isArray(recipients) || !domain) return null
  for (const recipient of recipients) {
    if (typeof recipient !== "string") continue
    const address = (/<([^>]+)>/.exec(recipient)?.[1] ?? recipient).trim().toLowerCase()
    const [local, host] = address.split("@")
    if (!local || host !== domain.toLowerCase()) continue
    const token = local.split("+")[0]
    if (TOKEN_RE.test(token)) return token
  }
  return null
}

export function linkCodeFrom(text: string): string | null {
  return CODE_RE.exec(text)?.[1]?.toUpperCase() ?? null
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

// Resend signs webhooks the Svix way: base64 HMAC-SHA256 of "id.timestamp.body", keyed by
// the base64 part of the whsec_ secret. The header can hold several "v1,<sig>" entries.
export function verifySvixSignature(
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!headers.id || !headers.timestamp || !headers.signature || !secret) return false
  const timestamp = Number(headers.timestamp)
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false
  const key = Buffer.from(secret.startsWith("whsec_") ? secret.slice(6) : secret, "base64")
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${body}`).digest("base64")
  return headers.signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",")
    return version === "v1" && Boolean(value) && safeEqual(value, expected)
  })
}

// Meta signs WhatsApp webhooks with X-Hub-Signature-256: sha256=<hex HMAC of the raw body>.
export function verifyMetaSignature(body: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=") || !appSecret) return false
  const expected = createHmac("sha256", appSecret).update(body).digest("hex")
  return safeEqual(header.slice(7), expected)
}

function clip(text: string) {
  return text.length > MAX_CAPTURE_TEXT ? `${text.slice(0, MAX_CAPTURE_TEXT)}...` : text
}

export function emailToInbox(email: { subject?: string | null; text?: string | null; html?: string | null; from?: string | null }) {
  const fromHtml = email.html ? richTextToPlainText(email.html).split("\n").map((line) => line.trim()).join("\n") : ""
  const body = (email.text?.trim() || fromHtml).trim()
  const subject = email.subject?.trim().replace(/^(fwd?|fw):\s*/i, "") ?? ""
  const title = (subject || body.split(/\r?\n/)[0]?.trim() || "An email").slice(0, 255)
  const from = email.from?.trim()
  const rawText = clip([body, from ? `Sent by ${from}` : null].filter(Boolean).join("\n\n"))
  return { title, rawText: rawText || title }
}

export function textToInbox(text: string) {
  const trimmed = text.trim()
  return { title: (trimmed.split(/\r?\n/)[0]?.trim() || "A message").slice(0, 255), rawText: clip(trimmed) }
}

export type WhatsAppMessage = { from: string; id: string; type: string; text: string | null }

// Pulls the messages out of a WhatsApp Cloud API webhook. Status updates are ignored.
export function parseWhatsAppMessages(payload: unknown): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = []
  const entries = (payload as { entry?: unknown })?.entry
  if (!Array.isArray(entries)) return messages
  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      const list = (change as { value?: { messages?: unknown } })?.value?.messages
      if (!Array.isArray(list)) continue
      for (const item of list) {
        const message = item as { from?: unknown; id?: unknown; type?: unknown; text?: { body?: unknown } }
        if (typeof message.from !== "string" || typeof message.id !== "string") continue
        const type = typeof message.type === "string" ? message.type : "unknown"
        const text = type === "text" && typeof message.text?.body === "string" ? message.text.body : null
        messages.push({ from: message.from, id: message.id, type, text })
      }
    }
  }
  return messages
}
