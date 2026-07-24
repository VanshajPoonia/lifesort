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

## AI Provider Migration (2026-07-23)

- Decision: Replace OpenRouter with direct Google Gemini API calls for all AI text/structured-output features.
  - Evidence: `lib/ai-provider.ts` exports a shared `gemini` client via `createGoogleGenerativeAI` (`@ai-sdk/google`), reading `GEMINI_API_KEY`. All 12 previous `createOpenAI({ baseURL: "https://openrouter.ai/api/v1" })` call sites (`/api/chat`, `/api/ai/*`, `/api/daily-content/generate`, `/api/templates/generate`) now import this shared client instead of constructing their own OpenRouter client.
  - Rationale: user-requested provider switch; simplifies to a single AI provider and removes the OpenRouter routing layer/attribution headers.
  - Model ids changed from OpenRouter aliases (e.g. `google/gemini-2.0-flash-exp:free`, `openai/gpt-4o-mini`) to the native Gemini model id `gemini-3.5-flash`, used by every AI route in the app. `lib/ai-models.ts` `AVAILABLE_MODELS` lists only this one model; the GPT/Claude/free-router options in the LifeSort Coach model picker no longer exist, and a Gemini Pro option was tried (`gemini-pro-latest`) and then explicitly removed by the user — Flash is the only tier LifeSort uses. `GEMINI_FLASH_MODEL` in `lib/ai-provider.ts` is currently unused dead code (each route keeps its own local `_MODEL` constant); leave it unless a future task consolidates them.
  - `OPENROUTER_API_KEY` is superseded by `GEMINI_API_KEY` everywhere. The old key/env var may still exist in `.env.local`/Vercel but is no longer read by any route.
  - `gemini-3.5-flash` is a specific dated model generation, not a `-latest` alias, so it will eventually be deprecated the same way `gemini-2.5-flash` already was by the time of this migration. Verify current Gemini model ids against Google's live `ListModels` endpoint before assuming this id still resolves.

## Life Domains Product Direction (2026-07-23)

- Decision: Rename and expand "Life Areas" into "Life Domains" as a single evolving feature, not a new parallel one.
  - Evidence: `AI_LIFE_DOMAINS_SPEC.md` (new) is the full product spec. It is explicit that the existing `life_areas` table, `app/life-areas/*` routes, and `components/life-area-controls.tsx` are the Phase 1 baseline for this work, and lists an "Explicit Non-Duplication Checklist" that must be satisfied before implementation starts.
  - Rationale: user supplied a detailed Life Domains product spec and required it be integrated into the existing spec without creating a duplicate feature.
  - Status: **Phase 1 implemented 2026-07-23** (`AI_TASK_LOG.md` 13:40 IST entry) — `app/life-areas/*` routes deleted and replaced by `app/domains/*` with compatibility redirects; `life_areas` table, `/api/life-areas` route, and `lib/life-areas.ts`/`life-area-controls.tsx` module names deliberately kept as-is per the spec's "avoid two names mid-flight" rule (only user-facing copy and page routes renamed so far). **Phase 2 implemented 2026-07-23** (`AI_TASK_LOG.md` 15:45 IST entry) — journal/calendar association, domain reviews, `is_ai_excluded` AI privacy enforcement across every AI context builder, desired-attention nudges. **Phase 3 implemented 2026-07-23** across two entries (`AI_TASK_LOG.md` 17:10 IST — `requires_reauth` enforcement and subdomains UI/depth-1 server-side enforcement; 18:30 IST — domain focus mode and domain templates). All three migrations are **applied to the live database** (confirmed via `\d` checks); focus mode and domain templates needed no schema changes (`life_area_id` already existed on every table touched). Remaining (deliberately deferred, not asked for): Life Balance deepening, domain AI summaries, proactive capture suggestions, cross-domain insights.
  - **Domain Focus Mode architecture decision (2026-07-23):** the focus context (`components/domain-focus-provider.tsx`) is mounted in `app/layout.tsx`, not inside `components/dashboard-layout.tsx`. Reason: pages like `app/today/page.tsx` render `<DashboardLayout>{...}</DashboardLayout>` — the page is DashboardLayout's *parent* in the React tree, so a context provided from within DashboardLayout would not be visible to a hook called at the top of the page component. Any future feature needing global client state visible to both the shell (header/sidebar) and individual pages must follow the same pattern: mount above `DashboardLayout` usage, in `app/layout.tsx`. Filtering (Today, search/⌘K) is done entirely client-side per `AI_LIFE_DOMAINS_SPEC.md` §9's explicit instruction ("a client-side filter over the same tables, not a new planning engine") — no new query params or server-side WHERE clauses were added; the today-plan and search APIs were only extended to additively include `life_area_id` in their existing SELECT lists so the client has something to filter on.
  - Any future work on domains/dashboards/tabs/onboarding-domain-step/desired-attention/domain-focus-mode must consult `AI_LIFE_DOMAINS_SPEC.md` first and extend the existing schema/routes rather than adding new ones.

## Generic Tags Kept Separate From Existing Per-Table Tag Columns (2026-07-23)

- Decision: New `tags`/`item_tags` tables (polymorphic, `item_type` in `task`/`goal`/`project`) were added for object types with no tagging today. The existing `TEXT[]` tag columns on `notes`, `people`, `vault_items`, and `budget_transactions` were **not** migrated or touched.
  - Evidence: `scripts/migrations/2026-07-23-generic-tags.sql`, `app/api/tags/route.ts`, `app/api/item-tags/route.ts`, `components/tag-picker.tsx`, wired into `app/tasks/page.tsx` only.
  - Rationale: migrating the existing columns would mean rewriting working tag UI on 4 features and migrating live data — a real architecture change, not "polish." `AGENTS.md` says to avoid unrelated refactors and preserve existing architecture without a documented reason to change it. This entry is that documentation, should someone later want the full consolidation.
  - Status: tags/item_tags tables live in production. Goals and Projects can use the same `TagPicker` component and `/api/item-tags` contract but aren't wired in yet.
  - If a future task wants one unified tag system across every object type, that is a distinct, larger task (data migration + UI rewrite on notes/people/vault/budget) and should be scoped and confirmed explicitly before starting — do not do it opportunistically while touching one of those features for something else.
  - **Follow-up (2026-07-24):** `AI_BUILD_PLAN.md` Phase 1's "Wire Tags + Attachments into Goals/Projects/Notes" bullet initially reads as if Notes needed the generic `TagPicker` wired in too. It does not — this decision already excluded Notes on purpose. Implemented: `TagPicker` + `item_tags` wired into the Goal modal and Project detail page only (`task`/`goal`/`project` — no CHECK-constraint or schema change needed, both already allowed these three). Notes got **Attachments only** (`attachments` already allowed `'note'` in its CHECK constraint); its existing `TEXT[]` tags UI was left untouched. If a future roadmap doc again implies "add generic tags to Notes," treat that as the doc being imprecise, not as new instruction — re-confirm against this entry first.

## File Attachments: Cloudflare R2, Private Bucket, Presigned URLs Only (2026-07-23)

