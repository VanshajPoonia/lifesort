# AI_CHECKLIST.md

Verification and safety checklist for AI agents working on LifeSort.

## Local Setup Checklist

1. Read:
   - `AGENTS.md`
   - `AI_PROJECT.md`
   - `AI_TASK_LOG.md`
   - `AI_DECISIONS.md`
   - `AI_CHECKLIST.md`
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

These are the project memory. Do not rely on chat history.
If anything in the chat conflicts with these files, trust the files.

After completing the task:
- Run npx tsc --noEmit and npm run build
- Update AI_TASK_LOG.md with: date, task, files changed, commands run, results, remaining issues, next steps
- Include the AI_TASK_LOG.md update in the same commit as the code

Task:
[your task here]
```

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
- `OPENROUTER_API_KEY`
- `JWT_SECRET`
- Vercel/Neon/Postgres provisioned variables such as `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `PGHOST`, `PGUSER`, and related names.

Check only names/presence unless explicitly authorized to inspect values.

## Commands

- Install: `pnpm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Start production server: `npm run start`
- Lint: `npm run lint`

Unavailable scripts:

- No `test` script is defined.
- No `typecheck` script is defined.
- No `format` script is defined.
- No database migration runner script is defined.

Database scripts:

- SQL files live in `scripts/`.
- Do not run them automatically.
- Treat `scripts/website-current-schema.sql` as the closest canonical baseline until production schema state is verified.

## Current Command Behavior

Known as of 2026-05-16:

- `npm run build` passes.
- `npm run build` skips TypeScript validation and linting because of `next.config.mjs`.
- `npm run build` emits warnings that `metadata.themeColor` and `metadata.viewport` should move to viewport exports.
- `npm run lint` fails before source linting because ESLint cannot find `eslint.config.(js|mjs|cjs)`.

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
5. For database issues, compare queries against `scripts/website-current-schema.sql`.
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
