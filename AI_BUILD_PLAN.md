# AI_BUILD_PLAN.md

**Master build plan for the complete LifeSort product.** This is the persistent home for the full-product specification the user supplied on 2026-07-23. Do not re-paste that prompt into chat — point here instead.

This file is the **reconciled** plan: the raw product vision (Appendix A) filtered through an audit of what LifeSort actually already is. Where the raw spec conflicts with the real codebase, this plan records the decision and the reason. **When the operative plan (Parts A–F) and Appendix A disagree, Parts A–F win** — the appendix is preserved reference, not fresh truth.

## How to use this file

- **Before building any feature toward the full-product vision**, read the relevant phase in Part C and the reconciliation notes in Part A that touch it.
- This file sits alongside — not above — the five standing memory files (`AGENTS.md`, `AI_PROJECT.md`, `AI_TASK_LOG.md`, `AI_DECISIONS.md`, `AI_CHECKLIST.md`) and the two existing specs (`AI_LIFE_DOMAINS_SPEC.md`, `DESIGN.md`). It is the *forward roadmap*; `AI_PROJECT.md` remains the *current-state* record. When a phase ships, update `AI_PROJECT.md` + `AI_TASK_LOG.md` as usual and tick the status here.
- Design decisions are governed by `DESIGN.md` (the Linear-shell + Notion-content + calm-warmth hybrid). This plan does not re-specify design.
- Life Domains work is still governed by `AI_LIFE_DOMAINS_SPEC.md`. This plan does not supersede it; it extends the same philosophy to the rest of the product.

## Status legend

- ✅ **Shipped** — exists and works with real persisted data.
- 🟡 **Partial** — exists but incomplete vs the full-product target.
- 🟠 **New** — not built; genuinely new work.
- 🔵 **Decision** — a reconciliation choice recorded by this plan (see Part A/B).

---

## Part A — Reconciliation audit (spec vs. reality)

LifeSort is **not greenfield**. It is a mature app with ~62 tables, ~90 API routes, and most of the vision's surface already present in some form. The single most important instruction in the raw spec is honored literally here: *"Do not discard or replace working features … Refactor and integrate them."* Most of this plan is **finishing and connecting**, not building from scratch.

The raw spec was written as if starting fresh. The following items are where it **diverges from the real codebase** — the "unusual things" flagged during the audit — with the decision for each.

### A1 — "Replace Life Areas with Life Domains" is already done 🔵

The spec (§3) says replace Life Areas, don't maintain both. **This is already satisfied.** There is exactly one feature. The rename shipped 2026-07-23: routes are `/domains`, all user-facing copy says "Life Domain," `/life-areas*` are compatibility redirects.

The database table is still `life_areas`, the API is still `/api/life-areas`, and the shared component is still `life-area-controls.tsx` — **deliberately**, per `AI_LIFE_DOMAINS_SPEC.md` §2 (renaming the table is a breaking migration across 18 foreign keys and every query). This is a *documented decision, not drift.*

> **Decision:** Do **not** trigger a `life_areas`→`domains` table/route/component rename because the spec's wording implies it. The internal name is an implementation detail; the product-level "one system" requirement is met. Any future table rename is its own scoped, confirmed migration — not a side effect of this plan.

### A2 — Autonomous agents / OpenClaw: descoped, infra repurposed 🔵

The spec (§22, §30) is explicit: **do not build** autonomous external agents, OpenClaw integration, multi-agent orchestration, or fully automatic calendar control.

But partial infrastructure for exactly that already exists: the `agent_action_events` table, `/api/agent/actions`, and `/api/agent/execute` (which intentionally returns `501 TOOL_NOT_IMPLEMENTED`). `AI_AUDIT.md` was literally triggered by a "Pre-Agents readiness review before building the LifeSort Agents (OpenClaw-style) feature."

> **Decision:** The OpenClaw / autonomous-agent direction is **descoped and superseded by this plan.** Do not build autonomy on top of it. **Repurpose** the existing `draft → confirm → execute` audit layer (`agent_action_events` + the two routes) as the substrate for the spec's *required* AI-safety model (§22: "never silently modify," "require approval for multi-item changes," "support undo," "distinguish generated content"). Keep the table and the confirmation pattern; drop the autonomy framing and the 501 execute stub's ambition to call arbitrary tools. This turns a descoped feature into the exact guardrail the vision demands.
>
> Note: the `.agents/` directory is the installed `impeccable` design skill, **not** product agent infrastructure. Don't conflate them.

### A3 — The Money/finance surface is under-specified by the spec — preserve it 🔵

The vision is life-OS-centric (domains, tasks, planning, journal, knowledge, reviews). It barely mentions the **large, working finance surface**: `/money` dashboard, budget, income, investments (with Alpha Vantage quotes + Groq screenshot parsing), wishlist, liabilities, Money Score, currency preferences.

The spec's §30 "avoid" list bans **cryptocurrency as a reward/token gimmick** and **sales CRM / customer pipelines** — it does **not** ban personal finance tracking.

> **Decision:** **Preserve the entire Money surface.** Frame it as the tooling of the **Financial** Life Domain (it already carries `life_area_id` on income, investments, budget categories, wishlist). "Not mentioned in the new spec" must never be read as "remove." Investment price tracking stays. Do not add token/reward/crypto-gamification. This is the clearest place a careless read of the spec could destroy working, valuable functionality.

### A4 — Many overlapping capture / GTD surfaces vs. "one universal Inbox" 🔵

The spec wants **one** universal Inbox (§8) and warns (§30) against "duplicate task modules" and "duplicate planning modules." Reality ships several specialized, working, data-backed surfaces: `inbox`, `someday`, `waiting`, `commitments`, `maintenance`, `vault`, `reset`, `timeline`, plus `nuke` (a single-focus goal).

