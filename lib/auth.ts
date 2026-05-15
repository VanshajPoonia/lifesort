import { cookies } from 'next/headers'
import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'

const sql = neon(process.env.DATABASE_URL!)

export interface User {
  id: string
  email: string
  name: string
  created_at: string
  trial_ends_at: string
  is_subscribed: boolean
  subscription_ends_at: string | null
  is_admin: boolean
  onboarding_completed: boolean
}

export interface Session {
  id: string
  user_id: string
  expires_at: string
}

async function hashPasswordSha256(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

// Verify password
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  if (!hashedPassword) return false

  if (hashedPassword.startsWith('$2a$') || hashedPassword.startsWith('$2b$') || hashedPassword.startsWith('$2y$')) {
    return bcrypt.compare(password, hashedPassword)
  }

  const legacyHash = await hashPasswordSha256(password)
  return legacyHash === hashedPassword
}

export function isLegacyPasswordHash(hashedPassword: string): boolean {
  return Boolean(hashedPassword && !hashedPassword.startsWith('$2'))
}

export async function updateUserPasswordHash(userId: string, password: string): Promise<void> {
  const passwordHash = await hashPassword(password)
  await sql`
    UPDATE users SET password_hash = ${passwordHash}, updated_at = NOW()
    WHERE id = ${userId}
  `
}

// Create session
export async function createSession(userId: string): Promise<string> {
  const sessionToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  
  await sql`
    INSERT INTO sessions (user_id, session_token, expires_at)
    VALUES (${userId}, ${sessionToken}, ${expiresAt.toISOString()})
  `
  
  return sessionToken
}

// Get session cookie from request
export function getSessionFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  
  const cookies = cookieHeader.split(';').map(c => c.trim())
  const sessionCookie = cookies.find(c => c.startsWith('session='))
  
  if (!sessionCookie) return null
  
  return sessionCookie.split('=')[1]
}

// Get session
export async function getSession(sessionToken: string): Promise<Session | null> {
  const result = await sql`
    SELECT * FROM sessions 
    WHERE session_token = ${sessionToken} AND expires_at > NOW()
  `
  
  return result[0] as Session || null
}

// Get user by ID (from session object)
export async function getUserById(session: Session): Promise<User | null> {
  const result = await sql`
    SELECT id, email, name, created_at, trial_ends_at, is_subscribed, subscription_ends_at, is_admin, onboarding_completed
    FROM users 
    WHERE id = ${session.user_id}
  `
  
  return result[0] as User || null
}

export async function getUserFromRequest(request: Request): Promise<User | null> {
  const sessionToken = getSessionFromCookie(request)
  if (!sessionToken) return null

  const session = await getSession(sessionToken)
  if (!session) return null

  return getUserById(session)
}

// Get user from session
export async function getUserFromSession(): Promise<User | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get('session')?.value
  
  if (!sessionId) return null
  
  const session = await getSession(sessionId)
  if (!session) return null
  
  return getUserById(session)
}

// Delete session (logout)
export async function deleteSession(sessionToken: string): Promise<void> {
  await sql`
    DELETE FROM sessions WHERE session_token = ${sessionToken}
  `
}

// Create user
export async function createUser(email: string, password: string, name: string): Promise<User> {
  const hashedPassword = await hashPassword(password)
  const trialEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day from now
  
  const result = await sql`
    INSERT INTO users (email, password_hash, name, trial_ends_at, onboarding_completed)
    VALUES (${email.toLowerCase()}, ${hashedPassword}, ${name}, ${trialEndsAt.toISOString()}, false)
    RETURNING id, email, name, created_at, trial_ends_at, is_subscribed, subscription_ends_at, is_admin, onboarding_completed
  `
  
  return result[0] as User
}

// Get user by email
export async function getUserByEmail(email: string) {
  const result = await sql`
    SELECT * FROM users WHERE email = ${email.toLowerCase()}
  `
  
  return result[0] || null
}
