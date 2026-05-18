# AI_PROJECT.md

Persistent project overview for AI coding agents.

## Current Project State

Project name: LifeSort.

`package.json` currently names the package `my-v0-project`, but the app UI, metadata, README, assets, and domain language identify the product as LifeSort.

LifeSort is a personal life-management application for organizing today plans, weekly reviews, life areas, life projects, Someday / Maybe ideas, goals, tasks, calendar events, notes, links, wishlist items, investments, income, budgets, daily content, and productivity coaching.

## Current Product Scope

Implemented feature areas found in the repo:

- Dashboard at `app/page.tsx`, aggregating tasks, goals, notes, budget, investments, wishlist, income, and habits widget.
- Consolidated navigation hubs in the main sidebar: Home, Today, Organize, Money, Reflect, Settings, and admin-only Admin. Existing feature routes remain deep-linkable; `/organize` groups Plan, Capture, and Admin tools into tabs, `/reflect` is the primary review/insight surface, and compatibility routes `/plan`, `/life-admin`, `/capture`, and `/insights` remain available. `/api/navigation-summary` supplies lightweight user-scoped hub badges for due tasks, today events, habits due, unsorted Inbox, waiting/commitment/maintenance pressure, weekly review status, notifications, and Someday reviews.
- Explainable LifeScore on the dashboard through `/api/life-score` and `/api/ai/life-score`: derives a daily 0-100 organization signal from focus completion, overdue task load, habits, goals, weekly review status, commitments, maintenance/vault dates, and Life Area balance only after the user has meaningful data in at least one scored source. Empty/new accounts show a setup empty state and do not save synthetic score snapshots. Daily snapshots are stored in `life_score_history` when the migration is applied. Optional AI explanation is read-only, rate-limited, and receives only the derived score summary/components.
- Habits & Routines at `app/habits/page.tsx`, with per-habit CRUD, daily check-ins, streak tracking (current/best), weekly/monthly completion %, and routine builder with ordered steps.
- Today Plan at `app/today/page.tsx`, providing a non-AI daily command center with focus items, energy/capacity planning, overload warnings, a unified draggable Today To-Do list for due/overdue tasks, goals, projects, waiting items, commitments, and maintenance, habits due today (with check-off), derived calendar/note/budget/wishlist suggestions, and end-of-day reflection.
- Weekly Review at `app/review/page.tsx`, providing a non-AI Monday-Sunday review across tasks, goals, habits, projects, notes, finance, Life Areas, and saved energy/capacity patterns with saved reflections and previous-review history.
- Reflect / Life Balance Insights at `app/reflect/page.tsx` and compatibility route `app/insights/page.tsx`, showing non-AI Life Area balance metrics across tasks, goals, habits, projects, notes, budget, and weekly review context, plus optional read-only AI analysis.
- Life Areas at `app/life-areas/page.tsx`, providing user-owned cross-module organization with default areas, icons, colors, descriptions, and ordering.
- Life Projects at `app/projects/page.tsx` and `app/projects/[id]/page.tsx`, providing larger project containers with status, priority, progress, optional Life Area assignment, templates, linked existing records, and activity.
- Life Vault at `app/vault/page.tsx`, with structured storage for important life info (documents, subscriptions, warranties, insurance, vehicle, home, medical, education, work), expiry/renewal/reminder date tracking, four views (All/Expiring/Renewals/By category), color-coded urgency badges, dashboard widget, global search, and quick-add support.
- People / Relationships at `app/people/page.tsx`, with contact CRUD (name, relationship type, email, phone, birthday, location, notes, tags, life area), per-person reminders (birthday/follow-up/custom, recurring), item linking (tasks/notes/projects/calendar events), four views (All/Birthdays/Follow-ups/By type), and dashboard widget.
- Custom auth: login, register, logout, current-user check, forgot password, and reset password.
- Tasks with priority, due date/time, reminders, completion state, category, optional goal linking, optional Life Area assignment, and persisted manual drag ordering.
- Goals with status, priority, progress, target dates, numeric tracking, reminders, linked tasks, and optional Life Area assignment.
- Nuke goal page for one large goal with milestones and reminders.
- Calendar page with local events and Google Calendar integration/sync routes.
- Notes page with CRUD, folders, tags, pinned notes, optional Life Area assignment, local search/filter UI, and autosave-style editing.
- Links page with folders, subfolders, URL previews, image upload via base64, and share links.
- Public share page at `app/share/[token]/page.tsx`.
- Wishlist with price, URL, image, priority, category, optional Life Area assignment, purchased state, preview fetching, and conversion to investment.
- Investments with symbols, quantities, estimated returns, optional Life Area assignment, quotes, refresh limits, popular investments, background fetch, and screenshot parsing/import.
- Income sources with amount, frequency, category, optional Life Area assignment, next payment date, and active state.
- Budget categories with optional Life Area assignment, transactions, goals, summary cards, and calculator UI.
- Daily content with authenticated OpenRouter-generated/static jokes, quotes, trivia, riddles, fun facts, games, and history.
- Games: Snake and Wordle components.
- Settings for profile, daily content preferences, and sidebar preferences.
- Admin subscription management.
- LifeSort Coach at `/ai-chat` and authenticated `/api/chat`: app-aware chat over safe server-gathered LifeSort context modes (Today, This week, Goals, Projects, Finance, Full LifeSort summary). The Coach uses model allowlisting, request validation, conservative usage caps, visible Personal Operating Rules, metadata-only note context, citation ids for LifeSort items used, and draft task suggestions that require explicit user confirmation before `/api/tasks` writes anything.
- AI Weekly Summary at `/api/ai/weekly-summary`: authenticated POST that takes the already-loaded week summary (numeric counts only, no PII) and calls OpenRouter to return structured output (summary, wins, risks, ignored areas, next-week focus, 3 next actions). Rate-limited to 5/day. Result is displayed on `/review` and optionally applied to reflection fields; AI never writes to any user table.
- AI Today Planner at `/api/ai/today-plan`: authenticated POST that takes the already-loaded candidates, habits, and daily capacity from `/today` (actual item titles + IDs) and calls OpenRouter to return a structured day plan (capacity-aware top priorities, schedule blocks, items to defer, risks, one small win). Rate-limited to 3/day. Every write action (add to focus, create task) requires explicit user confirmation — nothing is applied automatically.
- AI Natural Language Capture at `/capture` and `/api/ai/capture`: users type messy natural language and AI parses it into structured draft actions for 9 types (task, waiting_item, goal, habit, note, project, vault_item, wishlist_item, calendar_event). Input validated with Zod (1–1000 chars). AI output validated per-type with Zod schemas. Drafts are fully editable before the user confirms creation. Rate-limited to 10/day. Nothing writes to the database until explicit user confirmation. Accessible through Organize > Capture and deep link `/capture`.
- AI Life Balance Insights at `/reflect` (and compatibility `/insights`) plus `/api/ai/life-balance`: authenticated GET returns aggregate Life Area balance metrics; authenticated POST calls OpenRouter for read-only analysis of over-focused areas, ignored areas, stress points, small suggested actions, and next-week balance. Rate-limited to 10/day. Suggested actions become tasks only after explicit user confirmation.
- AI "What Am I Ignoring?" Insights at `/reflect` (and compatibility `/insights`) plus `/api/ai/what-am-i-ignoring`: authenticated GET returns non-AI neglect/risk signals for quiet Life Areas, stale goals/projects, overdue waiting items/commitments/maintenance, missed habits, upcoming Vault renewals, and finance review gaps only when finance records exist and are stale. Authenticated POST calls OpenRouter for read-only explanations and small suggested actions. Rate-limited to 5/day. Suggested actions become tasks only after explicit user confirmation.
- Reset My Life at `/reset`, `/api/reset`, `/api/reset/actions`, `/api/reset/recovery-plan`, and `/api/ai/reset-suggestions`: recovery dashboard for overwhelm triage across overdue tasks, stale goals, inactive projects, missed habits, unsorted inbox items, overdue waiting items, overdue commitments, overdue maintenance, and upcoming deadlines. Bulk cleanup actions require confirmation, recovery plans reuse Today Plan focus items, and AI suggestions are read-only until the user explicitly applies selected actions. No new core data table is used.
- Someday / Maybe at `/someday` and `/api/someday`: user-scoped low-pressure holding area for ideas and possibilities that are not active tasks or goals yet. Items support category, optional Life Area, review date, someday/promoted/archived status, dashboard review-due widget, Quick Add, Global Search, AI Capture draft creation, and explicit promotion to projects, goals, tasks, wishlist items, or notes through `/api/someday/promote`.
- Life Timeline at `/timeline` and `/api/timeline`: chronological view of meaningful life activity derived from existing tables (no new schema). Sources: completed tasks, completed goals, completed projects, project activity milestones, notes created, weekly reviews, habit check-in milestones (7/14/21/30/50/100 check-ins), wishlist items purchased, investments added, budget categories/goals, maintenance completions, Vault renewals represented by Vault-linked maintenance completions, People follow-ups where reminders are marked sent, and completed commitments. Timeline logic lives in `lib/timeline.ts` and is shared by the API and Global Search. Filters by event type, life area, date range, and text search. Client groups events by month or week. Dashboard widget shows 5 most recent milestones. Sidebar nav under "Insights".
- Universal Life Inbox at `/inbox` and `/api/inbox`: user-scoped capture queue for messy thoughts, reminders, ideas, and responsibilities before the user decides where they belong. Items can be unsorted, archived, or converted after explicit confirmation into tasks, goals, notes, projects, habits, wishlist items, vault items, or calendar events. Conversion records `converted_type` and `converted_id` on the original inbox item. Quick Add can capture to Inbox, AI Capture can save raw text to Inbox, the dashboard shows unsorted items, and Global Search includes Inbox items.
- Waiting For tracker at `/waiting` and `/api/waiting`: user-scoped tracking for external dependencies such as replies, approvals, deliveries, refunds, school/company/bank/government follow-ups, job applications, and other things the user is waiting on. Items support status, expected/follow-up dates, optional Life Area, Project, and Person links, dashboard follow-up/overdue widget, Quick Add support, Global Search, and AI Capture draft creation.
- Commitments tracker at `/commitments` and `/api/commitments`: user-scoped tracking for promises and obligations made to oneself or others. Commitments support type/status, due dates, optional Life Area/Project/Person/Task links, dashboard due-soon/at-risk widget, Quick Add, Global Search, and explicit conversion to a linked task through `/api/commitments/convert-to-task`.
- Life Maintenance at `/maintenance` and `/api/maintenance`: user-scoped recurring maintenance tracker for renewals, checkups, repairs, reviews, and admin responsibilities. Items support category, recurrence, custom interval days, next due date, last completed date, reminder lead time, optional Life Area/Vault links, templates, dashboard upcoming/overdue widget, Quick Add, Global Search, mark-complete date advancement, and explicit task creation through `/api/maintenance/create-task`.
- Personal Operating Rules at `/rules` and `/api/personal-rules`: user-scoped visible preferences and constraints that LifeSort AI planning features can read. Users can CRUD active/inactive rules, set structured planning preferences (working hours, max daily focus items, reminder timing, heavy/light days, planning style), and preview the exact AI planning context. AI routes read active rules but do not create or change rules.
- Smart Templates at `/templates`: 10 pre-designed life systems (student semester, fitness transformation, job search, business launch, budget reset, travel plan, learning roadmap, content creator planner, home management, reading list). Each template is a static code definition in `lib/templates.ts`. Users preview all items before anything is created. "Create this system" applies each item sequentially via existing CRUD APIs (projects, tasks, goals, habits, notes, custom sections, budget categories, vault items). Nothing writes to the database until the user explicitly confirms. Template-created items appear in existing global search automatically.
- Global search across Timeline, Someday / Maybe, Inbox, Waiting For, Commitments, Maintenance, tasks, goals, notes, links, wishlist, investments, income, and budget.
- Global search also includes projects.
- Notification Center at `/notifications` and `components/notification-bell.tsx`: bell icon in the header is visible on desktop and mobile, shows a red unread badge, and opens a Popover dropdown with the 10 most recent notifications. Full `/notifications` page lists all notifications grouped by date (Today / Yesterday / This Week / Earlier) with type filter and read/unread toggle. Notifications are generated on-demand from 8 source conditions: tasks due in 3 days, goal deadlines in 7 days, active daily habits with no check-in today, project deadlines in 7 days, vault items expiring in 30 days, people reminders due, weekly review nudge if no review for the previous week, and budget categories at ≥80% of monthly limit. Uses `notifications` table with UNIQUE(user_id, type, related_item_type, related_item_id) to prevent duplicate generation. Read state is preserved across regenerations via `ON CONFLICT DO NOTHING`. Sidebar nav link and Settings toggle included. Migration: `scripts/add-notifications.sql`.

