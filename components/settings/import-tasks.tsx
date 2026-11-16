"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { FileUp, Loader2 } from "lucide-react"

import { localToday } from "@/components/kits/kit-icon"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { prepareImport, readTaskCsv, type TaskCsv } from "@/lib/task-import"

const MAX_FILE_BYTES = 2 * 1024 * 1024

function dueLabel(date: string | null) {
  return date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No date"
}

// Settings > Account: bring tasks over from Todoist or any CSV. The file is read in the
// browser and previewed before anything is added.
export function ImportTasks() {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")
  const [parsed, setParsed] = useState<TaskCsv | null>(null)
  const [error, setError] = useState("")
  const [skipCompleted, setSkipCompleted] = useState(true)
  const [dropPastDates, setDropPastDates] = useState(true)
  const [importing, setImporting] = useState(false)
  const [imported, setImported] = useState<number | null>(null)

  const today = localToday()
  const ready = parsed ? prepareImport(parsed.tasks, { skipCompleted, dropPastDates }, today) : []
  const pastDates = parsed ? parsed.tasks.filter((task) => task.due_date && task.due_date < today).length : 0
  const finished = parsed ? parsed.tasks.filter((task) => task.completed).length : 0

  const readFile = async (file: File | undefined) => {
    setParsed(null)
    setError("")
    setImported(null)
    if (!file) return
    setFileName(file.name)
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over 2 MB. Export a smaller project or list.")
      return
    }
    const result = readTaskCsv(await file.text())
    if ("error" in result) setError(result.error)
    else if (result.tasks.length === 0) setError("No tasks found in that file.")
    else setParsed(result)
  }

  const runImport = async () => {
    setImporting(true)
    try {
      const response = await fetch("/api/import/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: ready }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Couldn't import those tasks.")
      setImported(data.created)
      setParsed(null)
      if (inputRef.current) inputRef.current.value = ""
      toast({ title: `Imported ${data.created} ${data.created === 1 ? "task" : "tasks"}` })
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Couldn't import those tasks.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <section aria-labelledby="import-tasks" className="rounded-xl border bg-card p-4 sm:p-5">
      <h2 id="import-tasks" className="text-lg font-semibold tracking-tight text-foreground">
        Bring your tasks over
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Import a CSV from Todoist (a project exported as a template) or from any app with a Title or Task column. You&apos;ll see the tasks before
        anything is added.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input ref={inputRef} id="import-file" type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} />
        <Button asChild variant="outline" className="gap-2">
          <label htmlFor="import-file" className="cursor-pointer">
            <FileUp className="h-4 w-4" aria-hidden="true" />
            Choose a CSV file
          </label>
        </Button>
        {fileName && <span className="min-w-0 truncate text-sm text-muted-foreground">{fileName}</span>}
      </div>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {imported !== null && (
        <p className="mt-3 text-sm text-muted-foreground">
          Added {imported} {imported === 1 ? "task" : "tasks"}.{" "}
          <Link href="/tasks" className="font-medium text-primary hover:underline">
            Open Tasks
          </Link>
        </p>
      )}

      {parsed && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-foreground">
            Found {parsed.tasks.length} {parsed.tasks.length === 1 ? "task" : "tasks"}
            {parsed.format === "todoist" ? " in a Todoist export" : ""}
            {parsed.skipped > 0 ? `, skipped ${parsed.skipped} other ${parsed.skipped === 1 ? "row" : "rows"}` : ""}.
          </p>

          <ul className="divide-y rounded-lg border text-sm">
            {ready.slice(0, 5).map((task, index) => (
              <li key={`${task.title}-${index}`} className="flex items-baseline justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate">{task.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {dueLabel(task.due_date)} · {task.priority}
                </span>
              </li>
            ))}
            {ready.length > 5 && <li className="px-3 py-2 text-xs text-muted-foreground">and {ready.length - 5} more</li>}
          </ul>

          {finished > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={skipCompleted} onCheckedChange={(checked) => setSkipCompleted(checked === true)} />
              Leave out the {finished} finished {finished === 1 ? "task" : "tasks"}
            </label>
          )}
          {pastDates > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={dropPastDates} onCheckedChange={(checked) => setDropPastDates(checked === true)} />
              Clear the {pastDates} due {pastDates === 1 ? "date" : "dates"} that already passed, so nothing arrives overdue
            </label>
          )}

          <Button onClick={() => void runImport()} disabled={importing || ready.length === 0} className="gap-2">
            {importing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Import {ready.length} {ready.length === 1 ? "task" : "tasks"}
          </Button>
        </div>
      )}
    </section>
  )
}
