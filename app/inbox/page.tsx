"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ElementType } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Archive,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  FileText,
  FolderPlus,
  Heart,
  Inbox,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { AI_SORT_MAX_CHARS, AiSortPanel } from "@/components/inbox/ai-sort-panel"
import { LifeAreaSelect } from "@/components/life-area-controls"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import type { LifeArea } from "@/lib/life-areas"
import { normalizeLifeArea } from "@/lib/life-areas"
import { cn } from "@/lib/utils"

// Inbox is the one place to capture (Stage 1 step 4, 2026-11-11). Universal
// Capture folded in here: save a thought as is, or save it and let AI draft
// tasks, events and the rest for you to confirm.

type InboxStatus = "unsorted" | "converted" | "archived" | "all"
type InboxSource = "manual" | "quick_add" | "ai_capture"
type TargetType = "task" | "goal" | "note" | "project" | "habit" | "wishlist_item" | "vault_item" | "calendar_event"

type InboxItem = {
  id: number
  title: string
  raw_text: string
  suggested_type: TargetType | null
  status: Exclude<InboxStatus, "all">
  life_area_id: number | string | null
  life_area_name?: string | null
  life_area_icon?: string | null
  life_area_color?: string | null
  source: InboxSource
  converted_type: TargetType | null
  converted_id: number | null
  created_at: string
  updated_at: string
}

type AiSource = { key: string; text: string; inboxItemId: number | null }

const statusFilters: Array<{ value: InboxStatus; label: string; empty: string }> = [
  { value: "unsorted", label: "To sort", empty: "Your Inbox is clear. Anything you jot down above lands here." },
  { value: "converted", label: "Sorted", empty: "Nothing sorted yet." },
  { value: "archived", label: "Archived", empty: "Nothing archived." },
  { value: "all", label: "All", empty: "Nothing here yet. Jot something down above." },
]

const sourceLabels: Record<InboxSource, string> = {
  manual: "Typed here",
  quick_add: "Quick Add",
  ai_capture: "Sorted with AI",
}

const targetOptions: Array<{ value: TargetType; label: string; icon: ElementType }> = [
  { value: "task", label: "Task", icon: CheckSquare },
  { value: "goal", label: "Goal", icon: Target },
  { value: "note", label: "Note", icon: FileText },
  { value: "project", label: "Project", icon: FolderPlus },
  { value: "habit", label: "Habit", icon: Sparkles },
  { value: "wishlist_item", label: "Wishlist item", icon: Heart },
  { value: "vault_item", label: "Vault item", icon: Shield },
  { value: "calendar_event", label: "Calendar event", icon: CalendarDays },
]

const targetLabels = Object.fromEntries(targetOptions.map((item) => [item.value, item.label])) as Record<TargetType, string>
const convertedHrefs: Record<TargetType, (id: number | null) => string> = {
  task: () => "/tasks",
  goal: () => "/goals",
  note: () => "/notes",
  project: (id) => (id ? `/projects/${id}` : "/projects"),
  habit: () => "/tasks?tab=habits",
  wishlist_item: () => "/wishlist",
  vault_item: () => "/vault",
  calendar_event: () => "/tasks?tab=calendar",
}

function titleFromText(rawText: string) {
  return rawText.trim().split(/\r?\n/)[0]?.trim().slice(0, 255) || "Inbox item"
}

function defaultPayload(item: InboxItem, targetType: TargetType): Record<string, string | null> {
  const title = item.title || titleFromText(item.raw_text)
  const text = item.raw_text || item.title
  const life_area_id = item.life_area_id ? String(item.life_area_id) : null

  if (targetType === "habit") {
    return { name: title, description: text, frequency: "daily", target_count: "1", life_area_id }
  }

  if (targetType === "note") {
    return { title, content: text, life_area_id }
  }

  if (targetType === "wishlist_item") {
    return { title, description: text, price: "", link: "", priority: "medium", life_area_id }
  }

  if (targetType === "vault_item") {
    return { title, description: text, category: "other", expiry_date: "", life_area_id }
  }

  if (targetType === "calendar_event") {
    return { title, description: text, event_date: "", start_time: "", end_time: "", life_area_id }
  }

  return { title, description: text, priority: "medium", due_date: "", target_date: "", life_area_id }
}

function shortDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// Text the AI sees for an existing item: the title, plus the body when it adds anything.
function aiTextFor(item: InboxItem) {
  const body = item.raw_text?.trim() || ""
  const title = item.title?.trim() || ""
  if (!body) return title
  return body.startsWith(title) ? body : `${title}\n${body}`
}