## Tech Stack

- Next.js `15.5.9`
- React `19.2.0`
- TypeScript
- Tailwind CSS
- shadcn/Radix-style UI components
- `@dnd-kit` for accessible drag-and-drop sorting
- lucide-react
- Neon Postgres via `@neondatabase/serverless`
- bcryptjs for password hashing
- `jose` and `jsonwebtoken` dependencies are present; most auth uses opaque session tokens, not JWT.
- AI SDK: `ai`, `@ai-sdk/react`, and `@ai-sdk/openai` for OpenRouter-compatible text generation.
- Resend for transactional/reminder emails
- Alpha Vantage external API for quotes and symbol search
- Groq OpenAI-compatible vision API for authenticated portfolio screenshot parsing.
- Vercel deployment, analytics dependency, and cron configuration

## Package Manager

`pnpm-lock.yaml` is present, so pnpm is the safest install choice. `package.json` does not currently include a `packageManager` field. Existing npm scripts can be run with npm, and `npm run build` was verified.

## Authentication Setup

Auth is custom and stored in the database:

- `lib/auth.ts` defines `User`, `Session`, password hashing/verification, session creation, session lookup, and user lookup helpers.
- New passwords are hashed with bcrypt.
- Legacy SHA-256 password hashes are still accepted and upgraded on login.
- Login/register route handlers create a session token with `crypto.randomUUID()`.
- The auth cookie is named `session`, is `httpOnly`, uses `sameSite: "lax"`, and is secure in production.
- Auth state on the client is provided by `components/auth-provider.tsx`.
- Most protected API routes call `getUserFromSession()`.

