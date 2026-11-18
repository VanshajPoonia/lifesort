import { z } from "zod"

import { sql } from "@/lib/db"
import type { ToolDefinition, ToolResult } from "@/lib/mcp"
import { richTextToPlainText } from "@/lib/rich-text"

// The connector's tools. They only see tasks, goals, notes, calendar events and Inbox,
// and skip anything in a domain kept away from AI or locked behind re-auth.

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const ADDS = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
const MAX_TEXT = 4000

export const ITEM_KINDS = ["task", "goal", "note", "event", "inbox"] as const
type ItemKind = (typeof ITEM_KINDS)[number]

export const CONNECTOR_TOOLS: ToolDefinition[] = [
  {
    name: "search",
    title: "Search LifeSort",
    description: "Search the user's tasks, goals, notes, calendar events and Inbox by words in their title or text. Returns ids to pass to fetch.",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "Words to look for" } }, required: ["query"] },
    annotations: READ_ONLY,
  },
  {
    name: "fetch",
    title: "Read one item",
    description: "Read one item in full by the id search returned, like task:12 or note:4.",
    inputSchema: { type: "object", properties: { id: { type: "string", description: "An id such as task:12" } }, required: ["id"] },
    annotations: READ_ONLY,
  },
  {
    name: "get_today",
    title: "What's on a day",
    description: "Tasks due or planned on a day, calendar events, past-due tasks that need a decision, and how many Inbox items wait to be sorted.",
    inputSchema: {
      type: "object",
      properties: { date: { type: "string", description: "The user's local date, YYYY-MM-DD. Defaults to today in UTC." } },
    },
    annotations: READ_ONLY,
  },
  {
    name: "list_tasks",
    title: "List tasks",
    description: "List the user's tasks, open ones by default, soonest due first.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "done", "all"], description: "Defaults to open" },
        due_on_or_before: { type: "string", description: "Only tasks due on or before this date, YYYY-MM-DD" },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Defaults to 25" },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: "add_to_inbox",
    title: "Add to Inbox",
    description: "Drop a thought, note or loose to-do into the user's LifeSort Inbox for them to sort later.",
    inputSchema: { type: "object", properties: { text: { type: "string", description: "What to capture" } }, required: ["text"] },
    annotations: ADDS,
  },
  {
    name: "add_task",
    title: "Add a task",
    description: "Add a task to the user's LifeSort when they clearly ask for one.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        due_date: { type: "string", description: "YYYY-MM-DD" },
        notes: { type: "string" },
        priority: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["title"],
    },
    annotations: ADDS,
  },
]

