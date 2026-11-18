import { sql } from "@/lib/db"
import { DAILY_CAPTURE_LIMIT, LINK_CODE_MINUTES, newAddressToken, newLinkCode } from "@/lib/capture"

// Storage for capture channels: one email address token and one linked WhatsApp number per person.

export type CaptureSource = "email" | "whatsapp"

export function captureConfig() {
  return {
    emailDomain: process.env.CAPTURE_EMAIL_DOMAIN?.trim().toLowerCase() || "",
    emailReady: Boolean(process.env.CAPTURE_EMAIL_DOMAIN && process.env.RESEND_WEBHOOK_SECRET && process.env.RESEND_API_KEY),
    whatsappNumber: process.env.WHATSAPP_NUMBER?.trim() || "",
    whatsappReady: Boolean(process.env.WHATSAPP_VERIFY_TOKEN && process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_NUMBER),
  }
}

export async function emailToken(userId: string, reset = false): Promise<string> {
  const token = newAddressToken()
  const rows = reset
    ? await sql`
        INSERT INTO capture_channels (user_id, channel, address_token)
        VALUES (${userId}, 'email', ${token})
        ON CONFLICT (user_id, channel) DO UPDATE SET address_token = EXCLUDED.address_token
        RETURNING address_token
      `
    : await sql`
        INSERT INTO capture_channels (user_id, channel, address_token)
        VALUES (${userId}, 'email', ${token})
        ON CONFLICT (user_id, channel) DO UPDATE SET address_token = capture_channels.address_token
        RETURNING address_token
      `
  return String(rows[0].address_token)
}

export async function whatsappStatus(userId: string) {
  const rows = await sql`
    SELECT phone, link_code, link_code_expires_at FROM capture_channels WHERE user_id = ${userId} AND channel = 'whatsapp'
  `
  const row = rows[0]
  const codeLive = row?.link_code && row.link_code_expires_at && new Date(row.link_code_expires_at) > new Date()
  return {
    linked: Boolean(row?.phone),
    phoneEnding: row?.phone ? String(row.phone).slice(-4) : null,
    linkCode: !row?.phone && codeLive ? String(row.link_code) : null,
  }
}

export async function startWhatsAppLink(userId: string) {
  const code = newLinkCode()
  const expires = new Date(Date.now() + LINK_CODE_MINUTES * 60_000).toISOString()
  await sql`
    INSERT INTO capture_channels (user_id, channel, link_code, link_code_expires_at)
    VALUES (${userId}, 'whatsapp', ${code}, ${expires})
    ON CONFLICT (user_id, channel) DO UPDATE SET link_code = EXCLUDED.link_code, link_code_expires_at = EXCLUDED.link_code_expires_at
  `
  return code
}

export async function unlinkWhatsApp(userId: string) {
  await sql`DELETE FROM capture_channels WHERE user_id = ${userId} AND channel = 'whatsapp'`
}

export async function userForEmailToken(token: string): Promise<string | null> {
  const rows = await sql`SELECT user_id FROM capture_channels WHERE channel = 'email' AND address_token = ${token}`
  return rows[0] ? String(rows[0].user_id) : null
}

export async function userForPhone(phone: string): Promise<string | null> {
  const rows = await sql`SELECT user_id FROM capture_channels WHERE channel = 'whatsapp' AND phone = ${phone}`
  return rows[0] ? String(rows[0].user_id) : null
}

// Links the number that sent a live code. A number can belong to one person only.
export async function linkWhatsApp(code: string, phone: string): Promise<boolean> {
  const rows = await sql`
    UPDATE capture_channels
    SET phone = ${phone}, linked_at = NOW(), link_code = NULL, link_code_expires_at = NULL
    WHERE channel = 'whatsapp' AND link_code = ${code} AND link_code_expires_at > NOW()
      AND NOT EXISTS (SELECT 1 FROM capture_channels other WHERE other.channel = 'whatsapp' AND other.phone = ${phone})
    RETURNING user_id
  `
  return rows.length > 0
}

// Saves to Inbox unless the person already got 50 captured items today.
export async function captureToInbox(userId: string, source: CaptureSource, title: string, rawText: string) {
  const count = await sql`
    SELECT COUNT(*)::int AS n FROM inbox_items
    WHERE user_id = ${userId} AND source IN ('email', 'whatsapp') AND created_at >= CURRENT_DATE
  `
  if (Number(count[0]?.n ?? 0) >= DAILY_CAPTURE_LIMIT) return "limit" as const
  await sql.transaction((tx) => [
    tx`INSERT INTO inbox_items (user_id, title, raw_text, source) VALUES (${userId}, ${title}, ${rawText}, ${source})`,
    tx`UPDATE capture_channels SET last_used_at = NOW() WHERE user_id = ${userId} AND channel = ${source}`,
  ])
  return "saved" as const
}
