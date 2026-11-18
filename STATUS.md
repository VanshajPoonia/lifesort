# LifeSort status

A plain summary of where LifeSort stands, written for you to come back to. Last updated 18 Nov 2026.

The detailed sources are `AI_BUILD_PLAN.md` (the plan; Part 0 is the current direction, Part C the bigger backlog), `AI_TASK_LOG.md` (what was done and how it was checked) and `AI_DECISIONS.md` (why things are the way they are).

## Short answer: is everything done?

No.

- **Part 0, the current direction (Stages 1 to 6 and the Later list):** mostly built. On 18 Nov you approved four parked features. Photo to Vault is built and live. Two-way Google sync and the ChatGPT/Claude connector are built but wait on your OK for database changes. Email/WhatsApp capture is next.
- **Part C, the older detailed backlog:** many items are still partly done or not started. See [What's left in the bigger backlog](#whats-left-in-the-bigger-backlog).
- **Testing:** a lot of the new work has not been tried in a browser with real use yet. See [What has been checked](#what-has-been-checked).

## The app today

LifeSort is for everyday people and aims to be the simplest to use. It runs at lifesort.vercel.app and installs on a phone home screen.

The sidebar has seven places:

| Place | What's in it |
|---|---|
| Today | Focus list with a timer, energy check, today's list, Needs a decision, Start fresh, Plan your hours, Evening wrap-up |
| Inbox | One capture box. Type, speak or share into it, then Save or Sort with AI. The camera button files a photo into the Vault |
| Tasks | List, Calendar and Habits tabs. Waiting and Later are filters. Break it down on any task |
| Domains | Life areas, goals, projects, and Life Kits |
| Library | Notes, Journal, People, Vault, Links, Whiteboards |
| Money | Overview, Budget (with bank statement import), Income, Investments, Wishlist |
| Reflect | Weekly Review, What I noticed, LifeScore, Timeline, Journal |

Settings holds Profile, Notifications (with install and push), Rules, Journal, Content, FAQs and Account (with task import, and the ChatGPT/Claude connector once it is live).

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

### Stage 4: Photo to Vault (built 18 Nov)

- Snap or pick a photo of a bill, policy, warranty or ID from the camera button in Inbox, or Scan a photo in Library > Vault.
- The AI fills in a form: name, Vault section, dates, amount and anything due. You check it. Nothing is saved until you tap Save.
- Ticks add a reminder two weeks before it renews, a task for anything due, and the amount as spending in Money.
- If the AI can't read it, the same form opens empty so you can still file it.
- The photo itself is kept with the Vault entry once file storage works. See [Waiting on you](#waiting-on-you).

### Stage 5: Life Patterns (done 17 Nov)

- Reflect > What I noticed: plain notes from your last 12 weeks. For example "Your mood dipped in weeks when more tasks slipped" or "You get the most done on Tuesdays".
- It says what happened together, never that one thing caused another. It stays quiet until there's enough data.
- Hide any note for four weeks. An optional AI read explains the week gently.
- It replaced the Life Balance and "What you're missing" tabs.

### Stage 6: Calendar and daily routine (mostly done 17 Nov)

- Plan your hours on Today: drag today's tasks into half-hour slots next to your calendar and Google events. Opens by itself before noon.
- Move to tomorrow in the evening wrap-up, with Undo.
- Two-way Google Calendar sync (built 18 Nov, not live yet). Tasks > Calendar > Connect Calendar has a switch: "Put my LifeSort events and planned tasks on Google". With it on, your LifeSort events and the tasks you plan into a time slot appear in Google Calendar. If you move or rename one of those in Google, LifeSort follows. Your other Google events still show in LifeSort as before. It goes live once you OK one database change and set up Google. See [Waiting on you](#waiting-on-you).

### From the Later list (done 17 Nov)

- Break it down: AI splits a task into small steps with minutes and sets the task's length.
- Bring your tasks over (Settings > Account): Todoist or any CSV.
- Import a bank statement (Money > Budget): HDFC, SBI, ICICI style CSVs. Safe to import twice.

### ChatGPT and Claude connector (built 18 Nov, not live yet)

- Settings > Account > "Use LifeSort in ChatGPT or Claude" shows one address to paste into Claude or ChatGPT as a connector. You sign in to LifeSort, see what's shared, and tap Allow.
- Then you can ask things like "what's on today?", "find my passport note" or "add 'call the plumber' to my LifeSort inbox".
- It can see tasks, goals, notes, calendar events and Inbox. It never sees Journal, Money, Vault, People, or any domain you keep away from AI. It can add to Inbox and add tasks, but can't edit or delete anything.
- The same card lists connected apps with Disconnect.
- I picked how the apps sign in (the standard OAuth way both apps support) because the build needed it. Say if you want it different.

## What has been checked

Every change passed typecheck, the build and the tests (237 tests now). Beyond that:

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
| Photo to Vault | Saves checked with EXPLAIN. Four real AI reads of a made-up bill all hit "Gemini is overloaded" and fell back to the empty form | No. The AI draft and the upload still need a real try |
| Two-way Google sync | The real code ran against a throwaway local copy of the database with Google faked: turning it on, editing, a move in Google coming back, deleting | No. Needs the database change and a real Google connection |
| ChatGPT and Claude connector | The whole sign-in and every tool ran against the local copy: consent, wrong codes refused, hidden domains stayed hidden, adding to Inbox, disconnecting | No. Needs the database change and a deploy |

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
- [ ] Snap a bill from Inbox and check the form it fills in

## Waiting on you

| Item | What it needs from you |
|---|---|
| Keeping photos and files (Photo to Vault, Vault attachments) | Replace the R2 key that was exposed in an old chat, and let browsers upload to the bucket. Steps in [R2 storage](#r2-storage) below |
| Two-way Google Calendar sync | 1. Say OK to the database change in [Database changes](#database-changes). 2. The Google Cloud steps in [Google Calendar](#google-calendar) |
| ChatGPT and Claude connector | Say OK to its database change in [Database changes](#database-changes). Nothing to set up after that; try it as in [Trying the connector](#trying-the-connector) |
| Email to task, WhatsApp or Telegram capture | An inbound email address or a bot account |
| Notion import | Your Notion export format, or a Notion connection |
| Shared household | A decision on who can see what |
| lifesort.kreativvantage.com | Fix the Cloudflare DNS setting (it returns a 404) |

### Database changes

These add new tables or columns and change nothing that exists. I tried to run the first one on the live database myself, and the safety check stopped me because you hadn't OK'd it. Fair enough. The code that needs them is built and waits on branch `worktree-four-features`. Once you say OK, I run them and put that code live.

- `scripts/migrations/2026-11-18-google-two-way-sync.sql`: three columns on `calendar_integrations` and a new `calendar_sync_links` table. Tested on a local copy of the schema, including running it twice.
- `scripts/migrations/2026-11-18-connector-oauth.sql`: new `oauth_clients` and `oauth_grants` tables, and Inbox items may come from `connector`, `email` or `whatsapp`. Tested the same way.

### Trying the connector

Once it's live:

- **Claude:** Settings > Connectors > Add custom connector. Name it LifeSort, paste `https://lifesort.vercel.app/api/mcp`, Add, then Connect. Sign in to LifeSort and tap Allow. In a chat, turn LifeSort on from the tools menu.
- **ChatGPT:** Settings > Apps & Connectors > Advanced settings > turn on Developer mode. Then Create, paste the same address, choose OAuth, and connect. Developer mode needs a paid ChatGPT plan.

### Google Calendar

In [Google Cloud Console](https://console.cloud.google.com), in the project that holds LifeSort's OAuth client:

1. Google Auth Platform > Data access > Add or remove scopes. Tick `.../auth/calendar.events` and save.
2. Google Auth Platform > Clients > LifeSort's web client > Authorized redirect URIs. Add `https://lifesort.vercel.app/api/calendar/google/callback` (and `http://localhost:3000/api/calendar/google/callback` for local testing). Connecting was broken before this because the old address pointed at lifesort.kreativvantage.com, which returns 404.
3. Google Auth Platform > Audience. If it says Testing, either add your Google account as a test user (Google then signs you out of the connection every 7 days) or press Publish app. Unverified apps show a "Google hasn't verified this app" screen. Tap Advanced, then Go to LifeSort. That's fine for your own use.
4. In LifeSort: Tasks > Calendar > Connect Calendar > Connect, allow access, then turn on "Put my LifeSort events and planned tasks on Google".

### R2 storage

The four `R2_*` settings are already in Vercel (Production and Preview). Only the key needs replacing, plus one bucket setting.

1. Cloudflare dashboard > R2 > Manage R2 API Tokens > Create API token. Permission: Object Read & Write, limited to the `lifesort` bucket. Copy the Access Key ID and Secret Access Key.
2. Vercel > project `v0-calendar-app-sb` > Settings > Environment Variables. Edit `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` with the new values for Production and Preview. Put the same two values in your local `.env.local`.
3. Back in Cloudflare, delete the old R2 token.
4. Cloudflare > R2 > `lifesort` bucket > Settings > CORS Policy > Add, and paste:
   ```json
   [{ "AllowedOrigins": ["https://lifesort.vercel.app", "http://localhost:3000"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```
5. Redeploy production so it picks up the new key (or tell me and I'll do it).

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
- On 18 Nov Gemini kept answering "this model is experiencing high demand", so every AI feature can fail at busy times. Photo scans fall back to the empty form.
- Money > Investments' screenshot reader still uses a Groq vision model that Groq has retired, so it likely fails.
- Push keys are not set for Vercel Preview builds, so push is off there. Production is fine.
- Pattern weeks and weekdays use server time, so they can be a day off near midnight in India.
- 50 lint findings remain. All are a known, reviewed kind.