export default function InboxPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()

  const [items, setItems] = useState<InboxItem[]>([])
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [filter, setFilter] = useState<InboxStatus>("unsorted")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [captureText, setCaptureText] = useState("")
  const [aiSource, setAiSource] = useState<AiSource | null>(null)
  const [editing, setEditing] = useState<InboxItem | null>(null)
  const [editValues, setEditValues] = useState({ title: "", raw_text: "", suggested_type: "none", life_area_id: null as string | null })
  const [converting, setConverting] = useState<InboxItem | null>(null)
  const [targetType, setTargetType] = useState<TargetType>("task")
  const [payload, setPayload] = useState<Record<string, string | null>>({})
  const [convertError, setConvertError] = useState("")

  const fetchData = useCallback(async () => {
    setError("")
    try {
      const [itemsRes, areasRes] = await Promise.all([
        fetch("/api/inbox?status=all&limit=100"),
        fetch("/api/life-areas"),
      ])

      if (!itemsRes.ok) throw new Error("Inbox is unavailable right now.")
      const itemsData = (await itemsRes.json()) as InboxItem[]
      setItems(Array.isArray(itemsData) ? itemsData : [])

      if (areasRes.ok) {
        const areasData = await areasRes.json()
        setLifeAreas(Array.isArray(areasData) ? areasData.map((area) => normalizeLifeArea(area)) : [])
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Inbox is unavailable right now.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
      return
    }

    if (user) {
      // Flagged by react-hooks/set-state-in-effect: fetchData is shared with
      // several mutation handlers below that need the reload afterward too.
      void fetchData()
    }
  }, [authLoading, user, router, fetchData])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false
      if (!q) return true
      const haystack = [item.title, item.raw_text, item.life_area_name || ""].join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [filter, items, search])

  const counts = useMemo(() => {
    return items.reduce(
      (total, item) => {
        total[item.status] += 1
        return total
      },
      { unsorted: 0, converted: 0, archived: 0 },
    )
  }, [items])

  // Saving always comes first, so a thought is never lost while the AI works.
  const saveCapture = async (sortWithAi: boolean) => {
    const rawText = captureText.trim()
    if (!rawText || saving) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: titleFromText(rawText),
          raw_text: rawText,
          source: sortWithAi ? "ai_capture" : "manual",
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Couldn't save that.")
      setCaptureText("")
      setFilter("unsorted")
      await fetchData()
      if (sortWithAi && data?.id) {
        setAiSource({ key: `item-${data.id}-${Date.now()}`, text: rawText, inboxItemId: Number(data.id) })
      } else {
        toast({ title: "Saved to Inbox", description: "Sort it whenever you have a minute." })
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Couldn't save that.")
    } finally {
      setSaving(false)
    }
  }

  const sortItemWithAi = (item: InboxItem) => {
    setAiSource({ key: `item-${item.id}-${Date.now()}`, text: aiTextFor(item), inboxItemId: item.id })
  }

  const updateItem = async (item: InboxItem, patch: Partial<InboxItem>) => {
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/inbox", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, ...patch }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to update inbox item.")
      await fetchData()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update inbox item.")
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (item: InboxItem) => {
    if (!window.confirm(`Delete "${item.title}" from Inbox?`)) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/inbox", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to delete inbox item.")
      await fetchData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete inbox item.")
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (item: InboxItem) => {
    setEditing(item)
    setEditValues({
      title: item.title,
      raw_text: item.raw_text || "",
      suggested_type: item.suggested_type || "none",
      life_area_id: item.life_area_id ? String(item.life_area_id) : null,
    })
  }

  const saveEdit = async () => {
    if (!editing) return
    await updateItem(editing, {
      title: editValues.title,
      raw_text: editValues.raw_text,
      suggested_type: editValues.suggested_type === "none" ? null : (editValues.suggested_type as TargetType),
      life_area_id: editValues.life_area_id,
    } as Partial<InboxItem>)
    setEditing(null)
  }

  const openConvert = (item: InboxItem) => {
    const nextType = item.suggested_type || "task"
    setConverting(item)
    setTargetType(nextType)
    setPayload(defaultPayload(item, nextType))
    setConvertError("")
  }

  const changeTargetType = (next: TargetType) => {
    setTargetType(next)
    if (converting) setPayload(defaultPayload(converting, next))
    setConvertError("")
  }

  const setPayloadField = (field: string, value: string | null) => {
    setPayload((current) => ({ ...current, [field]: value }))
    setConvertError("")
  }

  const convertItem = async () => {
    if (!converting) return
    setSaving(true)
    setConvertError("")
    try {
      const response = await fetch("/api/inbox/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: converting.id,
          target_type: targetType,
          payload,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to convert inbox item.")
      setConverting(null)
      toast({ title: `Made a ${targetLabels[targetType].toLowerCase()}`, description: converting.title })
      await fetchData()
    } catch (conversionError) {
      setConvertError(conversionError instanceof Error ? conversionError.message : "Failed to convert inbox item.")
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  const activeFilter = statusFilters.find((option) => option.value === filter) ?? statusFilters[0]
  const tooLongForAi = captureText.trim().length > AI_SORT_MAX_CHARS

  return (
    <DashboardLayout>
      <div className="section-enter mx-auto w-full max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dump it here. Sort it when you have a minute.</p>
        </header>

        <section aria-label="Capture" className="rounded-xl border bg-card p-4 sm:p-5">
          <Label htmlFor="inbox-capture" className="sr-only">
            What&apos;s on your mind?
          </Label>
          <Textarea
            id="inbox-capture"
            value={captureText}
            onChange={(event) => setCaptureText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                void saveCapture(false)
              }
            }}
            placeholder="What's on your mind? A reminder, a worry, an idea, a whole messy list..."
            className="min-h-[110px] resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
          />
          <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {tooLongForAi
                ? `AI can sort up to ${AI_SORT_MAX_CHARS} characters. Save it, or shorten it to sort with AI.`
                : "Sort with AI sends the text to the AI. It saves to Inbox first, so nothing is lost."}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={() => void saveCapture(false)} disabled={!captureText.trim() || saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Inbox className="h-4 w-4" aria-hidden="true" />}
                Save
              </Button>
              <Button onClick={() => void saveCapture(true)} disabled={!captureText.trim() || saving || tooLongForAi} className="gap-2">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Sort with AI
              </Button>
            </div>
          </div>
        </section>

        {aiSource && (
          <AiSortPanel
            key={aiSource.key}
            text={aiSource.text}
            inboxItemId={aiSource.inboxItemId}
            onClose={() => setAiSource(null)}
            onFinished={() => void fetchData()}
          />
        )}

        {error && (
          <p role="status" className="rounded-xl border border-dashed bg-card/60 p-4 text-sm text-muted-foreground">
            {error}
          </p>
        )}

        <section aria-labelledby="inbox-list" className="space-y-3">
          <h2 id="inbox-list" className="sr-only">Inbox items</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="group" aria-label="Show" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
              {statusFilters.map((option) => {
                const selected = filter === option.value
                const count = option.value === "all" ? null : counts[option.value]
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setFilter(option.value)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
                      selected
                        ? "border-primary/30 bg-primary-tint text-primary"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {option.label}
                    {count ? <span className="tabular-nums opacity-80">{count}</span> : null}
                  </button>
                )
              })}
            </div>
            {items.length > 5 && (
              <div className="relative sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search Inbox"
                  aria-label="Search Inbox"
                  className="h-9 bg-card pl-9"
                />
              </div>
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : filteredItems.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card/60 p-5 text-sm text-muted-foreground">
              {search ? "Nothing matches that search." : activeFilter.empty}
            </p>
          ) : (
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card">
              {filteredItems.map((item) => {
                const convertedHref = item.converted_type ? convertedHrefs[item.converted_type](item.converted_id) : null
                const body = item.raw_text?.trim() && item.raw_text.trim() !== item.title.trim() ? item.raw_text.trim() : null
                const meta = [
                  shortDate(item.created_at),
                  sourceLabels[item.source] || null,
                  item.life_area_name || null,
                  item.suggested_type && item.status === "unsorted" ? `Maybe a ${targetLabels[item.suggested_type].toLowerCase()}` : null,
                ].filter(Boolean)
                return (
                  <li key={item.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-foreground">{item.title}</p>
                      {body && <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">{body}</p>}
                      {meta.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{meta.join(" · ")}</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.status === "unsorted" && (
                        <>
                          <Button size="sm" variant="outline" className="h-8 bg-card" onClick={() => openConvert(item)}>
                            Sort
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1.5 text-primary"
                            onClick={() => sortItemWithAi(item)}
                            disabled={aiTextFor(item).length > AI_SORT_MAX_CHARS}
                          >
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            AI
                          </Button>
                        </>
                      )}
                      {convertedHref && item.converted_type && (
                        <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5">
                          <Link href={convertedHref}>
                            Open {targetLabels[item.converted_type].toLowerCase()}
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label={`More for ${item.title}`}>
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openEdit(item)}>
                            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                            Edit
                          </DropdownMenuItem>
                          {item.status === "archived" ? (
                            <DropdownMenuItem onSelect={() => void updateItem(item, { status: "unsorted" })}>
                              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                              Move back to sort
                            </DropdownMenuItem>
                          ) : item.status !== "converted" ? (
                            <DropdownMenuItem onSelect={() => void updateItem(item, { status: "archived" })}>
                              <Archive className="mr-2 h-4 w-4" aria-hidden="true" />
                              Archive
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onSelect={() => void deleteItem(item)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit</DialogTitle>
            <DialogDescription>Tidy it up before you sort it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inbox-edit-title">Title</Label>
              <Input id="inbox-edit-title" value={editValues.title} onChange={(event) => setEditValues((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inbox-edit-text">Text</Label>
              <Textarea
                id="inbox-edit-text"
                value={editValues.raw_text}
                onChange={(event) => setEditValues((current) => ({ ...current, raw_text: event.target.value }))}
                className="min-h-[120px]"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Probably a</Label>
                <Select value={editValues.suggested_type} onValueChange={(value) => setEditValues((current) => ({ ...current, suggested_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not sure yet</SelectItem>
                    {targetOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Life domain</Label>
                <LifeAreaSelect
                  areas={lifeAreas}
                  value={editValues.life_area_id}
                  onChange={(value) => setEditValues((current) => ({ ...current, life_area_id: value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(converting)} onOpenChange={(open) => !open && setConverting(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sort it</DialogTitle>
            <DialogDescription>Pick what this becomes and check the details. Nothing is created until you confirm.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Make it a</Label>
              <Select value={targetType} onValueChange={(value) => changeTargetType(value as TargetType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {targetOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ConversionFields
              targetType={targetType}
              payload={payload}
              lifeAreas={lifeAreas}
              onChange={setPayloadField}
            />

            {convertError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {convertError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConverting(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={convertItem} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create {targetLabels[targetType]}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

function ConversionFields({
  targetType,
  payload,
  lifeAreas,
  onChange,
}: {
  targetType: TargetType
  payload: Record<string, string | null>
  lifeAreas: LifeArea[]
  onChange: (field: string, value: string | null) => void
}) {
  const titleKey = targetType === "habit" ? "name" : "title"
  const dateLabel =
    targetType === "goal" ? "Target date" :
    targetType === "project" || targetType === "task" ? "Due date" :
    targetType === "vault_item" ? "Expiry date" :
    targetType === "calendar_event" ? "Event date" :
    ""
  const dateKey =
    targetType === "goal" ? "target_date" :
    targetType === "vault_item" ? "expiry_date" :
    targetType === "calendar_event" ? "event_date" :
    "due_date"

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{targetType === "habit" ? "Name" : "Title"}</Label>
        <Input value={payload[titleKey] || ""} onChange={(event) => onChange(titleKey, event.target.value)} />
      </div>

      {(targetType === "task" || targetType === "goal" || targetType === "project" || targetType === "note" || targetType === "wishlist_item" || targetType === "vault_item" || targetType === "calendar_event" || targetType === "habit") && (
        <div className="space-y-2">
          <Label>{targetType === "note" ? "Content" : "Description"}</Label>
          <Textarea
            value={(targetType === "note" ? payload.content : payload.description) || ""}
            onChange={(event) => onChange(targetType === "note" ? "content" : "description", event.target.value)}
            className="min-h-[100px]"
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {dateLabel && (
          <div className="space-y-2">
            <Label>{dateLabel}{targetType === "calendar_event" ? " *" : ""}</Label>
            <Input type="date" value={payload[dateKey] || ""} onChange={(event) => onChange(dateKey, event.target.value || null)} />
          </div>
        )}

        {(targetType === "task" || targetType === "goal" || targetType === "project" || targetType === "wishlist_item") && (
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={payload.priority || "medium"} onValueChange={(value) => onChange("priority", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {targetType === "habit" && (
          <>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={payload.frequency || "daily"} onValueChange={(value) => onChange("frequency", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target count</Label>
              <Input type="number" min={1} value={payload.target_count || "1"} onChange={(event) => onChange("target_count", event.target.value)} />
            </div>
          </>
        )}

        {targetType === "wishlist_item" && (
          <>
            <div className="space-y-2">
              <Label>Price</Label>
              <Input type="number" min={0} step="0.01" value={payload.price || ""} onChange={(event) => onChange("price", event.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={payload.link || ""} onChange={(event) => onChange("link", event.target.value)} />
            </div>
          </>
        )}

        {targetType === "vault_item" && (
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={payload.category || "other"} onValueChange={(value) => onChange("category", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["documents", "subscriptions", "warranty", "insurance", "vehicle", "home", "medical", "education", "work", "other"].map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {targetType === "calendar_event" && (
          <>
            <div className="space-y-2">
              <Label>Start time *</Label>
              <Input type="time" value={payload.start_time || ""} onChange={(event) => onChange("start_time", event.target.value || null)} />
            </div>
            <div className="space-y-2">
              <Label>End time *</Label>
              <Input type="time" value={payload.end_time || ""} onChange={(event) => onChange("end_time", event.target.value || null)} />
            </div>
          </>
        )}

        <div className="space-y-2 sm:col-span-2">
          <Label>Life Domain</Label>
          <LifeAreaSelect areas={lifeAreas} value={payload.life_area_id} onChange={(value) => onChange("life_area_id", value)} />
        </div>
      </div>
    </div>
  )
}
