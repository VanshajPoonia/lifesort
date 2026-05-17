# AI_DECISIONS.md

Architecture and product decision memory for LifeSort.

## Current Architecture Decisions

- Decision: Use Next.js App Router for pages and API route handlers.
  - Evidence: Feature pages live under `app/**/page.tsx`; backend endpoints live under `app/api/**/route.ts`.

- Decision: Use raw Neon Postgres SQL instead of an ORM.
  - Evidence: Route handlers and shared libs call `neon(process.env.DATABASE_URL!)` and use tagged SQL templates.
  - Inferred reason: Keeps the v0-generated app simple and close to the database schema.

- Decision: Use custom email/password authentication.
  - Evidence: `lib/auth.ts`, `app/api/auth/login/route.ts`, `app/api/auth/register/route.ts`, and `components/auth-provider.tsx`.
  - Inferred reason: The app controls users, sessions, trials, subscriptions, admin status, and onboarding state directly in Postgres.

- Decision: Use shadcn/Radix-style UI primitives and Tailwind CSS.
  - Evidence: `components.json`, `components/ui/*`, `tailwind.config.js`, and `app/globals.css`.
  - Inferred reason: Fits the v0-generated component style and enables reusable UI primitives.

- Decision: Deploy on Vercel and use Vercel Cron.
  - Evidence: README Vercel deployment badges/links and `vercel.json`.

## Patterns Agents Should Preserve

- Keep App Router page and route-handler structure.
- Keep protected route handlers using `getUserFromSession()` from `lib/auth.ts` unless intentionally normalizing an inconsistent route.
- Keep user-scoped SQL queries filtered by `user_id`.
- Keep UI composed from `components/ui` and existing shared components.
- Keep Tailwind theme tokens and CSS variable approach in `app/globals.css`.
- Keep feature changes close to the relevant page/API route unless shared logic already exists.
- Keep schema changes represented as explicit SQL files or documented migration steps.

## Anti-Patterns to Avoid

- Do not add a new app framework, ORM, auth platform, state library, or service unless explicitly requested.
- Do not rewrite broad feature areas to fix a narrow bug.
- Do not run database scripts against any environment without explicit approval and target confirmation.
- Do not rely on chat history for repo memory.
- Do not change auth/session behavior casually; several areas depend on it.
- Do not commit secrets or copy `.env.local` values into docs.
- Do not remove v0/Vercel context unless the deployment workflow is intentionally changed.

## Data and Modeling Decisions

- User IDs are `VARCHAR(255)` in the current schema baseline, with `gen_random_uuid()::text` defaults.
- Most user-owned tables reference `users(id)` with `ON DELETE CASCADE`.
- Tasks can link to goals through `tasks.goal_id`.
- Investments can link to wishlist items through `investments.wishlist_item_id`.
- Notes use a simple knowledge model: user-owned `note_folders`, optional `notes.folder_id`, inline `notes.tags` as `TEXT[]`, and `notes.is_pinned` for pinned/favorite notes.
- Today Plan uses one `daily_plans` row per user per date, with `focus_items JSONB` for up to three saved focus items and three reflection text fields.
- Weekly Review uses one `weekly_reviews` row per user per Monday-Sunday week, with user-written reflection fields and a `summary_snapshot JSONB` saved only when the user saves the review. Weekly metrics are otherwise derived live from user-scoped source tables and do not mutate those source records.
- Universal Life Inbox uses a user-owned `inbox_items` table for pre-sorting capture. `converted_type` and `converted_id` are intentionally polymorphic because Inbox can convert into records across multiple module tables. The conversion endpoint validates the authenticated user, validates optional Life Area ownership, creates the target record server-side, and marks the inbox item `converted` only after target creation succeeds.
- Waiting For uses a user-owned `waiting_items` table for external dependencies the user is waiting on. Life Area, Project, and Person links are optional, nullable, and ownership-validated in `/api/waiting`; follow-up and overdue views are derived from `follow_up_date` and `expected_date`, while resolved/cancelled items are excluded from active dashboard counts.
- Commitments use a user-owned `commitments` table for promises and obligations the user made to themselves or others. Life Area, Project, Person, and related Task links are optional, nullable, and ownership-validated in `/api/commitments`; due-soon and overdue indicators are derived from `due_date`, and overdue open commitments are not auto-marked missed.
- Life Projects use a user-owned `projects` table plus flexible `project_items` links for existing records and `project_activity` for project-level changes. Project links are polymorphic and validated in API code because linked source records live in separate module tables; deleting a project removes links/activity, but deleting or unlinking a source item does not mutate other modules.
- Link folders can be nested through `link_folders.parent_id`.
- Preferences use JSON/JSONB in user-related tables, including sidebar preferences and content preferences.
- Daily content stores generated or played content with `content_type`, `category`, `content`, and `extra_data`.
- AI usage events are stored in a user-owned `ai_usage_events` table with route, provider, model, status, optional error message, and timestamp. Route handlers enforce conservative per-user daily caps in code so provider usage is scoped before making external AI calls.