Known inconsistency:

- `app/api/calendar/sync/route.ts` reads a `session_id` cookie and queries `sessions.id`, while the main auth system sets a `session` cookie containing `sessions.session_token`.

## Database Setup

The database is Neon Postgres. Raw SQL is used directly through `neon(process.env.DATABASE_URL!)`.

Important database files:

- `lib/db.ts`: shared exported Neon SQL client.
- `lib/auth.ts`: creates its own Neon SQL client and implements auth queries.
- `scripts/website-current-schema.sql`: closest canonical schema baseline; header says it reflects the current website API and that older patch scripts contain drift.
- `scripts/*.sql`: many incremental schema scripts for features and fixes.

Major tables in the current schema baseline:

- `users`, `sessions`, `password_reset_tokens`
- `life_areas`
- `daily_plans`
- `weekly_reviews`
- `life_score_history`
- `personal_rules`
- `someday_items`
- `inbox_items`
- `waiting_items`
- `commitments`
- `maintenance_items`
- `projects`, `project_items`, `project_activity`
- `goals`, `tasks`, `nuke_goals`
- `calendar_events`, `calendar_integrations`
- `note_folders`, `notes`
- `link_folders`, `user_links`
- `wishlist_items`, `investments`, `income_sources`
- `budget_categories`, `budget_transactions`, `budget_goals`
- `user_content_preferences`, `daily_content`
- `custom_sections`, `custom_section_items`
- `api_usage`, `ai_usage_events`, `popular_investments`, `agent_action_events`

