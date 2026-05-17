# AI_AUDIT.md

**Audit date:** 2026-05-17
**Auditor:** Claude Code (review mode)
**Scope:** Database schema, API routes, auth, integrations, security, data integrity, agent-readiness
**Trigger:** Pre-Agents readiness review before building the LifeSort Agents (OpenClaw-style) feature

This is a point-in-time snapshot. Re-run the recurring checks in [AI_CHECKLIST.md](AI_CHECKLIST.md#recurring-dbapi-safety-checks) periodically.

---

## A. Executive Summary

LifeSort is a feature-rich personal life-management app with 81 API routes, 51 user-scoped tables, and 7 external integrations. The core feature surface works in production, but **rapid feature work has produced significant migration drift, validation inconsistency, and three concrete security issues that must be fixed before the Agents feature ships**.

**Headline findings:**

1. **CRITICAL: CRON_SECRET check has a fall-through bug** — `app/api/cron/deadline-reminders/route.ts:29-34`. If `CRON_SECRET` is set in production and an attacker sends a request with the wrong secret, the outer `if` is true but the inner guard (`!process.env.CRON_SECRET`) is false, so no 401 returns and the cron logic executes. The endpoint is effectively unauthenticated whenever the secret is configured but wrong.
2. **HIGH: OAuth callback uses unvalidated `state` as user_id** — `app/api/calendar/google/callback/route.ts:27`. An attacker who completes Google OAuth can write `calendar_integrations` rows under any user_id by passing it as the `state` query parameter.
3. **HIGH: URL preview has open SSRF surface** — `app/api/url-preview/route.ts` fetches any URL with no IP/loopback/metadata-endpoint blocking. Internal services (`http://localhost`, `http://169.254.169.254`) are reachable.
4. **HIGH: 13 production tables are missing from the canonical schema baseline** (`scripts/website-current-schema.sql`). Fresh-DB setup is broken because the legacy `setup-database.sql` uses incompatible `SERIAL` user_id types.
5. **MEDIUM: Only 1 of 81 routes uses Zod validation**. The rest use ad-hoc `typeof` checks. `/api/share` POST and `/api/admin/update-subscription` POST have effectively no validation.

**Two fixes applied during this audit** (single commit):
- `app/api/calendar/sync/route.ts` — switched to `getUserFromSession()` (was reading wrong cookie name `session_id`, querying wrong column `sessions.id`).
- `app/api/calendar/google/callback/route.ts:46` — narrowed the OAuth error log to standard fields only (`error`, `error_description`, `status`).

**Recommendation:** Do not ship the Agents feature until items N1–N5 in §N are resolved.

---

## B. Database Health Score: **6.5 / 10**

| Dimension | Score | Notes |
|---|---|---|
| Tables exist for all code references | 10/10 | All 45 tables queried in code have a CREATE TABLE somewhere |
| Canonical baseline completeness | 4/10 | 13 production tables missing from `website-current-schema.sql` |
| Migration consistency | 5/10 | `setup-database.sql` + `run-pending-migrations.sql` + `website-current-schema.sql` overlap with type drift |
| user_id scoping | 9/10 | All user-owned tables have `user_id`; `payment_logs` is orphaned (UUID, no FK) |
| Foreign key correctness | 8/10 | Mostly `ON DELETE CASCADE`; some cross-table FKs use `ON DELETE SET NULL` (intentional, polymorphic) |
| Index coverage | 8/10 | 84 indexes; `habits.frequency`, `routines.sort_order`, `notifications.type`, `custom_section_records (section_id, created_at)` could be added |
| Enum/check constraint discipline | 7/10 | Most status enums are CHECK-constrained; some (e.g., `wishlist.priority`) are free-form |
| Timezone consistency | 5/10 | Mix of `TIMESTAMP` and `TIMESTAMP WITH TIME ZONE` across tables |

---

## C. API Health Score: **7 / 10**

| Dimension | Score | Notes |
|---|---|---|
| Auth coverage on protected routes | 9/10 | All but `app/api/calendar/sync` (now fixed) use `getUserFromSession()` |
| user_id scoping in queries | 9/10 | Spot-check found no leaks; `app/api/calendar/google/callback` writes to arbitrary user_id from state (HIGH) |
| HTTP status discipline | 5/10 | Most errors return 500 even for clearly user-input failures (should be 400/404/409) |
| Body validation | 3/10 | Only 1 route (`app/api/ai/capture`) uses Zod. Most rely on ad-hoc `typeof` checks. `/api/share` and `/api/admin/update-subscription` have no validation |
| Rate limiting coverage | 6/10 | AI routes covered by `lib/ai-usage.ts`; non-AI routes have none, including `/api/search`, `/api/url-preview`, `/api/dashboard` |
| Response shape consistency | 6/10 | Many routes return raw `result[0]`, others wrap in `{ ... }`. Agent-ready API surface needs normalization |
| Method-level auth | 10/10 | No mutation-on-GET anti-patterns found |
| Error message safety | 8/10 | A few `console.error(error)` calls log full error objects; preferred pattern is `error instanceof Error ? error.message : error` |

---

## D. Integration Health Score: **7.5 / 10**

| Integration | Score | Notes |
|---|---|---|
| OpenRouter (AI text) | 8/10 | Model allowlists in `/api/chat`; rate-limited via `ai_usage_events`; usage tolerates missing migration |
| Groq (vision) | 8/10 | `/api/investments/parse-screenshot` — file size limit 5MB, MIME allowlist, max 3 files |
| Resend (email) | 7/10 | Uses default `resend.dev` sender domain — fine for dev, must change before prod |
| Google OAuth + Calendar | 6/10 | `state` not validated against session (HIGH); refresh tokens stored plain-text in DB; sync route was broken (now fixed) |
| Alpha Vantage (quotes) | 7/10 | Refresh-limit logic exists in investments; no per-user rate-limit on `/api/stock-quote` (public, unauth) |
| URL preview | 3/10 | Open SSRF; no IP/loopback blocking; only YouTube/Vimeo are short-circuited safely |
| Vercel Cron | 4/10 | CRON_SECRET check has fall-through bug (see §A.1); not timing-safe |

---

## E. Security Health Score: **6 / 10**

Three critical findings (CRON fall-through, OAuth state, URL preview SSRF) cap this score until fixed. Otherwise the codebase shows reasonable defensive defaults: parameterized SQL throughout (no injection surface), bcrypt password hashing, session-cookie httpOnly + sameSite=lax, password-reset tokens are 256-bit single-use with session invalidation.

| Dimension | Score |
|---|---|
| SQL injection | 10/10 (Neon tagged templates everywhere) |
| AuthN strength | 8/10 (bcrypt + secure cookie; legacy SHA256 path still accepted but upgrades on login) |
| AuthZ correctness | 6/10 (CRON + OAuth callback issues) |
| SSRF | 3/10 (URL preview) |
| Secret/token logging | 7/10 (one issue fixed in this pass; others minor) |
| CSRF protection | 5/10 (sameSite=lax on session cookie is partial; no explicit CSRF tokens on state-changing routes) |
| Rate limiting | 5/10 (AI only; no anti-abuse on auth endpoints either) |
| Audit logging | 2/10 (no audit table for admin/AI/agent actions) |

---

## F. Table-by-Table Schema Audit

**51 tables total.** Format: `table — primary location | user_id type | indexes | issues`

### Auth & system
| Table | Location | user_id | Issues |
|---|---|---|---|
| `users` | website-current-schema.sql | VARCHAR(255) PK | Drift: setup-database.sql uses SERIAL |
| `sessions` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `password_reset_tokens` | website-current-schema.sql | VARCHAR(255) FK | OK |

### Cross-module
| Table | Location | user_id | Issues |
|---|---|---|---|
| `life_areas` | run-pending-migrations.sql | VARCHAR(255) FK | OK |
| `notifications` | add-notifications.sql | VARCHAR(255) FK | **Missing from canonical schema** |

### Planning & review
| Table | Location | user_id | Issues |
|---|---|---|---|
| `daily_plans` | run-pending-migrations.sql | VARCHAR(255) FK | OK |
| `weekly_reviews` | run-pending-migrations.sql | VARCHAR(255) FK | OK |
| `life_score_history` | run-pending-migrations.sql | VARCHAR(255) FK | OK |
| `personal_rules` | run-pending-migrations.sql | VARCHAR(255) FK | OK |
| `inbox_items` | run-pending-migrations.sql | VARCHAR(255) FK | OK |
| `someday_items` | run-pending-migrations.sql | VARCHAR(255) FK | OK |
| `waiting_items` | run-pending-migrations.sql | VARCHAR(255) FK | OK |
| `commitments` | run-pending-migrations.sql | VARCHAR(255) FK | OK |
| `maintenance_items` | run-pending-migrations.sql | VARCHAR(255) FK | OK |

### Tasks/goals/projects
| Table | Location | user_id | Issues |
|---|---|---|---|
| `goals` | website-current-schema.sql | VARCHAR(255) FK | Drift in setup-database.sql |
| `tasks` | website-current-schema.sql | VARCHAR(255) FK | Drift in setup-database.sql |
| `nuke_goals` | website-current-schema.sql | VARCHAR(255) FK | Drift in setup-database.sql |
| `projects` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `project_items` | website-current-schema.sql | VARCHAR(255) FK | Polymorphic FK to 8 types; CHECK constrained |
| `project_activity` | website-current-schema.sql | VARCHAR(255) FK | Polymorphic; no CHECK |

### Notes/links/calendar
| Table | Location | user_id | Issues |
|---|---|---|---|
| `note_folders` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `notes` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `link_folders` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `user_links` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `calendar_events` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `calendar_integrations` | website-current-schema.sql | VARCHAR(255) FK | **Stores OAuth refresh_token plain text** |

### Finance
| Table | Location | user_id | Issues |
|---|---|---|---|
| `wishlist_items` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `investments` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `income_sources` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `budget_categories` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `budget_transactions` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `budget_goals` | website-current-schema.sql | VARCHAR(255) FK | OK |

### Content & customization
| Table | Location | user_id | Issues |
|---|---|---|---|
| `user_content_preferences` | website-current-schema.sql | VARCHAR(255) PK | OK |
| `daily_content` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `custom_sections` | website-current-schema.sql | VARCHAR(255) FK | OK |
| `custom_section_items` | website-current-schema.sql | (via section FK) | OK |
| `custom_section_records` | run-pending-migrations.sql | (via section FK) | **Missing from canonical schema** |

### Feature-specific (the "missing 13")
| Table | Location | user_id | Issues |
|---|---|---|---|
| `habits` | add-habits.sql | VARCHAR(255) FK | **Missing from canonical schema** |
| `habit_checkins` | add-habits.sql | VARCHAR(255) FK | **Missing from canonical schema** |
| `routines` | add-habits.sql | VARCHAR(255) FK | **Missing from canonical schema** |
| `routine_steps` | add-habits.sql | (via routine FK) | **Missing from canonical schema**; (routine_id, sort_order) index would help |
| `people` | add-people.sql | VARCHAR(255) FK | **Missing from canonical schema** |
| `people_reminders` | add-people.sql | VARCHAR(255) FK | **Missing from canonical schema** |
| `people_links` | add-people.sql | VARCHAR(255) FK | **Missing from canonical schema**; could add (person_id, item_type, item_id) composite |
| `vault_items` | add-vault.sql | VARCHAR(255) FK | **Missing from canonical schema** |
| `payment_logs` | add-payment-logs.sql | UUID (no FK) | **Orphaned schema; not in canonical; type mismatch** |
| `pomodoro_sessions` | setup-database.sql | INTEGER (legacy) | **Type mismatch; not updated to VARCHAR(255)** |
| `pomodoro_settings` | add-missing-features.sql | INTEGER (PK, legacy) | **Type mismatch; unusual PK pattern** |

### System tracking
| Table | Location | user_id | Issues |
|---|---|---|---|
| `api_usage` | website-current-schema.sql | (system, no user) | Global; no per-user contention isolation |
| `ai_usage_events` | run-pending-migrations.sql | VARCHAR(255) FK | OK; route deploys tolerate missing table |
| `popular_investments` | website-current-schema.sql | (reference data) | OK |

---

## G. API-by-API Audit

**81 routes total.** Severity legend: 🟢 OK · 🟡 needs hardening · 🟠 ship-blocker for Agents · 🔴 fix now.

### Auth (6)
| Route | Methods | Severity | Notes |
|---|---|---|---|
| `/api/auth/login` | POST | 🟢 | bcrypt; legacy SHA256 upgrade path; no rate limit (🟡 future) |
| `/api/auth/register` | POST | 🟢 | bcrypt cost=12; min password 6 chars (consider raising to 8) |
| `/api/auth/logout` | POST | 🟢 | Deletes session row |
| `/api/auth/me` | GET | 🟢 | Standard pattern |
| `/api/auth/forgot-password` | POST | 🟢 | 256-bit token; 1h expiry; non-reveal response |
| `/api/auth/reset-password` | GET/POST | 🟢 | Token single-use; sessions invalidated post-reset |

### CRUD — user-owned resources (45)
All follow the same pattern: `getUserFromSession()` → guard 401 → `sql\`... WHERE user_id = ${user.id}\``. Spot-checked: `tasks`, `goals`, `habits`, `notes`, `notifications`, `vault`, `people`, `projects`, `inbox`, `commitments`, `someday`, `waiting`, `maintenance`. All 🟢 for auth + scoping.

**Validation severity per group:** all 🟡 — uses `typeof x !== "string"` ad-hoc checks rather than Zod schemas. Not unsafe today (Neon parameterizes), but hostile for an LLM agent that needs predictable 400 responses.

### Aggregation (3)
| Route | Severity | Notes |
|---|---|---|
| `/api/dashboard` | 🟢 | `Promise.all` over user-scoped queries |
| `/api/search` | 🟢 | ILIKE pattern with sanitization; 🟡 no rate limit |
| `/api/timeline` | 🟢 | Parallel per-source queries with `safe()` fallback |

### AI (10)
All use `getUserFromSession()` + `checkAiUsageLimit()` + `createAiUsageEvent()`. All 🟢. Daily caps: capture=10, chat=50, today-plan=3, life-balance=10, weekly-summary=5, life-score=5, reset-suggestions=5, what-am-i-ignoring=5, daily-content/generate=15, parse-screenshot=10. **Only `/api/ai/capture` uses Zod for input AND output validation** — the rest manually parse AI output and trust shape (🟡).

### Integration (4)
| Route | Severity | Notes |
|---|---|---|
| `/api/calendar/google/auth` | 🟢 | Sets OAuth state from session user.id |
| `/api/calendar/google/callback` | 🟠 | **Uses `state` as user_id without verifying it matches current session** (line 27). One-line fix: call `getUserFromSession()` and compare to state. Also fixed in this pass: narrowed error log (line 46) |
| `/api/calendar/sync` | 🟢 (fixed) | Was reading wrong cookie name; now uses `getUserFromSession()` |
| `/api/stock-quote` | 🟡 | Public, unauth; consider rate limit |

### Cron (1)
| Route | Severity | Notes |
|---|---|---|
| `/api/cron/deadline-reminders` | 🔴 | **CRON_SECRET fall-through bug** (lines 29-34). Wrong-secret requests in production proceed to execute. Must be fixed before any production cron schedule changes |

### Admin (1)
| Route | Severity | Notes |
|---|---|---|
| `/api/admin/update-subscription` | 🟡 | `is_admin` server-side check ✓; **no body validation** on `userId`, `isSubscribed`, `subscriptionEndsAt`. Could accept malformed dates that NULL-coalesce to NULL silently |

### Utility (14)
| Route | Severity | Notes |
|---|---|---|
| `/api/url-preview` | 🔴 | **Open SSRF**; no IP/loopback/metadata-endpoint blocking; 5s timeout limits blast but doesn't prevent reconnaissance |
| `/api/share` GET | 🟢 | Validates `share_token AND is_public = true` together |
| `/api/share` POST | 🟡 | No body validation |
| `/api/profile` GET | 🟢 | User-scoped |
| `/api/profile` PUT | 🟡 | No body validation; COALESCE-based partial updates |
| `/api/reset/*` (3 routes) | 🟢 | User-scoped |
| `/api/nuke-goal` | 🟢 | User-scoped |
| `/api/onboarding` | 🟢 | User-scoped |
| `/api/daily-content` (3 routes) | 🟢 | User-scoped, AI-rate-limited |
| `/api/today-plan` | 🟢 | User-scoped |
| `/api/weekly-review` | 🟢 | User-scoped |
| `/api/chat/context` | 🟢 | User-scoped |

---

## H. Missing Migrations

13 tables exist in production but are not in `scripts/website-current-schema.sql`. A fresh-DB setup that runs only the canonical baseline will be missing every feature that depends on them.

| Table | Defined in | Used by |
|---|---|---|
| `habits` | `add-habits.sql` | Habits & Routines |
| `habit_checkins` | `add-habits.sql` | Habits |
| `routines` | `add-habits.sql` | Routines |
| `routine_steps` | `add-habits.sql` | Routines |
| `people` | `add-people.sql` | People |
| `people_reminders` | `add-people.sql` | People |
| `people_links` | `add-people.sql` | People |
| `vault_items` | `add-vault.sql` | Vault |
| `notifications` | `add-notifications.sql` | Notification Center |
| `payment_logs` | `add-payment-logs.sql` | (orphaned) |
| `pomodoro_sessions` | `setup-database.sql` (legacy) | Pomodoro page |
| `pomodoro_settings` | `add-missing-features.sql` (legacy types) | Pomodoro page |
| `custom_section_records` | `add-custom-sections-fields.sql` | Custom sections records |

**Action:** Section O of this audit specifies the canonical-migration consolidation plan.

---

## I. Conflicting Migrations

| Conflict | Files involved | Severity |
|---|---|---|
| `users.id` type — SERIAL vs VARCHAR(255) | `setup-database.sql` vs `website-current-schema.sql` | CRITICAL |
| All user_id FK types follow `users.id` drift | Every table CREATE in `setup-database.sql` | CRITICAL |
| Duplicate FK creation blocks for `waiting_items.project_id`, `waiting_items.person_id`, `commitments.project_id`, `commitments.person_id`, `commitments.related_task_id`, `maintenance_items.vault_item_id` | `run-pending-migrations.sql` + `website-current-schema.sql` | LOW (idempotent with `IF NOT EXISTS`) |
| `goals` CREATE TABLE appears in 4 files | `setup-database.sql`, `create-nuke-goal-table.sql`, `add-budgeting-tables.sql`, `website-current-schema.sql` | MEDIUM |
| `notes` CREATE TABLE appears in 3 files | `add-missing-features.sql`, `create-notes-table.sql`, `website-current-schema.sql` | LOW (consistent) |

**Action:** Either delete `setup-database.sql` entirely, or rewrite it to be a thin pointer to `website-current-schema.sql`. See section O.

---

## J. Unused Tables / Columns

| Item | Status |
|---|---|
| `pomodoro_sessions` | Schema present; `/api/pomodoro/*` routes do NOT exist. UI page may use localStorage only. Verify before deleting |
| `pomodoro_settings` | Same as above |
| `popular_investments.last_fetched_at` | Used in `/api/investments/popular` background fetch; OK |
| `users.refresh_count_today`, `users.last_refresh_date` | Used in investment quote refresh limit logic |
| `payment_logs` | Schema exists; no `/api/payments/*` routes found. Likely deprecated |
| `api_usage` | Used by older investment quote tracking; AI usage uses separate `ai_usage_events` |

**Action:** Confirm whether pomodoro feature still uses these tables. If not, delete the migrations and tables in a dedicated cleanup PR (out of audit scope).

---

## K. Risky Endpoints

| Route | Risk | File:Line |
|---|---|---|
| `/api/cron/deadline-reminders` | CRON_SECRET fall-through (mis-set secret bypasses auth) | `app/api/cron/deadline-reminders/route.ts:29-34` |
| `/api/calendar/google/callback` | OAuth state used as user_id without session validation | `app/api/calendar/google/callback/route.ts:27` |
| `/api/url-preview` | Open SSRF: fetches any URL incl. localhost/metadata IPs | `app/api/url-preview/route.ts:40` |
| `/api/admin/update-subscription` | No body validation (low impact because is_admin gated) | `app/api/admin/update-subscription/route.ts:14` |
| `/api/share` POST | No body validation; user-scoped so cross-account risk minimal | `app/api/share/route.ts:84` |
| `/api/stock-quote` | Public, unauthenticated; could be abused for Alpha Vantage quota exhaustion | `app/api/stock-quote/route.ts` |
| `/api/investments/parse-screenshot` | File size 5MB × 3 = 15MB per request; Groq vision token cost | `app/api/investments/parse-screenshot/route.ts` |

---

## L. Broken Integrations (status: fixed in this pass)

| Issue | Status |
|---|---|
| `/api/calendar/sync` always 401 because wrong cookie/column | **FIXED** — now uses `getUserFromSession()` |
| `/api/calendar/google/callback` logged full token-error response body | **FIXED** — log narrowed to `{ status, error, error_description }` only |

The Google OAuth `state`-as-user_id issue is **NOT** fixed in this pass — it requires session validation logic that's beyond a one-line safe fix. Documented in section N.

---

## M. Required Environment Variables

### Server-only (never expose to client)
- `DATABASE_URL` — Neon Postgres. Used by every route.
- `RESEND_API_KEY` — Email. Used by forgot-password, deadline-reminders cron.
- `OPENROUTER_API_KEY` — Used by 10 AI routes.
- `GROQ_API_KEY` — Used by `/api/investments/parse-screenshot`.
- `ALPHA_VANTAGE_API_KEY` — Used by `/api/stock-quote`, `/api/investments/background-fetch`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Used by 3 calendar OAuth routes.
- `CRON_SECRET` — Used by `/api/cron/deadline-reminders` (note: see §K bug).

### Public
- `NEXT_PUBLIC_APP_URL` — Used by forgot-password email links, OAuth redirect URI builders.

### Framework / inferred
- `NODE_ENV` — Used by login/register/cron for prod-only behavior.
- `VERCEL_URL` — Fallback for app URL in `forgot-password`.

### Provisioned by Neon/Vercel, NOT used in code
`DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL_NO_SSL`, `POSTGRES_HOST`, `POSTGRES_DATABASE`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `PGHOST`, `PGHOST_UNPOOLED`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `NEON_PROJECT_ID`, `VERCEL_OIDC_TOKEN` — present in `.env.local` but not referenced from code. Can be left or pruned at the next env cleanup.

---

## N. Required Fixes Before Agents Tab

Prioritized. Each should be a separate small PR.

### N1 (P0): Fix CRON_SECRET fall-through
**File:** `app/api/cron/deadline-reminders/route.ts:29-34`
**Fix:** Replace the conditional logic with a strict check using `crypto.timingSafeEqual`:
```ts
const authHeader = request.headers.get("authorization") ?? ""
const secret = process.env.CRON_SECRET
if (!secret) return NextResponse.json({ error: "Cron not configured" }, { status: 500 })
const expected = Buffer.from(`Bearer ${secret}`)
const actual = Buffer.from(authHeader)
if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```
This both fixes the fall-through and adds timing-safe comparison.

### N2 (P0): Validate OAuth state in Google callback
**File:** `app/api/calendar/google/callback/route.ts:27`
**Fix:** Call `getUserFromSession()` and confirm `user.id === state`. If not, redirect with `?error=state_mismatch`. Today, an attacker who completes Google OAuth can write `calendar_integrations` rows under any user's account by passing a target user_id as the state parameter.

### N3 (P0): Block SSRF in `/api/url-preview`
**File:** `app/api/url-preview/route.ts:40`
**Fix:** Before `fetch(url, ...)`:
1. Parse URL; require `https:` only.
2. DNS-resolve hostname; reject if any resolved IP is in private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.0/8, 169.254.0.0/16, ::1, fc00::/7).
3. Cap response size during stream (e.g., 1MB).
4. Add per-user rate limit (5/min via a new `url_preview_events` table, mirroring `ai_usage_events`).

