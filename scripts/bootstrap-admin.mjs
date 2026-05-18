#!/usr/bin/env node
// scripts/bootstrap-admin.mjs
//
// Creates (or promotes) a user with is_admin = TRUE and seeds the 13 default
// life areas. Useful right after a fresh schema install when no users exist
// yet and the /register flow can't create an admin.
//
// Usage:
//   node --env-file=.env.local scripts/bootstrap-admin.mjs <email> <password> <name>
//
// Behavior:
// - If the email doesn't exist: creates a new user with is_admin = TRUE.
// - If the email already exists: promotes that account to is_admin = TRUE
//   (password is NOT changed; use the password reset flow if you need that).
// - Idempotent on life_areas (ON CONFLICT DO NOTHING per area).

import bcrypt from "bcryptjs"
import { neon } from "@neondatabase/serverless"

const DEFAULT_LIFE_AREAS = [
  { name: "Work", icon: "Briefcase", color: "#2563EB", description: "Career, job responsibilities, and professional projects" },
  { name: "School", icon: "GraduationCap", color: "#7C3AED", description: "Classes, coursework, exams, and academic planning" },
  { name: "Finance", icon: "Wallet", color: "#059669", description: "Money, budgets, income, investing, and financial goals" },
  { name: "Health", icon: "HeartPulse", color: "#DC2626", description: "Medical care, wellness, appointments, and health habits" },
  { name: "Fitness", icon: "Dumbbell", color: "#EA580C", description: "Training, movement, strength, and physical goals" },
  { name: "Family", icon: "Home", color: "#DB2777", description: "Family responsibilities, plans, and relationships" },
  { name: "Friends", icon: "Users", color: "#0891B2", description: "Friendships, social plans, and community" },
  { name: "Personal", icon: "User", color: "#4F46E5", description: "Personal admin, routines, and self-management" },
  { name: "Learning", icon: "BookOpen", color: "#9333EA", description: "Skills, reading, courses, and curiosity" },
  { name: "Business", icon: "Building2", color: "#0F766E", description: "Business ideas, operations, clients, and growth" },
  { name: "Home", icon: "House", color: "#CA8A04", description: "Home projects, maintenance, chores, and space planning" },
  { name: "Travel", icon: "Plane", color: "#0284C7", description: "Trips, itineraries, packing, and places to go" },
  { name: "Creativity", icon: "Palette", color: "#C026D3", description: "Creative projects, art, writing, and making things" },
]

const [, , emailArg, passwordArg, nameArg] = process.argv
if (!emailArg || !passwordArg || !nameArg) {
  console.error("Usage: node --env-file=.env.local scripts/bootstrap-admin.mjs <email> <password> <name>")
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set. Did you pass --env-file=.env.local ?")
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)
const email = emailArg.toLowerCase()
const hashedPassword = await bcrypt.hash(passwordArg, 12)
const trialEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

const userRows = await sql`
  INSERT INTO users (email, password_hash, name, trial_ends_at, onboarding_completed, is_admin)
  VALUES (${email}, ${hashedPassword}, ${nameArg}, ${trialEndsAt}, false, true)
  ON CONFLICT (email) DO UPDATE SET is_admin = true
  RETURNING id, email, name, is_admin, (xmax = 0) AS was_inserted
`
const user = userRows[0]
console.log(`${user.was_inserted ? "✓ Created new user" : "✓ Promoted existing user"}: id=${user.id}, email=${user.email}, name=${user.name}, is_admin=${user.is_admin}`)

let seeded = 0
for (const [index, area] of DEFAULT_LIFE_AREAS.entries()) {
  const r = await sql`
    INSERT INTO life_areas (user_id, name, icon, color, description, sort_order)
    VALUES (${user.id}, ${area.name}, ${area.icon}, ${area.color}, ${area.description}, ${index})
    ON CONFLICT (user_id, name) DO NOTHING
    RETURNING id
  `
  if (r.length > 0) seeded++
}
console.log(`✓ Seeded ${seeded}/${DEFAULT_LIFE_AREAS.length} life areas (${DEFAULT_LIFE_AREAS.length - seeded} already existed)`)
console.log("\nDone. Log in with this email/password and you'll have admin access.")
