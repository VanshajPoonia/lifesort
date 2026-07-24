# AI_CHECKLIST.md

Verification and safety checklist for AI agents working on LifeSort.

## Local Setup Checklist

1. Read:
   - `AGENTS.md`
   - `AI_PROJECT.md`
   - `AI_TASK_LOG.md`
   - `AI_DECISIONS.md`
   - `AI_CHECKLIST.md`
   - `AI_BUILD_PLAN.md` — master full-product roadmap; read before feature work toward the full vision
2. Check current worktree:
   - `git status --short`
3. Install dependencies if needed:
   - Preferred: `pnpm install`
   - Reason: `pnpm-lock.yaml` exists.
4. Confirm environment variables exist before running backend flows that need them.
5. Do not print secret values from `.env.local`.

## Codex Kickoff Prompt

Paste this at the start of every Codex task, followed by your actual request:

```
Before starting, read these files in order:
1. AGENTS.md
2. AI_PROJECT.md
3. AI_TASK_LOG.md — read the most recent entry carefully
4. AI_DECISIONS.md
5. AI_CHECKLIST.md
6. AI_BUILD_PLAN.md — if the task advances the full-product vision

These are the project memory. Do not rely on chat history.
If anything in the chat conflicts with these files, trust the files.

After completing the task:
- Run npx tsc --noEmit and npm run build
- Update AI_TASK_LOG.md with: date, task, files changed, commands run, results, remaining issues, next steps
- Include the AI_TASK_LOG.md update in the same commit as the code

Task:
[your task here]
```

## Build Plan Continuation Prompt

Paste this at the start of a new chat to continue the full-product build without re-explaining anything. Self-updating by design — it points at `AI_BUILD_PLAN.md`/`AI_TASK_LOG.md` for "what's next" rather than hardcoding a step, so it stays correct across many future sessions as phases progress.

```
Continue the LifeSort full-product build per AI_BUILD_PLAN.md.

Before starting, read in this order:
1. AGENTS.md
2. AI_PROJECT.md
3. AI_TASK_LOG.md — read the most recent entries carefully
4. AI_DECISIONS.md
5. AI_CHECKLIST.md
6. AI_BUILD_PLAN.md — read Part B (confirmed decisions) and Part C (phased roadmap) in full

These files are the project memory, not this chat — do not rely on chat history. Decisions recorded in AI_BUILD_PLAN.md Part B are already settled (e.g. Money/finance is preserved, autonomous agents/OpenClaw are descoped, the life_areas table keeps its name, and the A4/A9 consolidation + nav-restructure directions are user-confirmed) — do not re-litigate them.

Task: work through AI_BUILD_PLAN.md Part C, Phase 0 (Foundation), taking the next item in that phase that AI_TASK_LOG.md shows isn't done yet. Implement it as its own coherent, focused change — not the whole phase at once. For UI/design changes, verify visually in a running dev server before calling it done.

After finishing that one item:
- Run npx tsc --noEmit and npm run build, record the results
- Update AI_TASK_LOG.md with a new dated entry (files changed, why, commands run, bugs, remaining issues, next steps)
- Update the status marker for that item in AI_BUILD_PLAN.md, and AI_PROJECT.md/AI_DECISIONS.md if applicable
- Commit code and docs together

Then continue to the next item in Phase 0 the same way, without stopping to ask approval for each one. Only stop if genuinely blocked by a decision only the user can make (e.g. before deleting or migrating data for an existing surface per AI_BUILD_PLAN.md §A4).
```

Once all of Phase 0 is done, the same prompt still works for Phase 1 onward — it always resolves "what's next" from the two files, not from this prompt's wording.

## Codex Handoff Prompt

Paste this when handing work from Codex to Claude Code or vice versa:

```
Read AI_TASK_LOG.md — the most recent entry has the handoff notes.
Read AI_DECISIONS.md and AI_CHECKLIST.md before making any changes.
Continue from where the last agent left off.
```

## Regression Checkpoint Prompt

Run this prompt periodically (after major feature work or before merging a branch) to verify nothing is broken. Paste it directly to Claude Code or Codex:

```
Do a regression checkpoint for the LifeSort website app.

Do not add new features in this pass.

Check that the recent changes did not break existing functionality.

Run:
- git status
- git diff --stat
- npx tsc --noEmit
- npm run lint
- npm run build

Then smoke-test these routes (HTTP 200 expected for all):
- / /tasks /goals /notes /links /wishlist /investments /income /budget
- /calendar /custom-sections /settings /ai-chat /login /register

Verify:
1. All routes return 200.
2. All protected API routes return 401 without a session (not 500).
3. /api/chat GET returns a valid model list JSON.
4. No new errors in the dev server log (beyond known pre-existing ones).
5. Pre-existing TS errors (deadline-reminders, convert-to-investment, calendar/page, snake-game) are unchanged.
6. Any new migration scripts are documented in AI_TASK_LOG.md with run status.

Update AI_TASK_LOG.md with: commands run, results, issues found, remaining issues, next recommended task.

Output: pass/fail summary, issues found, files that may need follow-up.
```

## Regression Checkpoint Execution Notes

Use this checklist when implementing the regression prompt:

1. Restart the dev server from a clean port before route testing.
2. Confirm `/login` returns `200` twice before continuing.
3. Prefer `127.0.0.1:3000` if `localhost` has shell-level connection issues.
4. Use disposable users for auth and user-isolation checks.
5. Verify protected APIs return `401` without cookies.
6. Smoke create/edit/delete paths through APIs when browser automation is unavailable.
7. Record browser-automation gaps separately from API/HTTP failures.
8. Treat 500s from missing columns/tables as schema drift and list exact missing objects.
9. Do not run migrations or direct database cleanup without explicit target confirmation.
10. After testing, delete temporary records through app APIs when possible and document anything left behind.
11. Capture/promotion features must keep APIs user-scoped, update migration baselines, validate optional linked ownership, and require explicit confirmation before creating linked records.

## Full QA And Hardening Checklist

Use this checklist for broad QA passes after responsive, IA, Journal, command palette, or auth-affecting work:

1. Start by checking `git status --short --branch`, `git diff --stat`, and available scripts in `package.json`.
2. Run `npx tsc --noEmit`, `npm run lint`, and `npm run build`; record known caveats separately from new regressions.
3. Do not run migrations or directly mutate the database unless the user explicitly confirms the target environment.
4. Use disposable users and app/API flows for data setup; clean up temporary task/note/inbox-style records through app APIs where practical.
5. Verify unauthenticated protected APIs return `401`, not `500`.
6. Verify two-user isolation for Search, Journal, Today, tasks, notes/inbox, and any newly touched data surface when the database is reachable.
7. Smoke main routes: `/`, `/today`, `/journal`, `/workspace`, `/money`, `/reflect`, `/settings`.
8. Smoke representative deep routes: `/tasks`, `/goals`, `/projects`, `/habits`, `/calendar`, `/inbox`, `/notes`, `/links`, `/custom-sections`, `/people`, `/vault`, `/maintenance`, `/budget`, `/income`, `/investments`, `/wishlist`, `/review`, `/timeline`, `/reset`, `/rules`, `/ai-chat`.
9. Smoke compatibility/auth routes: `/capture`, `/insights`, `/plan`, `/life-admin`, `/notifications`, `/login`, `/register`.
10. If browser automation is available, check 375px, 414px, 768px, 1024px, 1280px, 1440px, and 1920px widths for horizontal overflow, mobile nav, Quick Add/FAB, command palette, search, notification bell, trial banner, dark mode, reduced motion, focus states, and console errors.
11. If Lighthouse is available, run desktop audits for Home, Today, Journal, Workspace, Money, and Reflect. Example: `npx lighthouse http://localhost:3000/ --view --preset=desktop`.
12. If DB/network/browser tooling is unavailable, document the exact blocker and list which checks were not completed. Do not mark those checks as passed.

## Global UX Smoke Checks

Run after changes to `DashboardLayout`, command/search/capture UI, Home preferences, onboarding, or trial/subscription UI:

- Cmd/Ctrl+K opens the global command palette.
- `?` opens the shortcuts dialog and does not fire while typing in inputs, textareas, selects, or contenteditable fields.
- Header search trigger, desktop Quick Add, and mobile FAB all open the command palette.
- Capture commands still route through the existing `QuickAddModal` or existing feature pages; no capture data is silently written by the palette itself.
- `/api/search?q=...` results still navigate to the expected records.
- Home stays calm, short, and focus-first; `home_view_mode` may remain stored for backward compatibility but must not turn Home into a module directory.
- Home's first screen should prioritize Today focus items, 4 glance stats, and Add Task / Capture Thought / Open Journal. Quick Access and deeper widgets stay in the secondary collapsible section, with localStorage recents that never block navigation.
- Onboarding completion merges `app_preferences` instead of erasing existing preference keys.
- Trial banner uses hourly precision and "Go Pro" or "Upgrade" wording.