- Decision: attachments are stored in Cloudflare R2 (not Vercel Blob, not Postgres) via `lib/r2.ts`, `app/api/attachments/*`. The bucket (`lifesort`, EU jurisdiction) is kept fully private — no Custom Domain, no Public Development URL. Every read/write goes through a short-lived (5 min) presigned URL issued by our API only after verifying the requesting user owns the parent item.
  - Evidence: `scripts/migrations/2026-07-23-attachments.sql`, `lib/r2.ts`, `app/api/attachments/route.ts`, `app/api/attachments/[id]/route.ts`, `components/attachment-list.tsx`, wired into `app/vault/page.tsx` only.
  - Rationale: R2 was the user's explicit choice (offered Vercel Blob first as the lower-friction, same-platform option, but the user chose R2). Presigned URLs rather than routing file bytes through our own API/Vercel function avoids Vercel's request body size limit and keeps large uploads fast; keeping the bucket private (rather than a public bucket/custom domain, which the user nearly set up) matches the "validate ownership via `user_id`" convention used everywhere else in the app — a public bucket would have bypassed that entirely.
  - **Known issue, must fix before production use:** the R2 API token currently in `.env.local` was pasted into the chat transcript during setup and is compromised. The user chose to reuse it once rather than block on generating a fresh one immediately ("reuse them once, then I will rotate later"). Any agent touching this feature should confirm with the user whether the token has been rotated yet, and should not assume the credentials in `.env.local` are safe to treat as secret.
  - Status: table live in production, API and one UI surface (Vault) built and smoke-tested (no live-bucket authenticated round trip verified yet). `R2_*` env vars exist only in local `.env.local` — **not yet in Vercel's project environment variables**, so this does not work in production/preview deploys yet.
  - Item types supported: `task`, `goal`, `project`, `note`, `vault_item` (same CHECK-constraint style as `item_tags`). Extending to a new item type means adding it to the CHECK constraint, the `ITEM_TYPES` set in `app/api/attachments/route.ts`, and the `itemBelongsToUser()` switch — not a schema change.

## Full LifeSort Product Build Plan (2026-07-23)

- Decision: Adopt `AI_BUILD_PLAN.md` as the single persistent, reconciled roadmap for building the complete LifeSort product. The user's full-product specification lives there (Appendix A) so it never needs re-pasting; Parts A–F are the project-grounded plan and win wherever they disagree with the raw spec.
  - Rationale: user supplied the entire product vision and required it be persisted, audited against the real codebase, and reconciled — not turned into another abstract concept document.

- Decision: The **OpenClaw / autonomous-agents direction is descoped.** Do not build autonomous external agents, multi-agent orchestration, or fully automatic calendar control (spec §22/§30). **Repurpose** the existing `agent_action_events` table and `/api/agent/{actions,execute}` routes as the draft→confirm→execute / undo / audit substrate for the spec's required AI-safety model. Keep the table and confirmation pattern; drop the autonomy ambition (and the `501` execute stub's goal of calling arbitrary tools).
  - Supersedes: the `AI_AUDIT.md` (2026-05-17) framing, which existed to make the app "Agents (OpenClaw-style)"-ready. That audit is now historical; re-verify its security findings before acting on them (`lib/safe-fetch.ts` already exists, addressing its SSRF item).

- Decision: The **Money/finance surface is preserved** and framed as Financial-domain tooling. The full-product spec under-specifies it, but "unmentioned" is never "remove." No crypto/token/reward gamification (spec §30); investment price tracking stays.

- Decision: Capture/planning canonical surfaces are **Inbox → Today → Tasks (+ statuses)**. The existing specialized trackers (`waiting`, `someday`, `commitments`, `maintenance`, `vault`, `reset`, `timeline`, `nuke`) are consolidated *carefully* over time and **never rip-and-replaced**; no data-backed surface is removed or migrated without explicit user confirmation.

- Decision: Rich text stays **Tiptap with HTML-in-column** (extend it — slash menu, tables, callouts, embeds, mentions); **no `note_blocks` table.** Backlinks/mentions are served by a new additive generic `item_relationships` table (general graph only — existing typed links like `project_items`, `life_area_id`, `goal_id`, `converted_*/promoted_*` remain authoritative for their own domains). This is the justified use `AI_LIFE_DOMAINS_SPEC.md` §3.3 held out for.

- Decision: **Reuse existing tables** rather than recreate spec §27 names. `habit_entries`→`habit_checkins`, `routine_items`→`routine_steps`, `reviews`/`review_responses`→`weekly_reviews`+`life_area_reviews` (add Monthly as a `period_type`), `templates`→`user_templates`, `whiteboard_elements`→Liveblocks Storage (no Postgres table). Genuinely new: `item_relationships`, `task_recurrence`/`task_dependencies`/`task_checklist_items`, `focus_sessions`/`time_entries`, `favorites`/`recent_items`.

- Decision: The `life_areas` table/route/API/component names are **retained** ("Life Domains" is the product name only) — see `AI_LIFE_DOMAINS_SPEC.md` §2. A careless read of the spec's "replace Life Areas" must not trigger an 18-FK rename migration.

- **User confirmation (2026-07-24):** user approved proceeding with the A4 (capture/GTD consolidation) and A9 (nav restructure) directions from `AI_BUILD_PLAN.md`, explicitly motivated by not wanting to overclutter the app. This unblocks starting Phase 0. It confirms the *approach*, not a blanket authorization to delete/migrate any specific existing surface (`waiting`, `someday`, `commitments`, `maintenance`, `vault`, `nuke`) — get explicit confirmation at the point any one of those is actually proposed for removal or data migration. "Don't overclutter" is now a standing, user-stated constraint: on borderline scope calls, prefer folding a capability into an existing surface over adding a new nav item, tab, or page.
  - Also on 2026-07-24: ran a full completeness cross-check of `AI_BUILD_PLAN.md` against all 33 sections of the original spec (recorded as A10 in that file). Found and fixed three real gaps — Phase 0 was missing the spec's explicit auth/authorization review item, Phase 3 marked Search as fully done without checking it against the spec's filter/action list, Phase 7 had no explicit production-cleanup item — plus one drift (Appendix A §3 had picked up a "People" domain-dashboard tab not present in the source spec). All fixed in `AI_BUILD_PLAN.md` directly rather than left as findings.

## Design Token Migration (2026-07-24)

