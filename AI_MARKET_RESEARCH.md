# AI_MARKET_RESEARCH.md

Competitor and product-market-fit research for LifeSort. Done on 2026-11-11 by Claude Code with web search.

This file is the evidence. The build order that comes out of it lives in `AI_BUILD_PLAN.md` Part 0. Decisions are recorded in `AI_DECISIONS.md`.

**Shelf life.** Competitor features and prices change fast. Treat everything here as a November 2026 snapshot and re-check before quoting a competitor in copy or pricing.

**How reliable it is.**

- Most sources are vendor blogs, app store listings and affiliate roundups. Official release notes are marked as such in the sources list.
- The search tool could not read Reddit, so real user complaints come from blogs, reviews and one DEV post.
- Prices were not checked on official pricing pages.

## Who LifeSort is for

In the user's own words (2026-11-11): LifeSort is for people to use in everyday life. It should be the simplest to use, and it should fit into people's lives through the templates we create. It ships as an installable web app.

So the target is everyday people, not productivity hobbyists. When a power feature and simplicity conflict, simplicity wins.

## The one-line finding

Every competitor owns one or two slices of life. LifeSort is the only app found that keeps tasks, habits, journal, money, people, documents and renewals in one database. Nobody uses that to connect them, and that is the opening.

Today LifeSort presents that breadth as about 40 separate pages, so it reads as clutter instead of power. Consolidating comes first. See `AI_BUILD_PLAN.md` Part 0.

## Competitor landscape

| App | What it owns | Overlap with LifeSort |
|---|---|---|
| Lunatask | Tasks, habits, mood, journal, notes and people in one end-to-end encrypted app. Native apps on every platform | Closest all-in-one rival. Has no money and no documents. Free tier limited to 2 areas of life and 7 habits |
| TickTick | Tasks, calendar, habits and focus timer. Added AI voice capture, an AI assistant and an MCP connector for ChatGPT and Claude in 2026 | Tasks, habits, Today |
| Todoist | Tasks. Ramble (voice brain dump to tasks) went GA in January 2026 | Tasks, Inbox |
| Griply | Life areas, then vision, goals, habits, tasks and calendar. Added a monthly habit grid and a life-area vision board in 2026 | Domains and goals |
| Sunsama | Guided daily planning, workload limits, shutdown routine | Today |
| Motion | AI builds and rebuilds your schedule. Now pushing "AI Employees" for work | Today, Calendar |
| Akiflow | Fast keyboard capture and manual time blocking | Inbox, Calendar |
| Tiimo | Visual day planner for ADHD. Co-Planner turns typed or spoken thoughts into a schedule with time estimates | Capture, Today, routines |
| Saner.ai | ADHD assistant. Brain dump to tasks, AI inbox, morning plan from email, notes and calendar | Capture, Today |
| Rosebud | AI journal that remembers past entries. Free plan ended 2026-09-30 | Journal |
| Apple Journal | Free on every iPhone. iOS 27 added prompts and sync status | Journal |
| Exist | Finds patterns between mood, habits and health tracker data | Insights |
| TimeAlign | Planned vs actual time per life area | Life Balance |
| Renewables, Tidee, Life Admin, LifeOnTrack | Document expiry and renewal reminders, household sharing. LifeOnTrack turns a photo of a bill into a reminder | Vault, Maintenance |
| Dex | Keep-in-touch reminders, AI briefings before meetings | People |
| Expensebit | WhatsApp expense tracking for India from text, voice notes and receipt photos | Money, capture channel |
| Notion | Build your own Life OS from templates. Personal agent, custom agents, MCP as shared memory | Everything, if you build it yourself |
| ChatGPT | Scheduled tasks that reach connected apps (Pulse was folded into this in June 2026) | Reminders, planning, coaching |

## What competitors have that LifeSort is missing

Priority is for everyday users.

