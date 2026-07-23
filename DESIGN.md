---
version: alpha
name: LifeSort Design System
description: >
  The active design reference for LifeSort — a hybrid life-management system that
  moves like Linear and reads like Notion, wrapped in the calm of a wellbeing app.
  A Linear-derived application shell (fast, keyboard-first, dense navigation and
  data) hosts Notion-derived flexible content (block-based notes, journals, and
  documents). The identity is warmer and more spacious than Linear and more
  structured and immediately usable than Notion: a warm paper canvas, a single
  calm teal action color, a scarce warm "ember" for personal moments, and a muted
  categorical palette scoped to Life Domains. Not a copy of either source — see
  linear/DESIGN.md and notion/DESIGN.md for the raw references this synthesizes.

# Canonical values below are LIGHT MODE. Dark mode + the app's HSL variable
# mapping are documented in the body (## Themes). LifeSort ships both themes.
colors:
  # Action — the single structural accent (calm teal). Linear-lavender / Notion-blue role.
  primary: "#127C6E"
  primary-hover: "#159487"
  primary-active: "#0E6357"
  primary-tint: "#E4F0EC"        # low-alpha teal wash for active nav rows, selection
  on-primary: "#FFFFFF"

  # Personal accent — used scarcely: streaks, celebrations, "today", milestones. Never chrome.
  ember: "#C7734A"
  ember-tint: "#F6E9DF"

  # Surfaces — warm, document-like, never clinical white
  canvas: "#F7F5F1"              # page ground (warm paper)
  canvas-soft: "#F1EDE6"         # sunken wells, footer, featured-tier fill
  surface: "#FFFFFF"             # cards, panels, inputs (crisp figure over warm ground)
  surface-raised: "#FFFFFF"      # same fill, lifted by shadow (menus, popovers, toasts)

  # Ink
  ink: "#1F1D1A"                 # headings + primary body (warm near-black)
  ink-secondary: "#46423C"       # secondary copy
  ink-muted: "#6E685F"           # meta, supporting
  ink-faint: "#9A948A"           # captions, placeholders, disabled

  # Lines
  hairline: "#E7E2DA"            # default 1px borders + dividers
  hairline-strong: "#D8D2C8"     # emphasized borders, focused input rest

  # Life-domain categorical palette — Notion's "sticker palette" role.
  # Muted/desaturated for calm. Identity + the domain spine ONLY. Never a CTA or chrome fill.
  domain-health: "#5B9A6F"       # body / health
  domain-mind: "#6E86D6"         # mind / reflect
  domain-work: "#4C6EA8"         # work / career
  domain-relationships: "#C86B8E" # people / relationships
  domain-money: "#C0942F"        # money / finance
  domain-growth: "#8A6DC4"       # growth / learning
  domain-home: "#B77B54"         # home / admin
  domain-play: "#3E9AA8"         # play / leisure

  # Semantic (warm-tuned, separate from the teal accent)
  success: "#3F9A5E"
  warning: "#C7902E"
  danger: "#C7513E"
  on-status: "#FFFFFF"

typography:
  # Three roles. UI = structured pages + shell. Reading = flexible content. Mono = data/keys.
  display:
    fontFamily: UI            # Inter
    fontSize: 40px
    fontWeight: 700
    lineHeight: 1.10
    letterSpacing: -1.0px
  title-xl:
    fontFamily: UI
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.6px
  title:
    fontFamily: UI
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.4px
  heading:
    fontFamily: UI
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.30
    letterSpacing: -0.2px
  body:
    fontFamily: UI
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  body-sm:
    fontFamily: UI
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  reading-title:
    fontFamily: Reading       # Source Serif 4
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: -0.3px
  reading:
    fontFamily: Reading
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.70
    letterSpacing: 0
  label:
    fontFamily: UI
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.30
    letterSpacing: 0.4px      # uppercase eyebrows, column headers, domain tabs
  button:
    fontFamily: UI
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.20
    letterSpacing: 0
  mono:
    fontFamily: Mono          # Geist Mono / JetBrains Mono
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.40
    letterSpacing: 0          # ⌘K shortcuts, ids, dates, tabular numbers

rounded:
  xs: 4px      # tags, chips, status dots
  sm: 6px      # menu rows, list-row hover
  md: 8px      # buttons, inputs, filter controls
  lg: 12px     # cards, panels, content blocks
  xl: 16px     # modals, image wells, empty-state frames
  pill: 9999px # filter pills, tag chips, segmented toggles, avatars

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 64px
  sidebar: 260px       # app-shell left rail width
  reading: 720px       # flexible-page centered content column max-width
  content: 1200px      # structured-page max content width