- Decision: `app/globals.css`'s core HSL variables (`:root` and `.dark`) now carry `DESIGN.md`'s LifeSort hybrid palette (calm teal primary, warm paper canvas/ink/hairline) instead of the original templated shadcn violet and clinical greys. New additive tokens (`--canvas-soft`, `--surface-raised`, `--ink-secondary/-muted/-faint`, `--hairline-strong`, `--primary-hover/-active/-tint`, `--ember/-tint`) and a `.domain-spine` utility class exist for future UI work to consume, mirrored into `tailwind.config.js` as Tailwind color utilities (`canvas`, `canvas.soft`, `surface`, `surface.raised`, `ink.*`, `hairline.*`, `ember.*`, `primary.hover/active/tint`).
  - Evidence: `AI_TASK_LOG.md` 2026-07-24 10:05 IST entry has the full hex→HSL derivation, including how dark-mode values `DESIGN.md` doesn't specify (`primary-tint`, `primary-active`, `ember-tint`, and `success`/`warning`/`destructive`) were derived.
  - The five alternate selectable themes (`ocean`, `forest`, `sunset`, `rose`, `midnight`) were deliberately **not** touched — `DESIGN.md` only governs the canonical light/dark pair.
  - **Deliberately deferred, not done in this pass:** the `DESIGN.md` 8-color muted "domain palette" was not wired into `lib/life-areas.ts`'s `LIFE_AREA_COLORS` swatch picker or `DEFAULT_LIFE_AREAS` presets, because the same bright preset hex values are reused as defaults across several unrelated features (habits, people avatars, tag-picker, whiteboard pen colors) — swapping them is a separate, larger reconciliation task, not a CSS token migration. `.domain-spine` is also not yet applied to any page (domains currently render a colored dot via inline `style`, not a spine) — that's Phase 1 domain-dashboard UI work.
  - Future agents styling any new surface should reach for the new tokens (`ink-muted`, `canvas-soft`, `hairline-strong`, `primary-hover`, etc.) before inventing ad hoc colors.

## Generic item_relationships Table (2026-07-24)

- Decision: Added `item_relationships` (`scripts/migrations/2026-07-24-item-relationships.sql`, mirrored into `scripts/schema.sql`/`scripts/fresh-install.sql`) as the single additive general graph for backlinks/mentions/related-items/dependencies per `AI_BUILD_PLAN.md` A6. Shape: `user_id, from_type, from_id, to_type, to_id, relation`, with `relation ∈ backlink|mention|related|depends_on|source_of|converted_from` and a CHECK-constrained, currently-17-type `from_type`/`to_type` enum (`task`, `goal`, `project`, `note`, `life_area`, `journal_entry`, `whiteboard`, `space`, `person`, `vault_item`, `wishlist_item`, `someday_item`, `inbox_item`, `waiting_item`, `commitment`, `maintenance_item`, `custom_section`).
  - Evidence: `lib/item-relationships.ts` (types, the CHECK-mirroring `itemRelationshipTypes`/`relationTypes` arrays, `validateItemOwnership()`, Zod schema), `app/api/item-relationships/route.ts` (GET both-direction lookup by `item_type`+`item_id`, POST with ownership validation on both ends, DELETE scoped by `user_id`), `app/api/item-relationships/route.test.ts`.
  - `from_id`/`to_id` are `VARCHAR(255)`, not `INTEGER`, because linked types span both SERIAL-integer tables (tasks/goals/projects/notes/...) and VARCHAR/UUID tables (whiteboards/spaces) — same reasoning already used for `space_items.item_id`.
  - `validateItemOwnership()` follows the exact pattern of `lib/spaces.ts`'s `validateSpaceItemAccess()`: a fixed internal `type → table name` map (never interpolated from user input) plus `sql\`SELECT id FROM ${sql.unsafe(table)} WHERE id::text = ${itemId} AND user_id = ${user.id}\``. `sql.unsafe()` is a documented Neon serverless driver feature for exactly this case (raw identifier interpolation from a trusted, fixed value) — do not use it with any request-supplied string.
  - The 17-type enum is deliberately not exhaustive of every table in the app — it covers the app's first-class "knowledge/object" surfaces per spec §21, not financial ledger rows (`investments`, `income_sources`, `budget_categories`/`budget_transactions`) or structural link/leaf tables (`project_items`, `space_items`, `tags`/`item_tags`, `attachments`). Widening the CHECK constraint later for a new type is a small forward-only migration (`ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT ...`), not a breaking change.
  - Per A6, existing typed links (`project_items`, `space_items`, `life_area_id`, `goal_id`, `converted_type`/`converted_id`, `promoted_type`/`promoted_id`) remain authoritative for their own domains — `item_relationships` is additive and must never be read as a replacement for them.
  - Status: migration file written and mirrored into `schema.sql`/`fresh-install.sql`, **not yet applied to any live database** per `AGENTS.md` ("do not run database scripts unless explicitly requested and the target database/environment is confirmed"). The API route works against a real database once the migration is applied; it is fully covered by mocked unit tests today. No UI consumes this endpoint yet — that's follow-up work (backlinks/related-items panels on Notes/Journal/Domains per `AI_BUILD_PLAN.md` Phase 1/3).

## Sidebar Nav Restructure (2026-07-24)

