"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderPlus,
  Inbox,
  Loader2,
  Shield,
  ShoppingCart,
  Sparkles,
  Target,
  Trash2,
  Wand2,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import type { DraftAction, DraftActionType } from "@/app/api/ai/capture/route"

// ─── Types ───────────────────────────────────────────────────────────────────

type DraftWithMeta = {
  id: string
  selected: boolean
  action: DraftAction
}

type ResultStatus = "pending" | "created" | "failed"
type ResultMap = Record<string, ResultStatus>

// ─── Constants ───────────────────────────────────────────────────────────────

const EXAMPLES = [
  "Remind me to call mom Friday and add gym 4 times a week.",
  "I want to save $800 for a laptop by August.",
  "Create a project for learning DSA and add tasks for arrays, strings, and recursion.",
  "Add a note that I liked the NSOC website.",
  "I need to renew my insurance next month.",
]

const TYPE_META: Record<DraftActionType, { label: string; color: string; icon: React.ElementType }> = {
  task:          { label: "Task",          color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",     icon: CheckCircle2 },
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
  goal:           "/api/goals",
  habit:          "/api/habits",
  note:           "/api/notes",
  project:        "/api/projects",
  vault_item:     "/api/vault",
  wishlist_item:  "/api/wishlist",
  calendar_event: "/api/calendar-events",
}

// ─── Draft field editor ───────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CapturePage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [text, setText] = useState("")
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState("")
  const [drafts, setDrafts] = useState<DraftWithMeta[]>([])
  const [parsed, setParsed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [savingInbox, setSavingInbox] = useState(false)
  const [inboxSaved, setInboxSaved] = useState(false)
  const [results, setResults] = useState<ResultMap>({})
  const [doneCount, setDoneCount] = useState(0)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, router, user])

  const parse = async () => {
    if (!text.trim() || parsing) return
    setParsing(true)
    setParseError("")
    setDrafts([])
    setResults({})
    setDoneCount(0)
    setParsed(false)

    try {
      const res = await fetch("/api/ai/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || "Parse failed")
      const actions: DraftAction[] = data.actions ?? []
      setDrafts(actions.map((action) => ({ id: crypto.randomUUID(), selected: true, action })))
      setParsed(true)
      if (actions.length === 0) setParseError("No structured actions found. Try rephrasing.")
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Parse failed")
    } finally {
      setParsing(false)
    }
  }

  const updateDraft = (id: string, updated: DraftAction) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, action: updated } : d)))
  }

  const removeDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  const toggleSelect = (id: string) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d)))
  }

  const selectedDrafts = drafts.filter((d) => d.selected)

  const submit = async () => {
    if (selectedDrafts.length === 0 || submitting) return
    setSubmitting(true)
    const initialResults: ResultMap = {}
    selectedDrafts.forEach((d) => { initialResults[d.id] = "pending" })
    setResults(initialResults)

    let created = 0
    for (const draft of selectedDrafts) {
      const endpoint = ENDPOINT_MAP[draft.action.type]
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft.action.payload),
        })
        if (res.ok) {
          setResults((prev) => ({ ...prev, [draft.id]: "created" }))
          created++
        } else {
          setResults((prev) => ({ ...prev, [draft.id]: "failed" }))
        }
      } catch {
        setResults((prev) => ({ ...prev, [draft.id]: "failed" }))
      }
    }

    setDoneCount(created)
    setSubmitting(false)
  }

  const isDone = Object.keys(results).length > 0 && !submitting

  if (authLoading) {
    return (
      <DashboardLayout title="AI Capture">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="AI Capture">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Natural Language Capture
            </CardTitle>
            <CardDescription>
              Type anything — tasks, goals, habits, notes, projects, vault items, wishlist items, or events.
              AI parses your text into structured drafts. Nothing saves until you confirm.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.slice(0, 3).map((example, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setText(example)}
                  className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {example.length > 50 ? example.slice(0, 50) + "…" : example}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 1000))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    parse()
                  }
                }}
                placeholder="e.g. Remind me to call mom Friday and add gym 4 times a week."
                rows={4}
                className="resize-none"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">
                  {text.length}/1000 · Your text is sent to AI for parsing. Nothing saves until you confirm.
                </span>
                <Button onClick={parse} disabled={!text.trim() || parsing} className="gap-2">
                  {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Parse with AI
                </Button>
              </div>
            </div>

            {parseError && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {parseError}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Draft actions */}
        {parsed && drafts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                {drafts.length} draft {drafts.length === 1 ? "action" : "actions"} — review and edit before creating
              </p>
              <p className="text-xs text-muted-foreground">{selectedDrafts.length} selected</p>
            </div>

            {drafts.map((draft) => {
              const meta = TYPE_META[draft.action.type]
              const Icon = meta.icon
              const status = results[draft.id]

              return (
                <Card
                  key={draft.id}
                  className={`transition-opacity ${draft.selected ? "" : "opacity-50"} ${
                    status === "created" ? "border-green-500/50" :
                    status === "failed" ? "border-destructive/50" : ""
                  }`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={draft.selected}
                          onChange={() => toggleSelect(draft.id)}
                          disabled={!!status}
                          className="mt-0.5 h-4 w-4 cursor-pointer accent-primary"
                          aria-label={`Select ${draft.action.description}`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                              <Icon className="h-3 w-3" />
                              {meta.label}
                            </span>
                            {status === "created" && (
                              <Badge variant="outline" className="border-green-500 text-green-600 text-xs">Created</Badge>
                            )}
                            {status === "failed" && (
                              <Badge variant="destructive" className="text-xs">Failed</Badge>
                            )}
                            {status === "pending" && (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">{draft.action.description}</p>
                        </div>
                      </div>
                      {!status && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeDraft(draft.id)}
                          aria-label="Remove this draft"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  {!status && (
                    <CardContent className="pt-0">
                      <DraftFields
                        action={draft.action}
                        onChange={(updated) => updateDraft(draft.id, updated)}
                      />
                    </CardContent>
                  )}
                </Card>
              )
            })}

            {/* Action bar */}
            {!isDone ? (
              <div className="flex items-center justify-between rounded-lg border bg-card p-4">
                <p className="text-sm text-muted-foreground">
                  {selectedDrafts.length === 0
                    ? "No items selected."
                    : `${selectedDrafts.length} item${selectedDrafts.length === 1 ? "" : "s"} will be created.`}
                </p>
                <Button
                  onClick={submit}
                  disabled={selectedDrafts.length === 0 || submitting}
                  className="gap-2"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create {selectedDrafts.length > 0 ? selectedDrafts.length : ""} selected {selectedDrafts.length === 1 ? "item" : "items"}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>
                      {doneCount} of {selectedDrafts.length} item{selectedDrafts.length === 1 ? "" : "s"} created successfully.
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setText("")
                      setDrafts([])
                      setResults({})
                      setDoneCount(0)
                      setParsed(false)
                      setParseError("")
                    }}
                  >
                    Parse another
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {parsed && drafts.length === 0 && !parseError && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            All drafts removed. Click &quot;Parse with AI&quot; again or try a different input.
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