## API Design Decisions

- Most route handlers return JSON via `NextResponse.json`.
- Many CRUD routes use method-based handlers in one route file: `GET`, `POST`, `PUT`, `DELETE`.
- Client pages call relative API paths with `fetch`.
- Global search intentionally catches per-source query failures and returns partial results.
- Dashboard aggregation exists both on the client dashboard page and in `/api/dashboard`.
- AI text routes use OpenRouter through `@ai-sdk/openai` with explicit model allowlists and main `getUserFromSession()` auth. Groq remains limited to investment screenshot parsing.
- AI Weekly Summary (`/api/ai/weekly-summary`) uses a client-sends-data pattern: the review page loads week metrics from `/api/weekly-review` and POSTs the already-loaded `summary` object to the AI endpoint. This avoids a second DB query and follows the same trust model as `/api/chat` (client sends messages). Since the endpoint is read-only (no DB writes), there is no security concern from client-provided data. Future AI features that are read-only can follow this pattern.
- AI Today Planner (`/api/ai/today-plan`) uses the same client-sends-data pattern: the today page already has candidates (mustDo, shouldDo, couldDo, calendarToday, upcomingDeadlines) and habitsToday loaded; these are POSTed to the AI endpoint. Unlike the weekly summary (numbers only), the today planner sends actual item titles because the AI needs them to prioritize. Item lists are capped client-side before sending. The endpoint does not perform DB writes; all write actions (add to focus, create task) are user-initiated on the client.
- New AI endpoints live under `app/api/ai/` to separate them from CRUD routes. Each must require session auth, check `OPENROUTER_API_KEY`, and use `checkAiUsageLimit`/`createAiUsageEvent`/`updateAiUsageEvent` from `lib/ai-usage.ts`.
- AI write-action safety: no AI feature in this codebase applies changes automatically. Every action that modifies data (focus items, task creation) is triggered by an explicit user button click after seeing the AI suggestion. This is the enforced pattern for all future AI features.
- Inbox conversion safety: capturing an Inbox item is separate from creating structured module data. Conversion to task/goal/note/project/habit/wishlist/vault/calendar requires an explicit user confirmation in `/inbox`; the raw Inbox item is retained and linked to the created object instead of being deleted.
- Commitment-to-task conversion is explicit and server-side. `/api/commitments/convert-to-task` creates a task owned by the authenticated user, then writes the new task id to `commitments.related_task_id`; it does not delete the commitment or automatically change its status.
- AI Natural Language Capture uses Zod for two validation layers: (1) input validation on the `text` field before calling the AI, (2) per-type Zod schemas on the AI's JSON output before returning to the client. Actions with invalid payloads are silently dropped rather than returning errors, so the client always gets a clean array. Supported write targets include Waiting For drafts, but the capture page still requires explicit user confirmation before calling `/api/waiting`. The capture page imports `DraftAction` from the API route file — an unusual pattern chosen to share the discriminated union type without a third shared-lib file. If this causes issues, extract to `lib/capture-types.ts`.
- Zod (`"zod": "3.25.76"`) is available in the repo and is now used in the capture endpoint. Future AI endpoints that need structured output validation should use Zod rather than manual type checks.
- AI Life Balance Insights (`/api/ai/life-balance`) differs from the client-sends-data pattern: GET and POST both derive user-scoped aggregate metrics server-side from Life Areas, tasks, goals, habits, projects, notes, budget, and recent weekly review reflections. The AI prompt receives aggregate counts plus short reflection snippets, not task titles or note content. The endpoint is read-only; suggested actions are returned as draft task suggestions and are only created by the `/insights` client after the user confirms.

