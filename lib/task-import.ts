// Task import from CSV (AI_BUILD_PLAN.md Part 0, Later: imports). Reads a Todoist
// template export (TYPE, CONTENT, DESCRIPTION, PRIORITY, DATE) or any CSV with a title
// column. Runs in the browser, so the person sees everything before it's added.

export type ImportedTask = {
  title: string
  description: string | null
  due_date: string | null
  priority: "low" | "medium" | "high"
  completed: boolean
}

export type TaskCsv = { format: "todoist" | "generic"; tasks: ImportedTask[]; skipped: number }

export const MAX_IMPORT_TASKS = 1000

// Minimal RFC 4180 parsing: quoted fields, doubled quotes, commas and newlines in quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false
  const input = text.replace(/^﻿/, "")
  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"'
        index++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index++
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else {
      field += char
    }
  }
  if (field !== "" || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""))
}

const ISO_DATE = /^(\d{4})[-/](\d{2})[-/](\d{2})/

function isoDate(value: string) {
  const match = ISO_DATE.exec(value.trim())
  if (!match) return null
  const [, y, m, d] = match
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
  return date.getUTCMonth() === Number(m) - 1 ? `${y}-${m}-${d}` : null
}

function withNote(description: string, note: string) {
  return [description.trim(), note].filter(Boolean).join("\n")
}

// Todoist's template CSV uses 1 for p1, its highest priority.
function todoistPriority(value: string): ImportedTask["priority"] {
  const level = Number(value)
  if (level === 1) return "high"
  if (level === 4) return "low"
  return "medium"
}

function genericPriority(value: string): ImportedTask["priority"] {
  const text = value.trim().toLowerCase()
  if (["high", "urgent", "1", "p1"].includes(text)) return "high"
  if (["low", "4", "p4"].includes(text)) return "low"
  return "medium"
}

const truthy = new Set(["true", "yes", "y", "1", "x", "done", "completed", "complete"])

function column(headers: string[], names: string[]) {
  return headers.findIndex((header) => names.includes(header))
}

function task(title: string, description: string, due: string, priority: ImportedTask["priority"], completed: boolean, dueLabel: string) {
  const date = due.trim() ? isoDate(due) : null
  // A date we can't read (like Todoist's "every monday") stays in the notes.
  const notes = due.trim() && !date ? withNote(description, `${dueLabel}: ${due.trim()}`) : description.trim()
  return {
    title: title.trim().slice(0, 255),
    description: notes ? notes.slice(0, 5000) : null,
    due_date: date,
    priority,
    completed,
  }
}

export function readTaskCsv(text: string): TaskCsv | { error: string } {
  const rows = parseCsv(text)
  if (rows.length < 2) return { error: "That file has no rows to import." }
  const headers = rows[0].map((header) => header.trim().toLowerCase())
  const body = rows.slice(1)

  const typeColumn = column(headers, ["type"])
  const contentColumn = column(headers, ["content"])
  if (typeColumn >= 0 && contentColumn >= 0) {
    const description = column(headers, ["description"])
    const priority = column(headers, ["priority"])
    const date = column(headers, ["date"])
    const tasks: ImportedTask[] = []
    let skipped = 0
    for (const cells of body) {
      const title = cells[contentColumn] ?? ""
      if ((cells[typeColumn] ?? "").trim().toLowerCase() !== "task" || !title.trim()) {
        skipped++
        continue
      }
      tasks.push(task(title, cells[description] ?? "", cells[date] ?? "", todoistPriority(cells[priority] ?? ""), false, "Todoist date"))
    }
    return { format: "todoist", tasks: tasks.slice(0, MAX_IMPORT_TASKS), skipped: skipped + Math.max(0, tasks.length - MAX_IMPORT_TASKS) }
  }

  const titleColumn = column(headers, ["title", "task", "name", "content", "subject", "todo", "task name"])
  if (titleColumn < 0) return { error: "Couldn't find a title column. Name one column Title or Task." }
  const due = column(headers, ["due", "due date", "due_date", "date", "deadline"])
  const description = column(headers, ["notes", "note", "description", "details"])
  const priority = column(headers, ["priority"])
  const done = column(headers, ["completed", "done", "status", "is completed"])
  const tasks: ImportedTask[] = []
  let skipped = 0
  for (const cells of body) {
    const title = cells[titleColumn] ?? ""
    if (!title.trim()) {
      skipped++
      continue
    }
    const completed = done >= 0 && truthy.has((cells[done] ?? "").trim().toLowerCase())
    tasks.push(task(title, cells[description] ?? "", cells[due] ?? "", genericPriority(cells[priority] ?? ""), completed, "Due"))
  }
  return { format: "generic", tasks: tasks.slice(0, MAX_IMPORT_TASKS), skipped: skipped + Math.max(0, tasks.length - MAX_IMPORT_TASKS) }
}

// Applies the import options: skip finished tasks, drop due dates that already passed.
export function prepareImport(tasks: ImportedTask[], options: { skipCompleted: boolean; dropPastDates: boolean }, today: string) {
  return tasks
    .filter((item) => !(options.skipCompleted && item.completed))
    .map((item) => (options.dropPastDates && item.due_date && item.due_date < today ? { ...item, due_date: null } : item))
}
