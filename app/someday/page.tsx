"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Archive,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  FolderPlus,
  GraduationCap,
  HeartPulse,
  Lightbulb,
  Loader2,
  Plane,
  Plus,
  Search,
  ShoppingCart,
  Target,
  Trash2,
  Wallet,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { LifeAreaBadge, LifeAreaSelect } from "@/components/life-area-controls"
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

type SomedayCategory = "idea" | "project" | "purchase" | "travel" | "learning" | "relationship" | "finance" | "health" | "other"
type SomedayStatus = "someday" | "promoted" | "archived"
type SomedayView = "all" | "review_due" | "someday" | "promoted" | "archived" | "category"
type PromoteTarget = "project" | "goal" | "task" | "wishlist_item" | "note"

type SomedayItem = {
  id: number
  title: string
  description: string | null
  category: SomedayCategory
  life_area_id: number | string | null
  life_area_name?: string | null
  life_area_icon?: string | null
  life_area_color?: string | null
  review_date: string | null
  status: SomedayStatus
  promoted_type: PromoteTarget | null
  promoted_id: number | string | null
  is_review_due?: boolean
  created_at?: string | null
  updated_at?: string | null
}

type SomedayForm = {
  title: string
  description: string
  category: SomedayCategory
  life_area_id: string
  review_date: string
  status: SomedayStatus
}

type PromoteForm = {
  target_type: PromoteTarget
  title: string
  description: string
  due_date: string
  target_date: string
  price: string
  url: string
  priority: "low" | "medium" | "high"
}

const categoryOptions: Array<{ value: SomedayCategory; label: string; icon: typeof Lightbulb }> = [
  { value: "idea", label: "Idea", icon: Lightbulb },
  { value: "project", label: "Project", icon: FolderPlus },
  { value: "purchase", label: "Purchase", icon: ShoppingCart },
  { value: "travel", label: "Travel", icon: Plane },
  { value: "learning", label: "Learning", icon: GraduationCap },
  { value: "relationship", label: "Relationship", icon: Target },
  { value: "finance", label: "Finance", icon: Wallet },
  { value: "health", label: "Health", icon: HeartPulse },
  { value: "other", label: "Other", icon: FileText },
]

const viewOptions: Array<{ value: SomedayView; label: string }> = [
  { value: "all", label: "All" },
  { value: "review_due", label: "Due for review" },
  { value: "someday", label: "Someday" },
  { value: "promoted", label: "Promoted" },
  { value: "archived", label: "Archived" },
  { value: "category", label: "By category" },
]

const statusOptions: Array<{ value: SomedayStatus; label: string }> = [
  { value: "someday", label: "Someday" },
  { value: "promoted", label: "Promoted" },
  { value: "archived", label: "Archived" },
]

const promoteOptions: Array<{ value: PromoteTarget; label: string }> = [
  { value: "project", label: "Project" },
  { value: "goal", label: "Goal" },
  { value: "task", label: "Task" },
  { value: "wishlist_item", label: "Wishlist item" },
  { value: "note", label: "Note" },
]

const emptyForm: SomedayForm = {
  title: "",
  description: "",
  category: "idea",
  life_area_id: "",
  review_date: "",
  status: "someday",
}

const emptyPromoteForm: PromoteForm = {
  target_type: "project",
  title: "",
  description: "",
  due_date: "",
  target_date: "",
  price: "",
  url: "",
  priority: "medium",
}

function localDate() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function dateOnly(value?: string | null) {
  return value ? String(value).slice(0, 10) : ""
}

