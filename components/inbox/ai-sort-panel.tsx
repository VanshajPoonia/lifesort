"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  FolderPlus,
  Lightbulb,
  Loader2,
  Shield,
  ShoppingCart,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import type { DraftAction, DraftActionType } from "@/app/api/ai/capture/route"

// AI sorting for Inbox (Stage 1 step 4). It used to be the Universal Capture page.
// The text is already saved in Inbox before this runs, so nothing is lost if the
// person walks away. Nothing else is created until they tap Add.

export const AI_SORT_MAX_CHARS = 1000

type DraftWithMeta = {
  id: string
  selected: boolean
  action: DraftAction
}

type ResultStatus = "pending" | "created" | "failed"

const TYPE_META: Record<DraftActionType, { label: string; color: string; icon: React.ElementType }> = {
  task:          { label: "Task",          color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",     icon: CheckCircle2 },
  waiting_item:  { label: "Waiting",       color: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",         icon: Clock },
  someday_item:  { label: "Later",         color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: Lightbulb },
  goal:          { label: "Goal",          color: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300", icon: Target },
  habit:         { label: "Habit",         color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: Sparkles },
  note:          { label: "Note",          color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",   icon: FileText },
  project:       { label: "Project",       color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300", icon: FolderPlus },
  vault_item:    { label: "Vault Item",    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",   icon: Shield },
  wishlist_item: { label: "Wishlist Item", color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",       icon: ShoppingCart },
  calendar_event: { label: "Calendar Event", color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",    icon: CalendarDays },
}

const VAULT_CATEGORIES = ["documents", "subscriptions", "warranty", "insurance", "vehicle", "home", "medical", "education", "work", "other"] as const

const ENDPOINT_MAP: Record<DraftActionType, string> = {
  task:           "/api/tasks",
  waiting_item:   "/api/tasks",
  someday_item:   "/api/tasks",
  goal:           "/api/goals",
  habit:          "/api/habits",
  note:           "/api/notes",
  project:        "/api/projects",
  vault_item:     "/api/vault",
  wishlist_item:  "/api/wishlist",
  calendar_event: "/api/calendar-events",
}

// Waiting and Someday drafts are saved as tasks with that status (Stage 1 step 3).
function requestBody(action: DraftAction): Record<string, unknown> {
  if (action.type === "waiting_item") {
    const payload = action.payload
    const notes = [payload.waiting_on_name ? `Waiting on ${payload.waiting_on_name}` : null, payload.description || null]
    return {
      title: payload.title,
      description: notes.filter(Boolean).join("\n\n") || null,
      due_date: payload.follow_up_date || payload.expected_date || null,
      priority: "medium",
      status: "waiting",
    }
  }
  if (action.type === "someday_item") {
    const payload = action.payload
    return { title: payload.title, description: payload.description || null, priority: "medium", status: "someday" }
  }
  return action.payload as Record<string, unknown>
}

function DraftFields({
  action,
  onChange,
}: {
  action: DraftAction
  onChange: (updated: DraftAction) => void
}) {
  function updatePayload(patch: Record<string, unknown>) {
    onChange({ ...action, payload: { ...action.payload, ...patch } } as DraftAction)
  }

  const p = action.payload as Record<string, unknown>

  if (action.type === "task") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3 space-y-1">
          <Label className="text-xs">Title</Label>
          <Input value={String(p.title ?? "")} onChange={(e) => updatePayload({ title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Due Date</Label>
          <Input type="date" value={String(p.due_date ?? "")} onChange={(e) => updatePayload({ due_date: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Priority</Label>
          <Select value={String(p.priority ?? "medium")} onValueChange={(v) => updatePayload({ priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  if (action.type === "goal") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3 space-y-1">
          <Label className="text-xs">Title</Label>
          <Input value={String(p.title ?? "")} onChange={(e) => updatePayload({ title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Target Date</Label>
          <Input type="date" value={String(p.target_date ?? "")} onChange={(e) => updatePayload({ target_date: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Priority</Label>
          <Select value={String(p.priority ?? "medium")} onValueChange={(v) => updatePayload({ priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  if (action.type === "waiting_item") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs">Title</Label>
          <Input value={String(p.title ?? "")} onChange={(e) => updatePayload({ title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Waiting on</Label>
          <Input value={String(p.waiting_on_name ?? "")} onChange={(e) => updatePayload({ waiting_on_name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Check back on</Label>
          <Input
            type="date"
            value={String(p.follow_up_date ?? p.expected_date ?? "")}
            onChange={(e) => updatePayload({ follow_up_date: e.target.value || null, expected_date: null })}
          />
        </div>
      </div>
    )
  }

  if (action.type === "someday_item") {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Title</Label>
          <Input value={String(p.title ?? "")} onChange={(e) => updatePayload({ title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Note</Label>
          <Textarea rows={2} value={String(p.description ?? "")} onChange={(e) => updatePayload({ description: e.target.value })} />
        </div>
      </div>
    )
  }

  if (action.type === "habit") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3 space-y-1">
          <Label className="text-xs">Habit Name</Label>
          <Input value={String(p.name ?? "")} onChange={(e) => updatePayload({ name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Frequency</Label>
          <Select value={String(p.frequency ?? "daily")} onValueChange={(v) => updatePayload({ frequency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="custom">Custom days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Target Count / Day</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={String(p.target_count ?? 1)}
            onChange={(e) => updatePayload({ target_count: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
      </div>
    )
  }

  if (action.type === "note") {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Title (optional)</Label>
          <Input value={String(p.title ?? "")} onChange={(e) => updatePayload({ title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Content</Label>
          <Textarea rows={4} value={String(p.content ?? "")} onChange={(e) => updatePayload({ content: e.target.value })} />
        </div>
      </div>
    )
  }

  if (action.type === "project") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs">Project Name</Label>
          <Input value={String(p.title ?? "")} onChange={(e) => updatePayload({ title: e.target.value })} />
        </div>
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs">Description (optional)</Label>
          <Input value={String(p.description ?? "")} onChange={(e) => updatePayload({ description: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Due Date</Label>
          <Input type="date" value={String(p.due_date ?? "")} onChange={(e) => updatePayload({ due_date: e.target.value || null })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Priority</Label>
          <Select value={String(p.priority ?? "medium")} onValueChange={(v) => updatePayload({ priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  if (action.type === "vault_item") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs">Title</Label>
          <Input value={String(p.title ?? "")} onChange={(e) => updatePayload({ title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Category</Label>
          <Select value={String(p.category ?? "other")} onValueChange={(v) => updatePayload({ category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VAULT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Expiry / Renewal Date</Label>
          <Input type="date" value={String(p.expiry_date ?? "")} onChange={(e) => updatePayload({ expiry_date: e.target.value || null })} />
        </div>
      </div>
    )
  }

  if (action.type === "wishlist_item") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs">Item Name</Label>
          <Input value={String(p.title ?? "")} onChange={(e) => updatePayload({ title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Price (optional)</Label>
          <Input
            type="number"
            min={0}
            placeholder="0.00"
            value={p.price != null ? String(p.price) : ""}
            onChange={(e) => updatePayload({ price: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Priority</Label>
          <Select value={String(p.priority ?? "medium")} onValueChange={(v) => updatePayload({ priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    )
  }

  if (action.type === "calendar_event") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 space-y-1">
          <Label className="text-xs">Event Title</Label>
          <Input value={String(p.title ?? "")} onChange={(e) => updatePayload({ title: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={String(p.event_date ?? "")} onChange={(e) => updatePayload({ event_date: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Start Time (optional)</Label>
          <Input type="time" value={String(p.start_time ?? "")} onChange={(e) => updatePayload({ start_time: e.target.value || null })} />
        </div>
      </div>
    )
  }

  return null
}

export function AiSortPanel({
  text,
  inboxItemId,
  onClose,
  onFinished,
}: {
  text: string
  inboxItemId: number | null
  onClose: () => void
  // Called after drafts are created, with how many were created.
  onFinished: (created: number) => void
}) {
  const panelRef = useRef<HTMLElement>(null)
  const [parsing, setParsing] = useState(true)
  const [error, setError] = useState("")
  const [drafts, setDrafts] = useState<DraftWithMeta[]>([])
  const [results, setResults] = useState<Record<string, ResultStatus>>({})
  const [submitting, setSubmitting] = useState(false)
  const [createdCount, setCreatedCount] = useState<number | null>(null)

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/ai/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, AI_SORT_MAX_CHARS) }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null)
        if (!res.ok) throw new Error(data?.error || "AI sorting failed.")
        return (data?.actions ?? []) as DraftAction[]
      })
      .then((actions) => {
        if (cancelled) return
        setDrafts(actions.map((action) => ({ id: crypto.randomUUID(), selected: true, action })))
        if (actions.length === 0) setError("The AI couldn't find anything to make from this. It's still in your Inbox.")
      })
      .catch((err) => {
        if (!cancelled) setError(`${err instanceof Error ? err.message : "AI sorting failed."} It's still in your Inbox.`)
      })
      .finally(() => { if (!cancelled) setParsing(false) })
    return () => { cancelled = true }
  }, [text])

  const selected = drafts.filter((draft) => draft.selected)
  const finished = createdCount !== null

  const create = async () => {
    if (selected.length === 0 || submitting) return
    setSubmitting(true)
    setResults(Object.fromEntries(selected.map((draft) => [draft.id, "pending" as ResultStatus])))
    let created = 0
    for (const draft of selected) {
      try {
        const res = await fetch(ENDPOINT_MAP[draft.action.type], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody(draft.action)),
        })
        setResults((prev) => ({ ...prev, [draft.id]: res.ok ? "created" : "failed" }))
        if (res.ok) created++
      } catch {
        setResults((prev) => ({ ...prev, [draft.id]: "failed" }))
      }
    }
    if (created > 0 && inboxItemId) {
      await fetch("/api/inbox", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: inboxItemId, status: "converted" }),
      }).catch(() => null)
    }
    setCreatedCount(created)
    setSubmitting(false)
    onFinished(created)
  }

  return (
    <section ref={panelRef} aria-label="Sort with AI" className="rounded-xl border border-primary/20 bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            Sorted by AI
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Check these before adding. Nothing is created until you tap Add.
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label="Close AI sorting">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <p className="mt-3 line-clamp-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{text}</p>

      {parsing ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Sorting...
        </p>
      ) : error ? (
        <p role="status" className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {drafts.map((draft) => {
            const meta = TYPE_META[draft.action.type]
            const Icon = meta.icon
            const status = results[draft.id]
            return (
              <div
                key={draft.id}
                className={cn(
                  "rounded-lg border p-3 transition-opacity",
                  !draft.selected && "opacity-60",
                  status === "created" && "border-success/40",
                  status === "failed" && "border-destructive/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-0.5"
                    checked={draft.selected}
                    disabled={Boolean(status)}
                    onCheckedChange={() =>
                      setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...d, selected: !d.selected } : d)))
                    }
                    aria-label={`Include ${draft.action.description}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", meta.color)}>
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {meta.label}
                      </span>
                      {status === "created" && <span className="text-xs font-medium text-success">Added</span>}
                      {status === "failed" && <span className="text-xs font-medium text-destructive">Couldn&apos;t add</span>}
                      {status === "pending" && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{draft.action.description}</p>
                  </div>
                  {!status && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDrafts((prev) => prev.filter((d) => d.id !== draft.id))}
                      aria-label={`Remove ${draft.action.description}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
                {!status && draft.selected && (
                  <div className="mt-3 pl-7">
                    <DraftFields
                      action={draft.action}
                      onChange={(updated) => setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...d, action: updated } : d)))}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {finished ? (
            <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                Added {createdCount} of {selected.length}.{createdCount && inboxItemId ? " The Inbox item is marked sorted." : ""}
              </p>
              <Button variant="outline" size="sm" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : drafts.length > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{selected.length} of {drafts.length} selected</p>
              <Button onClick={() => void create()} disabled={selected.length === 0 || submitting} className="gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Add {selected.length || ""}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">You removed every draft. It&apos;s still in your Inbox.</p>
          )}
        </div>
      )}
    </section>
  )
}
