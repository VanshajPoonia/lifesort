# AI_PROJECT.md

Persistent project overview for AI coding agents.

## Current Project State

Project name: LifeSort.

`package.json` currently names the package `my-v0-project`, but the app UI, metadata, README, assets, and domain language identify the product as LifeSort.

LifeSort is a personal life-management application for organizing today plans, weekly reviews, life areas, life projects, Someday / Maybe ideas, goals, tasks, calendar events, notes, links, wishlist items, investments, income, budgets, daily content, and productivity coaching.

## Current Product Scope

Implemented feature areas found in the repo:

- Dashboard at `app/page.tsx`, focused on immediate attention: Today focus hero with the saved 3 focus items, Plan my day with AI CTA to Today, 4-number glance row, Add Task / Capture Thought / Open Journal quick actions, and a collapsible secondary section for Quick Access, LifeScore, Today/Money/Journal summaries, Pending, Recent Activity, notifications, and pinned favorites placeholder.
- Consolidated navigation hubs in the main sidebar, grouped since 2026-07-24 into 5 labeled sections per `AI_BUILD_PLAN.md` §4/A9: **Today** (Home, Today), **Life Domains** (Domains), **Workspace** (Workspace, Journal, Whiteboard, Money), **Reflect** (Reflect, Coach), **Utilities** (Settings, admin-only Admin). Group labels are hidden in tablet/collapsed icon-rail mode. Existing feature routes remain deep-linkable; `/workspace` groups Tasks & Goals, Inbox & Ideas, Boards & Spaces, Templates & Routines, and Waiting & Commitments tabs, while `/organize`, `/plan`, and `/life-admin` remain compatibility redirects. `/money` is the canonical finance surface with Overview, Budget, Income, Investments, and Wishlist tabs; `/budget`, `/income`, `/investments`, and `/wishlist` remain compatibility redirects. `/reflect` is the primary review/insight surface, and compatibility route `/insights` remains available. `/domains` is now directly reachable from the sidebar and mobile "More" sheet (previously only reachable by URL/search — a gap closed in the same nav restructure). `/api/navigation-summary` supplies lightweight user-scoped hub badges for due tasks, today events, habits due, unsorted Inbox, waiting/commitment/maintenance pressure, weekly review status, notifications, and Someday reviews.
- Explainable LifeScore on the dashboard through `/api/life-score` and `/api/ai/life-score`: derives a daily 0-100 organization signal from focus completion, overdue task load, habits, goals, weekly review status, commitments, maintenance/vault dates, and Life Area balance only after the user has meaningful data in at least one scored source. Empty/new accounts show a setup empty state and do not save synthetic score snapshots. Daily snapshots are stored in `life_score_history` when the migration is applied. Optional AI explanation is read-only, rate-limited, and receives only the derived score summary/components.
- Habits & Routines at `app/habits/page.tsx`, with per-habit CRUD, daily check-ins, streak tracking (current/best), weekly/monthly completion %, compact 12-week completion grids, and routine builder with ordered steps.
- Today Plan at `app/today/page.tsx`, providing a non-AI daily planner with focus items, fullscreen Focus Mode sessions, the priority-filtered draggable daily list placed immediately near the top, a This Week planner tab for drag-rescheduling dated tasks, energy/capacity planning, overload warnings, habits due today (with check-off), derived calendar/note/budget/wishlist suggestions, Journal preview, and end-of-day reflection.
- Daily Journal at `app/journal/page.tsx`, with one user-owned entry per date for mood, energy, gratitude, static affirmation suggestions, customizable intention labels, evening reflection, day ratings, tags, tomorrow setup, recent-entry history, mood trend, monthly heatmap, journal search, and 2-second autosave with a manual save fallback. Morning/Evening mode only changes visible sections and never clears hidden fields. Streaks count only dates with non-empty user journal content. `notes_from_today` uses the shared Tiptap rich-text editor, stores editor HTML in the existing `TEXT` column, and supports selected-text AI Refine plus browser-provided voice dictation. Saving `tomorrow_focus` server-side upserts a journal-sourced focus item into the next day's Today plan when capacity allows. `/today` links to the selected day's journal preview, and `/reflect` plus compatibility `/insights` show a weekly Journal digest tab. Migrations: `scripts/migrations/2026-05-18-daily-journal.sql`, `scripts/migrations/2026-06-03-journal-intention-labels.sql`.
- Collaborative Whiteboard at `app/whiteboard/page.tsx`, `app/whiteboard/[id]/page.tsx`, and login-gated share route `app/whiteboard/share/[token]/page.tsx`. Whiteboard metadata is user-scoped in Postgres, while realtime canvas state and presence use Liveblocks rooms with secure server-side auth through `/api/liveblocks-auth`. MVP tools include select/move, pan/zoom, pen, rectangle, ellipse, line, text, sticky notes, eraser/delete, color, stroke width, undo/redo, collaborator cursors, and viewer read-only mode. Migration: `scripts/migrations/2026-05-20-whiteboards.sql`.
- Spaces at `app/spaces/page.tsx` and `app/spaces/[id]/page.tsx`, exposed through Workspace > Visual. Spaces are user-owned containers for related LifeSort records and use a linking table instead of duplicating source data. V1 links notes/pages, whiteboards, tasks, projects, links, and custom sections; users can create a new source record from inside a Space and link existing records. Migration: `scripts/migrations/2026-05-20-spaces.sql`.
- Weekly Review at `app/review/page.tsx`, providing a non-AI Monday-Sunday review across tasks, goals, habits, projects, notes, finance, Life Areas, and saved energy/capacity patterns with saved reflections and previous-review history.
- Reflect / Life Balance Insights at `app/reflect/page.tsx` and compatibility route `app/insights/page.tsx`, showing tabbed review/insight navigation for LifeScore, Life Balance, Timeline, Ignored Signals, Weekly Review, and Journal. The Journal tab includes 90-day privacy-limited journal insights from `/api/journal/insights` plus the existing weekly digest. Reset My Life is available from a standalone emergency CTA instead of a review tab. Life Balance and Ignored Signals keep the existing non-AI metrics plus optional read-only AI analysis.
- Life Domains (renamed from "Life Areas" — see `AI_LIFE_DOMAINS_SPEC.md`) at `app/domains/page.tsx` and `app/domains/[id]/page.tsx` (table stays `life_areas`, API route stays `/api/life-areas`; only the page routes and all user-facing copy renamed, with `/life-areas*` kept as compatibility redirects to `/domains*`). Provides user-owned cross-module organization: default domains, icons, colors, descriptions, ordering, lifecycle (`status`: active/paused/archived/hidden, filterable via tabs on the list page), `importance`, `desired_attention`, `review_frequency`, `health_status`, free-text fields (current focus, definition of success, concerns, long-term vision, boundaries), and privacy flags (`is_ai_excluded`, `requires_reauth` — stored but re-auth enforcement not yet built). The detail page is a tabbed dashboard (Overview/Goals/Projects/Tasks/Habits and Routines/Knowledge, hiding empty tabs) that filters the existing list pages by `life_area_id` rather than re-implementing them. Onboarding (`components/onboarding-modal.tsx`) now creates real starter domains via `/api/life-areas` on completion, and a shared `<DomainTodayOverview />` widget (`components/domain-today-overview.tsx`) shows a compact per-domain summary (tasks today/overdue, habits due, from the `domainSummary` field added to `/api/navigation-summary`) on both `/today` and the home dashboard. Journal entries (`daily_journal_entries`) and calendar events (`calendar_events`) can now carry a `life_area_id`, surfaced as Calendar/Journal tabs on the domain dashboard once a domain has data. Domains support reviews (`life_area_reviews` table, `/api/life-area-reviews`, Review tab on `/domains/[id]`) and privacy: `is_ai_excluded` is enforced everywhere the app builds AI context (Coach, Life Balance, What Am I Ignoring, weekly summary) so an excluded domain's data never reaches Gemini. The Life Balance tab (`/reflect`, `/api/ai/life-balance`) now shows gentle desired-attention-vs-actual-activity nudges. `requires_reauth` is now enforced (password re-prompt via `/api/auth/verify-password`, session-scoped unlock) and subdomains have a UI (Domain Settings "Parent domain" selector, depth-1 enforced server-side). A "Focus on this domain" button (`app/domains/[id]/page.tsx`) turns on Domain Focus Mode: a session-scoped, client-side filter (`components/domain-focus-provider.tsx`, sessionStorage-backed) that tints the app shell with the domain's accent color, filters Today's items/habits (`app/today/page.tsx`), and filters global search/⌘K results (`components/global-command-palette.tsx`) to that domain, with an "Exit focus" control always visible in the header banner (`components/dashboard-layout.tsx`). Domain-flavored starter templates (Physical/Mental/Financial/Career/Relationships, `lib/templates.ts`) can be applied from a domain page's "Apply a template" button, auto-tagging created tasks/goals/projects/habits/notes with that domain via `?domain_id=` on `/templates`. **Status:** Phase 1, Phase 2, and Phase 3 of `AI_LIFE_DOMAINS_SPEC.md` §19 are all implemented (2026-07-23, see `AI_TASK_LOG.md`) except the deliberately-deferred Phase 3 items (Life Balance deepening, domain AI summaries, proactive capture suggestions, cross-domain insights). All three migrations (`2026-07-23-life-domains-phase1.sql`, `2026-07-23-life-domains-phase2.sql`, `2026-07-23-generic-tags.sql`) are **applied to the live database**; focus mode and domain templates required no new migrations. Read `AI_LIFE_DOMAINS_SPEC.md` before further Life Domains work.
- Generic tags (`tags`, `item_tags` tables; `/api/tags`, `/api/item-tags`; `components/tag-picker.tsx`) for object types that have no tagging otherwise — currently `task`/`goal`/`project`. Deliberately additive and separate from the existing `TEXT[]` tag columns on `notes`/`people`/`vault_items`/`budget_transactions`, which are untouched (see `AI_DECISIONS.md`). UI wired into `app/tasks/page.tsx` only so far; Goals/Projects can reuse the same component and API but aren't wired in yet.
- Generic attachments (`attachments` table; `/api/attachments`, `/api/attachments/[id]`; `lib/r2.ts`; `components/attachment-list.tsx`) for `task`/`goal`/`project`/`note`/`vault_item`. Files are stored in a private Cloudflare R2 bucket (not Postgres) and accessed only via short-lived server-issued presigned URLs after a per-item ownership check — the bucket has no public domain and no file bytes ever pass through our own API. UI wired into `app/vault/page.tsx` only so far (vault items are the most natural fit — insurance/ID/policy documents). **`R2_*` env vars are only in local `.env.local`, not yet added to Vercel** — this feature is not deploy-ready until that's done and the exposed credential is rotated (see `AI_TASK_LOG.md` 2026-07-23 19:40 IST entry).
- Life Projects at `app/projects/page.tsx` and `app/projects/[id]/page.tsx`, providing larger project containers with status, priority, progress, optional Life Area assignment, templates, linked existing records, and activity.
- Life Vault at `app/vault/page.tsx`, with structured storage for important life info (documents, subscriptions, warranties, insurance, vehicle, home, medical, education, work), expiry/renewal/reminder date tracking, four views (All/Expiring/Renewals/By category), color-coded urgency badges, dashboard widget, global search, and quick-add support.
- People / Relationships at `app/people/page.tsx`, with contact CRUD (name, relationship type, email, phone, birthday, location, notes, tags, life area), per-person reminders (birthday/follow-up/custom, recurring), item linking (tasks/notes/projects/calendar events), relationship count badges for commitments/waiting/task links, four views (All/Birthdays/Follow-ups/By type), and dashboard widget.
- Custom auth: login, register, logout, current-user check, forgot password, and reset password.
- Tasks with quick-create Enter submission, priority, due date/time, reminders, completion state, category, optional goal linking, optional Life Area assignment, quick date filters, multi-select bulk actions, project linking through `project_items`, and persisted manual drag ordering.
- Goals with status, priority, progress, target dates, numeric tracking, client-derived on-track signals, quick task creation linked by `goal_id`, reminders, linked tasks, and optional Life Area assignment.
- Focus Goal page at `/nuke` for one large goal with milestones and reminders.
- Calendar workspace at `app/calendar/page.tsx` with Month/Week scheduling views, Today/previous/next controls, local events, incomplete scheduled tasks, Google synced read-only reminders, drag-and-drop scheduling through existing task/event records, and a Draft Task Panel for incomplete tasks with no due date.
- Notes page with CRUD, folders, tags, pinned notes, optional Life Area assignment, local search/filter UI, autosave-style editing, and a reusable Tiptap rich-text editor that preserves legacy plain-text note compatibility while saving edited rich content as HTML in the existing `notes.content` column. Notes opt into selected-text AI Refine through `/api/ai/refine-text` and client-side Web Speech dictation through the editor toolbar.
- Links page with folders, subfolders, URL previews, image upload via base64, and share links.
- Public share page at `app/share/[token]/page.tsx`.
- Money at `/money`, with URL-backed tabs for Overview, Budget, Income, Investments, and Wishlist. The Overview tab is a real financial dashboard derived from existing user data: estimated net worth, Money Score, savings rate, 6-month cash flow, budget health, upcoming Vault bills, wishlist savings progress, and liabilities. The Budget, Income, Investments, and Wishlist tabs reuse the existing feature UIs with preferred-currency display formatting. Compatibility routes `/budget`, `/income`, `/investments`, and `/wishlist` redirect to their matching Money tabs.
- Wishlist with price, URL, image, priority, category, optional Life Area assignment, purchased state, preview fetching, conversion to investment, and explicit creation of linked Budget Goals through "Save for this."
- Investments with symbols, quantities, estimated returns, optional Life Area assignment, quotes, refresh limits, popular investments, background fetch, screenshot parsing/import, and portfolio allocation pie chart grouped by type/symbol/name.
- Income sources with amount, frequency, category, optional Life Area assignment, next payment date, and active state.
- Budget categories with optional Life Area assignment, transactions, goals, optional linked wishlist goal ids, summary cards, cash-flow/category-usage API aggregates, and calculator UI.
- Daily content with authenticated Gemini-generated/static jokes, quotes, trivia, riddles, fun facts, games, and history. It is no longer auto-surfaced from the main shell and is managed from its route/settings.
- Games: Snake and Wordle components.
- Settings for profile, preferred currency display formatting, Journal intention labels, daily content preferences, Home layout preference compatibility, and sidebar preferences.
- Admin subscription management.
- LifeSort Coach at `/ai-chat` and authenticated `/api/chat`: app-aware chat over safe server-gathered LifeSort context modes (Today, This week, Goals, Projects, Finance, Full LifeSort summary). The Coach uses model allowlisting, request validation, conservative usage caps, visible Personal Operating Rules, metadata-only note context, citation ids for LifeSort items used, and draft task suggestions that require explicit user confirmation before `/api/tasks` writes anything.
- AI Weekly Summary at `/api/ai/weekly-summary`: authenticated POST that takes the already-loaded week summary (numeric counts only, no PII) and calls Gemini to return structured output (summary, wins, risks, ignored areas, next-week focus, 3 next actions). Rate-limited to 5/day. Result is displayed on `/review` and optionally applied to reflection fields; AI never writes to any user table.
- AI Today Planner at `/api/ai/today-plan`: authenticated POST that takes the already-loaded candidates, habits, and daily capacity from `/today` (actual item titles + IDs) and calls Gemini to return a structured day plan (capacity-aware top priorities, schedule blocks, items to defer, risks, one small win). Rate-limited to 3/day. Every write action (add to focus, create task) requires explicit user confirmation — nothing is applied automatically.
- Universal Capture at `/capture` and `/api/ai/capture`: users type messy natural language and AI parses it into structured draft actions for 9 types (task, waiting_item, goal, habit, note, project, vault_item, wishlist_item, calendar_event). Input validated with Zod (1–1000 chars). AI output validated per-type with Zod schemas. Drafts are fully editable before the user confirms creation. Rate-limited to 10/day. Nothing writes to the database until explicit user confirmation. Accessible through Workspace > Capture and deep link `/capture`.
- AI Life Balance Insights at `/reflect` (and compatibility `/insights`) plus `/api/ai/life-balance`: authenticated GET returns aggregate Life Area balance metrics; authenticated POST calls Gemini for read-only analysis of over-focused areas, ignored areas, stress points, small suggested actions, and next-week balance. Rate-limited to 10/day. Suggested actions become tasks only after explicit user confirmation.
- AI "What Am I Ignoring?" Insights at `/reflect` (and compatibility `/insights`) plus `/api/ai/what-am-i-ignoring`: authenticated GET returns non-AI neglect/risk signals for quiet Life Areas, stale goals/projects, overdue waiting items/commitments/maintenance, missed habits, upcoming Vault renewals, and finance review gaps only when finance records exist and are stale. Authenticated POST calls Gemini for read-only explanations and small suggested actions. Rate-limited to 5/day. Suggested actions become tasks only after explicit user confirmation.
- Reset My Life at `/reset`, `/api/reset`, `/api/reset/actions`, `/api/reset/recovery-plan`, and `/api/ai/reset-suggestions`: recovery dashboard for overwhelm triage across overdue tasks, stale goals, inactive projects, missed habits, unsorted inbox items, overdue waiting items, overdue commitments, overdue maintenance, and upcoming deadlines. Bulk cleanup actions require confirmation, recovery plans reuse Today Plan focus items, and AI suggestions are read-only until the user explicitly applies selected actions. No new core data table is used.
- Someday / Maybe at `/someday` and `/api/someday`: user-scoped low-pressure holding area for ideas and possibilities that are not active tasks or goals yet. Items support category, optional Life Area, review date, someday/promoted/archived status, dashboard review-due widget, Quick Add, Global Search, Universal Capture draft creation, and explicit promotion to projects, goals, tasks, wishlist items, or notes through `/api/someday/promote`.
- Life Timeline at `/timeline` and `/api/timeline`: chronological view of meaningful life activity derived from existing tables (no new schema). Sources: completed tasks, completed goals, completed projects, project activity milestones, notes created, weekly reviews, habit check-in milestones (7/14/21/30/50/100 check-ins), wishlist items purchased, investments added, budget categories/goals, maintenance completions, Vault renewals represented by Vault-linked maintenance completions, People follow-ups where reminders are marked sent, and completed commitments. Timeline logic lives in `lib/timeline.ts` and is shared by the API and Global Search. Filters by event type, life area, date range, and text search. Client groups events by month or week. Dashboard widget shows 5 most recent milestones. Sidebar nav under "Insights".
- Universal Life Inbox at `/inbox` and `/api/inbox`: user-scoped capture queue for messy thoughts, reminders, ideas, and responsibilities before the user decides where they belong. Items can be unsorted, archived, or converted after explicit confirmation into tasks, goals, notes, projects, habits, wishlist items, vault items, or calendar events. Conversion records `converted_type` and `converted_id` on the original inbox item. Quick Add can capture to Inbox, Universal Capture can save raw text to Inbox, the dashboard shows unsorted items, and Global Search includes Inbox items.
- Waiting For tracker at `/waiting` and `/api/waiting`: user-scoped tracking for external dependencies such as replies, approvals, deliveries, refunds, school/company/bank/government follow-ups, job applications, and other things the user is waiting on. Items support status, expected/follow-up dates, optional Life Area, Project, and Person links, dashboard follow-up/overdue widget, Quick Add support, Global Search, and Universal Capture draft creation.
- Commitments tracker at `/commitments` and `/api/commitments`: user-scoped tracking for promises and obligations made to oneself or others. Commitments support type/status, due dates, optional Life Area/Project/Person/Task links, dashboard due-soon/at-risk widget, Quick Add, Global Search, and explicit conversion to a linked task through `/api/commitments/convert-to-task`.
- Life Maintenance at `/maintenance` and `/api/maintenance`: user-scoped recurring maintenance tracker for renewals, checkups, repairs, reviews, and admin responsibilities. Items support category, recurrence, custom interval days, next due date, last completed date, reminder lead time, optional Life Area/Vault links, templates, dashboard upcoming/overdue widget, Quick Add, Global Search, mark-complete date advancement, and explicit task creation through `/api/maintenance/create-task`.
- Personal Operating Rules at `/rules` and `/api/personal-rules`: user-scoped visible preferences and constraints that LifeSort AI planning features can read. Users can CRUD active/inactive rules, set structured planning preferences (working hours, max daily focus items, reminder timing, heavy/light days, planning style), and preview the exact AI planning context. AI routes read active rules but do not create or change rules.
- Smart Templates at `/templates`: 10 pre-designed life systems (student semester, fitness transformation, job search, business launch, budget reset, travel plan, learning roadmap, content creator planner, home management, reading list). Each template is a static code definition in `lib/templates.ts`. Users preview all items before anything is created. "Create this system" applies each item sequentially via existing CRUD APIs (projects, tasks, goals, habits, notes, custom sections, budget categories, vault items). Nothing writes to the database until the user explicitly confirms. Presets can be forked into user-owned My Templates through `/api/user-templates` for editing.
- My Templates at `/templates?mode=my`: user-created, forked, and explicitly saved AI templates persist in `user_templates` with user-owned JSONB item definitions. Users can add/edit/delete templates, reorder items with the shared `SortableList`, preview a user template, and only then confirm "Create this system" through `/api/user-templates/[id]/use`. Migration: `scripts/migrations/2026-06-03-user-templates.sql`.
- AI Template Builder at `/templates?mode=ai` and Workspace > Systems: authenticated users can enter a prompt and receive a Zod-validated generated LifeSort system preview. `/api/templates/generate` calls Gemini through AI SDK structured output and records `template_builder` usage events; `/api/templates/apply` re-validates the preview and creates user-owned Spaces, Custom Sections, tasks, notes, habits, links, optional Whiteboard, and optional budget categories only after explicit confirmation. Generated templates can also be explicitly saved to My Templates with source `ai`; recent generated/applied history is sessionStorage-only as a same-session convenience, not permanent storage.
- Global command palette in `components/global-command-palette.tsx`, opened by Cmd/Ctrl+K, Ctrl+K, the header search trigger, and Quick Add/FAB. It combines capture actions (reusing `QuickAddModal`), `/api/search` results, navigation commands, and links to existing AI surfaces without adding a new inline AI assistant.
- Global search across Timeline, Someday / Maybe, Inbox, Waiting For, Commitments, Maintenance, tasks, goals, projects, notes, links, wishlist, investments, income, and budget.
- Notification Center at `/notifications` and `components/notification-bell.tsx`: bell icon in the header is visible on desktop and mobile, shows a red unread badge, and opens a Popover dropdown with the 10 most recent notifications. Full `/notifications` page lists all notifications grouped by date (Today / Yesterday / This Week / Earlier) with type filter and read/unread toggle. Notifications are generated on-demand from warning and positive reinforcement conditions: due tasks/goals/projects, missed habits, expiring Vault items, people follow-ups, weekly review nudges, budget warnings, journal/habit streak milestones, best task week, goal completions, and all-budgets-under-limit months. Uses `notifications` table with UNIQUE(user_id, type, related_item_type, related_item_id) to prevent duplicate generation. Read state is preserved across regenerations via `ON CONFLICT DO NOTHING`. Sidebar nav link and Settings toggle included. Migration: `scripts/add-notifications.sql`.

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
- AI SDK: `ai`, `@ai-sdk/react`, and `@ai-sdk/google` for direct Gemini text generation via `lib/ai-provider.ts`.
- Tiptap rich text via `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-link`, and `@tiptap/extension-placeholder`.
- Resend for transactional/reminder emails
- Alpha Vantage external API for quotes and symbol search
- Groq OpenAI-compatible vision API for authenticated portfolio screenshot parsing.
- Liveblocks for collaborative whiteboard presence and room storage via `@liveblocks/client`, `@liveblocks/react`, and `@liveblocks/node`.
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
- CRUD and planning: `today-plan`, `weekly-review`, `life-areas`, `projects`, `projects/items`, `projects/activity`, `tasks`, `goals`, `notes`, `note-folders`, `links`, `link-folders`, `wishlist`, `investments`, `income`, `budget`, `calendar-events`, `nuke-goal`, `custom-sections`, `journal/search`
- Capture and sorting: `someday`, `someday/promote`, `inbox`, `inbox/convert`, `waiting`, `commitments`, `commitments/convert-to-task`, `maintenance`, `maintenance/complete`, `maintenance/create-task`
- User/profile/preferences: `profile`, `onboarding`, `sidebar-preferences`, `daily-content`
- Integrations: `calendar/google/*`, `calendar/sync`, `stock-quote`, `url-preview`
- AI: `chat`, `daily-content/generate`, `investments/parse-screenshot`, `ai/weekly-summary`, `ai/today-plan`, `ai/capture`, `ai/refine-text`, `ai/life-balance`, `ai/what-am-i-ignoring`, `ai/reset-suggestions`, `ai/life-score`, `templates/generate`, `templates/apply`; these routes use main session auth and provider-specific env vars. Planning-oriented AI routes read visible Personal Operating Rules through `lib/personal-rules.ts`. Template Builder uses `/api/templates/*` because it is coupled to the existing Templates product surface.
- Operational: `cron/deadline-reminders`, `admin/update-subscription`, `dashboard`, `search`, `share`
- Agent infrastructure: `agent/actions` (GET/POST/PUT/DELETE pending agent actions), `agent/execute` (POST executes a confirmed action). Backed by `agent_action_events` table. Both routes require session auth and Zod-validate every body. `/api/agent/execute` returns 501 TOOL_NOT_IMPLEMENTED until the tool registry is built — this is intentional.