### N4 (P1): Consolidate canonical schema
Section O describes the consolidation plan. Without this, fresh DBs cannot be set up reliably.

### N5 (P1): Add audit log table for Agents
Section Q describes the schema. Required before Agents start writing on behalf of the user.

### N6 (P2, deferred): Adopt Zod across CRUD routes
Section P describes the rollout. Not a ship-blocker, but Agents will benefit from predictable 400 responses.

### N7 (P2, deferred): Add basic rate limiting on `/api/search`, `/api/dashboard`, `/api/url-preview`, `/api/stock-quote`
Use the `ai_usage_events`-style pattern with a generic `route_usage_events` table.

---

## O. Recommended Canonical Migration Plan

**Goal:** One file in `scripts/` that creates the full current schema on a fresh database. Delete or stub the legacy files.

**Recommended structure:**
- `scripts/schema.sql` — new canonical baseline (renamed from `website-current-schema.sql`) — contains all 51 tables, indexes, FKs, and CHECK constraints. Idempotent (`IF NOT EXISTS` throughout).
- `scripts/migrations/` — new directory. Each file is dated `YYYY-MM-DD-<name>.sql` and is purely additive (ALTER TABLE only). Future feature work adds files here.
- `scripts/legacy/` — move `setup-database.sql`, `add-*.sql`, `create-*.sql`, `fix-*.sql` here. Keep for historical reference but mark in a README that they should not be run.
- Delete: nothing in this pass. Just reorganize.