const schemas = {
  search: z.object({ query: z.string().trim().min(1).max(200) }),
  fetch: z.object({ id: z.string().trim().min(3).max(40) }),
  get_today: z.object({ date: dateString.optional() }),
  list_tasks: z.object({
    status: z.enum(["open", "done", "all"]).optional(),
    due_on_or_before: dateString.optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
  add_to_inbox: z.object({ text: z.string().trim().min(1).max(5000) }),
  add_task: z.object({
    title: z.string().trim().min(1).max(255),
    due_date: dateString.optional(),
    notes: z.string().trim().max(5000).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
  }),
}

export function parseItemId(id: string): { kind: ItemKind; id: number } | null {
  const match = /^(task|goal|note|event|inbox):(\d{1,10})$/.exec(id.trim())
  if (!match) return null
  return { kind: match[1] as ItemKind, id: Number(match[2]) }
}

export function itemUrl(origin: string, kind: ItemKind, id: number) {
  switch (kind) {
    case "task": return `${origin}/tasks`
    case "goal": return `${origin}/goals`
    case "note": return `${origin}/library?tab=notes&note=${id}`
    case "event": return `${origin}/tasks?tab=calendar`
    case "inbox": return `${origin}/inbox`
  }
}

export function inboxTitle(text: string) {
  const firstLine = text.split(/\r?\n/)[0]?.trim() || "From your AI assistant"
  return firstLine.slice(0, 255)
}

function clip(value: unknown) {
  const text = typeof value === "string" ? value : ""
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}...` : text
}

function json(structured: Record<string, unknown>): ToolResult {
  return { text: JSON.stringify(structured), structured }
}

function problem(message: string): ToolResult {
  return { text: message, isError: true }
}

type Row = Record<string, unknown>

async function search(userId: string, origin: string, query: string): Promise<ToolResult> {
  const pattern = `%${query.replace(/[%_\\]/g, (char) => `\\${char}`)}%`
  const [tasks, goals, notes, events, inbox] = await Promise.all([
    sql`SELECT t.id, t.title FROM tasks t LEFT JOIN life_areas la ON la.id = t.life_area_id
        WHERE t.user_id = ${userId} AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE
          AND (t.title ILIKE ${pattern} OR COALESCE(t.description, '') ILIKE ${pattern})
        ORDER BY t.completed, t.updated_at DESC LIMIT 8`,
    sql`SELECT g.id, g.title FROM goals g LEFT JOIN life_areas la ON la.id = g.life_area_id
        WHERE g.user_id = ${userId} AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE
          AND (g.title ILIKE ${pattern} OR COALESCE(g.description, '') ILIKE ${pattern})
        ORDER BY g.updated_at DESC LIMIT 8`,
    sql`SELECT n.id, n.title FROM notes n LEFT JOIN life_areas la ON la.id = n.life_area_id
        WHERE n.user_id = ${userId} AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE
          AND (n.title ILIKE ${pattern} OR COALESCE(n.content, '') ILIKE ${pattern})
        ORDER BY n.updated_at DESC LIMIT 8`,
    sql`SELECT e.id, e.title, e.event_date FROM calendar_events e LEFT JOIN life_areas la ON la.id = e.life_area_id
        WHERE e.user_id = ${userId} AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE
          AND (e.title ILIKE ${pattern} OR COALESCE(e.description, '') ILIKE ${pattern})
        ORDER BY e.event_date DESC LIMIT 8`,
    sql`SELECT i.id, i.title FROM inbox_items i LEFT JOIN life_areas la ON la.id = i.life_area_id
        WHERE i.user_id = ${userId} AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE
          AND i.status = 'unsorted' AND (i.title ILIKE ${pattern} OR i.raw_text ILIKE ${pattern})
        ORDER BY i.updated_at DESC LIMIT 8`,
  ])
  const results = [
    ...tasks.map((row: Row) => ({ id: `task:${row.id}`, title: String(row.title), url: itemUrl(origin, "task", Number(row.id)) })),
    ...goals.map((row: Row) => ({ id: `goal:${row.id}`, title: String(row.title), url: itemUrl(origin, "goal", Number(row.id)) })),
    ...notes.map((row: Row) => ({ id: `note:${row.id}`, title: String(row.title || "Untitled note"), url: itemUrl(origin, "note", Number(row.id)) })),
    ...events.map((row: Row) => ({ id: `event:${row.id}`, title: `${row.title} (${row.event_date})`, url: itemUrl(origin, "event", Number(row.id)) })),
    ...inbox.map((row: Row) => ({ id: `inbox:${row.id}`, title: String(row.title), url: itemUrl(origin, "inbox", Number(row.id)) })),
  ]
  return json({ results })
}

async function fetchItem(userId: string, origin: string, rawId: string): Promise<ToolResult> {
  const parsed = parseItemId(rawId)
  if (!parsed) return problem("Use an id from search, like task:12.")
  const { kind, id } = parsed
  let rows: Row[] = []
  if (kind === "task") {
    rows = await sql`SELECT t.title, t.description AS text, t.status, t.priority, t.due_date, t.scheduled_date, t.scheduled_time, t.completed
      FROM tasks t LEFT JOIN life_areas la ON la.id = t.life_area_id
      WHERE t.id = ${id} AND t.user_id = ${userId} AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE`
  } else if (kind === "goal") {
    rows = await sql`SELECT g.title, g.description AS text, g.status, g.progress, g.target_date
      FROM goals g LEFT JOIN life_areas la ON la.id = g.life_area_id
      WHERE g.id = ${id} AND g.user_id = ${userId} AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE`
  } else if (kind === "note") {
    rows = await sql`SELECT n.title, n.content AS text, n.updated_at
      FROM notes n LEFT JOIN life_areas la ON la.id = n.life_area_id
      WHERE n.id = ${id} AND n.user_id = ${userId} AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE`
  } else if (kind === "event") {
    rows = await sql`SELECT e.title, e.description AS text, e.event_date, e.start_time, e.end_time, e.location
      FROM calendar_events e LEFT JOIN life_areas la ON la.id = e.life_area_id
      WHERE e.id = ${id} AND e.user_id = ${userId} AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE`
  } else {
    rows = await sql`SELECT i.title, i.raw_text AS text, i.status, i.created_at
      FROM inbox_items i LEFT JOIN life_areas la ON la.id = i.life_area_id
      WHERE i.id = ${id} AND i.user_id = ${userId} AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE`
  }
  const row = rows[0]
  if (!row) return problem("Nothing with that id is shared with you.")
  const { title, text, ...metadata } = row
  return json({
    id: `${kind}:${id}`,
    title: String(title || "Untitled"),
    text: clip(kind === "note" ? richTextToPlainText(String(text ?? "")) : text),
    url: itemUrl(origin, kind, id),
    metadata,
  })
}

async function getToday(userId: string, date: string): Promise<ToolResult> {
  const [tasks, pastDue, events, inbox] = await Promise.all([
    sql`SELECT t.id, t.title, t.priority, t.due_date, t.scheduled_time, t.duration_minutes
        FROM tasks t LEFT JOIN life_areas la ON la.id = t.life_area_id
        WHERE t.user_id = ${userId} AND t.completed = FALSE AND (t.due_date = ${date} OR t.scheduled_date = ${date})
          AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE
        ORDER BY t.scheduled_time NULLS LAST, t.priority LIMIT 50`,
    sql`SELECT t.id, t.title, t.due_date
        FROM tasks t LEFT JOIN life_areas la ON la.id = t.life_area_id
        WHERE t.user_id = ${userId} AND t.completed = FALSE AND t.due_date < ${date}
          AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE
        ORDER BY t.due_date DESC LIMIT 10`,
    sql`SELECT e.id, e.title, e.start_time, e.end_time, e.location
        FROM calendar_events e LEFT JOIN life_areas la ON la.id = e.life_area_id
        WHERE e.user_id = ${userId} AND e.event_date = ${date}
          AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE
        ORDER BY e.start_time`,
    sql`SELECT COUNT(*)::int AS n FROM inbox_items WHERE user_id = ${userId} AND status = 'unsorted'`,
  ])
  return json({
    date,
    tasks: tasks.map((row: Row) => ({ id: `task:${row.id}`, ...row })),
    needs_a_decision: pastDue.map((row: Row) => ({ id: `task:${row.id}`, ...row })),
    events: events.map((row: Row) => ({ id: `event:${row.id}`, ...row })),
    inbox_to_sort: Number(inbox[0]?.n ?? 0),
  })
}

async function listTasks(userId: string, input: z.infer<typeof schemas.list_tasks>): Promise<ToolResult> {
  const status = input.status ?? "open"
  const limit = input.limit ?? 25
  const dueBy = input.due_on_or_before ?? null
  const rows = await sql`
    SELECT t.id, t.title, t.status, t.priority, t.due_date, t.scheduled_date, t.completed
    FROM tasks t LEFT JOIN life_areas la ON la.id = t.life_area_id
    WHERE t.user_id = ${userId}
      AND COALESCE(la.is_ai_excluded, FALSE) = FALSE AND COALESCE(la.requires_reauth, FALSE) = FALSE
      AND (${status} = 'all' OR t.completed = ${status === "done"})
      AND (${dueBy}::date IS NULL OR t.due_date <= ${dueBy}::date)
    ORDER BY t.due_date NULLS LAST, t.updated_at DESC
    LIMIT ${limit}
  `
  return json({ tasks: rows.map((row: Row) => ({ id: `task:${row.id}`, ...row })) })
}

async function addToInbox(userId: string, text: string): Promise<ToolResult> {
  const rows = await sql`
    INSERT INTO inbox_items (user_id, title, raw_text, source)
    VALUES (${userId}, ${inboxTitle(text)}, ${text}, 'connector')
    RETURNING id
  `
  return { text: "Added to the user's LifeSort Inbox.", structured: { id: `inbox:${rows[0].id}` } }
}

async function addTask(userId: string, input: z.infer<typeof schemas.add_task>): Promise<ToolResult> {
  const rows = await sql`
    INSERT INTO tasks (user_id, title, description, priority, due_date, status, completed, sort_order)
    VALUES (${userId}, ${input.title}, ${input.notes ?? null}, ${input.priority ?? "medium"}, ${input.due_date ?? null}, 'next', FALSE, 0)
    RETURNING id
  `
  return { text: `Added the task "${input.title}".`, structured: { id: `task:${rows[0].id}` } }
}

export async function runConnectorTool(userId: string, origin: string, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const schema = schemas[name as keyof typeof schemas]
  if (!schema) return problem(`Unknown tool: ${name}`)
  const parsed = schema.safeParse(args)
  if (!parsed.success) return problem(parsed.error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; "))
  const input = parsed.data as Record<string, unknown>

  switch (name) {
    case "search": return search(userId, origin, String(input.query))
    case "fetch": return fetchItem(userId, origin, String(input.id))
    case "get_today": return getToday(userId, (input.date as string | undefined) ?? new Date().toISOString().slice(0, 10))
    case "list_tasks": return listTasks(userId, input as z.infer<typeof schemas.list_tasks>)
    case "add_to_inbox": return addToInbox(userId, String(input.text))
    default: return addTask(userId, input as z.infer<typeof schemas.add_task>)
  }
}