> **Decision:** Canonical capture/plan surfaces are **Inbox → Today → Tasks (with statuses)**, matching the spec. But the existing trackers hold **real user data and work** — this is a *consolidation*, not a rip-and-replace. Treat as follows:
> - `inbox` → **is** the universal Inbox; extend it (§8 processing actions, NL parsing) rather than build anew.
> - `waiting`, `someday` → conceptually the spec's task statuses `Waiting` / `Someday`. Long-term, expose them as task statuses + saved views while **keeping the existing tables and routes as compatibility lenses**. Migration of data, if ever done, is its own confirmed task.
> - `commitments`, `maintenance`, `vault` → specialized lenses with no clean task-status equivalent (obligations to people, recurring renewals, document storage). **Keep as-is**; connect them into the relationship graph (A6) and reviews.
> - `nuke` → fold conceptually into Goals as a "primary focus goal" view over time; keep the route until then.
> - `reset`, `timeline` → derived views over existing data; keep.
>
> **This consolidation is the single biggest IA decision in the plan and must be confirmed with the user before any surface is removed or a table is migrated.** Nothing here authorizes deleting a working feature.
>
> **Confirmed 2026-07-24:** user approved this direction ("go with your suggestions, as I don't want to overclutter the app"). This confirms the *approach* — consolidate carefully, extend Inbox/Today/Tasks as the canonical spine, don't build a parallel system. It does **not** by itself authorize deleting or migrating data for any specific existing surface (`waiting`, `someday`, `commitments`, `maintenance`, `vault`, `nuke`) — get an explicit go-ahead at the point any one of those is actually proposed for removal or data migration.

### A5 — Rich editor: extend Tiptap, don't move to a block table 🔵

The spec (§14) wants a full Notion-style block editor (slash commands, tables, callouts, embeds, mentions, backlinks) and §27 lists a `note_blocks` table. Reality: a shared **Tiptap** editor storing HTML in the existing `notes.content TEXT` column (a documented decision), with AI Refine + voice dictation, used by Notes and Journal.

> **Decision:** **Extend the existing Tiptap editor** (add slash menu, tables, callouts, embeds, mentions/date/entity references) rather than migrate to a `note_blocks` row-per-block model. Keep HTML-in-column storage. Backlinks/mentions are served by the generic relationship table (A6), **not** by `note_blocks`. Do not create `note_blocks` unless a concrete feature (e.g., block-level collaboration) forces it later.

### A6 — Generic relationship model: now justified, add additively 🔵

The spec (§21, §27) wants a general relationship model / `item_relationships`. Reality: many *typed* polymorphic links (`project_items`, `space_items`, `converted_type/id`, `promoted_type/id`, `life_area_id`, `goal_id`), and `AI_LIFE_DOMAINS_SPEC.md` §3.3 explicitly warned against *speculative* join tables.

The warning was against speculation. There is now a **real** need: backlinks, `@mentions`, "related items," whiteboard-connected objects, and knowledge connections (§16, §21).

> **Decision:** Add a single generic **`item_relationships`** table **additively** (`id, user_id, from_type, from_id, to_type, to_id, relation` where `relation ∈ backlink|mention|related|depends_on|source_of|converted_from|...`). It carries the *general* graph. The **existing typed links stay the source of truth for their own domains** (a task's project is still `project_items`; a task's domain is still `life_area_id`). `item_relationships` never duplicates or overrides them — it records the cross-object graph they don't capture. This is the spec's §27 rule honored: "avoid separate duplicate tables … a safe generic relationship table [is] better."

### A7 — Spec §27 table list: most already exist under other names 🔵

The spec's §27 schema is generic and aspirational. Auditing each against the real schema, **most already exist** — creating them anew would violate the spec's own "avoid duplicate tables" rule. Mapping:

| Spec §27 table | Reality | Action |
|---|---|---|
| `users`, `goals`, `projects`, `tasks`, `notes`, `calendar_events`, `people`, `tags`, `item_tags`, `attachments`, `habits`, `whiteboards`, `domains` | Exist (`domains` = `life_areas`) | Reuse |
| `habit_entries` | `habit_checkins` exists | Reuse existing name |
| `routine_items` | `routine_steps` exists | Reuse existing name |
| `reviews`, `review_responses` | `weekly_reviews` + `life_area_reviews` exist | Reuse; add **monthly** as a `period_type`, not a new table |
| `templates` | `user_templates` + code-defined templates exist | Reuse |
| `whiteboard_elements` | Liveblocks Storage holds canvas state (deliberate) | **Do not** add a Postgres table |
| `reminders` | Per-item reminder columns + `people_reminders` + `notifications` exist | Add a generic table **only if** a unified reminder engine is built |
| `user_preferences` | Columns on `users` + JSONB prefs tables | Consolidate into one table only if it reduces churn (optional) |
| `focus_sessions`, `time_entries` | Partial (`pomodoro_sessions`, Today focus overlay) | 🟠 New — add in the Execution phase |
| `item_relationships` | None | 🟠 New — see A6 |
| `task_recurrence`, `task_dependencies` | None | 🟠 New — add in Tasks depth work |
| `task_checklist_items` | ✅ Added 2026-07-24, applied to the live database | Done — see `AI_DECISIONS.md` |
| `favorites`, `recent_items` | None (favorites is a UI placeholder) | 🟠 New — Utilities phase |
| `note_blocks` | N/A — HTML-in-column | **Do not** add (see A5) |

### A8 — `AI_AUDIT.md` is a point-in-time snapshot with superseded items ⚠️

`AI_AUDIT.md` (dated 2026-05-17) predates two big shifts: the **OpenRouter→Gemini** provider migration (its env-var and integration sections still say OpenRouter) and the **agents descope** (A2). Some of its security findings also appear addressed since (e.g., `lib/safe-fetch.ts` now exists, matching its SSRF remediation R3).

> **Decision:** Treat `AI_AUDIT.md` as historical. Before acting on any finding there, **re-verify current status** — do not assume CRON_SECRET (N1), OAuth-state (N2), SSRF (N3), or schema-consolidation (N4) are still open. A fresh security pass belongs in the Hardening phase (Part C, Phase 7) and should re-baseline that document.

### A9 — Smaller flags (no blocking decision)

