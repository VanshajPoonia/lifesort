"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FolderPlus,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  User,
  XCircle,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
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

type WaitingOnType = "person" | "company" | "school" | "bank" | "government" | "delivery" | "refund" | "job" | "other"
type WaitingStatus = "waiting" | "follow_up_needed" | "resolved" | "cancelled"
type WaitingView = "all" | "follow_up_today" | "overdue" | "resolved" | "life_area"

type WaitingItem = {
  id: number
  title: string
  description: string | null
  waiting_on_name: string
  waiting_on_type: WaitingOnType
  status: WaitingStatus
  expected_date: string | null
  follow_up_date: string | null
  life_area_id: number | string | null
  project_id: number | string | null
  person_id: number | string | null
  notes: string | null
  life_area_name?: string | null
  life_area_icon?: string | null
  life_area_color?: string | null
  project_title?: string | null
  person_name?: string | null
  is_follow_up_due?: boolean
  is_overdue?: boolean
  created_at: string
  updated_at: string
}

type ProjectOption = {
  id: number | string
  title: string
}

type PersonOption = {
  id: number | string
  name: string
}

type WaitingForm = {
  title: string
  description: string
  waiting_on_name: string
  waiting_on_type: WaitingOnType
  status: WaitingStatus
  expected_date: string
  follow_up_date: string
  life_area_id: string | null
  project_id: string | null
  person_id: string | null
  notes: string
}

const waitingOnOptions: Array<{ value: WaitingOnType; label: string }> = [
  { value: "person", label: "Person" },
  { value: "company", label: "Company" },
  { value: "school", label: "School" },
  { value: "bank", label: "Bank" },
  { value: "government", label: "Government" },
  { value: "delivery", label: "Delivery" },
  { value: "refund", label: "Refund" },
  { value: "job", label: "Job" },
  { value: "other", label: "Other" },
]

const statusOptions: Array<{ value: WaitingStatus; label: string }> = [
  { value: "waiting", label: "Waiting" },
  { value: "follow_up_needed", label: "Follow up needed" },
  { value: "resolved", label: "Resolved" },
  { value: "cancelled", label: "Cancelled" },
]

const viewOptions: Array<{ value: WaitingView; label: string }> = [
  { value: "all", label: "All" },
  { value: "follow_up_today", label: "Follow up today" },
  { value: "overdue", label: "Overdue" },
  { value: "resolved", label: "Resolved" },
  { value: "life_area", label: "By life area" },
]

const emptyForm: WaitingForm = {
  title: "",
  description: "",
  waiting_on_name: "",
  waiting_on_type: "person",
  status: "waiting",
  expected_date: "",
  follow_up_date: "",
  life_area_id: null,
  project_id: null,
  person_id: null,
  notes: "",
}

function formatDate(value?: string | null) {
  if (!value) return "No date"
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function todayDate() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function statusVariant(status: WaitingStatus) {
  if (status === "resolved") return "default"
  if (status === "cancelled") return "outline"
  if (status === "follow_up_needed") return "destructive"
  return "secondary"
}

function areaForItem(item: WaitingItem, areas: LifeArea[]) {
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

function itemIsActive(item: WaitingItem) {
  return item.status === "waiting" || item.status === "follow_up_needed"
}

function itemFollowUpDue(item: WaitingItem) {
  const date = parseDate(item.follow_up_date)
  return itemIsActive(item) && Boolean(date && date <= todayDate())
}

function itemOverdue(item: WaitingItem) {
  const date = parseDate(item.expected_date)
  return itemIsActive(item) && Boolean(date && date < todayDate())
}

function formFromItem(item: WaitingItem): WaitingForm {
  return {
    title: item.title || "",
    description: item.description || "",
    waiting_on_name: item.waiting_on_name || "",
    waiting_on_type: item.waiting_on_type || "other",
    status: item.status || "waiting",
    expected_date: item.expected_date ? String(item.expected_date).slice(0, 10) : "",
    follow_up_date: item.follow_up_date ? String(item.follow_up_date).slice(0, 10) : "",
    life_area_id: item.life_area_id ? String(item.life_area_id) : null,
    project_id: item.project_id ? String(item.project_id) : null,
    person_id: item.person_id ? String(item.person_id) : null,
    notes: item.notes || "",
  }
}

function payloadFromForm(form: WaitingForm) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    waiting_on_name: form.waiting_on_name.trim(),
    waiting_on_type: form.waiting_on_type,
    status: form.status,
    expected_date: form.expected_date || null,
    follow_up_date: form.follow_up_date || null,
    life_area_id: form.life_area_id,
    project_id: form.project_id,
    person_id: form.person_id,
    notes: form.notes.trim() || null,
  }
}

