# AI_PROJECT.md

Persistent project overview for AI coding agents.

## Current Project State

Project name: LifeSort.

`package.json` currently names the package `my-v0-project`, but the app UI, metadata, README, assets, and domain language identify the product as LifeSort.

LifeSort is a personal life-management application for organizing goals, tasks, calendar events, notes, links, wishlist items, investments, income, budgets, daily content, and productivity coaching.

## Current Product Scope

Implemented feature areas found in the repo:

- Dashboard at `app/page.tsx`, aggregating tasks, goals, notes, budget, investments, wishlist, and income.
- Custom auth: login, register, logout, current-user check, forgot password, and reset password.
- Tasks with priority, due date/time, reminders, completion state, category, and optional goal linking.
- Goals with status, priority, progress, target dates, numeric tracking, reminders, and linked tasks.
- Nuke goal page for one large goal with milestones and reminders.
- Calendar page with local events and Google Calendar integration/sync routes.
- Notes page with CRUD, folders, tags, pinned notes, local search/filter UI, and autosave-style editing.
- Links page with folders, subfolders, URL previews, image upload via base64, and share links.
- Public share page at `app/share/[token]/page.tsx`.
- Wishlist with price, URL, image, priority, category, purchased state, preview fetching, and conversion to investment.
- Investments with symbols, quantities, estimated returns, quotes, refresh limits, popular investments, background fetch, and screenshot parsing/import.
- Income sources with amount, frequency, category, next payment date, and active state.
- Budget categories, transactions, goals, summary cards, and calculator UI.
- Daily content with generated/static jokes, quotes, trivia, riddles, fun facts, games, and history.
- Games: Snake and Wordle components.
- Settings for profile, daily content preferences, and sidebar preferences.
- Admin subscription management.
- AI chat page and `/api/chat` route for productivity coaching.
- Global search across tasks, goals, notes, links, wishlist, investments, income, and budget.

## Tech Stack

- Next.js `15.5.9`
- React `19.2.0`
- TypeScript
- Tailwind CSS
- shadcn/Radix-style UI components
- lucide-react
- Neon Postgres via `@neondatabase/serverless`
- bcryptjs for password hashing
- `jose` and `jsonwebtoken` dependencies are present; most auth uses opaque session tokens, not JWT.
- AI SDK: `ai` and `@ai-sdk/react`
- Resend for transactional/reminder emails
- Alpha Vantage external API for quotes and symbol search
- Groq OpenAI-compatible vision API for portfolio screenshot parsing
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
- `app/api/investments/parse-screenshot/route.ts` defines a local JWT-based `getUserFromSession()` with fallback secret `"your-secret-key"`, which does not match the main opaque session-token auth flow.

## Database Setup

The database is Neon Postgres. Raw SQL is used directly through `neon(process.env.DATABASE_URL!)`.

Important database files:

- `lib/db.ts`: shared exported Neon SQL client.
- `lib/auth.ts`: creates its own Neon SQL client and implements auth queries.
- `scripts/website-current-schema.sql`: closest canonical schema baseline; header says it reflects the current website API and that older patch scripts contain drift.
- `scripts/*.sql`: many incremental schema scripts for features and fixes.

Major tables in the current schema baseline:

- `users`, `sessions`, `password_reset_tokens`
- `goals`, `tasks`, `nuke_goals`
- `calendar_events`, `calendar_integrations`
- `note_folders`, `notes`
- `link_folders`, `user_links`
- `wishlist_items`, `investments`, `income_sources`
- `budget_categories`, `budget_transactions`, `budget_goals`
- `user_content_preferences`, `daily_content`
- `custom_sections`, `custom_section_items`
- `api_usage`, `popular_investments`

There is no automated migration runner in `package.json`.

## API and Backend Structure

Backend code lives in `app/api/**/route.ts`. It uses Next route handlers with direct SQL queries and JSON responses.

Representative API areas:

- Auth: `app/api/auth/*`
- CRUD: `tasks`, `goals`, `notes`, `note-folders`, `links`, `link-folders`, `wishlist`, `investments`, `income`, `budget`, `calendar-events`, `nuke-goal`, `custom-sections`
- User/profile/preferences: `profile`, `onboarding`, `sidebar-preferences`, `daily-content`
- Integrations: `calendar/google/*`, `calendar/sync`, `stock-quote`, `url-preview`
- AI: `chat`, `daily-content/generate`, `investments/parse-screenshot`
- Operational: `cron/deadline-reminders`, `admin/update-subscription`, `dashboard`, `search`, `share`

## Frontend Structure

The frontend uses App Router pages under `app/`. Most feature pages are client components with local state and calls to route handlers via `fetch`.

Important pages:

- `/`: dashboard
- `/login`, `/register`, `/forgot-password`, `/reset-password`
- `/tasks`, `/goals`, `/nuke`, `/calendar`, `/notes`, `/links`
- `/wishlist`, `/investments`, `/income`, `/budget`
- `/daily-content`, `/custom-sections`, `/pomodoro`, `/settings`, `/admin`, `/ai-chat`
- `/share/[token]`

Important shared components:

- `components/dashboard-layout.tsx`: app shell/sidebar/top-level layout for signed-in app pages.
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
- `JWT_SECRET`
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