- **Nav restructure (§4):** the spec's sidebar (TODAY / PLAN / LIFE DOMAINS / WORKSPACE / UTILITIES) differs from the current hubs (Home, Today, Journal, Workspace, Whiteboard, Money, Reflect, Coach). A real IA change — sequence it in Foundation, but **keep all existing hub routes as redirects** (the app already relies on this pattern). **Confirmed 2026-07-24** — user approved proceeding with this restructure ("go with your suggestions, as I don't want to overclutter the app"), which is also the explicit rationale for keeping the new sidebar tight (§4: "Do not overcrowd the sidebar with every minor view") rather than surfacing every existing route.
- **Monthly review:** Weekly + per-domain reviews exist; daily reflection lives in Journal. **Monthly review is a gap** → add as a review `period_type`.
- **Tests:** none exist (no test runner). The spec (§26, §31) requires them. Foundational gap.
- **Games / daily-content:** off-spec but harmless; daily-content is already de-emphasized. Leave; do not invest. Don't add leaderboards/gamification (§30).
- **`package.json` name is `my-v0-project`:** cosmetic; leave (a rename risks the Vercel project link). Product name is LifeSort everywhere that matters.
- **PWA:** a manifest exists; installability/offline capture do not. Hardening phase.

### A10 — Completeness check: all 33 spec sections cross-referenced (2026-07-24)