**Adding the 13 missing tables to `schema.sql`:**
Copy the CREATE TABLE blocks verbatim from:
- `add-habits.sql` → habits, habit_checkins, routines, routine_steps
- `add-people.sql` → people, people_reminders, people_links
- `add-vault.sql` → vault_items
- `add-notifications.sql` → notifications
- `add-custom-sections-fields.sql` → custom_section_records
- For `payment_logs` and `pomodoro_*`: confirm usage before including; if unused, drop the migrations entirely.

**Validation:** After consolidation, run `schema.sql` against a clean local Postgres and verify `npm run build` + a manual smoke test of each feature page.

---

## P. Recommended API Hardening Plan

Order of execution:

1. **Adopt Zod for all `/api/admin/*`** (low blast radius, sets the pattern).
2. **Adopt Zod for `/api/share` POST, `/api/profile` PUT** (currently zero validation).
3. **Add a shared `lib/api-response.ts`** with helpers: `ok(data)`, `badRequest(message)`, `notFound()`, `unauthorized()`, `forbidden()`, `serverError(message)`. Most route handlers can switch their `NextResponse.json({...}, {status: ...})` calls to these helpers in one PR per module.
4. **Add structured error codes** to error responses (`{ error: "string", code: "VALIDATION_FAILED" }`) so an Agents LLM can pattern-match without parsing prose.
5. **Standardize success response shape** to `{ data, meta }` (where `meta` includes pagination/timing). Most existing routes return raw `result[0]` or an array — Agents will struggle without uniformity.
6. **Add module-by-module Zod schemas** in `lib/schemas/<module>.ts`. Reuse across the matching CRUD route + AI Capture parsing.