- Decision: The sidebar (`components/dashboard-layout.tsx`) now renders `HUB_NAV_ITEMS` grouped under 5 labeled sections (Today, Life Domains, Workspace, Reflect, Utilities) instead of one flat list, implementing `AI_BUILD_PLAN.md` Phase 0's nav-restructure item / A9. Group labels use `DESIGN.md`'s `label` typography role (small uppercase, muted) and are hidden in rail mode (tablet/collapsed desktop) where item text labels are already hidden — only vertical spacing signals grouping there.
  - Evidence: `SidebarGroup` type, `GROUP_ORDER`/`GROUP_LABELS`, and the `group` field added to `SidebarItem` in `components/dashboard-layout.tsx`.
  - **Reconciliation, not a literal copy of spec §4:** the raw spec's groups (TODAY: Today/Inbox · PLAN: Calendar/Upcoming/Routines · LIFE DOMAINS: shortcuts/All Domains · WORKSPACE: Projects/Goals/Knowledge/Journal/Whiteboards/People/Reviews · UTILITIES: Search/Recent/Favorites/Settings) group individual *features*. LifeSort's existing hubs already consolidate many of those features under a few sidebar entries (Workspace bundles Tasks/Goals/Projects/Calendar/Inbox/... behind one link) specifically to avoid sidebar clutter. Exploding back out to the spec's granular per-feature list would undo that consolidation and directly violate the user's "don't overclutter" constraint (Part B #12). So grouping was applied one level up, onto the existing hub set, reusing the spec's *group names* only where they map honestly: Today→Home+Today, Workspace→Workspace+Journal+Whiteboard+Money, Reflect→Reflect+Coach (a LifeSort-specific pairing, not a spec group), Utilities→Settings(+Admin). Search/Recent/Favorites aren't listed under Utilities because Search is already global via ⌘K (per spec §4's own "Quick Capture + Command Palette always global" note) and Recent/Favorites don't exist as features yet (tracked as Phase 3 🟠 items).
  - **New "Life Domains" sidebar item (`/domains`, `Compass` icon) — closes a real gap, not just relabeling.** Before this change, Life Domains — despite being one of the most extensively built features in the app (`AI_LIFE_DOMAINS_SPEC.md`, all 3 phases shipped) — had **no direct sidebar entry point at all**. It was only reachable via a direct URL, Global Search result, or Quick Add, and was *incorrectly* aliased under the "Reflect" hub's active-highlighting list (visiting `/domains` lit up "Reflect" in the sidebar, not any Domains link, since none existed). Confirmed via grep that `/domains` also isn't indexed by Global Search or listed on the Workspace hub page. Removed `/domains`/`/life-areas` from `reflect`'s `aliases` and gave Domains its own top-level item.
  - `DEFAULT_SIDEBAR_PREFS` (`dashboard-layout.tsx`), `DEFAULT_SIDEBAR_SECTIONS` (`app/api/sidebar-preferences/route.ts`), and the Settings → Sidebar Sections toggle list (`app/settings/page.tsx`) were all updated in lockstep with a `domains: true` entry — these three lists must stay in sync whenever a hub item is added or removed, since nothing enforces that automatically.
  - Mobile bottom nav (Home/Today/Workspace/Money/More) was **not** restructured — it's a deliberately different, already-documented pattern (`AI_CHECKLIST.md` Navigation checklist item 8) using a different UI paradigm than "grouped sidebar sections." Domains was added to the mobile "More" sheet list instead, at the top.
  - No hub route was removed, renamed, or had its redirect behavior changed. Every existing alias array is preserved (minus the `/domains`/`/life-areas` move off `reflect` and onto the new `domains` item).

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
- Tasks use `tasks.sort_order` for persisted manual ordering. Due-date sorting remains a UI mode; drag reorder writes only `sort_order`.
- Task bulk "Move to project" links tasks into projects through `project_items` instead of adding `project_id` to tasks. Bulk actions reuse existing task and project-item APIs and do not introduce a separate task batch endpoint.
- Goal on-track status is a client-side progress signal derived from `goals.created_at`, `target_date`, and `progress`; it does not write status back to the database.
- Calendar scheduling preserves source records: dragging/scheduling a task writes `tasks.due_date` on the existing task, dragging a local event writes `calendar_events.event_date` on the existing event, and Google synced events remain read-only reminders. Do not duplicate tasks into calendar events for scheduling.
- Investments can link to wishlist items through `investments.wishlist_item_id`.
- Budget Goals can link to Wishlist items through `budget_goals.wishlist_item_id`. Wishlist-driven goal creation is explicit from the Wishlist UI and guarded against duplicates per `(user_id, wishlist_item_id)`.
- Money liabilities use a user-owned `liabilities` table for simple debt tracking. Liabilities are included in the Money Overview estimated net worth calculation but do not mutate investments, budget transactions, income sources, or wishlist records.
- `users.preferred_currency` is a display-formatting preference only. Stored finance numbers are not converted when the preference changes; Money UI formatting uses the selected ISO currency through `lib/currency.ts`.
- Notes use a simple knowledge model: user-owned `note_folders`, optional `notes.folder_id`, inline `notes.tags` as `TEXT[]`, and `notes.is_pinned` for pinned/favorite notes. Rich note bodies are stored as editor-generated HTML in the existing `notes.content TEXT` column; legacy plain text is converted only for editor display and is not rewritten until the user edits.
- Today Plan uses one `daily_plans` row per user per date, with `focus_items JSONB` for up to three saved focus items, `today_item_order JSONB` for per-day ordering of derived Today To-Do item ids, daily capacity fields (`energy_level`, `available_focus_minutes`, `mood`, `day_type`), and three reflection text fields. Journal may write one `source_type: "journal"` focus item into the next day's plan from `tomorrow_focus`; it updates/removes only its own journal-sourced item and does not evict user-picked focus items when the list is already full. Focus Mode is an overlay on Today focus items rather than a replacement route; task-sourced focus sessions may complete the source task, while non-task sessions remain close-only unless the user appends notes to Journal. Capacity is planning context only; labels such as sick/recovery do not imply health advice or diagnosis.
- Daily Journal uses one `daily_journal_entries` row per user per `journal_date`. Gratitude, Work/Personal/Family intentions, and tags are JSONB so the form can stay flexible without adding child tables. The visible intention labels are stored on `users` as `journal_intention_1`, `journal_intention_2`, and `journal_intention_3`, defaulting to Work, Personal, and Family. Journal autosave writes the whole normalized entry after a 2-second debounce and keeps a visible manual Save fallback. `notes_from_today` may contain editor-generated HTML in the existing `TEXT` column; other small journal reflection fields remain plain text. `locked_at` exists for future read-only locking, but current UI keeps entries editable to avoid accidental data loss.
- Collaborative Whiteboard stores only board metadata, ownership, collaborators, visibility, and share tokens in Postgres. Realtime element data, autosave, and presence live in Liveblocks Storage/Presence, with room ids in the stable format `lifesort:whiteboard:{whiteboardId}`. Public share links are login-gated and grant viewer access only; explicit editor access requires a collaborator row.
- Spaces are user-owned containers, not duplicated content stores. `spaces` stores only container metadata, while `space_items` links to existing source records by `(item_type, item_id)` for notes, whiteboards, tasks, projects, links, and custom sections. Creating inside a Space creates the normal source record first, then links it. Deleting or archiving a Space must not delete linked source records.
- Weekly Review uses one `weekly_reviews` row per user per Monday-Sunday week, with user-written reflection fields and a `summary_snapshot JSONB` saved only when the user saves the review. Weekly metrics are otherwise derived live from user-scoped source tables, including daily capacity patterns from `daily_plans`, and do not mutate those source records.
- LifeScore is a derived, explainable dashboard signal, not a source of truth. `lib/life-score.ts` computes component scores from existing user-owned tables, normalizes across available sources, uses non-shaming labels, and stores one daily snapshot in `life_score_history` for trend/history when the migration is applied. Empty/new accounts do not receive synthetic neutral component scores; `ready: false` prevents snapshot writes and AI explanations until at least one scored source has meaningful user data. The score helper may write only this snapshot; it does not mutate source tasks, goals, habits, commitments, maintenance, vault, or Life Area records.
- Money Score is a client-side derived dashboard signal, not a source of truth. It scores budget adherence, savings rate, whether investments exist, linked wishlist budget goals, and overdue liabilities from data already fetched by Money Overview. It must not write finance data or imply currency conversion.
- Universal Life Inbox uses a user-owned `inbox_items` table for pre-sorting capture. `converted_type` and `converted_id` are intentionally polymorphic because Inbox can convert into records across multiple module tables. The conversion endpoint validates the authenticated user, validates optional Life Area ownership, creates the target record server-side, and marks the inbox item `converted` only after target creation succeeds.
- Someday / Maybe uses a user-owned `someday_items` table for low-pressure future ideas and possibilities. `promoted_type` and `promoted_id` are intentionally polymorphic because Someday items can be promoted to projects, goals, tasks, wishlist items, or notes. Promotion validates the authenticated user and optional Life Area ownership, creates the target server-side, and marks the Someday item `promoted` only after target creation succeeds.
- Waiting For uses a user-owned `waiting_items` table for external dependencies the user is waiting on. Life Area, Project, and Person links are optional, nullable, and ownership-validated in `/api/waiting`; follow-up and overdue views are derived from `follow_up_date` and `expected_date`, while resolved/cancelled items are excluded from active dashboard counts.
- Commitments use a user-owned `commitments` table for promises and obligations the user made to themselves or others. Life Area, Project, Person, and related Task links are optional, nullable, and ownership-validated in `/api/commitments`; due-soon and overdue indicators are derived from `due_date`, and overdue open commitments are not auto-marked missed.
- Life Maintenance uses a user-owned `maintenance_items` table for recurring renewals, checkups, repairs, reviews, and admin responsibilities. Custom recurrence is represented by `custom_interval_days`; mark-complete updates `last_completed_date`, advances `next_due_date` from the completion date, and keeps recurring items active. Life Area and Vault links are optional, nullable, and ownership-validated in `/api/maintenance`; task creation is explicit through `/api/maintenance/create-task` and does not mutate the maintenance item.
- Reset My Life is derived from existing user-owned tables and does not add a new core table. `/api/reset` gathers stale/overdue/missed/unsorted records, `/api/reset/actions` applies only confirmed per-item actions, and `/api/reset/recovery-plan` reuses `daily_plans.focus_items` for the top 1-3 recovery priorities. "Move to someday" maps onto existing fields rather than adding schema: task/goal category, paused statuses, cleared dates, or equivalent non-destructive states.
- Life Projects use a user-owned `projects` table plus flexible `project_items` links for existing records and `project_activity` for project-level changes. Project links are polymorphic and validated in API code because linked source records live in separate module tables; deleting a project removes links/activity, but deleting or unlinking a source item does not mutate other modules.
- Link folders can be nested through `link_folders.parent_id`.
- Preferences use JSON/JSONB in user-related tables, including sidebar preferences, content preferences, and allowlisted app preferences such as `home_view_mode`.
- Daily content stores generated or played content with `content_type`, `category`, `content`, and `extra_data`.
- AI usage events are stored in a user-owned `ai_usage_events` table with route, provider, model, status, optional error message, and timestamp. Route handlers enforce conservative per-user daily caps in code so provider usage is scoped before making external AI calls.

## API Design Decisions

- Most route handlers return JSON via `NextResponse.json`.
- Many CRUD routes use method-based handlers in one route file: `GET`, `POST`, `PUT`, `DELETE`.
- Client pages call relative API paths with `fetch`.
- Global search intentionally catches per-source query failures and returns partial results.
- Dashboard aggregation exists both on the client dashboard page and in `/api/dashboard`.
- AI text routes call Google Gemini directly through `@ai-sdk/google` (`lib/ai-provider.ts`) with explicit model allowlists and main `getUserFromSession()` auth. Groq remains limited to investment screenshot parsing.
- LifeSort Coach (`/api/chat`) gathers server-side user-scoped context through `lib/lifesort-coach-context.ts` before calling Gemini. Context modes are selectable, missing newer tables are reported as unavailable, notes provide metadata only (no note body content), and citations use stable ids like `[task:123]`. The chat endpoint remains read-only; suggested task drafts are parsed on `/ai-chat` and only created through `/api/tasks` after explicit user confirmation.
- AI Weekly Summary (`/api/ai/weekly-summary`) uses a client-sends-data pattern: the review page loads week metrics from `/api/weekly-review` and POSTs the already-loaded `summary` object to the AI endpoint. This avoids a second DB query and follows the same trust model as `/api/chat` (client sends messages). Since the endpoint is read-only (no DB writes), there is no security concern from client-provided data. Future AI features that are read-only can follow this pattern.
- AI Today Planner (`/api/ai/today-plan`) uses the same client-sends-data pattern: the today page already has candidates (mustDo, shouldDo, couldDo, calendarToday, upcomingDeadlines), habitsToday, and daily capacity loaded; these are POSTed to the AI endpoint. Unlike the weekly summary (numbers only), the today planner sends actual item titles because the AI needs them to prioritize. Item lists are capped client-side before sending, and capacity can further cap top priorities. The endpoint does not perform DB writes; all write actions (add to focus, create task) are user-initiated on the client.
- New AI endpoints normally live under `app/api/ai/` to separate them from CRUD routes. Each must require session auth, check `GEMINI_API_KEY`, and use `checkAiUsageLimit`/`createAiUsageEvent`/`updateAiUsageEvent` from `lib/ai-usage.ts`. Template Builder is the current exception: `/api/templates/generate` and `/api/templates/apply` live beside the existing Templates product route, but still follow the same auth, env, usage-limit, validation, and explicit-confirmation safety rules.
- Liveblocks room auth lives at `/api/liveblocks-auth` and must use `getUserFromSession()`, `LIVEBLOCKS_SECRET_KEY`, exact room-level permission checks, and `prepareSession()`. Never expose `LIVEBLOCKS_SECRET_KEY`, never grant wildcard room access, and map LifeSort roles so owner/editor receive full room access while viewer receives read access.
- AI write-action safety: no AI feature in this codebase applies changes automatically. Every action that modifies data (focus items, task creation) is triggered by an explicit user button click after seeing the AI suggestion. This is the enforced pattern for all future AI features.
- Inbox and Someday promotion safety: capturing an Inbox or Someday item is separate from creating structured module data. Conversion/promotion requires explicit user confirmation in the relevant page; the original item is retained and linked to the created object instead of being deleted.
- Commitment-to-task conversion is explicit and server-side. `/api/commitments/convert-to-task` creates a task owned by the authenticated user, then writes the new task id to `commitments.related_task_id`; it does not delete the commitment or automatically change its status.
- AI Natural Language Capture uses Zod for two validation layers: (1) input validation on the `text` field before calling the AI, (2) per-type Zod schemas on the AI's JSON output before returning to the client. Actions with invalid payloads are silently dropped rather than returning errors, so the client always gets a clean array. Supported write targets include Waiting For drafts, but the capture page still requires explicit user confirmation before calling `/api/waiting`. The capture page imports `DraftAction` from the API route file — an unusual pattern chosen to share the discriminated union type without a third shared-lib file. If this causes issues, extract to `lib/capture-types.ts`.
- Zod (`"zod": "3.25.76"`) is available in the repo and is now used in the capture endpoint. Future AI endpoints that need structured output validation should use Zod rather than manual type checks.
- AI Life Balance Insights (`/api/ai/life-balance`) differs from the client-sends-data pattern: GET and POST both derive user-scoped aggregate metrics server-side from Life Areas, tasks, goals, habits, projects, notes, budget, and recent weekly review reflections. The AI prompt receives aggregate counts plus short reflection snippets, not task titles or note content. The endpoint is read-only; suggested actions are returned as draft task suggestions and are only created by the `/insights` client after the user confirms.
- AI "What Am I Ignoring?" Insights (`/api/ai/what-am-i-ignoring`) derive user-scoped neglect/risk signals server-side from existing tables and do not add a new table. GET returns non-AI signals; POST sends capped signal summaries plus visible Personal Operating Rules to Gemini for read-only explanation. Suggested actions are returned as draft task suggestions and are only created by the `/insights` client after user confirmation.
- AI Reset Suggestions (`/api/ai/reset-suggestions`) derives the same reset dashboard server-side and sends capped item summaries plus allowed actions to Gemini. The endpoint is read-only and rate-limited to 5/day; suggested reset actions are only applied later through `/api/reset/actions` after user selection and confirmation.
- AI LifeScore Explanation (`/api/ai/life-score`) sends only the already-derived LifeScore summary, component scores, reasons, improvements, unavailable sources, and recent score history to Gemini. It is read-only, uses `life_score_explanation` usage events with a 5/day cap, and does not create tasks or modify source data.
- AI Template Builder (`/api/templates/generate` and `/api/templates/apply`) uses AI SDK structured output (`generateText` with `Output.object`) plus Zod validation to generate a preview-only LifeSort system. Generation sends only the user's prompt and generic LifeSort schema instructions to Gemini and records `template_builder` usage. Applying re-validates the submitted template server-side and creates records only after the user confirms. Generated templates are saved persistently only when the user explicitly clicks "Save to My Templates"; same-session recent history uses `sessionStorage`.
- AI Refine Text (`/api/ai/refine-text`) is selected-text-only writing assistance for opted-in rich editors. It requires session auth, `GEMINI_API_KEY`, Zod validation, `refine_text` usage limits, and sends only the selected text plus the requested action/tone to Gemini. The route returns plain text and never writes to LifeSort data; the editor shows Replace/Insert/Cancel confirmation before any document change.

## Notification Center Decisions

- Notifications are generated on-demand: every `GET /api/notifications` call runs `generateNotifications(uid)` before querying the table. This avoids a separate cron job for in-app alerts.
- The `notifications` table uses `UNIQUE(user_id, type, related_item_type, related_item_id)` with `ON CONFLICT DO NOTHING` inserts. This means: (1) each condition creates at most one notification row, and (2) `is_read` state set by the user is preserved across regenerations without being reset.
- Date-sensitive notification types (habit_missed, budget_warning) include the date or month in `related_item_id` to allow one notification per period (e.g., `habit_id-2026-05-17` or `category_id-2026-05`).
- Stable notification types (task_due, goal_deadline, vault_expiring, people_followup, project_deadline, weekly_review) use the source item's id as `related_item_id` so the notification is created once per item and persists until dismissed.
- Positive reinforcement notification types use the same unique insert pattern. Milestones include the milestone value in `related_item_id` (`journal-30`, `habit_id-50`) and period-based wins use the week/month id, so congratulations are not repeated on every generation call.
- Read notifications older than 30 days are auto-deleted at the start of each generation call to prevent unbounded table growth.
- The `safe()` + `isMissingTable()` pattern (same as `app/api/timeline/route.ts`) wraps every INSERT in generation — if the `notifications` table or any source table is missing (migration not yet applied), that source is silently skipped. The GET route catches a missing `notifications` table and returns `{ notifications: [], unread_count: 0 }` rather than 500.
- `components/notification-bell.tsx` is a client component that re-fetches when the Popover opens to show fresh state. Optimistic updates keep the UI snappy for mark-read actions.
- Notification settings for v1 are a filter bar on the `/notifications` page (type + read/unread toggles), not a separate preferences page or DB column.

## Timeline and Multi-Source Aggregation Decisions

- The Life Timeline derives events from existing source tables and does not add `timeline_events` in v1. Timeline logic lives in `lib/timeline.ts` so `/api/timeline`, the dashboard widget, and Global Search can share one derivation path. Vault renewal completions are represented by completed maintenance items linked to Vault records; People follow-up completions are represented by `people_reminders.is_sent = TRUE`.
- The timeline helper runs one query per source in parallel via `Promise.all`. Each source query is wrapped in a `safe()` helper that catches missing-table errors (PostgreSQL error codes 42P01/42703) and returns an empty array, allowing partial results when a migration hasn't been applied. This is the same resilience pattern used in `lib/ai-usage.ts`.
- Habit streak milestones are computed in JavaScript inside the API route: habit_checkins are fetched and grouped by habit_id, deduplicated by date, sorted chronologically, and milestone events are emitted at the 7th, 14th, 21st, 30th, 50th, and 100th unique check-in date per habit. This approach is simpler than a SQL window function and handles weekly/daily habits the same way.
- Timeline filtering (event type, life area, date range, text search) happens in JavaScript after all sources are merged, not in SQL. This is acceptable for a personal app where total event count is bounded (< 1000 events per user). If scaling becomes a concern, move filters into individual SQL WHERE clauses.
- The `/api/timeline` GET response includes `life_areas` for the filter dropdown, avoiding a second client fetch.

## Template and Static Data Decisions

- Smart Templates are defined as static TypeScript data in `lib/templates.ts`, not as database rows. There is no `templates` database table. Templates are arrays of `TemplateItem` union types with a `buildPayload()` helper that maps each item type to the correct API payload shape.
- Template application is client-side: the `/templates` page iterates `template.items` and POSTs each to its existing CRUD endpoint sequentially. This reuses all existing validation and auth logic on those endpoints without a new API route.
- `budget_category` items require `type: "category"` as a discriminator in the `/api/budget` POST body; `buildPayload()` injects this. All other types strip the TypeScript discriminant before sending.
- `life_area_id` is intentionally omitted from template definitions — templates are generic and not tied to a user's specific life areas. Users assign life areas after creation.
- AI-generated templates use `lib/template-builder.ts` as the canonical schema. Unlike static templates, generated template application is server-side through `/api/templates/apply` so the app can create a Space and link supported source records in one authenticated Neon transaction. V1 links notes, whiteboards, tasks, links, and custom sections to Spaces; habits and budget categories are created but not Space-linked because `space_items.item_type` does not allow those types.
- User-created Templates use a separate `user_templates` table, not the static `lib/templates.ts` list and not `custom_sections`. The table stores user-owned JSONB item definitions with `source = manual | ai | forked`, `forked_from`, and `last_used_at`. `user_id` is `VARCHAR(255)` to match the canonical `users.id` type even though the original product prompt sketched an integer FK.
- User-created Templates are applied server-side through `/api/user-templates/[id]/use`, after the client shows a preview and the user confirms. The route validates ownership, re-validates stored item JSON, creates records in the normal LifeSort source tables, and updates `last_used_at` after success.

## UI and Component Decisions

- App pages generally render inside `DashboardLayout`.
- Rich writing surfaces use `components/editor/rich-text-editor.tsx` with Tiptap. Store v1 rich content as editor-generated HTML in existing `TEXT` columns rather than adding JSON columns or migrations. Previews/search/character counts must strip rich HTML through `lib/rich-text.ts` and should not render stored note or journal HTML with `dangerouslySetInnerHTML`. AI Refine is opt-in per editor surface, selected-text-only, and must keep user confirmation before replacing/inserting generated text.
- Voice dictation for writing surfaces is browser-provided through the Web Speech API. There is no server transcription route, audio upload, AssemblyAI dependency, or new transcription env var in v1. Unsupported browsers must show a clear in-editor message and leave the editor usable.
- Signed-in pages use `DashboardLayout` with consolidated navigation plus direct high-use creative/AI entry points. The primary sidebar shows Home, Today, Journal, Workspace, Whiteboard, Money, Reflect, Coach, Settings, and admin-only Admin. Individual feature routes remain deep-linkable and are reached from hub cards, Global Search, Quick Add, mobile More, or direct URLs. Sidebar preferences use `workspace` as the current hub key while `organize` remains a legacy fallback for stored user JSON. Hub badges use `/api/navigation-summary`, a read-only user-scoped aggregate endpoint with missing-schema tolerance and no new tables.
- Home is an attention dashboard, not a full module dashboard. Keep it short and focus-first: Today focus hero, 4 glance stats, and three quick actions should be visible before secondary cards. Quick Access, LifeScore, module summaries, Pending, Recent Activity, notifications, and pinned favorites belong in the collapsible secondary section unless a future task explicitly changes the Home hierarchy.
- Home keeps the `home_view_mode` app preference for backward compatibility, but the visible Home surface stays calm and short. Keep `/api/app-preferences` allowlisted; do not turn it into arbitrary client-writable user JSON.
- Today is the primary daily focus surface. Focus items, due Today To-Do items, Should Do, and Could Do should appear near the top as one prioritized daily list with Must/Should/Could filters; Journal preview, capacity, habits, calendar, notes, deadlines, and reflection remain supporting sections. The This Week tab is opt-in and reschedules existing tasks by updating `tasks.due_date`; it does not replace the default Today view or duplicate tasks into a separate planner table.
- Workspace is the primary workspace hub at `/workspace`, with `?tab=plan|capture|visual|systems|follow-ups` tabs labeled Tasks & Goals, Inbox & Ideas, Boards & Spaces, Templates & Routines, and Waiting & Commitments. `/organize`, `/plan`, and `/life-admin` are compatibility route files that redirect to matching Workspace tabs. `/capture` remains the full Universal Capture feature page because it contains unique workflow logic.
- Money is the primary finance surface at `/money`, with `?tab=overview|budget|income|investments|wishlist` tabs. `/budget`, `/income`, `/investments`, and `/wishlist` are compatibility route files that redirect to matching Money tabs. Keep finance feature behavior in reusable Money tab panels rather than nesting full pages with another `DashboardLayout`.
- Money Overview is a derived dashboard, not a new finance ledger. Net worth, savings rate, cash flow, budget health, upcoming bills, and wishlist progress are computed from existing user-owned finance/Vault/Wishlist data plus the small liabilities table; do not introduce fake totals or automatic write actions.
- Reflect is the primary insight/review surface at `/reflect`. `/insights` remains a compatibility feature route with the same tabbed Reflect workflow so old deep links do not break. LifeScore is the first/default tab, followed by Life Balance, Timeline, Ignored Signals, Weekly Review, and Journal. Reset My Life remains reachable through a standalone emergency CTA instead of a review tab.
- Reflect Journal Insights use `/api/journal/insights`, which intentionally returns only the last 90 days of journal date, mood, star ratings, and gratitude. Do not include rich notes or full journal text in that insights payload.
- Mobile navigation uses a bottom bar for Home, Today, Workspace, Money, and More. More exposes Journal, Whiteboard, LifeSort Coach, Reflect, Settings, Profile, Support/FAQs, and admin-only Admin while the header still keeps Global Search, Quick Add, notifications, profile/settings, and sign-out reachable.
- Whiteboard remains linked from Workspace > Visual and is also a direct sidebar/mobile More entry for discoverability. `/whiteboard` remains deep-linkable.
- Spaces live under Workspace > Boards & Spaces rather than the top-level sidebar. `/spaces` and `/spaces/[id]` remain deep-linkable and highlight Workspace as their active navigation area.
- Global capture/search/navigation lives in `GlobalCommandPalette`: Cmd/Ctrl+K opens the palette, Quick Add/FAB opens the same palette in capture mode, and capture writes still happen through the existing `QuickAddModal` or feature pages. The palette may link to existing AI pages, but must not introduce a new inline AI write surface without the usual draft/confirm pattern.
- UI polish should use the shared Tailwind utilities in `app/globals.css` before introducing page-local one-offs: `surface-card` for calm bordered surfaces, `interactive-card` for subtle hover lift, and `section-enter` for short page/section entrance motion. These utilities must stay transform/opacity based, fast (roughly 120-250ms), and reduced-motion aware. Do not add a separate animation library for routine product polish.
- Responsive shell behavior follows one breakpoint contract: mobile is `<640px`, tablet is `640-1023px`, desktop is `1024-1600px`, and wide is `>1600px`. Prefer Tailwind classes for layout, and use `hooks/use-breakpoint.ts` only when behavior must change at runtime. The signed-in shell uses a full sidebar on desktop/wide, a localStorage-persisted collapsed rail on desktop when requested, an automatic icon rail on tablet, and bottom navigation only on mobile.
- Theme state is stored in `localStorage` and applied via root class/data attributes.
- `sessionStorage` is used for transient UI caching such as onboarding completion and sidebar preferences.
- lucide-react is the icon source.
- Spotify-style list reordering uses `@dnd-kit` through `components/sortable-list.tsx` so mouse, touch, and keyboard drag behavior stays centralized.

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
- Personal Operating Rules use a single user-scoped `personal_rules` table. Normal user-created rules use `rule_type = 'rule'`; the structured preference set uses one visible `rule_type = 'preferences'` row protected by a partial unique index on `(user_id) WHERE rule_type = 'preferences'`. This keeps AI planning context visible and editable instead of storing hidden rules in a separate table or configuration blob.
- AI planning routes call `getPersonalRulesContext(user_id)` to inject the exact visible preview into prompts. The helper returns defaults if the table/column is missing so deployments do not hard-fail before the migration is applied. AI routes may read active rules and preferences, but they do not create or mutate rules.
- Life Areas are modeled as a user-owned `life_areas` table with optional nullable `life_area_id` foreign keys on tasks, goals, notes, wishlist items, budget categories, income sources, investments, and custom sections. Budget transactions intentionally stay indirectly organized through their category instead of getting a direct Life Area column in the first pass.
- Life Area detail pages consume optional `life_area_id` filters on existing module APIs instead of adding an aggregate endpoint. Full module pages may read `?life_area_id=` for deep links, but default unfiltered behavior should remain unchanged.
- Default Life Areas are seeded by SQL migrations for existing users and by registration/API code for future users; the app still treats Life Area assignment as optional everywhere.
- Today Plan stores focus selections, capacity fields, reflection fields, and the user-selected order of Today To-Do item ids for that date. Today To-Do, Should Do, Could Do, Upcoming Deadlines, Calendar Today, and Quick Notes are still derived on demand from existing user-scoped modules rather than duplicated into `daily_plans`. Today To-Do intentionally clubs same-day/overdue tasks, goals, projects, waiting items, commitments, and maintenance so dated responsibilities from other modules are visible on the day they are due.

## Deployment Decisions

- Vercel is the documented deployment platform.
- Vercel Cron calls `/api/cron/deadline-reminders` daily at `0 9 * * *`.
- `next.config.mjs` currently disables TypeScript and ESLint build failures.
- Images are set to unoptimized.

## Agent Action Infrastructure (2026-05-18)

Decisions made while implementing N5 (audit follow-up). These shape how the LifeSort Agents feature will execute writes on the user's behalf.

- **Decision: Every agent write goes through `agent_action_events` as a draft.**
  - Status lifecycle: `pending` → `confirmed` | `rejected` (set by user) → `executed` | `failed` (set by `/api/agent/execute`).
  - `executed`/`failed` rows are immutable — they cannot be deleted via the API. This preserves the audit trail.
  - Rationale: matches the pattern from AI Capture / AI Today Plan and gives users a single review queue across all agent activity.

- **Decision: `/api/agent/execute` returns 501 TOOL_NOT_IMPLEMENTED until `lib/agent-tools.ts` exists.**
  - The route validates ownership and confirmation state, then marks the action `status='failed'` with a clear error before returning 501.
  - Rationale: shipping the route as a stub forces every consumer to register tools explicitly. There is no risk of accidental writes through an unimplemented dispatch.
  - When tool registry is built: replace the 501 branch with `const handler = AGENT_TOOLS[action.tool_name]` lookup; if no handler exists, return the same 501 + `failed` status.

- **Decision: Agent actions are user-scoped at every layer.**
  - GET, PUT, DELETE on `/api/agent/actions` all filter by `user_id = user.id`.
  - `/api/agent/execute` validates the action belongs to the current session user before executing.
  - Even with a valid action id, no user can confirm or execute another user's action.

- **Decision: Zod is mandatory for all agent-related routes from day one.**
  - Both `/api/agent/actions` and `/api/agent/execute` use Zod schemas for body validation and return structured `{ error, code, issues? }` 400 responses.
  - This sets the pattern for the broader Zod adoption recommended by AI_AUDIT.md §P.

## Database Migration Workflow (2026-05-18)

- **Decision: Canonical schema lives in `scripts/schema.sql`. Legacy/feature SQL files moved to `scripts/legacy/`.** Forward-only migrations live in `scripts/migrations/YYYY-MM-DD-<name>.sql`.
  - Rationale: a single file for fresh-DB setup eliminates the previous drift where `setup-database.sql`, `run-pending-migrations.sql`, and `website-current-schema.sql` had overlapping but inconsistent CREATE statements.
  - When adding a new schema change: write the migration file AND mirror the CREATE/ALTER content into `schema.sql` so fresh-DB setup stays complete.
  - `scripts/README.md` documents the workflow.

- **Decision: `payment_logs`, `pomodoro_sessions`, `pomodoro_settings` ARE included in the canonical schema with rewritten `user_id VARCHAR(255)`.** (Updated 2026-05-18 — supersedes the original "not in canonical schema" decision.)
  - Rationale: user requested keeping these tables for potential future feature work. They are not currently queried by `app/api` code, but the schema is now self-consistent (all user_id columns uniformly `VARCHAR(255)`, no INTEGER/UUID drift).
  - If/when these features are wired up, the schema is ready.

- **Decision: `api_usage` intentionally has no `user_id`.**
  - Rationale: it's a system-wide quota counter for shared external APIs (Alpha Vantage daily request cap), one row per (api_name, date). Used only by `app/api/investments/background-fetch`. A comment in `schema.sql` documents this so future agents don't "fix" it by adding `user_id`.

## OAuth Token Encryption at Rest (2026-05-18)

- **Decision: OAuth tokens stored in `calendar_integrations` (`access_token`, `refresh_token`) are encrypted at the application layer using AES-256-GCM before being written to the database.**
  - Rationale: closes the plaintext-OAuth-tokens finding from the schema audit. If the Neon DB is ever leaked (backup, snapshot, compromised credential), attackers cannot directly use the tokens to access user calendars — they would need the encryption key as well.
  - Implementation: `lib/token-crypto.ts` exports `encryptToken` / `decryptToken`. Key derived via `scryptSync(process.env.OAUTH_TOKEN_ENCRYPTION_KEY, "lifesort-oauth-v1", 32)` and cached. Storage format: `v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>`.
  - Format version prefix (`v1:`) enables future key rotation: a migration can detect the prefix, decrypt with the old key, re-encrypt with the new key, bump to `v2:`.

- **Decision: Backward-compatible decrypt — legacy plaintext rows pass through unchanged.**
  - Rationale: avoids a destructive backfill. `decryptToken` returns the value as-is when the `v1:` prefix is absent. Existing rows self-encrypt on next token refresh (Google access tokens TTL ~1 hour), so the prod DB transitions naturally with no operator action.

- **Decision: In production, missing/short `OAUTH_TOKEN_ENCRYPTION_KEY` throws; in development, it warns once and falls back to plaintext pass-through.**
  - Rationale: production must enforce encryption; local dev should not be blocked when the key isn't configured (e.g., when a contributor first clones the repo).
  - Operational note: `OAUTH_TOKEN_ENCRYPTION_KEY` MUST be set in Vercel env vars before any deploy that includes this code, or `/api/calendar/google/callback` and `/api/calendar/sync` will throw on every request.

- **Anti-pattern: do NOT encrypt `sessions.session_token` or `password_reset_tokens.token` with the same helper.**
  - Rationale: sessions need plaintext cookie comparison; password reset tokens are short-lived and should be hashed on write (a separate future improvement, different from symmetric encryption). The token-crypto helper is specifically for OAuth tokens that need to be decrypted and re-sent to a third-party API.

## Pre-Agents Audit Decisions (2026-05-17)

Decisions recorded from the pre-Agents audit (`AI_AUDIT.md`). These shape the next 5 implementation tasks before the Agents feature begins.

- **Decision: Consolidate to a single canonical schema file.**
  - Rationale: 13 production tables are missing from `scripts/website-current-schema.sql` and `setup-database.sql` uses incompatible `SERIAL` user_id types. Fresh-DB setup is currently broken.
  - Plan: Rename `website-current-schema.sql` → `schema.sql`, include all 51 tables, move legacy/feature-specific SQL files into `scripts/legacy/`, and use a new `scripts/migrations/` directory for forward-only ALTER TABLE migrations.
  - See AI_AUDIT.md §O.

- **Decision: Add an `agent_action_events` audit table before Agents ship.**
  - Rationale: Agents will autonomously trigger writes on the user's behalf. We need a row-per-action audit trail with status tracking (pending → confirmed → executed) so users can review and undo agent activity.
  - Schema: see AI_AUDIT.md §Q1.

- **Decision: Adopt the "draft → confirm → execute" pattern for all Agent writes.**
  - Rationale: AI Capture, AI Today Plan, AI Life Balance already use this pattern. Agents must use it too. No agent action mutates user data without explicit user confirmation.
  - Implementation: Agent proposes `agent_action_events` rows with `status='pending'`. UI shows the diff. A new `/api/agent/execute` route flips to `status='executed'` and calls the underlying CRUD endpoint.
  - See AI_AUDIT.md §Q2.

- **Decision: Explicit tool registry in `lib/agent-tools.ts` — do not let agents call arbitrary routes.**
  - Rationale: Bounded surface area. Each tool is `{ name, description, schema, handler }` with a Zod schema for inputs and outputs.
  - Initial tool set: read-only (list_tasks, list_goals, list_today, list_inbox, list_notifications). Write tools added one-by-one with confirmation.
  - See AI_AUDIT.md §Q3.

- **Decision: Adopt Zod for body validation, starting with `/api/admin/*` and `/api/share` POST.**
  - Rationale: Only `/api/ai/capture` uses Zod today. Agents will rely on predictable 400 responses with structured error codes. Manual `typeof` checks are not sufficient.
  - Implementation: per-module Zod schemas in `lib/schemas/<module>.ts`. Share schemas between CRUD routes and AI Capture parsing.
  - See AI_AUDIT.md §P.

- **Decision: Three pre-existing security issues block the Agents feature**: CRON_SECRET fall-through, OAuth state validation, URL preview SSRF.
  - These are not Agents-specific but the Agents feature will increase attack surface. Fix before adding agent capabilities.
  - See AI_AUDIT.md §N1–N3, §R1–R3.

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
