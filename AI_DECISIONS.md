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
- Link folders can be nested through `link_folders.parent_id`.
- Preferences use JSON/JSONB in user-related tables, including sidebar preferences and content preferences.
- Daily content stores generated or played content with `content_type`, `category`, `content`, and `extra_data`.

## API Design Decisions

- Most route handlers return JSON via `NextResponse.json`.
- Many CRUD routes use method-based handlers in one route file: `GET`, `POST`, `PUT`, `DELETE`.
- Client pages call relative API paths with `fetch`.
- Global search intentionally catches per-source query failures and returns partial results.
- Dashboard aggregation exists both on the client dashboard page and in `/api/dashboard`.

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
- `app/api/investments/parse-screenshot/route.ts` verifies the `session` cookie as JWT with fallback `JWT_SECRET`, which does not match main session-token auth.

## Database Decisions

- `scripts/website-current-schema.sql` is the closest canonical schema baseline because it says it reflects the current website API and older patch scripts contain drift.
- Many older SQL scripts are incremental patches and should be reviewed before use.
- There is no migration runner script in `package.json`.

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
- The screenshot parsing route has a fallback JWT secret string and auth flow mismatch.
- Calendar integration stores access and refresh tokens in the database.
- Reminder emails use `resend.dev` sender defaults in current code.
- Cron route checks `CRON_SECRET`, but its unauthorized logic should be reviewed before production hardening.
- AI and external API routes depend on provider keys and should avoid logging sensitive responses.

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
- Is the AI SDK model string `openai/gpt-4o-mini` backed by Vercel AI Gateway or another provider configuration?
