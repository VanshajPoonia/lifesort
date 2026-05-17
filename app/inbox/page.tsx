"use client"

import { useEffect, useMemo, useState } from "react"
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
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { LifeAreaBadge, LifeAreaSelect } from "@/components/life-area-controls"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { LifeArea } from "@/lib/life-areas"
import { normalizeLifeArea } from "@/lib/life-areas"

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

const statusFilters: Array<{ value: InboxStatus; label: string }> = [
  { value: "unsorted", label: "Unsorted" },
  { value: "converted", label: "Converted" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
]

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
  habit: () => "/habits",
  wishlist_item: () => "/wishlist",
  vault_item: () => "/vault",
  calendar_event: () => "/calendar",
}

function titleFromText(rawText: string) {
  return rawText.trim().split(/\r?\n/)[0]?.trim().slice(0, 255) || "Inbox item"
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function areaForItem(item: InboxItem, areas: LifeArea[]) {
  if (!item.life_area_id) return null
  const area = areas.find((candidate) => String(candidate.id) === String(item.life_area_id))
  if (area) return area
  if (item.life_area_name) {
    return {
      id: String(item.life_area_id),
      name: item.life_area_name,
      icon: item.life_area_icon || "Target",
      color: item.life_area_color || "#64748B",
      description: null,
      sort_order: 0,
    }
  }
  return null
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

export default function InboxPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [items, setItems] = useState<InboxItem[]>([])
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [filter, setFilter] = useState<InboxStatus>("unsorted")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [capture, setCapture] = useState({ title: "", raw_text: "", suggested_type: "none", life_area_id: null as string | null })
  const [editing, setEditing] = useState<InboxItem | null>(null)
  const [editValues, setEditValues] = useState({ title: "", raw_text: "", suggested_type: "none", life_area_id: null as string | null })
  const [converting, setConverting] = useState<InboxItem | null>(null)
  const [targetType, setTargetType] = useState<TargetType>("task")
  const [payload, setPayload] = useState<Record<string, string | null>>({})
  const [convertError, setConvertError] = useState("")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
      return
    }

    if (user) {
      void fetchData()
    }
  }, [authLoading, user, router])

  const fetchData = async () => {
    setLoading(true)
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
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== "all" && item.status !== filter) return false
      if (!q) return true
      const haystack = [
        item.title,
        item.raw_text,
        item.suggested_type ? targetLabels[item.suggested_type] : "",
        item.status,
        item.source,
        item.life_area_name || "",
      ].join(" ").toLowerCase()
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

  const createInboxItem = async () => {
    const rawText = capture.raw_text.trim()
    const title = capture.title.trim() || titleFromText(rawText)
    if (!rawText && !capture.title.trim()) {
      setError("Add a title or some text first.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          raw_text: rawText,
          suggested_type: capture.suggested_type === "none" ? null : capture.suggested_type,
          life_area_id: capture.life_area_id,
          source: "manual",
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to capture item.")
      setCapture({ title: "", raw_text: "", suggested_type: "none", life_area_id: null })
      setFilter("unsorted")
      if (filter === "unsorted") await fetchData()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to capture item.")
    } finally {
      setSaving(false)
    }
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
      setFilter("converted")
      if (filter === "converted") await fetchData()
    } catch (conversionError) {
      setConvertError(conversionError instanceof Error ? conversionError.message : "Failed to convert inbox item.")
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || !user) {
    return (
      <DashboardLayout title="Inbox">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Inbox" subtitle="Capture now. Sort later.">
      <div className="space-y-6">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              Quick Capture
            </CardTitle>
            <CardDescription>Drop the thought here before it gets lost.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
              <Input
                value={capture.title}
                onChange={(event) => setCapture((current) => ({ ...current, title: event.target.value }))}
                placeholder="Optional title"
              />
              <Select
                value={capture.suggested_type}
                onValueChange={(value) => setCapture((current) => ({ ...current, suggested_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Suggested type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No suggestion</SelectItem>
                  {targetOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={capture.raw_text}
              onChange={(event) => setCapture((current) => ({ ...current, raw_text: event.target.value }))}
              placeholder="A reminder, worry, idea, responsibility, shopping thought, or anything unfinished..."
              className="min-h-[120px]"
            />
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="space-y-2">
                <Label>Life Area</Label>
                <LifeAreaSelect
                  areas={lifeAreas}
                  value={capture.life_area_id}
                  onChange={(value) => setCapture((current) => ({ ...current, life_area_id: value }))}
                />
              </div>
              <Button onClick={createInboxItem} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Inbox className="h-4 w-4" />}
                Capture
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {statusFilters.map((status) => (
              <Button
                key={status.value}
                type="button"
                variant={filter === status.value ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilter(status.value)}
              >
                {status.label}
              </Button>
            ))}
          </div>
          <div className="relative md:w-80">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Inbox..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-2xl font-bold">{counts.unsorted}</p>
            <p className="text-xs text-muted-foreground">unsorted</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-2xl font-bold">{counts.converted}</p>
            <p className="text-xs text-muted-foreground">converted</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-2xl font-bold">{counts.archived}</p>
            <p className="text-xs text-muted-foreground">archived</p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {loading ? (
            <>
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <Inbox className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-lg font-semibold">
                {search ? "No matching inbox items" : filter === "unsorted" ? "Your Inbox is clear" : "Nothing here yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {filter === "unsorted"
                  ? "Capture something above, or use Quick Add when a thought is too messy for a module."
                  : "Switch filters or capture a new item to start sorting."}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const area = areaForItem(item, lifeAreas)
              const suggested = item.suggested_type ? targetLabels[item.suggested_type] : null
              const convertedHref = item.converted_type ? convertedHrefs[item.converted_type](item.converted_id) : null

              return (
                <Card key={item.id}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="truncate text-lg">{item.title}</CardTitle>
                          <Badge variant={item.status === "unsorted" ? "default" : "outline"}>{item.status}</Badge>
                          <Badge variant="outline">{item.source.replace("_", " ")}</Badge>
                          {suggested && <Badge variant="secondary">{suggested}</Badge>}
                          <LifeAreaBadge area={area} fallback="No area" />
                        </div>
                        <CardDescription className="mt-1">Updated {formatDate(item.updated_at)}</CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.status === "unsorted" && (
                          <Button size="sm" onClick={() => openConvert(item)} className="gap-2">
                            Convert
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                          Edit
                        </Button>
                        {item.status === "archived" ? (
                          <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "unsorted" })} className="gap-2">
                            <RotateCcw className="h-4 w-4" />
                            Restore
                          </Button>
                        ) : item.status !== "converted" ? (
                          <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "archived" })} className="gap-2">
                            <Archive className="h-4 w-4" />
                            Archive
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => deleteItem(item)} className="gap-2 text-destructive">
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {item.raw_text ? (
                      <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{item.raw_text}</p>
                    ) : (
                      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No extra text saved.</p>
                    )}
                    {convertedHref && item.converted_type && (
                      <Button asChild variant="outline" size="sm" className="gap-2">
                        <Link href={convertedHref}>
                          Open {targetLabels[item.converted_type]}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Inbox Item</DialogTitle>
            <DialogDescription>Adjust the capture before sorting it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editValues.title} onChange={(event) => setEditValues((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Text</Label>
              <Textarea
                value={editValues.raw_text}
                onChange={(event) => setEditValues((current) => ({ ...current, raw_text: event.target.value }))}
                className="min-h-[120px]"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Suggested type</Label>
                <Select value={editValues.suggested_type} onValueChange={(value) => setEditValues((current) => ({ ...current, suggested_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No suggestion</SelectItem>
                    {targetOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Life Area</Label>
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
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(converting)} onOpenChange={(open) => !open && setConverting(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Convert Inbox Item</DialogTitle>
            <DialogDescription>Review the destination and details before creating anything.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Convert to</Label>
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
          <Label>Life Area</Label>
          <LifeAreaSelect areas={lifeAreas} value={payload.life_area_id} onChange={(value) => onChange("life_area_id", value)} />
        </div>
      </div>
    </div>
  )
}
