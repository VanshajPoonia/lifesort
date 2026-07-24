import { NextResponse } from "next/server"
import { neon } from "@/lib/neon-client"
import { getUserFromSession } from "@/lib/auth"
import { normalizeCurrency } from "@/lib/currency"

const sql = neon(process.env.DATABASE_URL!)

const defaultJournalIntentions = {
  journal_intention_1: "Work",
  journal_intention_2: "Personal",
  journal_intention_3: "Family",
}

function cleanJournalIntention(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 40) : fallback
}

async function getProfilePreferences(userId: string) {
  try {
    const rows = await sql`
      SELECT journal_intention_1, journal_intention_2, journal_intention_3, preferred_currency
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `
    return {
      journal_intention_1: cleanJournalIntention(rows[0]?.journal_intention_1, defaultJournalIntentions.journal_intention_1),
      journal_intention_2: cleanJournalIntention(rows[0]?.journal_intention_2, defaultJournalIntentions.journal_intention_2),
      journal_intention_3: cleanJournalIntention(rows[0]?.journal_intention_3, defaultJournalIntentions.journal_intention_3),
      preferred_currency: normalizeCurrency(rows[0]?.preferred_currency),
    }
  } catch (error) {
    console.error("[profile] optional preference fields unavailable:", error)
    return { ...defaultJournalIntentions, preferred_currency: "USD" }
  }
}

export async function GET() {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await sql`
      SELECT id, name, email, avatar, bio, phone, location, date_of_birth, subscription_tier, subscription_end_date, created_at
      FROM users WHERE id = ${user.id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get content preferences
    const prefs = await sql`
      SELECT * FROM user_content_preferences WHERE user_id = ${user.id}
    `

    const profilePreferences = await getProfilePreferences(user.id)

    return NextResponse.json({ 
      ...result[0],
      ...profilePreferences,
      content_preferences: prefs[0] || null
    })
  } catch (error) {
    console.error("[v0] Get profile error:", error)
    return NextResponse.json({ error: "Failed to get profile" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, avatar, bio, phone, location, date_of_birth, journal_intention_1, journal_intention_2, journal_intention_3, preferred_currency } = body

    const result = await sql`
      UPDATE users SET
        name = COALESCE(${name ?? null}, name),
        avatar = COALESCE(${avatar ?? null}, avatar),
        bio = COALESCE(${bio ?? null}, bio),
        phone = COALESCE(${phone ?? null}, phone),
        location = COALESCE(${location ?? null}, location),
        date_of_birth = COALESCE(${date_of_birth ?? null}, date_of_birth)
      WHERE id = ${user.id}
      RETURNING id, name, email, avatar, bio, phone, location, date_of_birth, subscription_tier, created_at
    `

    const hasJournalPreferences =
      Object.prototype.hasOwnProperty.call(body, "journal_intention_1") ||
      Object.prototype.hasOwnProperty.call(body, "journal_intention_2") ||
      Object.prototype.hasOwnProperty.call(body, "journal_intention_3")
    const hasCurrencyPreference = Object.prototype.hasOwnProperty.call(body, "preferred_currency")

    if (hasJournalPreferences) {
      try {
        await sql`
          UPDATE users SET
            journal_intention_1 = ${cleanJournalIntention(journal_intention_1, defaultJournalIntentions.journal_intention_1)},
            journal_intention_2 = ${cleanJournalIntention(journal_intention_2, defaultJournalIntentions.journal_intention_2)},
            journal_intention_3 = ${cleanJournalIntention(journal_intention_3, defaultJournalIntentions.journal_intention_3)},
            updated_at = NOW()
          WHERE id = ${user.id}
        `
      } catch (error) {
        console.error("[profile] optional journal preference fields update failed:", error)
      }
    }

    if (hasCurrencyPreference) {
      try {
        await sql`
          UPDATE users SET
            preferred_currency = ${normalizeCurrency(preferred_currency)},
            updated_at = NOW()
          WHERE id = ${user.id}
        `
      } catch (error) {
        console.error("[profile] optional currency preference field update failed:", error)
      }
    }

    const profilePreferences = await getProfilePreferences(user.id)

    return NextResponse.json({ ...result[0], ...profilePreferences })
  } catch (error) {
    console.error("[v0] Update profile error:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