## Notification Center Decisions

- Notifications are generated on-demand: every `GET /api/notifications` call runs `generateNotifications(uid)` before querying the table. This avoids a separate cron job for in-app alerts.
- The `notifications` table uses `UNIQUE(user_id, type, related_item_type, related_item_id)` with `ON CONFLICT DO NOTHING` inserts. This means: (1) each condition creates at most one notification row, and (2) `is_read` state set by the user is preserved across regenerations without being reset.
- Date-sensitive notification types (habit_missed, budget_warning) include the date or month in `related_item_id` to allow one notification per period (e.g., `habit_id-2026-05-17` or `category_id-2026-05`).
- Stable notification types (task_due, goal_deadline, vault_expiring, people_followup, project_deadline, weekly_review) use the source item's id as `related_item_id` so the notification is created once per item and persists until dismissed.
- Read notifications older than 30 days are auto-deleted at the start of each generation call to prevent unbounded table growth.
- The `safe()` + `isMissingTable()` pattern (same as `app/api/timeline/route.ts`) wraps every INSERT in generation — if the `notifications` table or any source table is missing (migration not yet applied), that source is silently skipped. The GET route catches a missing `notifications` table and returns `{ notifications: [], unread_count: 0 }` rather than 500.
- `components/notification-bell.tsx` is a client component that re-fetches when the Popover opens to show fresh state. Optimistic updates keep the UI snappy for mark-read actions.
- Notification settings for v1 are a filter bar on the `/notifications` page (type + read/unread toggles), not a separate preferences page or DB column.

## Timeline and Multi-Source Aggregation Decisions

- The Life Timeline derives events from 8 existing source tables (tasks, goals, projects, notes, weekly_reviews, wishlist_items, investments, budget_categories) plus habit_checkins for milestone computation. No new database tables were added.
- The timeline API (`/api/timeline`) runs one query per source in parallel via `Promise.all`. Each source query is wrapped in a `safe()` helper that catches missing-table errors (PostgreSQL error codes 42P01/42703) and returns an empty array, allowing partial results when a migration hasn't been applied. This is the same resilience pattern used in `lib/ai-usage.ts`.
- Habit streak milestones are computed in JavaScript inside the API route: habit_checkins are fetched and grouped by habit_id, deduplicated by date, sorted chronologically, and milestone events are emitted at the 7th, 14th, 21st, 30th, 50th, and 100th unique check-in date per habit. This approach is simpler than a SQL window function and handles weekly/daily habits the same way.
- Timeline filtering (event type, life area, text search) happens in JavaScript after all sources are merged, not in SQL. This is acceptable for a personal app where total event count is bounded (< 1000 events per user). If scaling becomes a concern, move filters into individual SQL WHERE clauses.
- The `/api/timeline` GET response includes `life_areas` for the filter dropdown, avoiding a second client fetch.

## Template and Static Data Decisions

- Smart Templates are defined as static TypeScript data in `lib/templates.ts`, not as database rows. There is no `templates` database table. Templates are arrays of `TemplateItem` union types with a `buildPayload()` helper that maps each item type to the correct API payload shape.
- Template application is client-side: the `/templates` page iterates `template.items` and POSTs each to its existing CRUD endpoint sequentially. This reuses all existing validation and auth logic on those endpoints without a new API route.
- `budget_category` items require `type: "category"` as a discriminator in the `/api/budget` POST body; `buildPayload()` injects this. All other types strip the TypeScript discriminant before sending.
- `life_area_id` is intentionally omitted from template definitions — templates are generic and not tied to a user's specific life areas. Users assign life areas after creation.
- If template storage or user-editable templates are needed in the future, introduce a `templates` table and CRUD route. Do not try to repurpose the existing `custom_sections` table.

