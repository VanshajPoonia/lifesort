import { NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { getUserFromSession } from '@/lib/auth'

const sql = neon(process.env.DATABASE_URL!)

export async function POST(request: Request) {
  try {
    const admin = await getUserFromSession()
    if (!admin?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId, isSubscribed, subscriptionEndsAt } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Update user subscription status
    const result = await sql`
      UPDATE users 
      SET 
        is_subscribed = ${isSubscribed},
        subscription_ends_at = ${subscriptionEndsAt || null},
        subscription_end_date = ${subscriptionEndsAt || null}
      WHERE id = ${userId}
      RETURNING id, email, name, is_subscribed, subscription_ends_at, trial_ends_at
    `

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ 
      message: 'Subscription updated successfully',
      user: result[0] 
    })
  } catch (error) {
    console.error('Error updating subscription:', error)
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
  }
}

// Get all users with their subscription status and profile info
export async function GET() {
  try {
    const admin = await getUserFromSession()
    if (!admin?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const users = await sql`
      SELECT 
        id, 
        email, 
        name, 
        created_at,
        trial_ends_at, 
        is_subscribed, 
        subscription_ends_at,
        subscription_end_date,
        avatar_url as avatar,
        bio,
        phone,
        location,
        date_of_birth,
        CASE 
          WHEN is_subscribed = true AND (subscription_ends_at IS NULL OR subscription_ends_at > NOW()) THEN 'active'
          WHEN trial_ends_at > NOW() THEN 'trial'
          ELSE 'expired'
        END as status,
        COALESCE(
          CASE 
            WHEN subscription_ends_at IS NULL AND is_subscribed = true THEN 'enterprise'
            WHEN is_subscribed = true THEN 'pro'
            ELSE 'free'
          END, 
          'free'
        ) as subscription_tier
      FROM users
      ORDER BY created_at DESC
    `

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