The user asked directly whether the plan covers everything from the original 33-section spec. It does — verified section-by-section against Appendix A and the phase/schema/criteria parts that operationalize it. Three real gaps surfaced during this check and were fixed (not just noted): Phase 0 was missing the spec's explicit "authentication and authorization review" item (added below); Phase 3 treated Search as fully done when the spec's filter/action list (§20) hadn't actually been audited (added a bullet); Phase 7 had no explicit "production cleanup" item (added). One inaccuracy was also fixed: Appendix A §3 had drifted from the source spec by adding "People" to the domain dashboard's tab list, which the original text does not include there (people connect to domains, but aren't a dashboard tab per §3/§5) — corrected.

| § | Topic | Coverage |
|---|---|---|
| 1 | Product vision | Appendix A ¶1 |
| 2 | Hierarchy | ¶2 |
| 3 | Life Domains | ¶3 (dashboard tab list corrected to match source) |
| 4 | Navigation | ¶4 · Phase 0 · A9 |
| 5 | Design direction | ¶5 · governed in full by `DESIGN.md` |
| 6 | Page categories | ¶6 |
| 7 | Today dashboard | ¶7 · Phase 2 |
| 8 | Universal Inbox/Capture | ¶8 · Phase 2 · A4 |
| 9 | Tasks | ¶9 · Phase 1 |
| 10 | Projects | ¶10 · shipped |
| 11 | Goals | ¶11 · shipped |
| 12 | Calendar & planning | ¶12 · Phase 2 |
| 13 | Focus Mode | ¶13 · Phase 4 |
| 14 | Notes & knowledge | ¶14 · Phase 3 · A5 |
| 15 | Journal | ¶15 · shipped |
| 16 | Whiteboards | ¶16 · Phase 5 |
| 17 | Habits & routines | ¶17 · shipped |
| 18 | Reviews | ¶18 · Phase 3 |
| 19 | People | ¶19 · shipped |
| 20 | Search & command palette | ¶20 · **gap fixed** — added an explicit Phase 3 filter/action audit bullet instead of a blanket "done" |
| 21 | Relationships | ¶21 · A6 |
| 22 | AI assistance | ¶22 · A2 · Phase 6 |
| 23 | Templates | ¶23 · Phase 5 |
| 24 | Notifications/reminders | ¶24 |
| 25 | Import/export | ¶25 · Phase 7 |
| 26 | Web/technical | ¶26 · Phase 7 · **gap fixed** — added the missing Foundation-level auth/authorization review to Phase 0 |
| 27 | Database | ¶27 · reconciled fully in A7 / Part D |
| 28 | Implementation process | ¶28 · mirrored as Part C's per-phase discipline |
| 29 | Build order | ¶29 · **is** Part C's phase structure, 1:1 |
| 30 | Remove/avoid/postpone | ¶30 · all 30 listed items preserved |
| 31 | Quality requirements | ¶31 · Part E |
| 32 | Working style | ¶32 |
| 33 | Completion criteria | Part F · live status |

---

## Part B — Canonical decisions locked by this plan

Fast reference (each expanded in Part A). Record any change to these in `AI_DECISIONS.md`.

1. `life_areas` table/route/component names are **kept**; "Life Domains" is the product name only. (A1)
2. **No autonomous agents / OpenClaw.** `agent_action_events` + `/api/agent/*` are repurposed as the AI confirm-before-write / undo / audit layer. (A2)
3. **Money/finance is preserved** as Financial-domain tooling. Never removed for being under-specified. No crypto/token gamification. (A3)
4. Canonical capture = **Inbox → Today → Tasks**; existing trackers are consolidated *carefully*, never rip-and-replaced, and **no surface is removed without user confirmation.** (A4)
5. Rich text = **extend Tiptap** (HTML-in-column); **no `note_blocks` table.** (A5)
6. Add **one additive `item_relationships` table** for the general backlink/mention/related graph; typed links stay authoritative for their own domains. (A6)
7. **Reuse existing tables**; do not recreate `habit_entries`/`routine_items`/`reviews`/`templates`/`whiteboard_elements` under spec names. (A7)
8. All AI stays **read-only until explicit confirmation**, rate-limited, model-allowlisted, `is_ai_excluded`-aware — the pattern already enforced across the app. No new AI trust model. (§22 = existing practice)
9. Preserve architecture: Next.js App Router, raw Neon SQL (no ORM), custom cookie sessions, shadcn/Radix + Tailwind + `app/globals.css` HSL tokens, `@/` imports. (per `AI_DECISIONS.md`)
10. `AI_AUDIT.md` is historical; re-verify before acting on it. (A8)
11. **User confirmed 2026-07-24:** proceed with the A4 (careful capture/GTD consolidation) and A9 (nav restructure) directions as written, motivated by not wanting to overclutter the app. This unblocks starting Phase 0. It does not pre-authorize deleting or migrating any specific existing surface's data — that is still confirmed individually when proposed (A4).
12. "Don't overclutter" is now an explicit, user-stated design constraint, not just an inference from `DESIGN.md`. Apply it when in doubt on borderline scope calls: prefer folding a capability into an existing surface over adding a new nav item, tab, or page.

---

## Part C — Phased build roadmap (grounded in current state)

Follows the raw spec's build order (§29) but annotated with what already exists. Each phase: land as focused commits, each with an `AI_TASK_LOG.md` entry, `npx tsc --noEmit` + `npm run build` recorded, and visual verification. **Do not** advance a phase with disconnected mock UI, dead buttons, or placeholder AI presented as complete (spec §28).

### Phase 0 — Foundation
- ✅ App shell, sidebar, command palette (`⌘K`), Quick Add/Capture, auth + authorization, raw-SQL data layer, theme tokens.
- ✅ **Design-system token migration** — migrated `app/globals.css` HSL variables (light + dark) onto the `DESIGN.md` values: calm teal primary, warm canvas/ink/hairline tokens, and a `.domain-spine` utility (2026-07-24, see `AI_TASK_LOG.md`). The 8-color domain palette swatch wiring (`lib/life-areas.ts`) and applying `.domain-spine` to actual domain pages are deliberately deferred to Phase 1 domain-dashboard depth work — see that task log entry for why.
- ✅ **Shared object types** — `lib/types/index.ts` (2026-07-24, see `AI_TASK_LOG.md`) is a barrel exporting canonical types for all core objects (`Task`, `Goal`, `Project`, `Note`, `Person`, `VaultItem`, `WishlistItem`, `SomedayItem`, `InboxItem`, `WaitingItem`, `Commitment`, `MaintenanceItem`, `CustomSection`, `DailyJournalEntry`, `Investment`, `IncomeSource`, `BudgetCategory`) mirroring `scripts/schema.sql`, plus re-exports of the types that already lived in their own lib module (`LifeArea`, `Space`, `Whiteboard`, `User`/`Session`, `ItemRelationship`). Purely additive — existing per-page ad-hoc types (e.g. `app/tasks/page.tsx`'s local `Task`) are not migrated to import from it; that adoption happens gradually as those pages are next touched.
- ✅ **`item_relationships`** table + minimal read/write API (A6) — foundational for backlinks, mentions, connected objects. Migration written and mirrored into `schema.sql`/`fresh-install.sql` (2026-07-24, see `AI_TASK_LOG.md`/`AI_DECISIONS.md`), `GET`/`POST`/`DELETE` on `/api/item-relationships` with per-type ownership validation, unit-tested. **Not yet applied to any live database** (per `AGENTS.md`, migrations aren't run without explicit confirmation) and no UI consumes it yet — wiring a backlinks/related-items panel into Notes/Journal/Domains is follow-up Phase 1/3 work.
- ✅ **Nav restructure** to the §4 grouping, keeping hub redirects (A9). Implemented 2026-07-24 (see `AI_TASK_LOG.md`): the sidebar now shows 5 labeled groups (Today, Life Domains, Workspace, Reflect, Utilities) reconciled onto LifeSort's actual hub set rather than the spec's literal grouping (our hubs already consolidate many spec-level features, so grouping applies one level up — see A9 reasoning). Also added a first-class **Domains** sidebar link (`/domains`), closing a real gap: Life Domains had no direct nav entry point before this, only reachable via URL/search. No hub routes removed; all existing redirects preserved. Verified visually at desktop/tablet/mobile widths.
- ✅ **Test harness** — Vitest wired as `npm test` with a first real suite on `lib/auth.ts` + one CRUD route (`app/api/tags/route.ts`, 20 tests). `npm run lint`'s ESLint flat config is also fixed and running (2026-07-24, see `AI_TASK_LOG.md` for the ESLint 9 vs. 10 / `eslint-config-next` v15 vs. v16 dead ends) — it now surfaces 293 pre-existing findings across the codebase, which is expected for a linter running for the first time and is tracked as separate follow-up cleanup, not blocking.
- ✅ **Auth/authorization review** (§29 Foundation) — lightweight pass across all 114 `app/api/**/route.ts` files completed 2026-07-24 (see `AI_TASK_LOG.md`). No unprotected user-data routes found; fixed a false-positive gap in `AI_CHECKLIST.md`'s auth-scoping grep check (it didn't recognize the equally-valid `getUserFromRequest()` helper). One minor, non-security style inconsistency noted (not fixed) in `wishlist/convert-to-investment`. Full security re-baseline (CRON secret, OAuth state, SSRF re-verification) remains deferred to Phase 7 (A8) as planned.
- **Exit:** teal/warm theme live in both modes; `item_relationships` callable; nav regrouped without broken links; `npm test` runs with ≥1 real test; auth pattern spot-check clean; tsc clean; build green.
- **Phase 0 complete as of 2026-07-24.** All six items above are ✅. Every exit criterion is met: theme migrated (light+dark, verified via screenshots), `item_relationships` has a working mocked-and-unit-tested API (migration not yet applied to a live database), nav is regrouped with zero broken links/redirects, `npm test` runs 30 real tests across 3 files, the auth spot-check found no vulnerabilities, `tsc --noEmit` and `npm run build` are clean throughout. Move to Phase 1 (Core organization) next; see that phase's bullets for the next specific item.

### Phase 1 — Core organization
- ✅ Life Domains (Phases 1–3 of `AI_LIFE_DOMAINS_SPEC.md`), Goals, Projects, Tasks (base), Tags (`tags`/`item_tags`), Attachments (R2).
- 🟡 **Tasks depth** — the spec (§9) separates **due date vs scheduled date vs duration** and wants subtasks, checklist, recurrence, reminder, actual duration, the full status set (Inbox/Next/In Progress/Waiting/Someday/Completed/Cancelled). Sequenced into 3 sub-steps (`AI_TASK_LOG.md` 2026-07-24 16:20 entry):
  - ✅ Sub-step 1 — `task_checklist_items` (subtasks/checklist), collapsible panel on `/tasks` (2026-07-24, see `AI_TASK_LOG.md` and `AI_DECISIONS.md`). Migration applied to the live database.
  - 🟠 Sub-step 2 — split due/scheduled/duration + the full status set (schema + UI). Not started.
  - 🟠 Sub-step 3 — `task_recurrence` + `task_dependencies`. Not started; recurrence is the meatiest piece.
- ✅ **Wire Tags + Attachments** into Goals/Projects/Notes (2026-07-24, see `AI_TASK_LOG.md`). Tags (`TagPicker`/`item_tags`) wired into the Goal modal and Project detail page only — Notes deliberately excluded since it already has its own freeform `TEXT[]` tags (`AI_DECISIONS.md`). Attachments wired into Goals, Projects, and Notes (all three already allowed in the `attachments` CHECK constraint; no migration needed).
- 🟠 **Relationships UI** — "related items" / backlinks surfaced on Task/Goal/Project/Note/Domain via `item_relationships`.
- **Exit:** a task can carry due≠scheduled≠duration, subtasks, a recurrence rule, and related items, all persisted; Tags/Attachments usable beyond their first surface.

### Phase 2 — Daily planning
- ✅ Inbox, Today (focus items, capacity, overload, drag-reschedule week view), Calendar (month/week, drag-schedule, Google read-only sync), domain overview widget.
- 🟡 **Universal Inbox processing** (§8) — complete/schedule/assign-domain/assign-project/convert/tag/someday/archive/delete as inline actions; NL parsing on capture ("Friday 4pm #Financial").
- 🟡 **Today as command center** (§7) — daily intention, top-3 (exists), scratchpad→object conversion, drag tasks onto calendar with resize, "move unfinished to another day," end-of-day reflection (journal already does part).
- 🟡 **Upcoming** view; **Suggested planning** (§12) — time-slot suggestions from deadline/priority/duration/working-hours/energy, **user-approved** (never autonomous).
- 🟠 **Recurrence engine** materialization (ties to Phase 1 `task_recurrence`); **reminder** consolidation.
- **Exit:** capture→inbox→process→schedule works end to end; recurring tasks generate; Today can timebox onto the calendar.

### Phase 3 — Knowledge & reflection
- ✅ Notes (folders, tags, pin, Tiptap, AI Refine), Journal (mood/energy/gratitude/reflection, autosave, heatmap, privacy), Search, People, per-domain + weekly reviews, Reflect hub.
- 🟡 **Rich editor upgrade** (A5, §14) — slash menu, tables, callouts, code, embeds, mentions/date/entity refs, TOC, word count.
- 🟡 **Backlinks & connections** (§21) via `item_relationships` — surfaced in Notes/Journal/Domains.
- 🟡 **Reviews** — add **Monthly** (period_type) and **Daily** review as first-class (today it's journal-embedded); reflection prompt customization.
- 🟠 **Favorites** + **Recent items** (`favorites`, `recent_items` tables; favorites is a UI placeholder today).
- 🟡 **Search depth** (§20) — audit and close gaps against the full filter list (type/domain/project/goal/date/status/tag/attachment/created/updated) and confirm every listed command-palette action exists (open recent, move item, change theme). Search and the palette work today but haven't been checked against this specific list.
- **Exit:** editor supports blocks/mentions; backlinks render; daily/weekly/monthly/domain reviews all exist; favorites & recents persist; Search/palette verified against the full §20 filter and action list.

### Phase 4 — Execution & development
- ✅ Habits (`habits`/`habit_checkins`), Routines (`routines`/`routine_steps`), Domain Focus Mode, Life Balance.
- 🟡 **Focus Mode** (§13) — a dedicated focus session over a task (current task + checklist + related notes + timer + pause/complete + follow-up + progress) beyond the Today overlay and the standalone `/pomodoro`.
- 🟠 **`focus_sessions` + `time_entries`** (A7) — record estimated vs actual duration; feed capacity planning and reviews.
- 🟡 **Domain balance/attention** deepening (`AI_LIFE_DOMAINS_SPEC.md` §12 Phase 3, deferred).
- **Exit:** a focus session persists start/end/actual-duration against a task and rolls up into Today capacity + reviews.

### Phase 5 — Visual thinking
- ✅ Whiteboards (Liveblocks MVP: pen/shape/text/sticky, presence, share).
- 🟠 **Connected objects** (§16) — sticky↔task/note conversion; embed live tasks/projects/goals/notes/events/domains on a board, kept in sync (via `item_relationships`, A6). **No `whiteboard_elements` Postgres table** (A7 — Liveblocks owns canvas).
- 🟡 **Whiteboard templates** (mind map, brainstorm, project plan, decision map, goal breakdown, weekly plan, vision board) and **export** (image/PDF).
- 🟠 **Templates** breadth (§23) — extend `user_templates` + code templates to tasks/goals/journal/routines; no public marketplace (§30).
- **Exit:** a sticky converts to a real task that stays linked; boards export; core templates exist.

### Phase 6 — Intelligence
- ✅ Coach chat, Capture parsing, Weekly Summary, Today Planner, Life Balance, What-Am-I-Ignoring, Reset suggestions, LifeScore explanation, Refine text, Template Builder — all read-only + confirm-before-write + rate-limited + `is_ai_excluded`-aware.
- 🟠 **Semantic/retrieval search** over authorized user data (§20, §22) — "answer questions using LifeSort data," find related content; retrieval must respect domain/journal privacy.
- 🟡 **Suggested domain assignment** at capture made proactive; **suggested scheduling** (Phase 2 tie-in); **review preparation** drafts.
- ✅/🔵 **AI safety substrate** — formalize on the repurposed `agent_action_events` (A2): every multi-item AI change becomes pending actions the user approves; **undo** support; generated content visibly marked.
- **Exit:** ask-your-data search works with citations and privacy respected; multi-item AI changes route through the confirm/undo layer.

### Phase 7 — Product hardening
- 🟠 **Imports** (§25): Todoist, Notion, CSV, Markdown, Google Calendar. **Exports** (§25): CSV, Markdown, JSON, ICS, PDF, full-workspace export.
- 🟡 **PWA** installability + 🟠 **offline capture**.
- 🟡 **Accessibility**, **performance**, **responsive** polish (responsive foundation already exists via `use-breakpoint`).
- 🟠 **Security re-baseline** — re-verify and close `AI_AUDIT.md` items against current code (A8); rotate the flagged R2 token; add `R2_*` to Vercel.
- 🟠 **Tests** for critical paths (auth, core CRUD, reminders, sharing, finance integrations, AI confirm-flow).
- 🟠 **Production cleanup** (§29) — remove dead code found along the way (e.g. confirm `components/global-search.tsx`'s dead-code status per `AI_DECISIONS.md` and delete if still unused), resolve the `pomodoro_sessions`/`pomodoro_settings` table disposition flagged in `AI_AUDIT.md` §J, revisit the `package.json` `my-v0-project` name.
- **Exit:** a user can import from Todoist/Notion/CSV and export everything; installable PWA; security doc re-baselined; critical-path tests green; known dead code/tables resolved.

---

## Part D — Schema plan (summary)

New tables this plan authorizes (all additive, `user_id`-scoped, FK-integrity, reusing existing where possible per A7):

- `item_relationships` (Phase 0/A6) — the general graph.
- `task_checklist_items`, `task_recurrence`, `task_dependencies` (Phase 1).
- `focus_sessions`, `time_entries` (Phase 4).
- `favorites`, `recent_items` (Phase 3).
- Optional/deferred: unified `reminders`, unified `user_preferences` — only if they reduce real churn.

**Explicitly not created:** `note_blocks` (A5), `whiteboard_elements` (A7), and any table duplicating `habit_checkins`/`routine_steps`/`weekly_reviews`/`life_area_reviews`/`user_templates`.

Migrations follow the repo convention: dated additive files in `scripts/migrations/`, mirrored into `scripts/schema.sql` + `scripts/fresh-install.sql`, **never run against a database without explicit user approval and target confirmation** (`AGENTS.md`).

---

## Part E — Guardrails (apply to every phase)

From the raw spec (§28, §31) and repo conventions, non-negotiable:

- Preserve working features; refactor and integrate, don't discard (§32).
- No disconnected mock UI, no dead buttons, no placeholder AI presented as complete (§28).
- Every feature: real persisted data, ownership/`user_id` checks, validation (prefer Zod), loading + empty + error states, responsive, keyboard-accessible where apt, on the `DESIGN.md` system.
- No new framework/ORM/auth/state library/service without explicit request (`AI_DECISIONS.md`).
- AI never writes without explicit confirmation; respects `is_ai_excluded` and journal privacy; rate-limited; model-allowlisted.
- Documentation is part of Done: update `AI_TASK_LOG.md` (+ the matrix files) in the **same commit** as code (`AGENTS.md`).
- Do not remove or migrate a data-backed surface (A4) without user confirmation.

---

## Part F — Completion criteria (spec §33) with current status

A user can:

1. Create an account + configure preferences — ✅
2. Create/manage Life Domains — ✅
3. Create goals inside domains — ✅
4. Create projects and tasks — ✅ (tasks depth 🟡)
5. Capture via universal Inbox — 🟡 (processing/NL parsing)
6. Plan tasks on a calendar — 🟡 (timebox+resize)
7. Today as daily command center — 🟡
8. Track habits and routines — ✅
9. Focus Mode + record work — 🟡 (session persistence)
10. Notes + connected knowledge — 🟡 (editor + backlinks)
11. Private journal — ✅
12. Whiteboards connected to real objects — 🟡 (connected objects)
13. People + important dates — ✅
14. Daily/weekly/monthly/domain reviews — 🟡 (monthly + first-class daily)
15. Search all personal data — 🟡 (semantic/ask-your-data)
16. Safe AI assistance — ✅ (broaden per Phase 6)
17. Import and export data — 🟠
18. Reliable desktop + mobile web — 🟡 (PWA/offline)
19. Recover gracefully from errors — 🟡
20. Understand + control private data — ✅ (domain privacy, journal privacy)

**Roughly: the product is ~60–65% of the full vision by surface, with the core organizational spine (domains/goals/projects/tasks/habits/journal/notes/calendar/AI-safety) already real.** The remaining work is depth (tasks, editor, focus), connection (relationships, backlinks, connected objects), reflection breadth (monthly/daily reviews), intelligence (retrieval search), and hardening (import/export, PWA, tests, security re-baseline).

---

## Appendix A — Full product specification (preserved reference)

The user's 2026-07-23 full-product prompt, preserved verbatim in substance so it never needs re-pasting. **Where this appendix and Parts A–F disagree, Parts A–F win** (they are the reconciled, project-grounded version).

> Treat all previous instructions about LifeSort, Life Domains, competitor comparisons, feature recommendations, and the Linear-plus-Notion design direction as one unified product specification. Build the complete product, carefully, in ordered phases — not uncontrolled repo-wide changes.

**1. Product vision.** Web-first personal operating system: Capture → Organize → Plan → Focus → Reflect → Find, connecting Life Domains, Goals, Projects, Tasks, Calendar, Habits/Routines, Notes/Knowledge, Journal, Whiteboards, Reviews, People, Files, Search, AI. It is a personal productivity/life-management platform — **not** an enterprise PM suite, team chat, CRM, social network, or autonomous-agent platform.

**2. Hierarchy.** Life Domain → Goal → Project → Task, but no level is forced — any object may attach directly to a domain. Everything connectable via relationships.

**3. Life Domains.** Replace Life Areas entirely (one system). Create/template/rename/reorder/icon+color/describe; status active/paused/hidden/archived; desired attention; review frequency; assign goals/projects/tasks/habits/routines/notes/journal/events/files/whiteboards/people/reviews; one primary + optional secondary domains; domain-focused view; review progress; privacy for sensitive domains. Each domain has a dashboard (Overview/Goals/Projects/Tasks/Habits/Calendar/Knowledge/Journal/Review), hiding empty sections.

**4. Navigation.** Linear-style grouped sidebar: TODAY (Today, Inbox) · PLAN (Calendar, Upcoming, Routines) · LIFE DOMAINS (shortcuts, All Domains) · WORKSPACE (Projects, Goals, Knowledge, Journal, Whiteboards, People, Reviews) · UTILITIES (Search, Recent, Favorites, Settings). Quick Capture + Command Palette always global. Don't overcrowd.

**5. Design.** Hybrid. Linear for shell/sidebar/lists/nav/search/command-palette/filters/status/priority/keyboard/speed/modals/drawers/menus/optimistic updates. Notion for rich text/notes/journal/docs/descriptions/overview content/templates/files/embeds/blocks/backlinks. LifeSort identity: softer/warmer than Linear, more structured than Notion; calm, spacious, personal, premium, accessible, responsive, fast; neutral backgrounds, subtle borders, controlled cards, moderate radius, clear type, subtle domain accents, restrained animation, light+dark. Avoid excess gradients, floating rounded cards everywhere, decorative animation, corporate issue-tracker styling, dense engineering layouts, empty blank-canvas experiences. *(Governed in detail by `DESIGN.md`.)*

**6. Page categories.** Structured (stable): Today, Inbox, Tasks, Calendar, Upcoming, Search, Routines, Settings. Flexible (block content): Notes, Journal, Documents, Reflections. Hybrid (fixed + flexible): Life Domains, Projects, Goals, Reviews, People. Not every screen is freely customizable.

**7. Today dashboard.** Date+greeting, daily intention, top-3 priorities, today's events, scheduled tasks, overdue tasks, habits/routines, available focus time, estimated workload, capacity warning, quick scratchpad, quick capture, start focus, end-of-day reflection. Users can pick 3 priorities, drag tasks onto calendar, resize/move scheduled tasks, distinguish fixed events vs flexible tasks, convert scratchpad to objects, move unfinished work to another day, complete reflection. Keep it focused, not every metric.

**8. Universal Inbox + Quick Capture.** Capture task/note/idea/journal/link/file/voice/event/project-idea via global button, keyboard shortcut, command palette, mobile control. NL parsing where practical ("Review investment plan Friday at 4 PM #Financial" → title/date/time/domain/project/tags). Capture first, organize later. Inbox processing: complete/schedule/assign-domain/assign-project/convert-type/tag/someday/archive/delete.

**9. Tasks.** Fields: title, description, status, priority, due date, scheduled date, scheduled start/end, duration estimate, actual duration, domain, project, goal, tags, subtasks, checklist, recurrence, reminder, attachments, related objects, created/updated/completed timestamps. Statuses: Inbox/Next/In Progress/Waiting/Someday/Completed/Cancelled. Views: Today/List/Board/Calendar/Upcoming. Recurrence: daily/weekdays/weekly/monthly/yearly/custom interval/repeat-after-completion/fixed. **Due date, scheduled date, and duration are distinct fields — not the same.**

**10. Projects.** Fields: name, description, status, domain, goal, start/target date, priority, progress, health, icon/cover, tasks, notes, files, whiteboards, reviews, activity, decisions, relationships. Statuses: Planned/Active/Paused/Completed/Cancelled/Archived. Page: Overview/Next actions/Tasks/Milestones/Calendar/Notes/Files/Whiteboards/Decisions/Review history. Health states explainable: On track / Needs attention / Blocked / No recent activity. No unexplained AI scores.

**11. Goals.** Fields: title, description, why-it-matters, domain, type, target date, status, measurement type, starting/current/target value, unit, related projects, related habits, review frequency, progress history. Types: Outcome/Habit/Maintenance/Learning. Weekly + monthly goal reviews. Not an enterprise OKR platform.

**12. Calendar & planning.** Views: Day/Week/Month/Agenda (Week is primary). Events, scheduled tasks, recurring events, all-day, time zones, filtering, drag-drop, task resizing, conflict detection, domain filters, Google Calendar; Outlook later if architecture permits. Manual planning (drag into time) + Suggested planning (recommend slots from deadline/priority/duration/events/working-hours/energy/domain-priority/workload) — **user must approve; no fully autonomous calendar control.**

**13. Focus Mode.** Current task, description, checklist, related project, related notes, timer, estimated/actual duration, pause, complete, add note, create follow-up, update progress, move to next scheduled task. After a session: complete / continue later / update estimate / record progress / create next action / add journal or work note. Avoid heavy gamification.

**14. Notes & knowledge.** One rich content system. Editor: paragraphs, headings, bulleted/numbered/checklists, quotes, callouts, code, tables, dividers, images, files, links, embeds, mentions, date/task/project/domain/whiteboard references, slash commands, drag-drop blocks, autosave, keyboard shortcuts. Note features: tags, collections, backlinks, related items, favorites, pinning, templates, version history, archive, export, full-text search, TOC, word count. Don't recreate every Notion database capability.

**15. Journal.** Calm and personal. Views: Today/Timeline/Calendar/Entries/Prompts/Insights. Entry: rich text, mood, energy, emotion tags, domain, photos, files, voice notes, related people/projects/tasks, gratitude, lessons, entry type, privacy. Types: Daily reflection/Free writing/Gratitude/Decision journal/Progress log/Memory/Project reflection/Weekly reflection. Privacy: private by default, optional lock, permanent deletion, export, exclude entries/domains from AI, no AI analysis without consent. Handwritten font only as an optional journal theme, never app-wide.

**16. Whiteboards.** Infinite canvas: text, sticky notes, shapes, connectors, freehand, images, files, frames, zoom, pan, multi-select, alignment, undo/redo, export image/PDF. Connected objects: tasks/projects/goals/notes/journal/events/domains; a sticky convertible to a task or note; connected objects stay synced with source records. Templates: mind map/brainstorm/project plan/decision map/goal breakdown/weekly plan/vision board. No public marketplace initially.

**17. Habits & routines.** Distinct concepts (habit = repeated behavior tracked; routine = ordered group). Support daily/weekly frequency, selected weekdays, flexible targets, reminders, completion history, optional streaks, skip-without-penalty, pause, notes, domain, routine grouping, habit targets, time-of-day. Streaks are not the main motivation.

**18. Reviews (a major differentiator).** Daily (completed/unfinished/wins/difficulties/mood-energy/lessons/tomorrow-prep). Weekly (clear inbox → review completed → overdue → projects → calendar → domains → goals/habits → pick next-week priorities → record lessons). Monthly (outcomes/time-allocation/project+goal progress/habit patterns/journal themes/domain attention/next-month priorities). Prompts customizable + skippable.

**19. People.** Lightweight personal records: name, photo, contact, relationship, domain connections, notes, important dates, related tasks/events/journal/projects, last interaction, follow-up reminders. Not a sales CRM.

**20. Search & command palette.** Search across tasks/projects/goals/domains/notes/journal/whiteboards/events/files/people/tags/reviews. Filters: type/domain/project/goal/date/status/tag/attachment/created/updated. Palette actions: create task/note/journal/project/event, open Today, open domain, start focus, schedule task, search, open recent, move item, change theme. Full keyboard navigation.

**21. Relationships & knowledge connections.** General relationship model: backlinks, mentions, related items, parent-child, dependencies, people relationships, domain relationships, goal-project-task, source relationships, converted-from. Avoid duplicating copied objects.

**22. AI assistance.** Integrated into workflows (not an isolated page). Capabilities: summarize notes/projects/domains, notes→tasks, extract deadlines, suggest subtasks, improve writing, find related content, answer questions from LifeSort data, generate weekly summaries, prepare reviews, suggest time slots, identify unresolved items, suggest domain assignment, suggest relationships. Requirements: show info used; never silently modify; require approval for multi-item create/change; support undo; distinguish generated content; allow AI disabled; respect domain/journal privacy; retrieval only from authorized data; loading/error/empty states. **Do not build:** autonomous external agents, OpenClaw, silent auto-rescheduling, automatic messaging, purchases, multi-agent systems, always-on external monitoring.

**23. Templates.** For tasks/projects/goals/notes/journal/whiteboards/domains/daily-plans/weekly+monthly-reviews/habits/routines. Builder: default properties, content blocks, prompt questions, default tasks/sections/domain-relationships. Not programming-like.

**24. Notifications & reminders.** Task/event/habit/routine/review reminders, waiting-task follow-ups, project-inactivity, goal-review. Controls: quiet hours, daily digest, per-item reminders, email prefs, browser notifications, future mobile. Avoid excessive motivational notifications.

**25. Import/export/ownership.** Import: Todoist, Notion, CSV, Markdown, Google Calendar. Export: CSV, Markdown, JSON, ICS, PDF where suitable, full-workspace export. Users own their data.

**26. Web/technical.** Web-first: responsive, installable PWA, fast load, autosave, optimistic updates, keyboard nav, accessible components, light+dark, reliable deep links, browser history, loading/empty/error/retry states, offline capture where feasible, secure auth, authorization checks, input validation, DB constraints, rate limiting, logging, error + performance monitoring, migrations, seed data, tests. No full native mobile app until web is stable; prepare architecture for a future mobile companion (Today/Quick capture/Tasks/Calendar/Journal/Search/Voice/Notifications).

**27. Database.** Inspect before modifying. Support (at minimum): users, user_preferences, domains, domain memberships/relationships, goals, projects, tasks, task_dependencies, task_recurrence, task_checklist_items, habits, habit_entries, routines, routine_items, notes, note_blocks/documents, journal_entries, calendar_events, reviews, review_responses, people, tags, item_tags, attachments, whiteboards, whiteboard_elements, item_relationships, reminders, notifications, templates, favorites, recent_items, focus_sessions, time_entries, AI audit records. Normalized relationships; a safe generic relationship table over per-pair duplicates; referential integrity; soft delete only where recovery/sync needs it. *(Reconciled in Part A7 / Part D — most already exist.)*

**28. Implementation process (per phase).** Inspect code → identify reusable → identify conflicting/obsolete → plan smallest coherent sequence → update schema safely → backend → interface → loading/empty/error → validation/authorization → test → visual verify → fix regressions before continuing. Don't rewrite working systems without clear benefit; no disconnected mock UI; no dead buttons; no placeholder AI presented as complete.

**29. Build order.** Foundation (audit, design cleanup, shared types, migration strategy, relationships, layout, sidebar, palette, quick capture, auth review) → Core Organization (domains, goals, projects, tasks, tags, attachments, relationships) → Daily Planning (inbox, today, upcoming, calendar, timeboxing, capacity, recurrence, reminders) → Knowledge & Reflection (editor, notes, journal, reviews, people, search, backlinks, favorites, recent) → Execution (habits, routines, focus, time tracking, domain focus, balance) → Visual (whiteboards, connected objects, templates, export) → Intelligence (semantic search, AI summaries, task extraction, domain assignment, scheduling, review prep, AI privacy) → Hardening (imports, exports, PWA, offline, a11y, perf, security, testing, responsive, cleanup).

**30. Remove/avoid/postpone.** No Life Areas separate from Life Domains; no duplicate task/planning/note/AI-search modules; no team chat, video, screen recording, employee/timesheet tools, sales CRM, customer pipelines, agile sprints, enterprise permissions, complex Gantt, public social feed, followers, public profiles, leaderboards, reward tokens, cryptocurrency, full email client, public template marketplace, huge integration marketplace, autonomous AI agents, OpenClaw, multi-agent orchestration, fully automatic calendar control, deeply nested domain hierarchies, or a full custom database-builder.

**31. Quality.** Every feature: real persisted data, validation, ownership/permissions, loading/empty/error states, responsive, keyboard-accessible where apt, on the shared design system, no duplicate business logic, tests for critical behavior, no breaking existing functionality. Visually inspect every page after implementation.

**32. Working style.** Don't return only a plan. Audit then implement. Before major architectural changes, briefly explain what exists / what changes / why / affected files, then make the change. After each coherent group report: completed / files changed / DB changes / tests / visual verification / remaining work / decisions needed. Continue phase to phase without per-task approval; make reasonable decisions on unspecified minor details; don't discard working features for differing slightly — refactor and integrate.

**33. Completion criteria.** *(Tracked with live status in Part F.)*

---

*Created 2026-07-23 by Claude Code (audit + reconciliation). Keep this file current: when a phase ships, update its status here and in `AI_PROJECT.md`/`AI_TASK_LOG.md`.*