| Gap | Who has it | Priority | Notes |
|---|---|---|---|
| Installable app on the phone, home screen, push notifications, share sheet | All of them | **High** | The user chose an installable web app (PWA). `public/` already has a manifest |
| Voice brain dump that becomes tasks | Todoist Ramble, TickTick, Tiimo, Saner | **High** | Cheap. `/api/ai/capture` already parses text into 9 item types |
| Time blocking on a calendar that syncs both ways | Sunsama, Akiflow, Motion, Griply, Lunatask | **High** | LifeSort only reads Google Calendar |
| Guided morning plan and evening shutdown | Sunsama | Medium | `/today` already has focus items and end-of-day reflection |
| AI splits a task into steps with time estimates | Tiimo, Motion | Medium | Small add to the existing checklist and Today planner |
| Turn an email into a task | Sunsama, Akiflow, Saner | Medium | Could share a forwarding address with "snap a photo" |
| Connect to ChatGPT or Claude (MCP) | TickTick, Notion | Later | Everyday users rarely set this up. Watch it as a threat |
| Import from Todoist or Notion | Most | Later | Helps switching |
| Bank sync | Monarch, Copilot, Expensebit | Later | Statement upload is a cheaper first step |
| Shared household | Tidee, Life Admin apps | Later | |
| End-to-end encryption | Lunatask | Skip | Conflicts with server-side AI. LifeSort answers with per-domain AI exclusion and re-auth instead |

## Where nobody does a good job yet

### 1. Templates that set up a real, working life system (Life Kits)

- **Who's close.** Notion "Life OS" templates are a real market. People pay for them on Gumroad. They are static pages, though, and reviewers say Notion needs setup and upkeep. Griply gives a structure but you fill it in yourself. Tiimo has routines, nothing more.
- **The gap.** No template creates live objects across tasks, habits, money and reminders at once, then adapts and cleans up after itself.
- **Evidence.** A system gets abandoned once keeping it up costs more than it saves (goalsandprogress.com). Kits remove the setup cost.
- **What LifeSort has.** 10 Smart Templates, My Templates, the AI Template Builder and domain starter templates.

### 2. Built for messy weeks

- **Evidence.** Several sources say overdue lists and broken streaks make opening the app feel like a guilt trip, so people stop. An arXiv survey found ADHD users call tools "rigid, impersonal or guilt-inducing". A DEV post by a builder of the indie app Dayleaf quotes users calling task apps "a highlight reel of every time you weren't productive".
- **The gap.** Dayleaf builds a calm to-do list on this idea. No all-in-one life app is built around it.
- **What LifeSort has.** Reset My Life. Nothing comparable was found elsewhere.

### 3. Snap a photo and it's sorted

- **Who's close.** Life admin apps track expiry dates, and LifeOnTrack turns a photo into a reminder. They are standalone and do not touch money or tasks. My Personal Admin promises an agent for bills, documents and warranties but was still alpha or beta in 2026.
- **What LifeSort has.** Vault, Maintenance, Budget, and Groq vision parsing of Investments screenshots.

### 4. Patterns across your whole life

- **Who's close.** Exist correlates mood, habits and health tracker data. TimeAlign compares planned vs actual time per life area.
- **The gap.** Nobody links tasks, spending, journal mood, habits and relationships, because nobody else holds all of them.
- **What LifeSort has.** All of those inputs, plus desired attention per domain.
- **Caution.** Present patterns as "noticed", not as causes.

## Threats

- **General AI assistants.** ChatGPT scheduled tasks can reach connected apps. Notion gives everyone a personal agent. TickTick shipped MCP. The risk is that people manage life through a chat window and apps become storage. Answer later with a privacy-scoped LifeSort connector. For everyday users, the answer now is being simpler than a chat window for daily life.
- **Cheap, polished task apps.** TickTick and Todoist cost a few dollars a month, have native apps and keep adding AI. LifeSort cannot win on tasks alone. It wins on kits plus the connected whole.
- **Lunatask.** Covers much of the same ground, with native apps and encryption. LifeSort's edge is money, documents, kits and patterns.
- **Apple Journal is free.** Do not compete on journaling alone. The journal feeds Patterns and messy-week recovery.

