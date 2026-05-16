@AGENTS.md

# CLAUDE.md

Operating instructions specific to Claude Code on the LifeSort repository. The shared workflow lives in `AGENTS.md` (imported above) and the four `AI_*.md` files in the project root.

## Claude Code Role

Claude Code's default role on this repository is to act as a **reviewer, architecture checker, and planning assistant**:

- Review proposed changes and PRs.
- Sanity check architecture, conventions, and adherence to existing patterns.
- Help plan implementation strategies before code is written.
- Surface risks, regressions, and unrelated drift in proposed work.

Codex is the primary coding agent for this repo.

## Fallback Coding Agent Mode

Claude Code may act as the implementing coding agent when:

- The user explicitly says Codex is unavailable.
- The user explicitly says Codex is out of tokens or otherwise blocked.
- The user explicitly asks Claude to implement the change directly.

Without one of those signals, prefer review and planning over edits.

## Workflow When Claude Acts as the Coding Agent

When implementing directly, Claude Code must follow the same workflow as Codex:

- Use `AGENTS.md` as the shared workflow source.
- Use `AI_PROJECT.md` for project context.
- Use `AI_TASK_LOG.md` for current work and handoff history.
- Use `AI_DECISIONS.md` for architecture decisions.
- Use `AI_CHECKLIST.md` for commands and verification.

Implementation expectations:

- Make minimal, focused changes scoped to the requested task.
- Avoid unrelated refactors.
- Preserve existing architecture unless there is a documented reason in `AI_DECISIONS.md` to change it.
- Follow the coding conventions and architecture conventions described in `AGENTS.md`.

## Documentation Updates After Claude's Implementation Work

After completing implementation work as the coding agent, Claude must:

- Update `AI_TASK_LOG.md` with date/time, task, files changed, commands run, verification results, and handoff notes.
- Update `AI_DECISIONS.md` only if an architecture decision changed.
- Update `AI_CHECKLIST.md` only if commands, setup, dependencies, or workflow changed.
- Update `AI_PROJECT.md` only if project scope, features, or structure changed.

When Claude only reviews or plans without changing code, no `AI_*.md` updates are required.

## Normal Claude Code Usage

Typical ways the user will invoke Claude Code on this repo:

- "Review the latest completed work."
- "Check the current architecture and identify risks."
- "Act as the coding agent because Codex is unavailable."
- "Create a Codex prompt to fix the highest-priority issues."