## Frontend Structure

The frontend uses App Router pages under `app/`. Most feature pages are client components with local state and calls to route handlers via `fetch`.

Important pages:

- `/`: dashboard with Today Plan preview and Life Balance entry point
- `/workspace`, `/money`, `/reflect`: grouped navigation hubs for planning/capture/visual/systems/follow-up modules, finance, and review/insight modules. `/organize` remains a compatibility redirect.
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
- `/domains`, `/domains/[id]` (`/life-areas*` redirects here)
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
- `components/editor/rich-text-editor.tsx`: reusable Tiptap editor for writing surfaces, starting with Notes and Journal, with opt-in AI Refine and browser dictation controls.

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
- Shared UX polish utilities live in `app/globals.css`: `surface-card`, `interactive-card`/`card-interactive`, `section-enter`, `tab-enter`, `list-item-enter`, `journal-enter`, and `save-feedback` provide calm card surfaces, subtle hover/press motion, page/tab/list entrance, Journal warmth, and reduced-motion-aware feedback without a separate animation library. Journal-specific notebook utilities also live there and must stay scoped to `/journal` so the rest of LifeSort does not inherit the warm paper treatment. Reusable motion class presets and timing tokens live in `lib/motion.ts`; `framer-motion` is intentionally not installed for routine LifeSort polish.
- Shared rich-text editor styling also lives in `app/globals.css` under `.rich-text-*` classes, with warmer journal-only variants for `mode="journal"`.
- Responsive foundation uses Tailwind breakpoints plus `hooks/use-breakpoint.ts` only where runtime behavior is needed: mobile `<640px`, tablet `640-1023px`, desktop `1024-1600px`, and wide `>1600px`. Signed-in pages use a centered app container capped around 1400px, a full desktop sidebar, a tablet icon rail, and mobile bottom navigation.

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
- `GEMINI_API_KEY`
- `VERCEL_OIDC_TOKEN`

