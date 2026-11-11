# AI_TASK_LOG.md

Every AI agent must update this file after making changes to the repo.

This file is the working memory and handoff log. Do not rely on chat history as the source of truth.

Keep it short. Entries dated before 2026-10 were moved word for word to `AI_TASK_LOG_ARCHIVE.md` on 2026-11-11. Search the archive when checking whether a migration or fix was already tried. When this file grows past roughly 100 KB, move the oldest entries there too.

## Current Status

LifeSort is a broad Next.js App Router application with many implemented product areas and a Vercel-oriented deployment. The repo now has persistent AI memory files in the project root.

Current verification state (2026-10-28):

- `npm run build` passes with TypeScript validation now actually enforced (`next.config.mjs`'s `typescript.ignoreBuildErrors` is `false`; `tsc --noEmit` is clean). `eslint.ignoreDuringBuilds` remains `true` — 65 pre-existing lint findings remain (down from 293 originally; see the 2026-07-25 ESLint cleanup entry, and 66 → 65 in the 2026-10-28 design pass), every one a reviewed-and-commented `react-hooks/set-state-in-effect` exception (either a real state transition or a function intentionally shared with non-effect call sites). It still exits non-zero; that is expected and not a blocker.
- `npm run lint` runs cleanly via `eslint.config.mjs` (ESLint 9.x + `eslint-config-next@16`) — it exits non-zero on real findings, it does not fail to run.
- `npm test` runs Vitest: 104/104 tests passing across 7 suites (`lib/auth.test.ts`, `lib/date-math.test.ts`, `app/api/tags/route.test.ts`, `app/api/item-relationships/route.test.ts`, `app/api/tasks/[id]/checklist-items/route.test.ts`, `app/api/tasks/[id]/recurrence/route.test.ts`, `app/api/tasks/route.test.ts`).
- `npx tsc --noEmit` is clean.

## Completed Work

### 2026-11-11 18:30 IST - Live usage check, task log archive, user answers on Stage 1

- **Agent/tool used:** Claude Code (Opus 5.5).
- **Task completed:** The user allowed the read-only row count and the task log cleanup, then answered the open questions with tick options: they stopped using LifeSort, Spaces and Custom Sections get removed, Waiting, Someday, Commitments and Maintenance fold into Tasks and their tables get dropped, Daily Content stays hidden, everything is free for now, kits get decided later, and Stage 1 starts now.
- **Usage check:** `psql` against `DATABASE_URL_UNPOOLED` with `default_transaction_read_only=on`. The pooled URL rejects startup options, so use the unpooled one for this. The query counted total rows, distinct `user_id` and rows from the last 90 days for every public table. Results: 2 users, 3 tasks, 26 life_areas, 2 journal entries, 1 whiteboard, a few notifications, sessions, AI usage events and daily content rows. Every other feature table had 0 rows and nothing was created in the last 90 days. The last session was 2026-05-20 and the last journal entry 2026-06-03. `vercel env ls` shows `DATABASE_URL` is one value for Production, Preview and Development, so this is production. No secret values were printed.
- **Files changed:**
  - `AI_TASK_LOG.md`: split. Lines 1 to 72 stay, and new short Active Bugs, Known Risks and Architecture Concerns sections replace the stale May ones. Added this entry.
  - `AI_TASK_LOG_ARCHIVE.md` (new): the old lines 73 to 5075, word for word (checked with `diff`).
  - `AGENTS.md`, `CLAUDE.md`: point at the archive.
  - `AI_BUILD_PLAN.md`: Part 0 has the usage finding, a reworked Stage 1, a "Retiring empty tables" section replacing the slow data-merge track, the user's answers and Part B #18.
  - `AI_DECISIONS.md`, `AI_MARKET_RESEARCH.md`, `AI_PROJECT.md`: usage finding and decisions.
- **Commands run:** the read-only `psql` queries above, `vercel env ls` (names and environments only) and `diff` checks on the archive split. No code changed, so `npx tsc --noEmit` and `npm run build` were not run.
- **Suggested next steps:** Stage 1 step 2, merging Home into Today with the messy-week rules.

### 2026-11-11 17:50 IST - Product direction: competitor research, consolidation plan, Claude as the only agent

- **Agent/tool used:** Claude Code (Opus 5.5). From this session on, Claude Code is the only AI agent on this repo (user decision).
- **Task completed:** The user said LifeSort is "too scattered" and asked for a consolidation plan built on the current features. They also wanted research on what competitors do that LifeSort is missing, and what LifeSort can do that nobody does well. They then set the direction: LifeSort is for everyday people, should be the simplest to use, should fit into people's lives through our templates, and ships as an installable web app. They asked for all of this to be saved and made Claude the only AI working on the repo.
- **Research done:** web search across about 30 competitors and sources (Lunatask, TickTick, Todoist, Griply, Sunsama, Motion, Akiflow, Tiimo, Saner, Rosebud, Apple Journal, Exist, TimeAlign, life admin apps, Dex, Expensebit, Notion, ChatGPT), plus a DEV search. Reddit could not be searched. Most sources are vendor or affiliate content, which is flagged in the research file.
- **Files changed:**
  - `AI_MARKET_RESEARCH.md` (new): target user, competitor landscape, what competitors have that LifeSort lacks, where nobody does it well, threats, price snapshot, sources.
  - `AI_BUILD_PLAN.md`: new Part 0 with the direction, rules for every change, the 7-place layout, a 6-stage build order, the data-merge track, a freeze list, the Part C mapping and open questions. Part B gained decisions 13 to 17. "How to use this file" now says to start at Part 0.
  - `AI_DECISIONS.md`: new "Product Direction: Everyday Simplicity, Life Kits, Installable Web App (2026-11-11)" section.
  - `AI_PROJECT.md`: Planned Work points at Part 0 and the research file.
  - `CLAUDE.md`: rewritten. Claude Code is the only agent, and the Codex primary/fallback rules are gone.
  - `AGENTS.md`: notes the single-agent setup and the new files, and adds two rows to the Memory Reference Guide.
  - `AI_TASK_LOG.md`: this entry.
- **Commands run:** `git status --short --branch` (clean on `design/declutter-shell-home`, one commit ahead of `main`, before starting). Created branch `docs/product-direction` from it. `npx tsc --noEmit` and `npm run build` were not run because this change is docs only and touches no code.
- **Bugs found or fixed:** none.
- **Remaining issues / known limitations:** nothing in the plan is built yet. Open questions for the user are listed in `AI_BUILD_PLAN.md` Part 0. `AI_CHECKLIST.md` still has Codex kickoff and handoff prompts, left in place as history.
- **Suggested next steps:** Stage 1 of `AI_BUILD_PLAN.md` Part 0. Start with the read-only row count once the user says yes, then merge Home into Today with the messy-week rules.
- **Handoff notes:** an earlier answer in the same session recommended freezing templates. The user's direction reversed that, and templates are now the core (Life Kits, Stage 3). Follow Part 0, not the earlier answer.

### 2026-10-28 13:45 IST - Design pass: declutter the shell, Home and hubs; motion; accessibility

- **Agent/tool used:** Claude Code (Opus 5.5) as implementing agent (`CLAUDE.md` fallback mode: the user explicitly asked Claude to improve the design directly, using the `impeccable` design skill).
- **Task completed:** User request: "improve its design, use the design skills and impeccable to make it more usable, remove excess clutter, add some animations and ease of access." Scoped to the surfaces every session touches: the app shell (sidebar, top bar, mobile nav), Home, the Workspace/Money hub pages, the Life Domains overview widget, the notification bell, the theme switcher, and global CSS/viewport. No API, schema, or data-flow changes.
- **Files changed:**
  - `app/globals.css`: added the missing base rule `* { border-color: hsl(var(--border)) }` (see Bugs found); themed text selection, caret and scrollbars from the palette; a generic `.collapsible-content` open/close animation (generalized from the journal one); `.nav-indicator` transition and a no-JS fallback fill for the active nav row; `.bar-grow` keyframe for data bars; a `prefers-reduced-motion` block that keeps tailwindcss-animate fades but zeroes their translate/scale/rotate, and disables the new animations.
  - `app/layout.tsx`: viewport no longer sets `maximumScale: 1` / `userScalable: false` (pinch zoom was blocked, a WCAG 1.4.4 failure; inputs are already 16px on mobile so iOS won't auto-zoom); `themeColor` changed from the old violet `#8b5cf6` to the DESIGN.md canvas colors for light and dark.
  - `components/dashboard-layout.tsx`: removed the per-page "Good Evening, X!" greeting `h1` from the top bar (it duplicated Home's greeting and gave every page two `h1`s); removed the duplicate Settings icon from the top bar and the sidebar footer (Settings is already a nav item); removed the raw `ID: <uuid>` line under the user name (now shows email); solid wordmark instead of gradient text; skip-to-content link + `main#main-content`; `aria-label`s on the sidebar/nav landmarks; `aria-current="page"` on active links; rail mode hides labels with `sr-only` instead of `hidden` so links keep accessible names; sign-out button has a real label; new shared nav highlight that glides between items across page navigations (module-level last-position cache, DOM writes in a layout effect, no extra renders, StrictMode-safe via a `data-seeded` flag); collapsed-rail state cached at module level so it no longer flashes open on every navigation; removed entrance animations from persistent chrome (top bar, mobile bottom bar, mobile Quick Add button), which replayed on every page change because each page mounts its own `DashboardLayout`; search trigger moved left and shows `Ctrl K` on non-Mac platforms (`useSyncExternalStore`, no hydration mismatch); mobile bottom nav gets `aria-current`, larger icons and safe-area padding; the mobile More sheet is a flat list and now includes Sign out (there was no way to sign out on mobile outside Settings).
  - `app/page.tsx` (Home): rewritten render. Greeting + date with two actions (Plan my day, Journal); "Today's focus" list and an "At a glance" list (overdue tasks, habits due, budget used, next event, each row now links to its page) side by side; "Needs attention" (the old Pending card) with pill filters using `aria-pressed`, next to Life domains; one disclosure row for LifeScore, Journal, Money and Recent activity (open state remembered for the session). Removed: the Quick Access section (6 shortcut cards + More actions menu + "Recently used" + a "Pinned favorites are reserved" placeholder), which duplicated the sidebar and command palette; the "Open Today" card (duplicated focus + glance); the Notifications card (duplicated the bell) and its `/api/notifications` fetch; the three big Add Task / Capture Thought / Open Journal buttons (Quick Add in the top bar and the mobile + button cover add/capture); the "Secondary dashboard cards · N signals" label; the `QuickAddModal` instance and quick-access localStorage code. Sections use real `h2` headings and `aria-busy` while loading; no nested cards.
  - `components/domain-today-overview.tsx`: same section/list styling as Home; adds an "All domains" link; collapsible content animates. Still collapsible; also used on `/today`.
  - `components/hub-page.tsx`: `HubHero` is a plain page header (no card, no eyebrow; the description crossfades when tabs change). `HubGrid` renders destinations as a dense two-column list launcher instead of a grid of equal-size cards; zero-count status pills ("0 overdue", "0 today", "No data yet") are no longer shown. Removed the unused `FavoritesTodo` placeholder and the unused `eyebrow` prop on `SectionHeader`.
  - `app/workspace/page.tsx`, `app/money/page.tsx`: `HubHero` now titled "Workspace" / "Money" (the page name) with the tab description underneath; dropped the Pinned favorites placeholder from every Workspace tab.
  - `components/notification-bell.tsx`: notification rows were clickable `div`s (not keyboard reachable); now `button`s with an sr-only "Unread:" prefix; read items no longer use `opacity-60` (failed contrast); unread badge uses the destructive token; bell `aria-label` includes the unread count; "View all" is `Button asChild` instead of a button nested in a link.
  - `components/theme-switcher.tsx`: menu is a radio group so the current theme is checked; trigger is always rendered (it used to return `null` until mounted, which shifted the top bar on every navigation) and is a ghost button like the bell.
  - `AI_TASK_LOG.md`, `AI_DECISIONS.md`, `AI_CHECKLIST.md`, `AGENTS.md`, `DESIGN.md`: this entry, a decision entry, the mocked-API verification recipe, the lint count, and two design rules.
- **Bugs found and fixed:**
  - **Dark mode borders were light gray app-wide.** `app/globals.css` never had shadcn's `* { border-color: hsl(var(--border)) }` base rule (it only exists in the unused legacy `styles/globals.css`), so every bare `border` class fell back to Tailwind's `gray-200` and glared in dark mode. Light mode was nearly identical by coincidence, which is why the 2026-07-24 token migration's light-only visual check missed it.
  - Sidebar rail flashed open on each navigation when collapsed (localStorage read in an effect on every mount).
  - Top bar shifted on each navigation (theme switcher rendered nothing until mounted).
  - Shell entrance animations replayed on every page change.
- **Commands run:**
  - `npx tsc --noEmit`: passed, no output.
  - `npm run build`: passed, compiled successfully, no warnings. `/` First Load JS 205 kB.
  - `npm test`: 104/104 passed (7 files).
  - `npm run lint`: 65 problems (down from 66; the Home quick-access localStorage effect was removed). All remaining are the existing commented `react-hooks/set-state-in-effect` cases; the comments on the two touched ones (sidebar collapsed hydration, theme switcher) were updated.
  - Visual verification with Playwright against `npm run dev` on port 3210, with **every `/api/**` request mocked by `page.route`** (fake user + fake data), so no account was created and nothing touched the database. Screenshots of Home, Workspace (desktop 1440 and mobile 390, light and dark), Home with the disclosure open, rail mode, mobile More sheet, the skip link and keyboard focus. Sampled the nav highlight's computed `translateY` during a Home → Workspace navigation: it eases 23 → 71 → 112 → ... → 210 with motion allowed, and jumps 23 → 210 with `prefers-reduced-motion: reduce`. Verified the rail stays 72px wide immediately after navigating.
- **Remaining issues / known limitations:**
  - `/today` (2,049 lines) was not redesigned in this pass beyond the shared shell and the domain widget it embeds; it still uses the older card-heavy style. Other feature pages likewise only inherit the shell, border, focus and motion fixes.
  - The mocked-API Playwright run of `/today` crashed on a mock that lacked `candidates.todayToDo`; that is a gap in the test mock, not an app bug, but it means `/today` was not visually re-checked.
  - DESIGN.md's Source Serif 4 / Geist Mono fonts are still not wired up (pre-existing gap, out of scope).
  - `HubCard.priority` and `zeroLabel` are still accepted but no longer change rendering.
- **Suggested next steps:** Apply the same declutter pattern to `/today` (it repeats focus/due/calendar summaries in several cards) and to the Money overview tab; then a page-by-page dark-mode sweep now that borders are fixed.
- **Handoff notes:** Home's removed Quick Access section can be restored from git history if the user wants it back. The nav highlight logic lives in one `useIsomorphicLayoutEffect` in `dashboard-layout.tsx`; it keys off `data-active="true"` on nav links and `data-indicator`/`data-seeded` on its own elements, so keep those attributes if the nav markup changes.

## Active Bugs / Issues

- No known code bugs. Last full check was 2026-07-25 (see `AI_TASK_LOG_ARCHIVE.md`).
- Attachments are not deploy-ready. The `R2_*` env vars exist only in `.env.local`, not in Vercel, and the R2 token there was exposed in a past chat and should be rotated. Stage 4 of `AI_BUILD_PLAN.md` Part 0 depends on this.
- `npm run lint` reports 65 reviewed `react-hooks/set-state-in-effect` findings and exits non-zero. Expected, not a blocker.

## Known Risks

- Secrets must never be copied from `.env.local` into docs or logs.
- Database scripts should not be run without explicit environment confirmation. `.env.local` points at the production database, which every Vercel environment shares.
- Integration routes rely on external services and API limits.
- Subscription/admin behavior should be changed carefully because it affects account access.

## Architecture Concerns

- Raw SQL is duplicated across many route handlers.
- Schema migration history is spread across many SQL files with overlapping changes.
- Client pages hold large amounts of local state and fetch logic. `/today` alone is about 2,000 lines.
- Tests cover `lib/auth.ts`, `lib/date-math.ts` and the tags, tasks, checklist-items, recurrence and item-relationships routes. Most other routes have no tests.