## Navigation / Information Architecture Checklist

1. Preserve deep links when consolidating navigation; hide routes from the sidebar only, never delete feature pages.
2. Keep the primary sidebar focused but discoverable: Home, Today, Journal, Workspace, Whiteboard, Money, Reflect, Coach, Settings, and admin-only Admin.
3. Keep Home short and attention-focused; do not re-add full module dashboards there when a hub or deep feature route already owns the workflow.
4. Keep Today as the primary daily focus surface, with focus/due/suggested items unified into Must/Should/Could priority filters.
5. Keep `/today` defaulting to the Today tab. The This Week planner is opt-in through `/today?tab=week` and should reschedule existing tasks through `/api/tasks`, not create a separate planning table.
6. Preserve compatibility routes: `/organize` should lead to Workspace, `/plan` should lead to Workspace > Tasks & Goals, `/life-admin` should lead to Workspace > Templates & Routines, `/capture` remains the Universal Capture feature page, and `/insights` remains a Reflect compatibility feature route.
7. Keep Quick Add, Global Search, notifications, profile/settings, and sign-out reachable from the shared layout.
8. Keep mobile navigation compact: Home, Today, Workspace, Money, and More. More should include Journal, Whiteboard, LifeSort Coach, Reflect, Settings/Profile, Support/FAQs, and admin-only Admin.
9. Keep hub summary endpoints read-only, authenticated, user-scoped, and missing-schema tolerant.
10. Add hub cards or tab links for any feature hidden from the sidebar so discoverability is not lost.
11. Life Area detail views should use optional filters on existing module APIs and preserve normal unfiltered module pages when no `life_area_id` query param is present.

## UI Polish Checklist

1. Keep polish passes frontend-only unless the task explicitly asks for data/API changes.
2. Prefer shared Tailwind utilities (`surface-card`, `interactive-card`/`card-interactive`, `section-enter`, `tab-enter`, `list-item-enter`, `journal-enter`, `save-feedback`) and existing shadcn/Radix primitives before adding page-local styles.
3. Keep motion subtle and fast: transform/opacity only where practical, about 120-250ms for routine interactions, up to 350ms for section entrance, and up to 650ms only for Journal-specific warmth.
4. Verify mobile tabs, hub cards, and forms stack or scroll without horizontal overflow.
5. Make primary workflows visually stronger than utilities, and replace vague badges such as "Clear" with useful status text like "0 due" or "No data yet".
6. Keep Quick Add, Global Search, notification bell, and mobile More navigation reachable after shell changes.
7. Reuse `lib/motion.ts` presets for shared animation classes and keep `tailwind.config.js` scanning `lib/**/*.{ts,tsx}`.
8. Do not add `framer-motion`, GSAP usage, sound, particles, or ambient motion for routine polish unless a future task explicitly justifies it.
9. Reduced motion must leave every interaction understandable: no required state change should depend on animation.
10. Prefer `AppEmptyState` for high-visibility empty panels; use `allClear` only for genuinely calm/clear states, not errors or missing data.
11. Money summaries must show real loaded values or explicit `No data`/unavailable labels. Do not invent finance totals for empty accounts.
12. Money feature links should target `/money?tab=budget|income|investments|wishlist`; `/budget`, `/income`, `/investments`, and `/wishlist` are compatibility redirects and should not contain standalone duplicated app shells.
13. Money Overview dashboard values must be derived from user-owned data: investments, budget summary/transactions/categories, income sources, Vault renewal/expiry dates, Wishlist items, and liabilities. Keep empty states honest.
14. Preferred currency is display-only. Use `lib/currency.ts` for Money formatting and do not convert stored numeric values when `users.preferred_currency` changes.
15. Wishlist "Save for this" must create at most one linked budget goal per wishlist item through `budget_goals.wishlist_item_id`; duplicate attempts should be non-destructive.
16. Liabilities require the money dashboard migration before authenticated CRUD works in an environment. Do not run the migration unless the target database is explicitly confirmed.
17. Money Score is display-only and client-derived from already-fetched Money dashboard data. Do not write score rows or convert stored finance values.
18. Theme contrast checks must include selected/focused command, select, and dropdown rows; nested `text-muted-foreground` icons/descriptions should inherit the selected foreground.
19. Prefer theme semantic status tokens (`text-success`, `text-warning`, `text-destructive`, `text-primary`) for high-traffic status text instead of raw `text-green-*` / `text-amber-*` / `text-red-*` classes.

