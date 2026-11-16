# LifeSort status

A plain summary of where LifeSort stands, written for you to come back to. Last updated 17 Nov 2026.

The detailed sources are `AI_BUILD_PLAN.md` (the plan; Part 0 is the current direction, Part C the bigger backlog), `AI_TASK_LOG.md` (what was done and how it was checked) and `AI_DECISIONS.md` (why things are the way they are).

## Short answer: is everything done?

No.

- **Part 0, the current direction (Stages 1 to 6 and the Later list):** mostly built. Everything left there is waiting on a decision from you.
- **Part C, the older detailed backlog:** many items are still partly done or not started. See [What's left in the bigger backlog](#whats-left-in-the-bigger-backlog).
- **Testing:** a lot of the new work has not been tried in a browser with real use yet. See [What has been checked](#what-has-been-checked).

## The app today

LifeSort is for everyday people and aims to be the simplest to use. It runs at lifesort.vercel.app and installs on a phone home screen.

The sidebar has seven places:

| Place | What's in it |
|---|---|
| Today | Focus list with a timer, energy check, today's list, Needs a decision, Start fresh, Plan your hours, Evening wrap-up |
| Inbox | One capture box. Type, speak or share into it, then Save or Sort with AI |
| Tasks | List, Calendar and Habits tabs. Waiting and Later are filters. Break it down on any task |
| Domains | Life areas, goals, projects, and Life Kits |
| Library | Notes, Journal, People, Vault, Links, Whiteboards |
| Money | Overview, Budget (with bank statement import), Income, Investments, Wishlist |
| Reflect | Weekly Review, What I noticed, LifeScore, Timeline, Journal |

Settings holds Profile, Notifications (with install and push), Rules, Journal, Content, FAQs and Account (with task import).

## What was built

### Stage 1: Consolidate (done 11 to 16 Nov)

- The sidebar went down to the seven places. Every old link redirects.
- Home and Today merged into one calm page. Past-due tasks show as "Needs a decision", not red overdue piles.
- Tasks became a hub. Waiting, Someday, Commitments and Maintenance folded into it.
- Capture folded into Inbox. Spaces and Custom Sections were removed.
- Library and Reflect hubs. Coach opens as a side panel on every page.
- Old screens retired: Pomodoro and Reset My Life go to Today, Focus Goal goes to Goals. Timeline and LifeScore moved into Reflect, and Rules and Notifications moved into Settings.
- 12 empty tables were dropped from the database.

### Stage 2: Installable app and capture (done 16 Nov)

- Installs to the home screen on Android and iPhone. Long-press shortcuts: Add task, Capture.
- Works offline as far as a "You're offline" page. App files are cached so it opens faster.
- Push reminders per device, switched on in Settings > Notifications. The daily reminder job runs at 8:00 IST and sends email plus push.
- Share to Inbox from other apps (Android only; iPhone doesn't allow it).
- Mic button in Inbox to speak instead of type.

### Stage 3: Life Kits (done 16 Nov)

- Eight kits: new semester, new job, moving house, getting fit, saving for something, job search, trip, renewing documents.
- A kit takes one date and sets up a goal, dated steps, habits and a budget line or Vault entry. Nothing is ever dated in the past.
- Kit cards show "Week 3 of 15" or "18 days to go". You can pause, resume, finish or remove. Removing only clears what you never touched.
- "Describe your situation" lets the AI draft a custom kit for you to check.
- Onboarding now starts with "What's going on in your life right now?"

### Stage 4: Photo to Vault (not built)

Parked by you. See [Waiting on you](#waiting-on-you).

### Stage 5: Life Patterns (done 17 Nov)

- Reflect > What I noticed: plain notes from your last 12 weeks. For example "Your mood dipped in weeks when more tasks slipped" or "You get the most done on Tuesdays".
- It says what happened together, never that one thing caused another. It stays quiet until there's enough data.
- Hide any note for four weeks. An optional AI read explains the week gently.
- It replaced the Life Balance and "What you're missing" tabs.

### Stage 6: Calendar and daily routine (mostly done 17 Nov)

- Plan your hours on Today: drag today's tasks into half-hour slots next to your calendar and Google events. Opens by itself before noon.
- Move to tomorrow in the evening wrap-up, with Undo.
- Not done: two-way Google Calendar sync (your choice, Google stays read-only).

### From the Later list (done 17 Nov)

- Break it down: AI splits a task into small steps with minutes and sets the task's length.
- Bring your tasks over (Settings > Account): Todoist or any CSV.
- Import a bank statement (Money > Budget): HDFC, SBI, ICICI style CSVs. Safe to import twice.

## What has been checked

Every change passed typecheck, the build and the tests (189 tests now). Beyond that:

| Area | How it was checked | Tried for real? |
|---|---|---|
| Stage 1 screens and redirects | Browser test with a throwaway account | Yes |
| Install, shortcuts, share, offline | Browser test on desktop Chrome | Partly. Not on a phone yet |
| Push reminders | Push service accepted the test | No. Your Mac's Chrome never received pushes. Needs a phone test |
| Life Kits | Database queries checked with EXPLAIN, nothing written | No |
| What I noticed | Queries run read-only for a made-up user | No real data yet |
| Plan your hours, Move to tomorrow | Uses existing APIs, no new database code | No |
| Kit drafts, task breakdown | Real AI calls with made-up text | Not in the app |
| Task and bank imports | Database writes checked with EXPLAIN | Not with real files |

You declined test accounts after Stage 2, so most checks since then avoided writing data.

### Worth trying when you have ten minutes

- [ ] Install from lifesort.vercel.app on your phone, turn on push, tap Send a test
- [ ] Share a link from another app on Android
- [ ] Speak into Inbox, then Sort with AI
- [ ] Domains > Start a kit > Getting fit, then look at Today
- [ ] One "Describe your situation" kit
- [ ] Plan your hours on Today
- [ ] Break it down on a task
- [ ] Import a Todoist export (check the priorities look right in the preview)
- [ ] Import one bank CSV

## Waiting on you

| Item | What it needs from you |
|---|---|
| Stage 4: snap a photo and it files itself | Replace the Cloudflare R2 key that was exposed in an old chat, then I add it to Vercel |
| Two-way Google Calendar sync | Add the calendar.events permission in Google Cloud and reconnect. Google may show an "unverified app" warning |
| ChatGPT and Claude connector | A decision on how those apps sign in to your LifeSort account |
| Email to task, WhatsApp or Telegram capture | An inbound email address or a bot account |
| Notion import | Your Notion export format, or a Notion connection |
| Shared household | A decision on who can see what |
| lifesort.kreativvantage.com | Fix the Cloudflare DNS setting (it returns a 404) |

## What's left in the bigger backlog

From `AI_BUILD_PLAN.md` Part C. These were planned before Part 0 and wait until after it.

**Daily planning**
- Natural language capture, like "Friday 4pm #Financial"
- An Upcoming view
- Suggested time slots for tasks (you approve them)
- Recurring tasks generating their next copy reliably; one place for reminders

**Knowledge and reflection**
- Richer editor: slash menu, tables, callouts, mentions, links between notes
- Backlinks shown in Notes, Journal and Domains
- Monthly and daily reviews alongside the weekly one
- Favorites and Recent items
- Search checked against the full filter list

**Doing the work**
- A fuller focus mode on a task (checklist, notes, timer, follow-up)
- Recording estimated against actual time, feeding planning and reviews

**Visual thinking**
- Turn a whiteboard sticky into a real task that stays linked
- Whiteboard templates and export
- Templates for journal and routines

**Intelligence**
- Ask questions about your own data, with privacy respected
- Suggested domain at capture; review preparation drafts
- One approve and undo layer for every multi-item AI change

**Hardening**
- Exports: CSV, Markdown, JSON, calendar file, full workspace
- Imports still missing: Notion, Markdown, Google Calendar
- Capture that works offline and syncs later
- Accessibility and performance pass
- Security re-check of old audit items
- Tests for critical paths (auth, reminders, sharing, money)
- Cleanup: remove `components/global-search.tsx` (unused), rename the package from `my-v0-project`

## Known issues

- Coach replies show raw markdown (like `**bold**`).
- Opening a date in the Journal saves an empty entry.
- AI features (kit drafts, What might this mean, Break it down) took 16 to 105 seconds in tests. The server stops at 60.
- Push keys are not set for Vercel Preview builds, so push is off there. Production is fine.
- Pattern weeks and weekdays use server time, so they can be a day off near midnight in India.
- 50 lint findings remain. All are a known, reviewed kind.
