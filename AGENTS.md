# AGENTS.md

Main operating instructions for AI coding agents working on LifeSort.

## Project Overview

LifeSort is a personal life-management web app. The current product scope includes a dashboard, custom email/password authentication, tasks, goals, a "nuke goal", calendar events and Google Calendar integration, notes, links/folders/sharing, wishlist items, investments, income sources, budgeting, daily content/games, settings, admin subscription controls, and an AI productivity chat.

This repository appears to be generated/synced from v0 and deployed on Vercel. Keep changes minimal, focused, and based on the existing codebase.

## Required Reading Before Any Task

Before starting any task, every AI agent must read:

- `AGENTS.md`
- `AI_PROJECT.md`
- `AI_TASK_LOG.md`
- `AI_DECISIONS.md`
- `AI_CHECKLIST.md`

Do not rely on chat history as the source of truth. These files are the durable project memory.

## Repository Structure

- `app/`: Next.js App Router pages, loading states, root layout, global CSS, and route groups.
- `app/api/`: Next.js route handlers for auth, CRUD APIs, AI features, calendar sync, reminders, search, sharing, and finance integrations.
- `components/`: Shared app components such as dashboard shell, auth provider, onboarding, quick add, search, reminders, games, and theme controls.
- `components/ui/`: shadcn/Radix-style UI primitives.
- `hooks/`: Shared React hooks such as toast and mobile detection helpers.
- `lib/`: Shared server utilities for auth, database access, and class-name merging.
- `scripts/`: Raw SQL schema baseline and migration/patch scripts.
- `public/`: App icons, manifest, logos, and placeholder assets.
- `styles/`: Legacy/unused global CSS location; active globals are imported from `app/globals.css`.

## Tech Stack

- Next.js `15.5.9` with App Router
- React `19.2.0`
- TypeScript
- Tailwind CSS `3.4.17`
- shadcn/Radix-style component primitives
- lucide-react icons
- Neon Postgres via `@neondatabase/serverless`
- Custom cookie sessions and bcrypt password hashing
- Vercel deployment and Vercel Cron
- AI SDK packages: `ai`, `@ai-sdk/react`
- Resend for email
- Alpha Vantage for stock/crypto/forex data
- Groq vision API for investment screenshot parsing

## Commands

Current `package.json` scripts:

- Install dependencies: `pnpm install` is preferred because `pnpm-lock.yaml` exists. `package.json` does not declare a `packageManager`.
- Development server: `npm run dev`
- Production build: `npm run build`
- Production start: `npm run start`
- Lint: `npm run lint`

Current command caveats:

- No `test` script exists.
- No `typecheck` script exists.
- No formatting script exists.
- `npm run lint` currently fails because no `eslint.config.*` file exists for ESLint 10.
- `npm run build` currently passes, but `next.config.mjs` skips TypeScript validation and linting during builds.

## Coding Conventions

- Preserve existing TypeScript, React, App Router, and Tailwind patterns.
- Use `@/` imports where the repo already does.
- Use existing `components/ui` primitives and lucide icons for interface work.
- Keep page-local state local unless an existing provider or shared helper already fits.
- Keep server-side data access in route handlers or shared server utilities.
- Prefer the existing raw SQL/Neon style over introducing a new ORM.
- Validate user ownership in database queries using `user_id`.
- Keep comments short and useful. Do not add broad narration comments.
- Do not add unrelated dependencies, frameworks, services, or app architecture.

## Architecture Conventions

- Frontend pages are primarily client components using `DashboardLayout`, `useAuth`, local state, and `fetch` calls to `app/api` routes.
- Auth uses custom email/password login with a `session` cookie, the `sessions` table, and helpers in `lib/auth.ts`.
- Database access is raw SQL through Neon. The closest canonical schema baseline is `scripts/website-current-schema.sql`; older SQL scripts contain drift.
- Shared UI follows shadcn/Radix component conventions configured in `components.json`.
- Styling uses Tailwind plus CSS variables in `app/globals.css`.
- Deployment is Vercel-oriented. `vercel.json` defines a daily cron for `/api/cron/deadline-reminders`.

## Required Pre-Change Workflow

Before making code changes, every agent must:

1. Summarize the task.
2. Summarize the relevant current repo state.
3. List the files it expects to modify.
4. Identify risks or unknowns.
5. Confirm the planned approach is minimal and focused.
6. Check `git status --short`.

## While Working

- Avoid unrelated refactors.
- Avoid changing architecture unless the reason is documented in `AI_DECISIONS.md`.
- Preserve existing patterns unless there is a clear reason not to.
- Keep changes scoped to the requested task.
- Run relevant verification commands where possible.
- Do not run database scripts unless explicitly requested and the target database/environment is confirmed.
- Do not expose secrets from `.env.local` or Vercel/Neon configuration.

## Required Post-Change Workflow

After completing work, every agent must update `AI_TASK_LOG.md` with:

- Date/time of work
- Agent/tool used, if known
- Task completed
- Files changed
- Summary of changes
- Commands run
- Build/lint/test results
- Bugs found or fixed
- Remaining issues
- Suggested next steps
- Handoff notes for the next AI agent

Also update:

- `AI_DECISIONS.md` for major architecture decisions or changes.
- `AI_CHECKLIST.md` for setup, command, dependency, or workflow changes.
- `AI_PROJECT.md` for product scope, feature, structure, or deployment changes.

## Git Workflow Expectations

- Inspect the worktree before editing.
- Do not revert user or agent changes that are unrelated to the current task.
- Keep commits focused when asked to commit.
- Include documentation updates in the same change when they are part of the task.
- Before handoff, review `git diff` and call out any known existing failures.

## Handoff Between Agents

Future agents should treat the `AI_*.md` files as the project memory. When handing off:

- Record what changed and why.
- Record exact verification commands and results.
- Separate new issues introduced by the task from pre-existing issues.
- Leave a concrete next recommended task.
- Include enough context for the next agent to continue without relying on chat history.