## Responsive Foundation Checklist

1. Use the LifeSort breakpoint contract consistently: mobile `<640px`, tablet `640-1023px`, desktop `1024-1600px`, wide `>1600px`.
2. Prefer Tailwind responsive classes; use `useBreakpoint()` only for runtime behavior such as shell mode or expand/collapse detail rows.
3. Signed-in shell expectations: desktop full sidebar, tablet icon rail, mobile bottom nav, and centered content capped around 1400px.
4. High-risk grids should start as one column, move to two columns at `sm`, and use three/four columns only from `lg` when the content fits.
5. Check 375px, 414px, 768px, 1024px, 1280px, 1440px, and 1920px widths for horizontal overflow, reachable Quick Add/Search, compact trial banner, and comfortable tap targets.

## Journal Feature Checklist

1. Journal entries must stay user-scoped through `user_id` and one row per `(user_id, journal_date)`.
2. Journal APIs should validate dates and request bodies with Zod, return `{ entry: null }` for missing dates, and never show fake saved data.
3. Journal autosave should debounce writes, show `Unsaved changes` / `Saving...` / `Saved` / error states, and keep a manual Save fallback.
4. `notes_from_today` uses the shared rich-text editor; history previews and counts should strip HTML rather than rendering stored markup.
5. Journal `tomorrow_focus` may upsert one next-day Today focus item with `source_type: "journal"`; do not overwrite three existing user-picked focus items.
6. `/api/journal/insights` must remain privacy-limited to dates, mood, star ratings, and gratitude only. Do not add rich text notes or full journal body fields to the insights response.
7. Do not add AI affirmation generation unless it follows the existing AI route pattern: session auth, usage caps, explicit provider env checks, and no automatic writes.
8. Keep Journal-specific visual polish scoped to `/journal`: warm notebook surfaces, readable writing fields, accessible star ratings, reduced-motion-safe section motion, and no global theme drift.
9. Journal star ratings must keep radiogroup/radio semantics and comfortable touch targets after styling changes.
10. When changing Journal schema or profile-backed Journal preferences, update the forward migration, `scripts/schema.sql`, `scripts/fresh-install.sql`, and `AI_TASK_LOG.md`.

## Rich Text Editor Checklist

1. Reuse `components/editor/rich-text-editor.tsx` for writing surfaces instead of adding another editor dependency.
2. Store v1 rich text as editor-generated HTML in existing `TEXT` columns unless a future task explicitly asks for a migration.
3. Preserve legacy plain-text compatibility: convert plain text for editor display, but do not rewrite old content until the user edits it.
4. Keep autosave ownership in the parent page/API flow; the editor should only debounce `onChange`.
5. Strip HTML with `lib/rich-text.ts` for previews, local search, history snippets, and character counts.
6. Link creation should reject unsafe protocols and use `rel="noopener noreferrer"` for external links.
7. AI Refine must use `/api/ai/refine-text`, require auth and `GEMINI_API_KEY`, send only selected text plus the requested action/tone, and show user confirmation before replacing or inserting text.
8. Dictation is browser Web Speech only in v1; do not add audio upload, AssemblyAI, or server transcription without a future explicit task.
9. Mobile checks should include toolbar wrapping, bubble menu behavior, contenteditable focus, dictation status, AI confirmation panels, and no horizontal overflow.

## Calendar Scheduling Checklist

1. Calendar drag scheduling must preserve source records: tasks remain tasks, local events remain calendar events, and synced Google events stay read-only.
2. Draft tasks are incomplete tasks with `due_date IS NULL`; do not add a separate draft table or status without an explicit migration request.
3. Dragging a task onto a date should update only task schedule fields needed for the move; unscheduling should clear `due_date`, `due_time`, and email reminder state.
4. Dragging a local event should update `calendar_events.event_date` while preserving its title, time, category, location, attendees, and reminder fields.
5. Mobile must include a non-drag schedule/reschedule path through buttons and a date picker or date input.
6. Verify `/api/tasks` and `/api/calendar-events` remain authenticated and user-scoped before accepting Calendar scheduling changes.

## Environment Setup Checklist