function formatDate(value?: string | null) {
  if (!value) return "No review date"
  return new Date(`${dateOnly(value)}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function findArea(item: SomedayItem): LifeArea | null {
  if (!item.life_area_id || !item.life_area_name) return null
  return normalizeLifeArea({
    id: item.life_area_id,
    name: item.life_area_name,
    icon: item.life_area_icon || "Target",
    color: item.life_area_color || "#2563EB",
    description: null,
    sort_order: 0,
  })
}

function categoryLabel(value: SomedayCategory) {
  return categoryOptions.find((item) => item.value === value)?.label || "Other"
}

function promotedHref(item: SomedayItem) {
  if (!item.promoted_type || !item.promoted_id) return "/someday"
  if (item.promoted_type === "project") return `/projects/${item.promoted_id}`
  if (item.promoted_type === "goal") return "/goals"
  if (item.promoted_type === "task") return "/tasks"
  if (item.promoted_type === "wishlist_item") return "/wishlist"
  return "/notes"
}

export default function SomedayPage() {
  const [items, setItems] = useState<SomedayItem[]>([])
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [view, setView] = useState<SomedayView>("someday")
  const [category, setCategory] = useState<SomedayCategory>("idea")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [error, setError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SomedayItem | null>(null)
  const [form, setForm] = useState<SomedayForm>(emptyForm)
  const [promoteItem, setPromoteItem] = useState<SomedayItem | null>(null)
  const [promoteForm, setPromoteForm] = useState<PromoteForm>(emptyPromoteForm)

  const dueCount = useMemo(() => items.filter((item) => item.status === "someday" && item.review_date && dateOnly(item.review_date) <= localDate()).length, [items])
  const activeCount = useMemo(() => items.filter((item) => item.status === "someday").length, [items])
  const promotedCount = useMemo(() => items.filter((item) => item.status === "promoted").length, [items])

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ view, limit: "200" })
      if (view === "category") params.set("category", category)
      if (search.trim()) params.set("q", search.trim())
      const response = await fetch(`/api/someday?${params.toString()}`)
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to load Someday items.")
      setItems(Array.isArray(data) ? data : [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Someday items.")
    } finally {
      setLoading(false)
    }
  }, [view, category, search])

  const loadLifeAreas = useCallback(async () => {
    try {
      const response = await fetch("/api/life-areas")
      if (!response.ok) return []
      const data = await response.json()
      return Array.isArray(data) ? data.map((item) => normalizeLifeArea(item)) : []
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    loadLifeAreas().then((areas) => {
      if (!cancelled) setLifeAreas(areas)
    })
    return () => {
      cancelled = true
    }
  }, [loadLifeAreas])

  useEffect(() => {
    // Flagged by react-hooks/set-state-in-effect: re-runs when view/category/
    // search change and needs the loading indicator back on immediately.
    // loadItems is also shared with several mutation handlers below.
    const timeout = window.setTimeout(() => {
      loadItems()
    }, search.trim() ? 250 : 0)

    return () => window.clearTimeout(timeout)
  }, [loadItems, search])

  const openCreate = () => {
    setEditingItem(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (item: SomedayItem) => {
    setEditingItem(item)
    setForm({
      title: item.title,
      description: item.description || "",
      category: item.category,
      life_area_id: item.life_area_id ? String(item.life_area_id) : "",
      review_date: dateOnly(item.review_date),
      status: item.status,
    })
    setDialogOpen(true)
  }

  const saveItem = async () => {
    if (!form.title.trim()) {
      setError("Title is required.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/someday", {
        method: editingItem ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem?.id,
          title: form.title,
          description: form.description || null,
          category: form.category,
          life_area_id: form.life_area_id || null,
          review_date: form.review_date || null,
          status: form.status,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to save Someday item.")
      setDialogOpen(false)
      await loadItems()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save Someday item.")
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (item: SomedayItem, status: SomedayStatus) => {
    setError("")
    try {
      const response = await fetch("/api/someday", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to update Someday item.")
      await loadItems()
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to update Someday item.")
    }
  }

  const deleteItem = async (item: SomedayItem) => {
    if (!window.confirm(`Delete "${item.title}" from Someday / Maybe? This cannot be undone.`)) return

    setError("")
    try {
      const response = await fetch("/api/someday", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to delete Someday item.")
      await loadItems()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete Someday item.")
    }
  }

  const openPromote = (item: SomedayItem) => {
    setPromoteItem(item)
    setPromoteForm({
      ...emptyPromoteForm,
      target_type: item.category === "purchase" ? "wishlist_item" : item.category === "project" ? "project" : "task",
      title: item.title,
      description: item.description || "",
    })
  }

  const promote = async () => {
    if (!promoteItem) return
    if (!promoteForm.title.trim()) {
      setError("Promotion title is required.")
      return
    }

    setPromoting(true)
    setError("")
    try {
      const payload: Record<string, unknown> = {
        title: promoteForm.title,
        description: promoteForm.description || null,
        priority: promoteForm.priority,
      }
      if (promoteForm.target_type === "project") payload.due_date = promoteForm.due_date || null
      if (promoteForm.target_type === "goal") payload.target_date = promoteForm.target_date || null
      if (promoteForm.target_type === "task") payload.due_date = promoteForm.due_date || null
      if (promoteForm.target_type === "wishlist_item") {
        payload.price = promoteForm.price ? Number.parseFloat(promoteForm.price) : null
        payload.url = promoteForm.url || null
      }
      if (promoteForm.target_type === "note") {
        payload.content = promoteForm.description || promoteItem.description || ""
      }

      const response = await fetch("/api/someday/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: promoteItem.id, target_type: promoteForm.target_type, payload }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to promote Someday item.")
      setPromoteItem(null)
      await loadItems()
    } catch (promoteError) {
      setError(promoteError instanceof Error ? promoteError.message : "Failed to promote Someday item.")
    } finally {
      setPromoting(false)
    }
  }

  const emptyTitle = search.trim()
    ? "No matching Someday items"
    : view === "review_due"
      ? "Nothing is due for review"
      : view === "category"
        ? `No ${categoryLabel(category).toLowerCase()} items yet`
        : "No Someday items yet"

  const emptyDescription = search.trim()
    ? "Try another search or clear the filters."
    : view === "review_due"
      ? "Low-pressure is working. Add review dates when an idea deserves a future check-in."
      : "Capture ideas, possible projects, trips, purchases, and maybe-one-day thoughts here."

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Someday / Maybe</h1>
            <p className="text-muted-foreground">A low-pressure shelf for ideas and possibilities before they become commitments.</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Someday Item
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active someday items</CardDescription>
              <CardTitle className="text-3xl">{loading ? "..." : activeCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Due for review</CardDescription>
              <CardTitle className="text-3xl">{loading ? "..." : dueCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Promoted</CardDescription>
              <CardTitle className="text-3xl">{loading ? "..." : promotedCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 lg:grid-cols-[180px_180px_minmax(0,1fr)]">
              <Select value={view} onValueChange={(value) => setView(value as SomedayView)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {viewOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={category} onValueChange={(value) => setCategory(value as SomedayCategory)} disabled={view !== "category"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Someday items..." className="pl-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-center gap-2 py-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
              <Lightbulb className="h-10 w-10 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold">{emptyTitle}</h2>
                <p className="max-w-md text-sm text-muted-foreground">{emptyDescription}</p>
              </div>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Add an idea
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item) => {
              const CategoryIcon = categoryOptions.find((option) => option.value === item.category)?.icon || Lightbulb
              return (
                <Card key={item.id} className={item.is_review_due ? "border-primary/50" : ""}>
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <CardTitle className="truncate text-lg">{item.title}</CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="gap-1.5">
                            <CategoryIcon className="h-3 w-3" />
                            {categoryLabel(item.category)}
                          </Badge>
                          <Badge variant={item.status === "someday" ? "secondary" : "outline"}>{item.status.replace("_", " ")}</Badge>
                          {item.is_review_due ? <Badge>Review due</Badge> : null}
                        </CardDescription>
                      </div>
                      <LifeAreaBadge area={findArea(item)} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {item.description ? <p className="line-clamp-3 text-sm text-muted-foreground">{item.description}</p> : null}
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-4 w-4" />
                        {formatDate(item.review_date)}
                      </span>
                      {item.promoted_type && item.promoted_id ? (
                        <a href={promotedHref(item)} className="inline-flex items-center gap-1 text-primary hover:underline">
                          <ArrowUpRight className="h-4 w-4" />
                          Promoted to {item.promoted_type.replace("_item", "").replace("_", " ")}
                        </a>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                        Edit
                      </Button>
                      {item.status === "someday" ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => openPromote(item)} className="gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            Promote
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => updateStatus(item, "archived")} className="gap-1">
                            <Archive className="h-3 w-3" />
                            Archive
                          </Button>
                        </>
                      ) : item.status === "archived" ? (
                        <Button variant="outline" size="sm" onClick={() => updateStatus(item, "someday")} className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Restore
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="sm" onClick={() => deleteItem(item)} className="gap-1 text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Someday item" : "Add Someday item"}</DialogTitle>
            <DialogDescription>Capture the possibility without making it an active commitment.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="someday-title">Title *</Label>
              <Input id="someday-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="someday-description">Description</Label>
              <Textarea id="someday-description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(value) => setForm((current) => ({ ...current, category: value as SomedayCategory }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="someday-review">Review date</Label>
              <Input id="someday-review" type="date" value={form.review_date} onChange={(event) => setForm((current) => ({ ...current, review_date: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Life domain</Label>
              <LifeAreaSelect areas={lifeAreas} value={form.life_area_id} onChange={(value) => setForm((current) => ({ ...current, life_area_id: value || "" }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as SomedayStatus }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveItem} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(promoteItem)} onOpenChange={(open) => !open && setPromoteItem(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Promote Someday item</DialogTitle>
            <DialogDescription>Review the details before creating an active LifeSort record.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Promote to</Label>
              <Select value={promoteForm.target_type} onValueChange={(value) => setPromoteForm((current) => ({ ...current, target_type: value as PromoteTarget }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {promoteOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={promoteForm.priority} onValueChange={(value) => setPromoteForm((current) => ({ ...current, priority: value as PromoteForm["priority"] }))}>
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
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="promote-title">Title *</Label>
              <Input id="promote-title" value={promoteForm.title} onChange={(event) => setPromoteForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="promote-description">{promoteForm.target_type === "note" ? "Content" : "Description"}</Label>
              <Textarea id="promote-description" rows={4} value={promoteForm.description} onChange={(event) => setPromoteForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            {promoteForm.target_type === "project" || promoteForm.target_type === "task" ? (
              <div className="space-y-2">
                <Label htmlFor="promote-due-date">Due date</Label>
                <Input id="promote-due-date" type="date" value={promoteForm.due_date} onChange={(event) => setPromoteForm((current) => ({ ...current, due_date: event.target.value }))} />
              </div>
            ) : null}
            {promoteForm.target_type === "goal" ? (
              <div className="space-y-2">
                <Label htmlFor="promote-target-date">Target date</Label>
                <Input id="promote-target-date" type="date" value={promoteForm.target_date} onChange={(event) => setPromoteForm((current) => ({ ...current, target_date: event.target.value }))} />
              </div>
            ) : null}
            {promoteForm.target_type === "wishlist_item" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="promote-price">Price</Label>
                  <Input id="promote-price" type="number" value={promoteForm.price} onChange={(event) => setPromoteForm((current) => ({ ...current, price: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promote-url">URL</Label>
                  <Input id="promote-url" value={promoteForm.url} onChange={(event) => setPromoteForm((current) => ({ ...current, url: event.target.value }))} />
                </div>
              </>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteItem(null)}>
              Cancel
            </Button>
            <Button onClick={promote} disabled={promoting} className="gap-2">
              {promoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
              Promote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
