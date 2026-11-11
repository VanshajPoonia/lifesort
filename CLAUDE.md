@AGENTS.md

# CLAUDE.md

Operating instructions specific to Claude Code on the LifeSort repository. The shared workflow lives in `AGENTS.md` (imported above) and the `AI_*.md` files in the project root.

## Claude Code Role

**Claude Code is the only AI agent working on this repository** (user decision, 2026-11-11). Codex is no longer used. Claude plans, implements, reviews and verifies its own work.

That means:

- Build features and fixes directly when the user asks. No fallback signal is needed.
- Plan before building anything large, and check the plan against `AI_BUILD_PLAN.md` Part 0, which holds the current direction and build order.
- Review your own diff before committing. Look for regressions, unrelated drift and broken redirects.
- Older `AI_*.md` entries mention Codex and handoffs between agents. Treat those as history.

## Workflow

The memory files are the source of truth. Read them before starting and consult them during work:

| File | When to use it |
|---|---|
| `AI_BUILD_PLAN.md` | Before feature work: Part 0 is the current direction and build order. |
| `AI_MARKET_RESEARCH.md` | When a choice depends on who LifeSort is for or what competitors do. |
| `AI_TASK_LOG.md` | Before starting: read recent entries and known issues. During work: check if a migration or fix was already attempted (also search `AI_TASK_LOG_ARCHIVE.md` for anything before 2026-10). After work: write the new entry. |
| `AI_DECISIONS.md` | Before introducing any pattern, library, or architecture change: confirm it aligns with recorded decisions. |
| `AI_CHECKLIST.md` | Before running commands or touching env vars: verify the correct command and variable names. |
| `AI_PROJECT.md` | When scope is unclear: confirm whether a feature is already implemented or planned. |
| `AGENTS.md` | When unsure about conventions or workflow: this file is the rule set. |

Implementation expectations:

- Make minimal, focused changes scoped to the requested task.
- Avoid unrelated refactors.
- Preserve existing architecture unless there is a documented reason in `AI_DECISIONS.md` to change it.
- Follow the coding conventions and architecture conventions described in `AGENTS.md`.
- Keep LifeSort simple for everyday people. Fold new capability into an existing place before adding a page or nav item.
- If a decision conflicts with the chat history, follow the memory file and flag it to the user.

## Documentation Updates After Every Code Change

This is the most commonly skipped step. It is not optional.

After any code change, no matter how small, Claude must update `AI_TASK_LOG.md` before the task is considered done. The update goes in the **same commit** as the code, not a separate one.

Checklist before closing a task:
- [ ] `npx tsc --noEmit` run and result recorded
- [ ] `npm run build` run and result recorded
- [ ] `AI_TASK_LOG.md` updated with a new dated section
- [ ] Other `AI_*.md` files updated if applicable (see `AGENTS.md` matrix)
- [ ] Documentation staged and committed together with the code

When Claude only reviews or plans without changing any files, no `AI_*.md` updates are required.