## Price snapshot (as reported, not verified)

| App | Reported price |
|---|---|
| Griply | $4.99/month or $29.99/year |
| Todoist Pro | about $5/month. Ramble free for 10 sessions a month |
| TimeAlign | $7.99/month |
| Dex | $12/month billed yearly |
| Rosebud | $12.99 to $59.99/month. No free plan since 2026-09-30 |
| Sunsama | about $17 to $22/month. No free plan |
| Motion | about $19 to $29/month |
| Akiflow | about $19 to $34/month |
| Notion Business | $20/user/month billed yearly |
| Lindy | $49.99/month |
| TickTick Premium | Price went up in 2026 |
| Lunatask | Free tier capped at 2 areas and 7 habits. Lifetime license sold before |

## Sources

Official or first-party:
- Notion release notes, 2026-10-19: https://www.notion.com/releases/2026-10-19
- TickTick What's New: https://help.ticktick.com/articles/7082552170989486080
- Todoist Ramble GA, 2026-01-21: https://www.todoist.com/help/todoist/product-updates/turn-your-scattered-thoughts-into-clear-tasks-ramble-jan-21-2026-HhmP8ue8R
- Rosebud long-term memory: https://help.rosebud.app/ai-analysis/long-term-memory
- Lunatask: https://lunatask.app and https://apps.apple.com/us/app/1583719331
- Griply compare page: https://griply.app/compare/best-life-planner-apps
- Tiimo AI planning: https://www.tiimoapp.com/product/ai-planning
- Saner.ai: https://www.saner.ai/blogs/ai-assistant-for-adhd
- Exist: https://exist.io/blog/what-exist-has-told-me/ and https://www.producthunt.com/products/exist
- TimeAlign: https://apps.apple.com/us/app/timealign/id6448807385
- Renewables: https://renewables.cubelated.com/
- Tidee: https://tidee.life/
- Life Admin: https://mylifeadmin.app/
- LifeOnTrack: https://play.google.com/store/apps/details?id=com.lifeontrack.app&hl=en
- My Personal Admin: https://www.mypersonaladmin.com/
- Expensebit: https://expensebit.com/
- Dex personal CRM list: https://getdex.com/blog/personal-crm-list/

News and reviews:
- ChatGPT scheduled tasks hub: https://itbrief.co.nz/story/openai-expands-chatgpt-scheduled-tasks-with-new-hub
- ChatGPT Pulse retirement: https://www.lilachbullock.com/chatgpt-pulse/
- Apple Journal in iOS 27: https://9to5mac.com/2026/06/11/heres-everything-new-for-journal-in-ios-27/
- Rosebud review 2026 (written by a competitor): https://blog.mylifenote.ai/rosebud-review/
- Griply 2026 launch: https://www.producthunt.com/p/griply/griply-2026
- Motion AI Employees review: https://max-productive.ai/ai-tools/motion-ai/
- Motion vs Sunsama vs Akiflow vs Amie: https://blog.apps.deals/motion-vs-sunsama-vs-akiflow-vs-amie-mac
- Best planner apps 2026: https://2sync.com/blog/best-planner-apps
- Life OS apps compared (vendor blog): https://discyhabit.com/blog/best-life-os-apps/
- Best WhatsApp AI assistants 2026: https://www.perisclaw.com/blog/best-whatsapp-ai-assistants
- LifeWheel comparison: https://lifewheel.us/compare/wheel-of-life-vs-habit-tracker-apps/
- Notion Life OS template (example of the paid template market): https://bettercreating.com/products/lifeos

Why people quit productivity apps:
- Why Most Productivity Apps Slowly Become Anxiety Machines, by Curious builder (DEV): https://dev.to/vaicurious/why-most-productivity-apps-slowly-become-anxiety-machines-57c1
- Why people quit their task manager: https://selfmanager.ai/articles/why-people-quit-their-task-manager
- Why task systems fail: https://goalsandprogress.com/why-task-systems-fail/
- Neurodivergent-aware productivity (arXiv): https://arxiv.org/pdf/2507.06864