---

## Q. Recommended Agent-Readiness Changes

To support the Agents feature without rewriting it later:

### Q1 — Audit log table
```sql
CREATE TABLE IF NOT EXISTS agent_action_events (
  id              SERIAL PRIMARY KEY,
  user_id         VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_run_id    UUID,
  tool_name       VARCHAR(100) NOT NULL,
  resource_type   VARCHAR(50),
  resource_id     TEXT,
  payload         JSONB,
  status          VARCHAR(20) NOT NULL,  -- 'pending' | 'confirmed' | 'rejected' | 'executed' | 'failed'
  error           TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  executed_at     TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_agent_action_events_user_created ON agent_action_events(user_id, created_at DESC);
CREATE INDEX idx_agent_action_events_run ON agent_action_events(agent_run_id);
```

### Q2 — Action confirmation pattern
Adopt the existing "draft → confirm → execute" model from `/api/ai/capture`:
- Agent proposes one or more `agent_action_events` rows with `status='pending'` and a structured payload.
- User UI shows the diff and confirms.
- A new `/api/agent/execute` route flips `status='executed'`, calls the underlying CRUD endpoint with the payload, and records the result.
- Destructive actions (DELETE) must require explicit confirmation per item.

### Q3 — Tool registry
Maintain `lib/agent-tools.ts` exporting an explicit list of `{ name, description, schema, handler }`. Do not let the agent call arbitrary routes. Start with read-only tools (list_tasks, list_goals, list_today), then write tools (create_task, complete_task, schedule_focus), each requiring confirmation per Q2.