Never print or commit secret values.

## Planned / Specified Work

- **Full LifeSort product build** (`AI_BUILD_PLAN.md`): the master reconciled roadmap for completing the entire product vision (Capture → Organize → Plan → Focus → Reflect → Find). It audits the 2026-07-23 full-product spec against this codebase and records the phased plan plus key reconciliation decisions — notably: the Money/finance surface is **preserved** (framed as Financial-domain tooling, not removed); the OpenClaw/autonomous-agents direction is **descoped** and the `agent_action_events` confirm-execute layer is repurposed as the AI action-safety substrate; a generic `item_relationships` table is added additively for backlinks/mentions; the `life_areas` table name is retained; and most of the spec's §27 tables already exist under other names. **Read `AI_BUILD_PLAN.md` before any feature work that advances the full-product vision.**
- **Life Domains** (`AI_LIFE_DOMAINS_SPEC.md`): full spec for the Life Domains system. **Phases 1, 2, and 3 are implemented** (2026-07-23; see the Life Domains bullet above and `AI_TASK_LOG.md`) except the deliberately-deferred Phase 3 items (Life Balance deepening, domain AI summaries, proactive capture suggestions, cross-domain insights). Consult the spec before any further Life Domains work.

## Current Priorities and Technical Debt

- ~~Add or repair ESLint flat config so `npm run lint` works.~~ Done 2026-07-24 (`eslint.config.mjs` + ESLint 9.39.5 + `eslint-config-next@16.2.11`; ESLint 10 isn't yet supported by `eslint-plugin-react`). Now surfaces 293 pre-existing findings — cleaning those up is the new, separate priority.
- Add a `typecheck` script and consider re-enabling TypeScript validation in builds.
- Consolidate schema drift around `scripts/website-current-schema.sql`.
- Normalize auth/session handling in routes that do not use `lib/auth.ts`.
- Expand automated test coverage beyond the 2026-07-24 starter suite (`lib/auth.ts` + `app/api/tags/route.ts`) to more CRUD routes, reminders, sharing, and finance integrations.
- Harden external URL preview fetching against SSRF and internal network access.
- Replace `resend.dev` sender defaults before production email use.
- Move unsupported `metadata.themeColor` and `metadata.viewport` fields to the Next viewport export pattern.

## Repo Health Snapshot

- Worktree had no tracked modifications before the AI memory docs were created.
- Build health: passing, but with type and lint gates disabled.
- Lint health: `npm run lint` runs (fixed 2026-07-24); 293 pre-existing findings not yet cleaned up.
- Test health: `npm test` (Vitest) runs; 20 tests across 2 files as of 2026-07-24 — a starter harness, not full coverage.
- Database health: schema source of truth needs confirmation against the live Neon database.

## Known Incomplete or Risky Areas

- `npm run lint` runs but reports 293 pre-existing findings (186 errors, 107 warnings) never checked before 2026-07-24 — see `AI_TASK_LOG.md` for the rule breakdown.
- Builds pass while skipping TypeScript and lint validation.
- Automated test coverage is minimal (2 files, 20 tests as of 2026-07-24).
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