There is no automated migration runner in `package.json`.

## API and Backend Structure

Backend code lives in `app/api/**/route.ts`. It uses Next route handlers with direct SQL queries and JSON responses.

Representative API areas:

- Auth: `app/api/auth/*`
- CRUD and planning: `today-plan`, `weekly-review`, `life-areas`, `projects`, `projects/items`, `projects/activity`, `tasks`, `goals`, `notes`, `note-folders`, `links`, `link-folders`, `wishlist`, `investments`, `income`, `budget`, `calendar-events`, `nuke-goal`, `custom-sections`
- Capture and sorting: `someday`, `someday/promote`, `inbox`, `inbox/convert`, `waiting`, `commitments`, `commitments/convert-to-task`, `maintenance`, `maintenance/complete`, `maintenance/create-task`
- User/profile/preferences: `profile`, `onboarding`, `sidebar-preferences`, `daily-content`
- Integrations: `calendar/google/*`, `calendar/sync`, `stock-quote`, `url-preview`
- AI: `chat`, `daily-content/generate`, `investments/parse-screenshot`, `ai/weekly-summary`, `ai/today-plan`, `ai/capture`, `ai/life-balance`, `ai/what-am-i-ignoring`, `ai/reset-suggestions`, `ai/life-score`; these routes use main session auth and provider-specific env vars. Planning-oriented AI routes read visible Personal Operating Rules through `lib/personal-rules.ts`.
- Operational: `cron/deadline-reminders`, `admin/update-subscription`, `dashboard`, `search`, `share`
- Agent infrastructure: `agent/actions` (GET/POST/PUT/DELETE pending agent actions), `agent/execute` (POST executes a confirmed action). Backed by `agent_action_events` table. Both routes require session auth and Zod-validate every body. `/api/agent/execute` returns 501 TOOL_NOT_IMPLEMENTED until the tool registry is built — this is intentional.

## Frontend Structure

The frontend uses App Router pages under `app/`. Most feature pages are client components with local state and calls to route handlers via `fetch`.

Important pages:

- `/`: dashboard with Today Plan preview and Life Balance entry point
- `/organize`, `/money`, `/reflect`: grouped navigation hubs for planning/capture/admin modules, finance, and review/insight modules.
- `/today`
- `/review`
- `/someday`
- `/inbox`
- `/waiting`
- `/commitments`
- `/maintenance`
- `/reset`
- `/rules`
- `/insights`
- `/life-areas`
- `/projects`, `/projects/[id]`
- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/tasks`, `/goals`, `/nuke`, `/calendar`, `/notes`, `/links`
- `/wishlist`, `/investments`, `/income`, `/budget`
- `/daily-content`, `/custom-sections`, `/pomodoro`, `/settings`, `/admin`, `/ai-chat`
- `/share/[token]`

Important shared components:

- `components/dashboard-layout.tsx`: app shell/sidebar/top-level layout for signed-in app pages.
- `components/life-area-controls.tsx`: shared Life Area icon, badge, and selector controls.
- `components/auth-provider.tsx`: client auth context.
- `components/subscription-checker.tsx`: subscription/trial UI state.
- `components/theme-provider.tsx` and `components/theme-switcher.tsx`: localStorage-based theme handling.
- `components/quick-add-modal.tsx`: multi-feature quick add.
- `components/global-search.tsx`: command-search UI.
- `components/daily-popup.tsx`: daily content popup and games integration.

## State Management

State management is mostly local React state:

- Client pages use `useState`, `useEffect`, and local fetch helpers.
- `AuthProvider` exposes the current user, loading state, login/register/logout.
- Theme and some UI preferences use `localStorage` or `sessionStorage`.
- No Redux, Zustand, TanStack Query, SWR, or server-state framework is currently used.

## Styling and UI System

- Tailwind CSS is configured in `tailwind.config.js`.
- shadcn/Radix-style component metadata is in `components.json`.
- Active global styles and theme tokens are in `app/globals.css`.
- Themes include light, dark, ocean, forest, sunset, rose, and midnight tokens.
- lucide-react is the icon library.
- UI primitives live in `components/ui`.

## Deployment Setup

- README says the app is deployed on Vercel and synced from v0.
- `vercel.json` configures a daily cron:
  - path: `/api/cron/deadline-reminders`
  - schedule: `0 9 * * *`
- `next.config.mjs` currently sets:
  - `typescript.ignoreBuildErrors: true`
  - `eslint.ignoreDuringBuilds: true`
  - `images.unoptimized: true`

## Environment Variables

Environment variable names observed in code and `.env.local` key names:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_URL_NO_SSL`
- `POSTGRES_HOST`
- `POSTGRES_DATABASE`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `PGHOST`
- `PGHOST_UNPOOLED`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`
- `NEON_PROJECT_ID`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ALPHA_VANTAGE_API_KEY`
- `GROQ_API_KEY`
- `OPENROUTER_API_KEY`
- `VERCEL_OIDC_TOKEN`

Never print or commit secret values.

## Current Priorities and Technical Debt

- Add or repair ESLint flat config so `npm run lint` works.
- Add a `typecheck` script and consider re-enabling TypeScript validation in builds.
- Consolidate schema drift around `scripts/website-current-schema.sql`.
- Normalize auth/session handling in routes that do not use `lib/auth.ts`.
- Add automated tests for auth, key CRUD routes, reminders, sharing, and finance integrations.
- Harden external URL preview fetching against SSRF and internal network access.
- Replace `resend.dev` sender defaults before production email use.
- Move unsupported `metadata.themeColor` and `metadata.viewport` fields to the Next viewport export pattern.

## Repo Health Snapshot

- Worktree had no tracked modifications before the AI memory docs were created.
- Build health: passing, but with type and lint gates disabled.
- Lint health: blocked by missing ESLint flat config.
- Test health: no configured automated test entrypoint.
- Database health: schema source of truth needs confirmation against the live Neon database.

## Known Incomplete or Risky Areas

- `npm run lint` fails because ESLint 10 cannot find `eslint.config.*`.
- Builds pass while skipping TypeScript and lint validation.
- No test command exists.
- Some route handlers use broad `any` types.
- URL preview fetches arbitrary URLs.
- Investment screenshot parsing uses a local JWT helper inconsistent with the main session cookie system.
- Calendar sync uses `session_id`, which is inconsistent with the main `session` cookie.
- Multiple SQL scripts overlap; the schema baseline warns that older patch scripts contain drift.
- AI routes depend on provider configuration not documented in code comments beyond env variable usage.

## Current Bottlenecks and Scalability Concerns

- Many dashboard and page flows use multiple client-side fetches instead of a typed shared data layer.
- Raw SQL is duplicated across routes, with no centralized validation/schema layer.
- No automated tests or typecheck script protect changes.
- External API limits are handled in some finance routes, but broader integration reliability is unclear.
- Database migration state must be verified manually before schema changes.