### Q4 — Agent run scoping
Each agent invocation gets a `run_id` (UUID). All `agent_action_events` for that run share the run_id. The user can view all actions taken in a run and revoke the whole run if needed (would require soft-undo logic per resource type — design that separately).

### Q5 — Rate limiting
Add `route_usage_events` table (or reuse `ai_usage_events` with `route` field) to cap agent actions per user per hour (e.g., 100 actions/hr default, configurable).

---

## R. Exact Next 5 Implementation Tasks

Each task is a single PR. Ordered.

### R1 — Fix CRON_SECRET fall-through
- One file: `app/api/cron/deadline-reminders/route.ts`
- Replace 6-line auth check with timing-safe equality
- Update `AI_TASK_LOG.md` and `AI_CHECKLIST.md`
- Estimated effort: 15 min

### R2 — Validate OAuth state in Google callback
- One file: `app/api/calendar/google/callback/route.ts`
- Add `getUserFromSession()` check; compare to `state`
- Redirect with `?error=state_mismatch` on mismatch
- Estimated effort: 20 min

### R3 — Block SSRF in `/api/url-preview`
- Two files: `app/api/url-preview/route.ts`, `lib/safe-fetch.ts` (new)
- New `lib/safe-fetch.ts` exports `safeFetchUrl(url, { maxBytes, timeoutMs })` that performs DNS resolution + private-IP rejection + size cap
- Estimated effort: 2 hours