components:
  app-shell:
    description: "Persistent Linear-style frame: fixed left sidebar + top bar + scrollable main. Present on every signed-in page."
    backgroundColor: "{colors.canvas}"
    sidebarWidth: "{spacing.sidebar}"
    sidebarBackground: "{colors.canvas-soft}"
    hairline: "{colors.hairline}"
  sidebar-nav-row:
    description: "Nav item in the left rail. Active row = teal text + primary-tint fill + 2px domain/teal left indicator."
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
    activeBackground: "{colors.primary-tint}"
    activeText: "{colors.primary}"
    activeIndicator: "{colors.primary}"
  command-palette:
    description: "⌘K global command + search overlay. Linear's speed core. Raised surface, mono shortcut hints, grouped results."
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    shortcutTypography: "{typography.mono}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xs}"
    shadow: elevation-2
  top-bar:
    description: "Slim contextual bar above main: breadcrumb/page title left, view controls + filters + quick-add right. 52px tall."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    height: "52px"
    hairline: "{colors.hairline}"
  button-primary:
    description: "The single teal action. One primary per view."
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "7px 14px"
    hoverBackground: "{colors.primary-hover}"
    activeBackground: "{colors.primary-active}"
  button-secondary:
    description: "Bordered neutral action (Cancel, secondary CTA)."
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "7px 14px"
    borderColor: "{colors.hairline-strong}"
  button-ghost:
    description: "Text-only action for dense toolbars and row actions."
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "7px 10px"
    hoverBackground: "{colors.canvas-soft}"
  filter-pill:
    description: "Linear-style filter/segmented control in structured views. Pill, selected = surface lift + ink text."
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
    selectedBackground: "{colors.surface}"
    selectedText: "{colors.ink}"
    borderColor: "{colors.hairline}"
  tag-chip:
    description: "Domain / label chip. Text + dot in the domain color; fill is a low-alpha tint of that color."
    backgroundColor: "domain-tint"
    textColor: "domain-color"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  list-row:
    description: "Task / item row in structured lists. Dense, keyboard-selectable, domain dot at left, hover lift."
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    hoverBackground: "{colors.canvas-soft}"
    hairline: "{colors.hairline}"
  card:
    description: "Workhorse container across structured + hybrid pages."
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    borderColor: "{colors.hairline}"
    shadow: elevation-0
  card-raised:
    description: "Lifted card for widgets that float above the canvas (Today summary, dashboard tiles)."
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    shadow: elevation-1
  hybrid-tab-bar:
    description: "Fixed system tabs on hybrid pages (Overview · Goals · Projects · Tasks · Knowledge · Review). Underline indicator in the domain color."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    activeText: "{colors.ink}"
    activeIndicator: "domain-color"
    hairline: "{colors.hairline}"
  content-block:
    description: "Notion-style editable block on flexible pages + hybrid Overview: text, heading, callout, image, link, file, or embedded widget. Left gutter reveals drag handle + add button on hover."
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.reading}"
    padding: "3px 2px"
    hoverBackground: "{colors.canvas-soft}"
    gutterWidth: "24px"
  callout:
    description: "Highlighted block: tinted surface + emoji/icon + body. Tint drawn from ember, a domain color, or a semantic color."
    backgroundColor: "tint"
    textColor: "{colors.ink}"
    typography: "{typography.reading}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
  text-input:
    description: "Form field. Tighter radius than cards; teal focus ring."
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    borderColor: "{colors.hairline-strong}"
    focusRing: "{colors.primary}"
  badge-status:
    description: "State pill (Active, Done, Overdue, Planned). Uses semantic or domain color as a tinted chip."
    backgroundColor: "tint"
    textColor: "status-color"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  domain-spine:
    description: "SIGNATURE. A 3px vertical rail in the active domain's color running down the left edge of a domain page/card, echoed as a dot in list rows and a tab underline. The one element binding the structured shell to flexible content and encoding which life area you are in."
    width: "3px"
    color: "domain-color"
    rounded: "{rounded.pill}"
  toast:
    description: "Transient confirmation. Raised surface, calm slide + fade."
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
    shadow: elevation-2
  empty-state:
    description: "Invitation to act. Centered, sunken frame, one primary action. Never a dead end."
    backgroundColor: "{colors.canvas-soft}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xxl}"