Observed env var names include:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `CRON_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ALPHA_VANTAGE_API_KEY`
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `OAUTH_TOKEN_ENCRYPTION_KEY`
- `LIVEBLOCKS_SECRET_KEY`
- `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — Cloudflare R2 (S3-compatible), used by `lib/r2.ts` / `app/api/attachments/*` for the generic attachments feature. Bucket must stay private (no Custom Domain, no Public Development URL) — all access is via short-lived presigned URLs. Only set in local `.env.local` so far; **not yet added to Vercel's project env vars** (needed before deploying attachments to production). See `AI_TASK_LOG.md` 2026-07-23 19:40 IST entry for the credential-rotation note before shipping this.
- Vercel/Neon/Postgres provisioned variables such as `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `PGHOST`, `PGUSER`, and related names.

Check only names/presence unless explicitly authorized to inspect values.

AI route env notes:

- `GEMINI_API_KEY` powers `/api/chat` and `/api/daily-content/generate`.
- `GEMINI_API_KEY` also powers `/api/templates/generate`; generated templates must remain preview-only until `/api/templates/apply` is called after explicit user confirmation.
- `GEMINI_API_KEY` also powers `/api/ai/refine-text`; the route must remain selected-text-only and read-only.
- `GROQ_API_KEY` powers `/api/investments/parse-screenshot`.
- AI routes should use the main opaque `session` cookie via `getUserFromSession()`, not JWT auth.
- The `ai_usage_events` migration must be applied before conservative per-user AI caps are enforced; code tolerates the table being absent so deploys do not fail before migration.

## AI Template Builder Checklist

1. `/templates?mode=ai` must show a generated preview before any write.
2. `/api/templates/generate` must require auth, `GEMINI_API_KEY`, `template_builder` usage limits, and Zod-validated structured output.
3. `/api/templates/apply` must require auth and re-validate the full template body before creating records.
4. Generated templates may create Spaces, Custom Sections, tasks, notes, habits, links, optional Whiteboard, and optional budget categories; do not create unrelated apps or agent flows.
5. Space links are v1-limited to item types allowed by `space_items`: notes, whiteboards, tasks, links, and custom sections.
6. Generated templates persist only after the user explicitly clicks "Save to My Templates"; same-session recent history may use `sessionStorage` but must not be treated as durable storage.
7. User-created Templates use `user_templates`; add/update the forward migration plus `scripts/schema.sql` and `scripts/fresh-install.sql` when changing that shape.
8. `/api/user-templates/[id]/use` must require auth, validate ownership, re-validate stored item JSON, and only run after a client preview/confirmation step.
9. Missing Spaces, Whiteboard, or user_templates migrations should fail gracefully and must be documented rather than worked around by changing schemas ad hoc.

OAuth token encryption env notes:

- `OAUTH_TOKEN_ENCRYPTION_KEY` is required in production. Used by `lib/token-crypto.ts` to encrypt `calendar_integrations.access_token` and `refresh_token` at rest with AES-256-GCM.
- Generate with: `openssl rand -base64 48`
- Must be set in BOTH `.env.local` (local dev) and Vercel project env vars (prod) before the next deploy or `/api/calendar/google/callback` and `/api/calendar/sync` will throw.
- In dev (`NODE_ENV !== 'production'`), a missing key triggers a one-time console warning and falls back to plaintext pass-through so local work isn't blocked.
- Legacy plaintext rows are decrypted as pass-through; they self-encrypt on next token refresh (Google access tokens expire after ~1 hour).
- Key rotation: the storage format starts with `v1:` so a future migration can re-encrypt with a new key.

Liveblocks env notes:

- `LIVEBLOCKS_SECRET_KEY` is server-only and powers `/api/liveblocks-auth` for collaborative Whiteboard rooms.
- Do not expose the secret through `NEXT_PUBLIC_*`, client code, docs, or committed files.
- Whiteboard room ids use `lifesort:whiteboard:{whiteboardId}` and must be authorized exactly, never with wildcard access.
- Public Whiteboard share links are login-gated and grant viewer access only unless a separate collaborator row grants editor.

## Commands

- Install: `pnpm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Start production server: `npm run start`
- Lint: `npm run lint`

Dependency notes:

- Drag-and-drop list sorting uses `@dnd-kit/core`, `@dnd-kit/sortable`, and `@dnd-kit/utilities`. Prefer the shared `components/sortable-list.tsx` wrapper before adding another drag implementation.
- Collaborative Whiteboard uses `@liveblocks/client`, `@liveblocks/react`, and `@liveblocks/node`; do not add a large canvas/whiteboard dependency unless a future task explicitly justifies it.
- Rich text writing surfaces use Tiptap through `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-link`, and `@tiptap/extension-placeholder`.

Test/lint status (updated 2026-07-24 — see `AI_TASK_LOG.md` for the full setup story):

- `npm test` runs Vitest (`vitest run`). Config: `vitest.config.ts` (Node environment, `@/` alias, dummy `DATABASE_URL` test env so `lib/auth.ts`/`lib/db.ts` import cleanly without a real database). First suite: `lib/auth.test.ts` (12 tests) + `app/api/tags/route.test.ts` (8 tests, mocking `@/lib/auth` and `@/lib/db`).
- `npm run lint` runs via `eslint.config.mjs` (flat config, imports `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` directly — no `FlatCompat` needed since `eslint-config-next@16` ships native flat arrays). Requires `eslint@9.x` — **ESLint 10 is not yet supported by `eslint-plugin-react`** (confirmed via its published `peerDependencies`), so do not bump past ESLint 9 until that changes. Currently reports 293 pre-existing findings (186 errors, 107 warnings) — first-ever lint run against this codebase, not yet cleaned up.

Unavailable scripts:

- No `typecheck` script is defined.
- No `format` script is defined.
- No database migration runner script is defined.

Database scripts:

- SQL files live in `scripts/`.
- Do not run them automatically.
- Canonical schema: `scripts/schema.sql`. Use for fresh-DB setup only.
- Forward-only additive migrations: `scripts/migrations/YYYY-MM-DD-<name>.sql`. Apply in date order to existing databases.
- Legacy SQL files: `scripts/legacy/` — kept for archaeology only, do NOT run.
- `scripts/legacy/setup-database.sql` is incompatible with the current schema (uses `SERIAL` user_id). Never run it.
- See `scripts/README.md` for the full workflow.

## Whiteboard Feature Checklist

1. Apply `scripts/migrations/2026-05-20-whiteboards.sql` before testing create/open flows against a database.
2. Confirm `LIVEBLOCKS_SECRET_KEY` is set before testing realtime room join; missing local secret should show a friendly setup error.
3. Verify `/api/liveblocks-auth` returns 401 unauthenticated and never grants wildcard access.
4. Verify owner/editor can draw while viewer can only pan/zoom/watch.
5. Verify two tabs show presence cursors and committed elements persist after refresh.
6. Verify login-gated share links create viewer access only, and explicit collaborator roles control edit access.

## Spaces Feature Checklist

1. Apply `scripts/migrations/2026-05-20-spaces.sql` before testing `/spaces` create/link flows against a database.
2. Verify `/api/spaces` and `/api/spaces/[id]/items` return 401 unauthenticated and remain scoped to the current user.
3. Verify Spaces link existing notes, whiteboards, tasks, projects, links, and custom sections without duplicating or deleting source records.
4. Verify creating inside a Space creates the normal source record first and then adds a `space_items` link.
5. Verify deleted or inaccessible linked items render gracefully as unavailable in the Space detail page.
6. Verify `/spaces` and `/spaces/[id]` highlight Workspace and Workspace > Boards & Spaces links to Spaces.

## Current Command Behavior

Known as of 2026-07-24 (supersedes the 2026-05-17 lint/test lines below):

- `npm run build` passes.
- `npm run build` skips TypeScript validation and linting because of `next.config.mjs`.
- `npm run build` emits warnings that `metadata.themeColor` and `metadata.viewport` should move to viewport exports.
- `npm run lint` now runs (see "Test/lint status" above) and exits non-zero due to 293 pre-existing findings, not a config failure.
- `npm test` now runs Vitest and passes (20/20 tests).

## Pre-Change Checklist

1. Read all AI memory files.
2. Check `git status --short`.
3. Understand the requested scope.
4. Identify affected files.
5. Summarize relevant repo state.
6. List expected files to modify.
7. Identify risks, unknowns, and verification commands.
8. Confirm the approach is minimal and focused.
9. Avoid unrelated changes.

## Post-Change Checklist

1. Review `git diff`.
2. Run relevant checks:
   - Usually `npm run build`.
   - Run `npm run lint` when touching source, but note the current known config failure.
   - Run targeted manual checks if command coverage is missing.
3. Fix errors caused by the change.
4. Document unrelated existing failures separately.
5. Update `AI_TASK_LOG.md`.
6. Update `AI_PROJECT.md`, `AI_DECISIONS.md`, or this file when product scope, architecture, setup, commands, dependencies, or workflow changed.
7. Provide a clear handoff summary.

## Pre-Commit Checklist

1. Confirm no secrets are included.
2. Confirm no unrelated files were edited.
3. Confirm docs and task log are updated.
4. Confirm commands and failures are recorded.
5. Confirm database scripts were not run accidentally.
6. Confirm large generated artifacts like `.next/`, `node_modules/`, and `*.tsbuildinfo` are not staged.

## Debugging Workflow

1. Reproduce with the narrowest command or route.
2. Check browser console or server output for the first real error.
3. Inspect the relevant page, component, route handler, and schema columns.
4. For auth issues, inspect `lib/auth.ts`, `components/auth-provider.tsx`, and the relevant `app/api/auth/*` route.
5. For database issues, compare queries against `scripts/schema.sql`.
6. For integration issues, check env var presence and provider response handling without logging secrets.
7. Make the smallest fix that addresses the failure.
8. Re-run the targeted verification.

## Deployment Verification Checklist

1. Run `npm run build`.
2. Review build warnings.
3. Confirm required env vars are configured in the deployment environment.
4. Confirm Vercel cron path `/api/cron/deadline-reminders` still exists after route changes.
5. Verify auth-sensitive routes still use the expected `session` cookie flow.
6. Verify any new database columns/tables have explicit migration instructions.
7. Verify external API changes have failure handling.
8. For AI routes, verify unauthenticated calls return `401`, missing provider keys return a clear `503`, malformed payloads return `400`, and rate-limited calls return `429`.
9. **Confirm `ai_usage_events` table exists in the live database before enabling AI features.** If the table is missing, all per-user AI rate limits are silently bypassed — `lib/ai-usage.ts` catches the missing-table error and returns `allowed: true` so that deploys don't fail before migrations, but this means unlimited AI calls until the migration runs. Run `SELECT COUNT(*) FROM ai_usage_events` on the live Neon database to verify.
9. For schema-spanning features, add a new dated file to `scripts/migrations/` AND mirror the CREATE/ALTER content into `scripts/schema.sql`. Document that migrations were not run automatically.
10. For capture/conversion features, verify every API is authenticated, every read/write is scoped by `user_id`, optional Life Area IDs are ownership-validated, and target record creation requires explicit user confirmation before writing structured module data.
11. For date-based tracker features, verify dashboard counts and filters exclude closed statuses, all optional linked IDs are ownership-validated, Global Search remains user-scoped, Quick Add posts a minimal valid payload, and Universal Capture only creates editable drafts before confirmation. For recurring trackers, verify completion advances the next due date from the completion date.
12. For derived timeline/search features, verify no duplicate timeline table is introduced unless manual events are explicitly requested, every source query is user-scoped, missing source tables fail softly, and Global Search uses the same derivation path as the timeline API.
13. For reset/bulk-cleanup features, verify every bulk action is explicitly confirmed, each item is rechecked by `user_id` at write time, destructive deletes are called out separately, AI suggestions are read-only until selected by the user, and recovery-plan writes reuse Today Plan focus items instead of duplicating plan data.
14. For user preference/rules features used by AI, verify the rules are visible/editable by the user, scoped by `user_id`, included in the schema baseline and pending migration script, and only read by AI routes unless the user explicitly confirms a write.
15. For read-only AI insight features, derive source signals server-side with `user_id` filters, tolerate missing newer tables with partial results, rate-limit through `ai_usage_events`, and keep all suggested writes behind explicit user confirmation.
16. For app-aware AI chat features, gather context server-side with `user_id` filters, cap the prompt context, avoid sending sensitive long-form content unless explicitly approved, expose citations for items used, and keep generated actions as confirmed drafts.
17. For capacity or wellness-adjacent planning features, keep language practical and non-medical, store only user-entered planning labels, and verify AI prompts do not make health claims.
18. For score/health-signal-style dashboard features, keep components explainable, user-scoped, non-shaming, and resilient to missing optional module tables; store history only in explicit snapshot tables and document migrations before use.

## Common Failure Points

- Missing ESLint flat config.
- Type errors hidden by `typescript.ignoreBuildErrors`.
- Lint errors hidden by `eslint.ignoreDuringBuilds`.
- Schema drift between SQL scripts and live database.
- Auth mismatch between `session` token and routes expecting `session_id` or JWT.
- Missing provider env vars for email, AI, finance, and calendar features.
- Arbitrary URL fetch behavior in URL preview.
- External API rate limits or provider downtime.

## What To Do When a Command Fails

- Capture the command and the important error summary in `AI_TASK_LOG.md`.
- Determine whether the failure is caused by the current change or is pre-existing.
- Fix failures caused by the current change before handoff.
- If the failure is pre-existing and outside scope, document it clearly and do not bury it.
- If a command needs network or external credentials, say what is missing and avoid printing secrets.

## Recurring DB/API Safety Checks

Run periodically (before major releases, after schema/migration changes, and as part of any future pre-Agents-style audit). Each check below maps to a finding from `AI_AUDIT.md` (2026-05-17). Re-running these catches regressions and confirms drift is being closed.

### Schema drift checks
```bash
# 1. Every table CREATE used by code must exist in at least one SQL file.
grep -rhoE 'FROM [a-z_]+|INTO [a-z_]+|UPDATE [a-z_]+|JOIN [a-z_]+' app/api/**/*.ts \
  | awk '{print $2}' | sort -u > /tmp/code-tables.txt