## UI and Component Decisions

- App pages generally render inside `DashboardLayout`.
- Signed-in pages use sidebar navigation with feature visibility controlled by sidebar preferences.
- Theme state is stored in `localStorage` and applied via root class/data attributes.
- `sessionStorage` is used for transient UI caching such as onboarding completion and sidebar preferences.
- lucide-react is the icon source.

## Authentication and Session Decisions

- Main auth uses an opaque `session` cookie containing `sessions.session_token`.
- Session lifetime is 30 days.
- Passwords are bcrypt-hashed for new credentials.
- Legacy SHA-256 hashes are accepted and upgraded on successful login.
- Admin access is represented by `users.is_admin`.
- Trial/subscription state lives on the `users` table.

Open/inconsistent auth questions:

- `app/api/calendar/sync/route.ts` uses `session_id`, not the main `session` cookie.

## Database Decisions

- `scripts/website-current-schema.sql` is the closest canonical schema baseline because it says it reflects the current website API and older patch scripts contain drift.
- Many older SQL scripts are incremental patches and should be reviewed before use.
- There is no migration runner script in `package.json`.
- Life Areas are modeled as a user-owned `life_areas` table with optional nullable `life_area_id` foreign keys on tasks, goals, notes, wishlist items, budget categories, income sources, investments, and custom sections. Budget transactions intentionally stay indirectly organized through their category instead of getting a direct Life Area column in the first pass.
- Default Life Areas are seeded by SQL migrations for existing users and by registration/API code for future users; the app still treats Life Area assignment as optional everywhere.
- Today Plan v1 stores only focus selections and reflection fields. Must Do, Should Do, Could Do, Upcoming Deadlines, Calendar Today, and Quick Notes are derived on demand from existing user-scoped modules rather than duplicated into `daily_plans`.

## Deployment Decisions

- Vercel is the documented deployment platform.
- Vercel Cron calls `/api/cron/deadline-reminders` daily at `0 9 * * *`.
- `next.config.mjs` currently disables TypeScript and ESLint build failures.
- Images are set to unoptimized.

## Performance Considerations

- Many feature pages fetch data on the client after auth state is known.
- Dashboard loads multiple data sources and computes summaries client-side.
- Search fans out across multiple SQL queries with per-query error handling.
- Finance quote fetching is limited by API usage/refresh count logic in investment routes.
- Large pages like investments, links, budget, and settings may benefit from future component splitting if they become hard to maintain.

## Security Considerations

- Never expose `.env.local` values.
- URL preview fetches arbitrary user-provided URLs and should be hardened against SSRF before relying on it in production.
- Calendar integration stores access and refresh tokens in the database.
- Reminder emails use `resend.dev` sender defaults in current code.
- Cron route checks `CRON_SECRET`, but its unauthorized logic should be reviewed before production hardening.
- AI and external API routes depend on provider keys and should avoid logging sensitive responses. Current AI routes require session auth, validate inputs, and use user-scoped usage events when the `ai_usage_events` migration has been applied.

## Future Migration Considerations

- Add ESLint flat config for ESLint 10.
- Add a `typecheck` script and re-enable build type/lint enforcement when practical.
- Standardize auth helpers across all protected routes.
- Consolidate schema drift and document the exact production migration process.
- Consider shared validation helpers for common CRUD body parsing.
- Consider a typed API/data-access layer only if duplication becomes a real maintenance bottleneck.

## Open Questions

- Which SQL scripts have been applied to the live database?
- Which deployment environment variables are required versus leftover from Vercel/Neon provisioning?
- Should the project standardize on pnpm commands for all workflows?
- Are `jose` and `jsonwebtoken` still needed now that the known AI JWT helper has been removed?