export default function WaitingPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [items, setItems] = useState<WaitingItem[]>([])
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [people, setPeople] = useState<PersonOption[]>([])
  const [view, setView] = useState<WaitingView>("all")
  const [lifeAreaFilter, setLifeAreaFilter] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [linkedDataWarning, setLinkedDataWarning] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WaitingItem | null>(null)
  const [form, setForm] = useState<WaitingForm>(emptyForm)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
      return
    }

    if (user) {
      void fetchData()
    }
  }, [authLoading, router, user])

  const fetchData = async () => {
    setLoading(true)
    setError("")
    setLinkedDataWarning("")
    try {
      const [itemsRes, areasRes, projectsRes, peopleRes] = await Promise.all([
        fetch("/api/waiting?view=all&limit=200"),
        fetch("/api/life-areas"),
        fetch("/api/projects"),
        fetch("/api/people"),
      ])

      if (!itemsRes.ok) throw new Error("Waiting For is unavailable right now.")
      const itemData = (await itemsRes.json()) as WaitingItem[]
      setItems(Array.isArray(itemData) ? itemData : [])

      if (areasRes.ok) {
        const areasData = await areasRes.json()
        setLifeAreas(Array.isArray(areasData) ? areasData.map((area) => normalizeLifeArea(area)) : [])
      }

      const warnings: string[] = []
      if (projectsRes.ok) {
        const projectData = await projectsRes.json()
        setProjects(Array.isArray(projectData) ? projectData.map((project) => ({ id: project.id, title: project.title || "Untitled project" })) : [])
      } else {
        setProjects([])
        warnings.push("Projects")
      }

      if (peopleRes.ok) {
        const peopleData = await peopleRes.json()
        setPeople(Array.isArray(peopleData) ? peopleData.map((person) => ({ id: person.id, name: person.name || "Unnamed person" })) : [])
      } else {
        setPeople([])
        warnings.push("People")
      }

      setLinkedDataWarning(warnings.length ? `${warnings.join(" and ")} links are unavailable right now.` : "")
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Waiting For is unavailable right now.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    return items.reduce(
      (total, item) => {
        if (itemFollowUpDue(item)) total.followUpsDue += 1
        if (itemOverdue(item)) total.overdue += 1
        if (item.status === "resolved") total.resolved += 1
        if (itemIsActive(item)) total.active += 1
        return total
      },
      { followUpsDue: 0, overdue: 0, resolved: 0, active: 0 },
    )
  }, [items])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (view === "follow_up_today" && !itemFollowUpDue(item)) return false
      if (view === "overdue" && !itemOverdue(item)) return false
      if (view === "resolved" && item.status !== "resolved") return false
      if (view === "life_area" && lifeAreaFilter && String(item.life_area_id || "none") !== lifeAreaFilter) return false
      if (view === "life_area" && !lifeAreaFilter && item.life_area_id) return false

      if (!query) return true
      const haystack = [
        item.title,
        item.description || "",
        item.waiting_on_name,
        item.waiting_on_type,
        item.status,
        item.notes || "",
        item.life_area_name || "",
        item.project_title || "",
        item.person_name || "",
      ].join(" ").toLowerCase()
      return haystack.includes(query)
    })
  }, [items, lifeAreaFilter, search, view])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setError("")
    setDialogOpen(true)
  }

  const openEdit = (item: WaitingItem) => {
    setEditing(item)
    setForm(formFromItem(item))
    setError("")
    setDialogOpen(true)
  }

  const setFormField = <K extends keyof WaitingForm>(field: K, value: WaitingForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError("")
  }

  const saveItem = async () => {
    const payload = payloadFromForm(form)
    if (!payload.title) {
      setError("Title is required.")
      return
    }
    if (!payload.waiting_on_name) {
      setError("Waiting on name is required.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/waiting", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to save waiting item.")
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
      await fetchData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save waiting item.")
    } finally {
      setSaving(false)
    }
  }

  const updateItem = async (item: WaitingItem, patch: Partial<WaitingItem>) => {
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/waiting", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, ...patch }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to update waiting item.")
      await fetchData()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update waiting item.")
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (item: WaitingItem) => {
    if (!window.confirm(`Delete "${item.title}" from Waiting For?`)) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/waiting", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to delete waiting item.")
      await fetchData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete waiting item.")
    } finally {
      setSaving(false)
    }
  }

  const emptyTitle =
    search ? "No matching waiting items" :
    view === "follow_up_today" ? "No follow-ups due today" :
    view === "overdue" ? "Nothing is overdue" :
    view === "resolved" ? "No resolved items yet" :
    view === "life_area" ? "No waiting items in this life area" :
    "Nothing waiting yet"

  const emptyCopy =
    view === "follow_up_today" ? "Follow-ups show here when their follow-up date is today or earlier." :
    view === "overdue" ? "Overdue items show here when the expected date has passed." :
    view === "resolved" ? "Resolved dependencies will collect here after you close them out." :
    "Track replies, refunds, approvals, deliveries, applications, and anything else you are waiting on."

  if (authLoading || !user) {
    return (
      <DashboardLayout title="Waiting For">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Waiting For" subtitle="Track the things that depend on someone or something else.">
      <div className="space-y-6">
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Waiting For
                </CardTitle>
                <CardDescription>Keep follow-ups, approvals, deliveries, refunds, and applications from slipping.</CardDescription>
              </div>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Add waiting item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">active waiting</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-2xl font-bold">{stats.followUpsDue}</p>
                <p className="text-xs text-muted-foreground">follow-ups due</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-2xl font-bold">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">overdue expected dates</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-2xl font-bold">{stats.resolved}</p>
                <p className="text-xs text-muted-foreground">resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {viewOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={view === option.value ? "secondary" : "outline"}
                size="sm"
                onClick={() => setView(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[220px_minmax(0,320px)]">
            {view === "life_area" && (
              <LifeAreaSelect
                areas={lifeAreas}
                value={lifeAreaFilter}
                onChange={setLifeAreaFilter}
                placeholder="Unassigned"
              />
            )}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search waiting items..."
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {linkedDataWarning && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {linkedDataWarning}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-3">
          {loading ? (
            <>
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
              <Skeleton className="h-36 w-full" />
            </>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-lg font-semibold">{emptyTitle}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{emptyCopy}</p>
              <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Add waiting item
              </Button>
            </div>
          ) : (
            filteredItems.map((item) => {
              const area = areaForItem(item, lifeAreas)
              const followUpDue = item.is_follow_up_due ?? itemFollowUpDue(item)
              const overdue = item.is_overdue ?? itemOverdue(item)

              return (
                <Card key={item.id} className={followUpDue || overdue ? "border-primary/30" : undefined}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="truncate text-lg">{item.title}</CardTitle>
                          <Badge variant={statusVariant(item.status)}>{titleCase(item.status)}</Badge>
                          <Badge variant="outline">{titleCase(item.waiting_on_type)}</Badge>
                          {followUpDue && <Badge variant="destructive">Follow up</Badge>}
                          {overdue && <Badge variant="destructive">Overdue</Badge>}
                          <LifeAreaBadge area={area} fallback="No area" />
                        </div>
                        <CardDescription className="mt-1">
                          Waiting on {item.waiting_on_name} · Updated {formatDate(item.updated_at)}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.status !== "resolved" && (
                          <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "resolved" })} disabled={saving} className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Resolve
                          </Button>
                        )}
                        {item.status !== "follow_up_needed" && item.status !== "resolved" && item.status !== "cancelled" && (
                          <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "follow_up_needed" })} disabled={saving}>
                            Follow up
                          </Button>
                        )}
                        {(item.status === "resolved" || item.status === "cancelled") && (
                          <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "waiting" })} disabled={saving} className="gap-2">
                            <RotateCcw className="h-4 w-4" />
                            Reopen
                          </Button>
                        )}
                        {item.status !== "cancelled" && item.status !== "resolved" && (
                          <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "cancelled" })} disabled={saving} className="gap-2">
                            <XCircle className="h-4 w-4" />
                            Cancel
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteItem(item)} disabled={saving} className="gap-2 text-destructive">
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-md border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Expected</p>
                        <p className="mt-1 text-sm font-medium">{formatDate(item.expected_date)}</p>
                      </div>
                      <div className="rounded-md border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Follow up</p>
                        <p className="mt-1 text-sm font-medium">{formatDate(item.follow_up_date)}</p>
                      </div>
                      <div className="rounded-md border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Project</p>
                        {item.project_id ? (
                          <Link href={`/projects/${item.project_id}`} className="mt-1 flex items-center gap-1 text-sm font-medium hover:underline">
                            <FolderPlus className="h-3.5 w-3.5" />
                            <span className="truncate">{item.project_title || "Open project"}</span>
                          </Link>
                        ) : (
                          <p className="mt-1 text-sm font-medium">None</p>
                        )}
                      </div>
                      <div className="rounded-md border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Person</p>
                        <p className="mt-1 flex items-center gap-1 text-sm font-medium">
                          <User className="h-3.5 w-3.5" />
                          <span className="truncate">{item.person_name || (item.person_id ? "Linked person" : "None")}</span>
                        </p>
                      </div>
                    </div>

                    {item.description ? (
                      <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">{item.description}</p>
                    ) : (
                      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No description saved.</p>
                    )}

                    {item.notes && (
                      <div className="rounded-md border p-3 text-sm">
                        <p className="text-xs font-medium text-muted-foreground">Notes</p>
                        <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{item.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open)
        if (!open) {
          setEditing(null)
          setForm(emptyForm)
          setError("")
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit waiting item" : "Add waiting item"}</DialogTitle>
            <DialogDescription>Track what you are waiting on and when to follow up.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(event) => setFormField("title", event.target.value)} placeholder="Refund from airline" />
              </div>
              <div className="space-y-2">
                <Label>Waiting on *</Label>
                <Input value={form.waiting_on_name} onChange={(event) => setFormField("waiting_on_name", event.target.value)} placeholder="Airline support" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.waiting_on_type} onValueChange={(value) => setFormField("waiting_on_type", value as WaitingOnType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {waitingOnOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setFormField("status", value as WaitingStatus)}>
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
              <div className="space-y-2">
                <Label>Expected date</Label>
                <Input type="date" value={form.expected_date} onChange={(event) => setFormField("expected_date", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Follow-up date</Label>
                <Input type="date" value={form.follow_up_date} onChange={(event) => setFormField("follow_up_date", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Life Area</Label>
                <LifeAreaSelect areas={lifeAreas} value={form.life_area_id} onChange={(value) => setFormField("life_area_id", value)} />
              </div>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={form.project_id || "none"} onValueChange={(value) => setFormField("project_id", value === "none" ? null : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={String(project.id)}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Person</Label>
                <Select value={form.person_id || "none"} onValueChange={(value) => setFormField("person_id", value === "none" ? null : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No person" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No person</SelectItem>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={String(person.id)}>
                        {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(event) => setFormField("description", event.target.value)} className="min-h-[90px]" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={(event) => setFormField("notes", event.target.value)} className="min-h-[90px]" />
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveItem} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