grep -hE 'CREATE TABLE( IF NOT EXISTS)? [a-z_]+' scripts/*.sql \
  | sed -E 's/.*CREATE TABLE( IF NOT EXISTS)? ([a-z_]+).*/\2/' | sort -u > /tmp/sql-tables.txt
# Any line in /tmp/code-tables.txt missing from /tmp/sql-tables.txt is a schema gap.

# 2. user_id type consistency — all user-owned tables should use VARCHAR(255).
grep -E 'user_id (INTEGER|SERIAL|UUID)' scripts/*.sql
# Any hit (other than setup-database.sql, which is now legacy) is a drift.
```

### API auth/scoping checks
```bash
# 3. Every protected route should import getUserFromSession or check session somehow.
for f in $(find app/api -name route.ts); do
  if ! grep -q 'getUserFromSession\|cron\|share\|stock-quote\|investments/popular' "$f"; then
    echo "Route may be unprotected: $f"
  fi
done

# 4. SELECT/UPDATE/DELETE on user-owned tables must have user_id filter.
# Inspect manually for any sql template that touches tasks/goals/notes/etc.
# without `WHERE ... user_id = ${user.id}`.
```

### Security regression checks
```bash
# 5. Cookie name must be 'session' everywhere except (intentionally) legacy code.
grep -rn 'session_id\|cookies().get("session_id")' app/api/

# 6. No console.log/error should print full `tokens` or full request bodies.
grep -rn 'console\.\(log\|error\).*\(tokens\|password\|secret\|body\)' app/

# 7. CRON_SECRET check should use timing-safe equality.
grep -rn 'CRON_SECRET' app/api/cron/

# 8. URL preview must block private IPs / loopback (look for safeFetchUrl or equivalent).
grep -rn 'safeFetchUrl\|private.*ip\|loopback\|169\.254' app/api/url-preview/
```

### Integration health checks
```bash
# 9. AI routes must call checkAiUsageLimit before invoking model.
for f in $(find app/api/ai app/api/chat app/api/daily-content/generate -name route.ts); do
  if ! grep -q 'checkAiUsageLimit' "$f"; then
    echo "AI route missing rate-limit guard: $f"
  fi
done

# 10. No hardcoded provider URLs that bypass env-var config.
grep -rn 'api\.openai\.com\|api\.groq\.com\|openrouter\.ai' app/ lib/
```

### Pre-Agents go/no-go check
Run before any Agents feature work:
- ☐ `AI_AUDIT.md` §N1 (CRON_SECRET fall-through) — fixed
- ☐ `AI_AUDIT.md` §N2 (OAuth state validation) — fixed
- ☐ `AI_AUDIT.md` §N3 (URL preview SSRF) — fixed
- ☐ `AI_AUDIT.md` §N4 (canonical schema consolidation) — fixed
- ☐ `AI_AUDIT.md` §N5 (`agent_action_events` table) — created
- ☐ `npx tsc --noEmit` passes
- ☐ `npm run build` passes
- ☐ Manual smoke test of every feature page (HTTP 200 expected)

All five Ns must be checked before Agents UI work begins.

## General Verification Flow

Before changes:

1. Read `AGENTS.md` and all `AI_*.md` files.
2. Check current git status.
3. Understand the task scope.
4. Identify affected files.
5. Avoid unrelated changes.

After changes:

1. Review git diff.
2. Run relevant checks.
3. Fix errors caused by the change.
4. Document any unrelated existing failures.
5. Update `AI_TASK_LOG.md`.
6. Provide a clear handoff summary.