### R4 — Consolidate canonical schema
- One commit: rename `scripts/website-current-schema.sql` → `scripts/schema.sql`, add the 13 missing CREATE TABLE blocks, move legacy scripts to `scripts/legacy/`
- Test by running against a clean local Postgres
- Update `AI_PROJECT.md`, `AI_DECISIONS.md`, `AI_CHECKLIST.md`
- Estimated effort: 3 hours

### R5 — Create `agent_action_events` table + draft "agent execute" route stub
- New migration: `scripts/migrations/2026-05-XX-agent-action-events.sql`
- New route: `app/api/agent/actions/route.ts` (GET pending, POST create, PUT confirm, DELETE reject)
- New route: `app/api/agent/execute/route.ts` (POST — accepts an agent_action_event id, performs the actual write)
- No UI in this PR; UI is the next milestone after this audit cycle
- Estimated effort: 1 day

After R1–R5 ship, Agents-tab development can begin safely.

---

## Appendix — Verification commands (from Phase 8)

| Command | Result (2026-05-17) |
|---|---|
| `git status --short` | Clean before audit; 6 files modified after this commit |
| `git diff --stat HEAD~1` | Documented in audit task-log entry |
| `npx tsc --noEmit` | Passes (no output) |
| `npm run lint` | Fails — pre-existing (ESLint 10 missing flat config) |
| `npm run build` | Passes |

No test command exists in `package.json`. Adding one is part of the broader hardening plan, not this audit.