---

## Overview

LifeSort is a personal life-management system. It should feel **fast like Linear**, **flexible like Notion**, and **calm like a wellbeing app** — structured without feeling corporate, personal without feeling decorative, powerful without asking the user to build their own system. This document is the hybrid: it borrows Linear's *application shell* and Notion's *content model*, then dresses both in a warmer, more spacious identity that is neither.

**What comes from Linear (the shell):** the persistent left sidebar, the ⌘K command palette, keyboard-first interaction, dense scannable lists, filters and views, speed, and the overall information architecture. Anything that is *navigated and operated* leans Linear.

**What comes from Notion (the content):** block-based editing for notes, journal entries, documents, and personal reflections; a calm centered reading column; callouts, embeds, and customizable blocks. Anything that is *written and read* leans Notion.

**What is LifeSort's own:** a warm paper canvas instead of Linear's near-black or Notion's clinical white; a single **calm teal** action color instead of Linear lavender or Notion blue; a scarce warm **ember** for genuinely personal moments (streaks, milestones, "today"); and a muted **domain palette** that gives each life area a quiet identity through the signature **domain spine**.

### Key characteristics

- Warm paper canvas (`{colors.canvas}` #F7F5F1), crisp white surfaces — document-calm, never clinical.
- One structural accent: calm teal `{colors.primary}` — the only color that paints an action.
- One personal accent: `{colors.ember}` — scarce, reserved for streaks/celebration/today. Never chrome.
- A muted domain palette scoped to Life Domain identity + the domain spine. Never a CTA fill.
- Three type roles: **Inter** for UI/structure, **Source Serif 4** for reading/writing, **Geist Mono** for data + keyboard shortcuts.
- Linear speed for structured surfaces; Notion spaciousness for flexible ones; the app's existing calm motion tokens (`--motion-journal: 650ms`) reserved for reflective moments.
- Elevation by hairline + soft layered shadow, not heavy drop shadows.

## Page categories

The whole system is organized by how much a page is *operated* vs *written*. This decides layout, type role, and how much customization is allowed.

### Structured pages — stable, limited customization

`Today` · `Inbox` · `Tasks` · `Calendar` · `Upcoming` · `Search` · `Routines` · `Settings`

- Full app shell; content sits in the `{spacing.content}` (1200px) column.
- **Inter** throughout; dense `list-row` lists, `filter-pill` controls, `card`/`card-raised` widgets.
- Fast and keyboard-driven. `mono` for shortcuts, dates, and tabular numbers.
- The layout is a promise: it does not move between visits. No block editing here.

### Flexible pages — block-based content

`Notes` · `Journal entries` · `Documents` · `Personal reflections`

- App shell + a centered `{spacing.reading}` (720px) column.
- **Source Serif 4** (`reading` / `reading-title`) for body and block headings — long-form personal writing reads warmer and calmer in a serif; this is the one place the reading face leads.
- `content-block` editing: text, heading, callout, image, link, file, embedded widget. Left gutter reveals drag + add on hover.
- Reserve the slower `--motion-journal` timing for entering/saving reflective content.

### Hybrid pages — fixed system sections + customizable content

`Life Domains` · `Projects` · `Goals` · `Reviews` · `People`

- App shell + `domain-spine` in the page's domain color + `hybrid-tab-bar` of **fixed** system tabs.
- A Life Domain page has fixed tabs — **Overview · Goals · Projects · Tasks · Knowledge · Review** — where the structured tabs (Goals/Projects/Tasks) render Inter lists and the **Overview** tab is a Notion-style canvas the user customizes with `content-block`s (text, callouts, images, links, files, and *selected* widgets).
- The rule: system sections are fixed and immediately useful; only the Overview is a canvas. LifeSort ships an opinionated system by default and lets customization in where personal context matters — it is **not** a blank canvas.

## Themes

LifeSort ships **light and dark**. The app already drives theming through HSL CSS variables in `app/globals.css` (`:root` / `.dark`, plus named variants like `[data-theme="ocean"]`) consumed by Tailwind via `hsl(var(--token))`. Migrate these tokens onto that existing system rather than introducing a parallel one — replace the current templated violet (`--primary: 262 83% 58%`) and clinical greys with the values below. Keep the existing `--motion-*` tokens; they already encode the calm intent.

### Light (canonical — see front matter)

Warm paper canvas, white surfaces, warm near-black ink, calm teal primary.

### Dark — softer and warmer than Linear (never #010102)

| Token | Light | Dark |
|---|---|---|
| canvas | `#F7F5F1` | `#1B1A1E` |
| canvas-soft | `#F1EDE6` | `#201F24` |
| surface | `#FFFFFF` | `#232227` |
| surface-raised | `#FFFFFF` (shadow) | `#2A292F` |
| ink | `#1F1D1A` | `#ECE9E3` |
| ink-secondary | `#46423C` | `#C4C0B8` |
| ink-muted | `#6E685F` | `#928D85` |
| ink-faint | `#9A948A` | `#6B6760` |
| hairline | `#E7E2DA` | `#302F35` |
| hairline-strong | `#D8D2C8` | `#3C3B42` |
| primary | `#127C6E` | `#2FA08D` |
| primary-hover | `#159487` | `#37B4A0` |
| primary-tint | `#E4F0EC` | `rgba(47,160,141,0.14)` |
| ember | `#C7734A` | `#D98A5E` |

Dark mode lifts the teal and ember so they read on the dark ground; domain colors keep their hue but lift ~8–10% in lightness. Give dark the same care as light — do not naively invert.

## Typography

### Roles

- **UI — Inter** (`next/font/google`, already installed). Carries `display` through `body-sm`, `label`, `button`. The voice of the shell and every structured page. Apply the negative tracking in the scale explicitly; Inter reads loose at default tracking.
- **Reading — Source Serif 4.** Carries `reading` and `reading-title` on flexible pages and inside content blocks. A warm, humanist serif that makes journaling and notes feel personal and document-like without tipping into decorative. (Load via `next/font/google`; scope it to flexible/content surfaces only.)
- **Mono — Geist Mono** (or JetBrains Mono). Carries `mono`: ⌘K shortcut hints, ids, dates, and tabular numeric data. The Linear command-surface texture.

### Scale

| Token | Family | Size | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `{typography.display}` | Inter | 40px | 700 | -1.0px | Rare hero / big empty-state |
| `{typography.title-xl}` | Inter | 30px | 600 | -0.6px | Page title (structured) |
| `{typography.title}` | Inter | 22px | 600 | -0.4px | Section / card cluster title |
| `{typography.heading}` | Inter | 18px | 600 | -0.2px | Card + subsection heading |
| `{typography.body}` | Inter | 15px | 400 | 0 | Default UI body |
| `{typography.body-sm}` | Inter | 13px | 400 | 0 | Dense lists, meta, nav |
| `{typography.reading-title}` | Source Serif 4 | 28px | 600 | -0.3px | Flexible-page / entry title |
| `{typography.reading}` | Source Serif 4 | 17px | 400 | 0 | Journal / note / doc body |
| `{typography.label}` | Inter | 12px | 600 | +0.4px | UPPERCASE eyebrows, column heads, tabs |
| `{typography.button}` | Inter | 14px | 500 | 0 | Button labels |
| `{typography.mono}` | Geist Mono | 13px | 500 | 0 | Shortcuts, ids, dates, numbers |

### Principles

- **Two voices, cleanly split.** Inter operates the app; Source Serif reads and writes. The switch is not decorative — it signals "you are now in your own words." Never mix the serif into structured chrome.
- **Tight display, calm body.** Negative tracking on titles for a set, confident feel; 1.55 body / 1.70 reading line-height for calm long-form.
- **Labels are taxonomy.** Uppercase `label` with positive tracking marks column headers, domain tabs, and eyebrows — the opposite signal from tracked-in titles.
- **Numbers align.** Use `font-variant-numeric: tabular-nums` (and `mono`) wherever figures stack — money, streaks, counts, dates.

## Layout

### The shell

Persistent Linear frame on every signed-in page: `app-shell` = left `sidebar` (260px, on `canvas-soft`) + `top-bar` (52px) + scrollable main on `canvas`. The sidebar holds workspace/identity, primary nav, and the Life Domains list (each with its domain dot). ⌘K opens the `command-palette` from anywhere. Below the tablet breakpoint the sidebar collapses to an overlay drawer.

### Content widths

- Structured pages: content up to `{spacing.content}` 1200px, full-bleed lists allowed.
- Flexible pages: centered `{spacing.reading}` 720px column — the calm reading measure (~70 characters).
- Hybrid pages: structured tabs use the wider column; the Overview canvas uses the reading column.

### Spacing

4px base. Structured surfaces run **dense** (`xs`–`sm` between rows, `md` card padding); flexible surfaces run **spacious** (`lg`–`xl` between blocks). The density difference is how the same system feels fast in one place and calm in another.

### Elevation

| Level | Treatment | Use |
|---|---|---|
| 0 — flat | `hairline` border, no shadow | Default cards, list rows |
| 1 — soft | Layered micro-shadow (many near-transparent stops) | Floating widgets, `card-raised` |
| 2 — raised | Deeper soft stack | `command-palette`, menus, `toast`, modals |

Barely-there, Notion-style — surfaces lift gently off the paper; never a hard cast. Structured density carries most hierarchy without shadow at all.

## The signature: the domain spine

LifeSort's one memorable element is the **domain spine** — a 3px vertical rail in a life area's assigned color, running down the left edge of that domain's pages and cards, echoed as a dot in every list row that belongs to it and as the underline under the active `hybrid-tab-bar` tab. It does real work: it tells you at a glance which part of your life you are looking at, and it is the single thread that ties Linear's structured shell to Notion's flexible content. Spend the app's color boldness here and on the teal action — keep everything else quiet.

Domain colors (muted, calm): health `#5B9A6F` · mind `#6E86D6` · work `#4C6EA8` · relationships `#C86B8E` · money `#C0942F` · growth `#8A6DC4` · home `#B77B54` · play `#3E9AA8`.

## Motion

Reuse the app's existing tokens: `--motion-quick 150ms` · `--motion-base 220ms` · `--motion-slow 350ms` · `--motion-journal 650ms` · ease `cubic-bezier(0.16, 1, 0.3, 1)`.

- **Structured shell:** quick/base — snappy nav, instant ⌘K, crisp list interactions. Linear speed.
- **Flexible + reflective:** slow/journal — gentle entry, save, and reveal on journal and reflection surfaces. This is where "calm" is felt.
- Always honor `prefers-reduced-motion`; the calm timings degrade to instant, not janky.

## Copy

Words are design material. Name things by what the person controls — *notes*, *domains*, *routines*, *reflections* — not how the system is built. Active voice; a control says exactly what it does and the confirmation echoes it ("Save entry" → "Entry saved"). Errors explain what happened and how to fix it, in the interface's calm voice, never apologizing or vague. Empty states invite the first action. Sentence case everywhere except `label` eyebrows.

## Do's and don'ts

### Do
- Reserve teal `{colors.primary}` for the single primary action, links, and focus — nothing decorative.
- Keep pages on the warm `{colors.canvas}`; float white `{colors.surface}` cards for gentle figure/ground.
- Lead structured pages with dense, fast, keyboard-friendly lists; lead flexible pages with a calm centered serif column.
- Use the domain palette + domain spine to carry life-area identity, and only there.
- Apply the negative tracking values on titles explicitly; use `mono` + tabular numerals wherever figures align.
- Keep hybrid pages' system sections fixed and useful; let customization live in the Overview canvas.
- Migrate onto the existing HSL variable + Tailwind + shadcn system; reuse the `--motion-*` tokens.

### Don't
- Don't paint a CTA or structural fill in a domain color or in `ember` — those carry identity and personal moments only.
- Don't introduce a second structural accent beside teal, or reintroduce the templated shadcn violet.
- Don't set the shell/structured chrome in the serif, or set journal bodies in Inter.
- Don't ship a clinical pure-white page or a Linear-cold near-black dark mode — LifeSort stays warm in both themes.
- Don't turn hybrid or structured pages into blank canvases; only the Overview is customizable.
- Don't drop heavy shadows; elevation is soft layered stops.

## Iteration guide

1. First decide the page category — structured, flexible, or hybrid. It sets layout, type role, and customization.
2. Reference components by their `components:` token name; add variants as new entries.
3. Default UI body to `{typography.body}` (Inter 400); default content body to `{typography.reading}` (Source Serif 400).
4. Keep teal scarce (action/link/focus), ember scarcer (personal moments), domain color scoped to identity + spine.
5. Map every value onto the app's HSL variables in `app/globals.css`; don't fork the token system.
6. Before shipping UI, run the `impeccable` skill (installed in this repo) against the surface for a craft + accessibility pass.

## References

- `linear/DESIGN.md` — raw Linear analysis (shell, speed, dark marketing canvas). Source, not target.
- `notion/DESIGN.md` — raw Notion analysis (content, warmth, sticker palette). Source, not target.

This file is the target. Where the references disagree, this hybrid wins.
