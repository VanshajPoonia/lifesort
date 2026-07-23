# AI_LIFE_DOMAINS_SPEC.md

Product specification for the **Life Domains** system. This is an extension of the existing LifeSort product specification (`AI_PROJECT.md`), not a replacement. It supersedes the term **"Life Areas"** everywhere the concept is discussed going forward.

**Do not build Life Domains as a second, parallel feature.** LifeSort already ships a working implementation of this concept under the "Life Areas" name (`app/life-areas/*`, `life_areas` table, `life-area-controls.tsx`, and `life_area_id` foreign keys on 18 tables — see §3). Life Domains is the renamed, expanded target for that existing feature. Every phase below is additive work on top of the current implementation, never a duplicate route, table, or component tree.

---

## 0. Status Quo — What Already Exists (Phase 0 baseline)

Read this before touching any Life Domains work. Source of truth: `AI_PROJECT.md` line for Life Areas, and the schema.

- Route: `app/life-areas/page.tsx` (list) and `app/life-areas/[id]/page.tsx` (detail).
- Table: `life_areas` (`id`, `user_id`, `name`, `icon`, `color`, `description`, `sort_order`, timestamps; `UNIQUE(user_id, name)`). No status/lifecycle, no importance/attention fields, no review cadence, no hierarchy.
- Connected via a single nullable `life_area_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL` on: `tasks`, `goals`, `projects`, `notes`, `wishlist_items`, `investments`, `income_sources`, `budget_categories`, `custom_sections`, `habits`, `people`, `vault_items`, `inbox_items`, `someday_items`, `waiting_items`, `commitments`, `maintenance_items`. That is one FK column per table — a single-primary-domain model already, which matches §6 below ("most items should have one primary domain").
- Consumed today by: Weekly Review (`/review`), Life Balance / "What Am I Ignoring?" insights (`/reflect`, `/api/ai/life-balance`, `/api/ai/what-am-i-ignoring`), LifeScore (`/api/life-score`), and every quick-add/create form across the app via `components/life-area-controls.tsx`.
- Not present today: domain dashboards, domain tabs (Overview/Goals/Projects/Tasks/Habits/Calendar/Knowledge/Journal/Review), desired attention, domain health status, focus mode, subdomains, lifecycle (active/paused/archived/hidden — today areas can only be created/edited/deleted), templates, domain-scoped privacy, multi-domain linking, onboarding domain setup, journal/calendar association.

Everything below is scoped against this baseline so no work duplicates it.

---

## 1. Purpose

Life Domains let a user divide their life into meaningful areas and manage each separately while still seeing how everything fits together. Beyond categorization, each domain is a focused space: a dashboard, a set of views, a review cadence, and (optionally) a temporary focus mode.

Starter domain set (used in onboarding, §4): Physical, Mental, Financial, Career, Relationships, Personal. Users are never restricted to this set — create, rename, reorder, hide, archive, or delete freely.

---

## 2. Terminology Rename

| Old | New | Notes |
|---|---|---|
| Life Area | Life Domain | User-facing term everywhere: nav, page titles, empty states, AI copy, onboarding. |
| `life_areas` table | stays `life_areas` (Phase 1), see §3 | Renaming the table is a breaking migration touching 18 FKs + every route/query. Do it as a single scoped migration in Phase 1, not incrementally, and update `AI_DECISIONS.md` when it happens. Until that migration lands, code comments/docs should say "Life Domain (stored as `life_areas`)" rather than silently keeping old user-facing copy. |
| `life_area_id` columns | stays until the rename migration | Same reasoning. |
| `components/life-area-controls.tsx` | rename to `life-domain-controls.tsx` in the same migration pass, not before (avoid two names mid-flight) | |
| `/life-areas`, `/life-areas/[id]` | `/domains`, `/domains/[id]`, with `/life-areas*` kept as compatibility redirects (matches the existing `/organize`, `/budget`, `/insights` redirect pattern) | |

No new "Life Domains" table, route, or component should be created alongside the existing ones at any point — extend and rename in place.

---

## 3. Data Model

### 3.1 New columns on `life_areas` (Phase 1)

Additive, nullable/defaulted so existing rows remain valid:

- `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived','hidden'))` — lifecycle (§13).
- `importance TEXT CHECK (importance IN ('low','medium','high'))` — nullable, user-set.
- `desired_attention TEXT CHECK (desired_attention IN ('low','medium','high'))` — §11.
- `review_frequency TEXT CHECK (review_frequency IN ('weekly','monthly','quarterly','custom','none')) DEFAULT 'none'`.
- `health_status TEXT CHECK (health_status IN ('thriving','stable','needs_attention','paused','not_assessed')) DEFAULT 'not_assessed'` — user-set, AI may suggest, never silently overwrite (§16).
- `parent_domain_id INTEGER REFERENCES life_areas(id) ON DELETE SET NULL` — subdomains, max depth 1 (§14; enforce depth in application code, not a CHECK constraint).
- Optional free-text fields: `definition_of_success TEXT`, `current_concerns TEXT`, `long_term_vision TEXT`, `current_focus TEXT`, `boundaries TEXT`.
- `is_ai_excluded BOOLEAN NOT NULL DEFAULT false` and `requires_reauth BOOLEAN NOT NULL DEFAULT false` — §15 privacy.

### 3.2 New table: `life_area_reviews` (Phase 2, §11)

Mirrors the existing `weekly_reviews` shape but scoped to one domain: `id`, `user_id`, `life_area_id`, `period_type` (weekly/monthly/quarterly/custom), `period_start`, `period_end`, prompt-answer fields (`feeling`, `improved`, `needs_attention`, `stress`, `stop_doing`, `continue_doing`, `next_action`), `attention_adjustment`, timestamps. Reuse the existing weekly-review UI patterns rather than inventing a new review component.

### 3.3 Multi-domain linking (Phase 3, only if needed)

The current single-`life_area_id`-column model is intentionally kept as the default for Phase 1 and 2 — it already matches "most items should have one primary domain" (§6). Do **not** add a join table speculatively. If cross-domain linking (e.g. "Plan anniversary trip" tagged Relationships + Financial + Recreation) becomes a real user request, add a single polymorphic table `life_area_links (id, life_area_id, item_type, item_id, is_primary)` rather than a join table per source table, and keep the existing `life_area_id` column as the primary-domain source of truth (`is_primary` rows must match it) so nothing that reads `life_area_id` today breaks.

### 3.4 Journal and Calendar association

