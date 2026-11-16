import webpush from "web-push"

import { sql } from "@/lib/db"

export type PushPayload = {
  title: string
  body: string
  url?: string
  tag?: string
}

type SubscriptionRow = { id: number; endpoint: string; p256dh: string; auth: string }

let configured: boolean | null = null

// Push stays off until all three VAPID env vars exist (preview builds may not have them).
export function isPushConfigured() {
  if (configured !== null) return configured
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  configured = Boolean(publicKey && privateKey && subject)
  if (publicKey && privateKey && subject) webpush.setVapidDetails(subject, publicKey, privateKey)
  return configured
}

// Sends to every device the user turned push on for. Devices the push service says
// are gone (404 or 410) are deleted.
export async function sendPushToUser(userId: string, payload: PushPayload) {
  const result = { sent: 0, removed: 0, failed: 0 }
  if (!isPushConfigured()) return result

  const rows = (await sql`
    SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ${userId}
  `) as SubscriptionRow[]

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12 },
        )
        result.sent += 1
        await sql`UPDATE push_subscriptions SET last_success_at = NOW() WHERE id = ${row.id}`
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await sql`DELETE FROM push_subscriptions WHERE id = ${row.id}`
          result.removed += 1
          return
        }
        result.failed += 1
        console.error("[push] send failed:", status ?? (error instanceof Error ? error.message : error))
      }
    }),
  )

  return result
}