`daily_journal` entries and `calendar_events` currently have no `life_area_id`. Adding it is Phase 2 work (needed for the Journal tab in §7 and the domain dashboard's "recent journal entries" / "upcoming events" widgets) — additive nullable FK, same pattern as the other 18 tables.

---

## 4. Onboarding Integration

Extend the existing `onboarding` flow (`app/api/onboarding`) with a Life Domains step:

- Present the six starter domains (§1) as pre-checked suggestions with icon + accent color already assigned.
- Let the user uncheck any, add custom domains inline (name, icon, color, optional description), reorder, and set each to active/hidden before finishing.
- Do not force a fixed structure — "skip all" must be a valid path that leaves the user with zero domains, matching how the rest of onboarding already treats optional steps.
- Store the result as normal `life_areas` rows via the existing `/api/life-areas` POST — no new onboarding-specific table.

---

## 5. Domain Dashboard & Views

`app/domains/[id]/page.tsx` (renamed from `app/life-areas/[id]/page.tsx`) gains a tab bar. Reuse the existing tab-bar pattern already used by `/money` and `/workspace`:

**Overview** — summary cards (goals, projects, tasks due, habit consistency, recent journal, recent notes, upcoming deadlines, current focus). **Goals**, **Projects**, **Tasks** — filtered views of the existing pages scoped by `life_area_id`, not new list implementations. **Habits and Routines** — filtered `app/habits` data. **Calendar** — filtered `calendar_events` once §3.4 ships. **Knowledge** — notes, links, files, whiteboards scoped to the domain. **Journal** — entries once §3.4 ships. **Review** — history from `life_area_reviews` (§3.2).

Hide tabs with zero connected items rather than showing empty states everywhere — every domain does not need every tab visible.

Different domains show different Overview metrics (health ≠ financial ≠ mental) — do not force one generic card layout; the Overview cards a domain shows should be driven by what data types it actually has connected, not a fixed template.

---

## 6. Domain Versus Project Versus Goal

Keep the existing three-level relationship, now named consistently:

- **Domain** — ongoing area of responsibility, no fixed completion (Health, Finance, Career).
- **Goal** — a desired result within a domain, uses existing `goals.life_area_id` and `goals` → `tasks.goal_id` linking, already implemented.
- **Project** — a temporary, completable outcome inside a domain, uses existing `projects.life_area_id` and `project_items`, already implemented.
- **Task/Habit** — may attach directly to a domain with no project or goal in between (`tasks.life_area_id` without a `goal_id`), already implemented.

This hierarchy already exists in the schema; the only work here is making it visible in the UI (the domain Overview tab should show Goals → Projects → Tasks as a nested summary, not three disconnected lists).

---

## 7. Capture and Quick Domain Assignment

Already implemented broadly via `life-area-controls.tsx` selectors on tasks, goals, projects, notes, wishlist, investments, income, budget, habits, people, vault, inbox, someday, waiting, commitments, and maintenance forms. Two gaps to close:

- **Universal Capture and Quick Add** (`/capture`, `components/quick-add-modal.tsx`) should let AI suggest a domain from the item's text (e.g. "Book dentist appointment" → Physical) but must never auto-assign without the user confirming — same confirmation-before-write pattern already used for every other Capture draft field.
- Domain selection stays optional at capture time everywhere (capture first, organize later) — this is already true for the existing life-area selectors and must not regress.

---

## 8. Today Screen Integration

Add a compact domain overview to `app/today/page.tsx` and the dashboard (`app/page.tsx`), in the same collapsible-secondary-section style the dashboard already uses for Quick Access/LifeScore/summaries:

```
Physical        2 tasks today · 1 habit due
Financial       1 bill upcoming · Monthly review due
Career          3 active tasks · 1 project needs attention
Relationships   No planned activity this week
```

Let users choose which domains appear here (a `settings` preference, same pattern as existing `sidebar-preferences`/`Home layout preference`). Derive counts from existing queries already used by `/api/navigation-summary` and `/api/today-plan` — do not stand up a new aggregation endpoint if those can be filtered by `life_area_id`.

---

## 9. Domain Focus Mode (Phase 2)

A session-scoped filter, not a separate workspace: entering focus mode for a domain filters Today, Search, and suggested actions to that domain's items and tints the shell with the domain's accent color, matching the existing per-theme CSS-variable approach in `app/globals.css` rather than introducing component-level inline styling. Exiting focus mode returns to the normal unfiltered shell. No data is ever separated into a disconnected workspace — this is a client-side filter over the same tables.

---

## 10. Planning System Integration

Extend the existing Today Plan / weekly planning flow (`app/today/page.tsx`, `/api/ai/today-plan`) so weekly planning can ask "which domains need attention this week?" and surface candidate tasks from just those domains. This is a filter on the existing candidate-gathering logic already in `/api/ai/today-plan` — not a new planning engine. As with every other AI suggestion in this app, surfaced items require explicit confirmation before creation/scheduling.

---

## 11. Domain Reviews

Extend `app/review/page.tsx` (Weekly Review) and add per-domain review history (`life_area_reviews`, §3.2) at a frequency the user sets per domain (`review_frequency`). Default prompts:

> How does this area of life feel right now? What has improved? What needs attention? What is creating stress? What should I stop doing? What should I continue doing? What is the next meaningful action? Does this area need more or less attention?

Prompts must be user-editable/skippable — do not hardcode them as required fields, matching how the existing Weekly Review already treats reflection fields as optional.

**Desired attention vs. actual activity**: compare `desired_attention` against real signal (time scheduled, tasks completed, habit consistency) and surface gentle, specific nudges — "You wanted to prioritize Physical Health this month, but no time has been scheduled for it this week" — never a guilt framing ("You are failing in your Health domain"). This copy rule applies to every domain-related notification and AI message in the app.

---

## 12. Life Balance View (extends existing feature)

`/reflect` already has a Life Balance tab backed by `/api/ai/life-balance`. Extend it, don't duplicate it, with:

- Desired vs. actual attention comparison (§11).
- Domains with no recent activity.
- Habit consistency by domain.

Keep the existing framing: awareness, not a score to maximize. The existing non-AI metrics stay non-AI; only the read-only Gemini analysis layer changes.

---

## 13. Domain Lifecycle

Add `active` / `paused` / `archived` / `hidden` (`status` column, §3.1). Archiving must preserve all connected records (no cascade delete — the existing `ON DELETE SET NULL` FKs already protect connected items from a domain delete, but archive is a status flip, not a delete, so this is purely a filter change in list queries). Use cases: pausing Education after finishing school; creating a temporary domain (Pregnancy, Relocation, Divorce) for a life season and archiving it after.

---

## 14. Domain Hierarchy (Phase 2, optional)

`parent_domain_id`, max one level deep (a subdomain cannot itself have subdomains — enforce in the API layer). Example: Physical Health → Fitness / Nutrition / Sleep / Medical. Purely optional; a domain with no subdomains behaves exactly as today.

---

## 15. Privacy Controls

Per-domain, using the new `is_ai_excluded` and `requires_reauth` columns (§3.1):

- Exclude a domain from AI context in Coach (`/api/chat`), Capture, Life Balance, and "What Am I Ignoring?" — every AI route that currently reads `life_area_id`-scoped data must check `is_ai_excluded` before including it, the same way journal AI features already respect user-level privacy limits (`/api/journal/insights` is already documented as "90-day privacy-limited").
- Exclude from Global Search result previews.
- Optional `requires_reauth` gate before opening the domain page — reuse existing session auth, do not build a second auth system; this can be a simple password/PIN re-prompt backed by the existing session.
- Item-level privacy (already partially true — journal privacy exists) should compose with domain-level privacy, not conflict with it.

---

## 16. AI Features and Guardrails

Within a domain, AI (via existing routes: Coach, Life Balance, What Am I Ignoring, Today Planner, Capture) may: summarize active goals, find unresolved tasks, suggest a next action, prepare a review draft, identify neglected projects, group unorganized content, suggest habits, compare desired vs. actual attention.

AI must **not**: diagnose mental or physical conditions, give authoritative financial conclusions, assign a `health_status` without the user setting or confirming it, read an `is_ai_excluded` domain, or restructure domains (merge/archive/create) without explicit confirmation. This matches every existing AI guardrail already documented in `AI_PROJECT.md` (read-only analysis, explicit confirmation before writes, rate limits, model allowlisting) — no new AI trust model is introduced.

---

## 17. Domain Templates (Phase 2)

Extend the existing Smart Templates system (`lib/templates.ts`, `/templates`) rather than building a parallel template mechanism. Add domain-flavored starter templates (Physical Health, Mental Health, Financial, Career, Relationships) that, like existing templates, only preview and never write until the user confirms "Create this system." A domain should be fully usable with zero template applied.

---

## 18. People Integration

Already implemented (`people.life_area_id`). No schema change needed. Keep People lightweight and personal — this is an existing product constraint (`AI_PROJECT.md`'s People description), not a new one; Life Domains work must not turn it into a CRM.

---

## 19. Development Roadmap

Phased against the Phase 0 baseline in §0 — each phase is additive to the existing `life_areas` implementation, never a rewrite.

**Phase 1** (extends what already ships): rename Life Area → Life Domain in UI copy and routes with compatibility redirects (§2); `status`/`importance`/lifecycle columns (§3.1); domain dashboard with tabs (§5); onboarding domain step (§4); Today screen domain overview (§8).

**Phase 2**: domain reviews (§3.2, §11); domain templates (§17); desired attention + gentle nudges (§11); domain health status (§3.1, §16); domain focus mode (§9); domain privacy controls (§15); journal/calendar association (§3.4); optional subdomains (§14).

**Phase 3**: Life Balance View deepening (§12) with time/activity analysis; domain AI summaries beyond current Coach scope; suggested domain assignment at capture (§7) made proactive rather than only-on-request; cross-domain insights; multi-domain linking only if justified by real usage (§3.3); mobile widgets (out of scope until a mobile shell exists).

Each phase lands as its own set of focused commits with matching `AI_TASK_LOG.md` entries, per the standard repo workflow — not one large migration.

---

## 20. Product Positioning

Internal/user-facing name stays **Life Domains** (clearer than "Domainify," kept only as internal shorthand if useful). Reference copy: "Turn every part of your life into a space you can understand, organize, and improve." / "Manage life by domain, not by scattered to-do lists." / "Bring your health, money, work, relationships, and goals into one connected system." This is copy guidance for onboarding/marketing surfaces, not a UI requirement.

---

## 21. Explicit Non-Duplication Checklist

Before starting any Life Domains implementation task, confirm:

- [ ] No new table is created that duplicates `life_areas` (extend it — §3.1).
- [ ] No new route tree is created alongside `/life-areas` (rename with redirects — §2).
- [ ] No new selector component is created alongside `life-area-controls.tsx` (rename in the same pass — §2).
- [ ] No new per-table domain FK pattern is introduced where `life_area_id` already exists (§0 already covers 18 tables).
- [ ] Domain-scoped Goals/Projects/Tasks/Habits/Notes tabs reuse existing list components filtered by `life_area_id`, not new list implementations (§5).
- [ ] Any new AI behavior follows the existing confirm-before-write and rate-limit patterns already documented in `AI_PROJECT.md` (§16).
