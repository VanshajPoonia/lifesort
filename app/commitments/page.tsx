"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
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
import { denormalizedLifeArea, normalizeLifeArea } from "@/lib/life-areas"

type CommitmentType = "personal" | "work" | "school" | "family" | "friend" | "client" | "financial" | "other"
type CommitmentStatus = "open" | "at_risk" | "completed" | "missed" | "cancelled"
type CommitmentView = "open" | "due_soon" | "at_risk" | "completed" | "missed" | "all"

type Commitment = {
  id: number
  title: string
  description: string | null
  committed_to: string
  commitment_type: CommitmentType
  due_date: string | null
  status: CommitmentStatus
  life_area_id: number | string | null
  project_id: number | string | null
  person_id: number | string | null
  related_task_id: number | string | null
  life_area_name?: string | null
  life_area_icon?: string | null
  life_area_color?: string | null
  project_title?: string | null
  person_name?: string | null
  related_task_title?: string | null
  is_due_soon?: boolean
  is_overdue?: boolean
  created_at: string
  updated_at: string
}

type ProjectOption = { id: number | string; title: string }
type PersonOption = { id: number | string; name: string }
type TaskOption = { id: number | string; title: string }

type CommitmentForm = {
  title: string
  description: string
  committed_to: string
  commitment_type: CommitmentType
  due_date: string
  status: CommitmentStatus
  life_area_id: string | null
  project_id: string | null
  person_id: string | null
  related_task_id: string | null
}

type TaskForm = {
  title: string
  description: string
  due_date: string
  priority: "low" | "medium" | "high"
  life_area_id: string | null
}

const commitmentTypeOptions: Array<{ value: CommitmentType; label: string }> = [
  { value: "personal", label: "Personal" },
  { value: "work", label: "Work" },
  { value: "school", label: "School" },
  { value: "family", label: "Family" },
  { value: "friend", label: "Friend" },
  { value: "client", label: "Client" },
  { value: "financial", label: "Financial" },
  { value: "other", label: "Other" },
]

const statusOptions: Array<{ value: CommitmentStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "at_risk", label: "At risk" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
  { value: "cancelled", label: "Cancelled" },
]

const viewOptions: Array<{ value: CommitmentView; label: string }> = [
  { value: "open", label: "Open" },
  { value: "due_soon", label: "Due soon" },
  { value: "at_risk", label: "At risk" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
  { value: "all", label: "All" },
]

const emptyForm: CommitmentForm = {
  title: "",
  description: "",
  committed_to: "",
  commitment_type: "personal",
  due_date: "",
  status: "open",
  life_area_id: null,
  project_id: null,
  person_id: null,
  related_task_id: null,
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

function itemIsActive(item: Commitment) {
  return item.status === "open" || item.status === "at_risk"
}

function itemDueSoon(item: Commitment) {
  const date = parseDate(item.due_date)
  if (!itemIsActive(item) || !date) return false
  const today = todayDate()
  const limit = new Date(today)
  limit.setDate(limit.getDate() + 7)
  return date >= today && date <= limit
}

function itemOverdue(item: Commitment) {
  const date = parseDate(item.due_date)
  return itemIsActive(item) && Boolean(date && date < todayDate())
}

function statusVariant(status: CommitmentStatus) {
  if (status === "completed") return "default"
  if (status === "missed" || status === "at_risk") return "destructive"
  if (status === "cancelled") return "outline"
  return "secondary"
}

function areaForItem(item: Commitment, areas: LifeArea[]) {
  if (!item.life_area_id) return null
  const area = areas.find((candidate) => String(candidate.id) === String(item.life_area_id))
  if (area) return area
  if (item.life_area_name) {
    return denormalizedLifeArea({
      id: String(item.life_area_id),
      name: item.life_area_name,
      icon: item.life_area_icon,
      color: item.life_area_color,
    })
  }
  return null
}

function formFromItem(item: Commitment): CommitmentForm {
  return {
    title: item.title || "",
    description: item.description || "",
    committed_to: item.committed_to || "",
    commitment_type: item.commitment_type || "personal",
    due_date: item.due_date ? String(item.due_date).slice(0, 10) : "",
    status: item.status || "open",
    life_area_id: item.life_area_id ? String(item.life_area_id) : null,
    project_id: item.project_id ? String(item.project_id) : null,
    person_id: item.person_id ? String(item.person_id) : null,
    related_task_id: item.related_task_id ? String(item.related_task_id) : null,
  }
}

function payloadFromForm(form: CommitmentForm) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    committed_to: form.committed_to.trim(),
    commitment_type: form.commitment_type,
    due_date: form.due_date || null,
    status: form.status,
    life_area_id: form.life_area_id,
    project_id: form.project_id,
    person_id: form.person_id,
    related_task_id: form.related_task_id,
  }
}

function defaultTaskForm(item: Commitment): TaskForm {
  return {
    title: item.title,
    description: item.description || `Commitment to ${item.committed_to}`,
    due_date: item.due_date ? String(item.due_date).slice(0, 10) : "",
    priority: item.status === "at_risk" ? "high" : "medium",
    life_area_id: item.life_area_id ? String(item.life_area_id) : null,
  }
}

export default function CommitmentsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const [items, setItems] = useState<Commitment[]>([])
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [people, setPeople] = useState<PersonOption[]>([])
  const [tasks, setTasks] = useState<TaskOption[]>([])
  const [view, setView] = useState<CommitmentView>("open")
  const [lifeAreaFilter, setLifeAreaFilter] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [linkedDataWarning, setLinkedDataWarning] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Commitment | null>(null)
  const [form, setForm] = useState<CommitmentForm>(emptyForm)
  const [converting, setConverting] = useState<Commitment | null>(null)
  const [taskForm, setTaskForm] = useState<TaskForm>(defaultTaskForm({
    id: 0,
    title: "",
    description: "",
    committed_to: "",
    commitment_type: "personal",
    due_date: null,
    status: "open",
    life_area_id: null,
    project_id: null,
    person_id: null,
    related_task_id: null,
    created_at: "",
    updated_at: "",
  }))
  const [convertError, setConvertError] = useState("")

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
      const [itemsRes, areasRes, projectsRes, peopleRes, tasksRes] = await Promise.all([
        fetch("/api/commitments?view=all&limit=200"),
        fetch("/api/life-areas"),
        fetch("/api/projects"),
        fetch("/api/people"),
        fetch("/api/tasks"),
      ])

      if (!itemsRes.ok) throw new Error("Commitments are unavailable right now.")
      const itemData = (await itemsRes.json()) as Commitment[]
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
        warnings.push("Projects")
        setProjects([])
      }

      if (peopleRes.ok) {
        const peopleData = await peopleRes.json()
        setPeople(Array.isArray(peopleData) ? peopleData.map((person) => ({ id: person.id, name: person.name || "Unnamed person" })) : [])
      } else {
        warnings.push("People")
        setPeople([])
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json()
        setTasks(Array.isArray(tasksData) ? tasksData.map((task) => ({ id: task.id, title: task.title || "Untitled task" })) : [])
      } else {
        warnings.push("Tasks")
        setTasks([])
      }

      setLinkedDataWarning(warnings.length ? `${warnings.join(", ")} links are unavailable right now.` : "")
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Commitments are unavailable right now.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    return items.reduce(
      (total, item) => {
        if (itemDueSoon(item)) total.dueSoon += 1
        if (item.status === "at_risk") total.atRisk += 1
        if (itemOverdue(item)) total.overdue += 1
        if (item.status === "completed") total.completed += 1
        if (item.status === "missed") total.missed += 1
        if (itemIsActive(item)) total.active += 1
        return total
      },
      { dueSoon: 0, atRisk: 0, overdue: 0, completed: 0, missed: 0, active: 0 },
    )
  }, [items])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    return items.filter((item) => {
      if (view === "open" && item.status !== "open") return false
      if (view === "due_soon" && !itemDueSoon(item)) return false
      if (view === "at_risk" && item.status !== "at_risk") return false
      if (view === "completed" && item.status !== "completed") return false
      if (view === "missed" && item.status !== "missed") return false
      if (lifeAreaFilter && String(item.life_area_id || "none") !== lifeAreaFilter) return false

      if (!query) return true
      const haystack = [
        item.title,
        item.description || "",
        item.committed_to,
        item.commitment_type,
        item.status,
        item.life_area_name || "",
        item.project_title || "",
        item.person_name || "",
        item.related_task_title || "",
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

  const openEdit = (item: Commitment) => {
    setEditing(item)
    setForm(formFromItem(item))
    setError("")
    setDialogOpen(true)
  }

  const setFormField = <K extends keyof CommitmentForm>(field: K, value: CommitmentForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
    setError("")
  }

  const saveItem = async () => {
    const payload = payloadFromForm(form)
    if (!payload.title) {
      setError("Title is required.")
      return
    }
    if (!payload.committed_to) {
      setError("Committed to is required.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/commitments", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to save commitment.")
      setDialogOpen(false)
      setEditing(null)
      setForm(emptyForm)
      await fetchData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save commitment.")
    } finally {
      setSaving(false)
    }
  }

  const updateItem = async (item: Commitment, patch: Partial<Commitment>) => {
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/commitments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, ...patch }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to update commitment.")
      await fetchData()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update commitment.")
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (item: Commitment) => {
    if (!window.confirm(`Delete "${item.title}" from Commitments?`)) return
    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/commitments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to delete commitment.")
      await fetchData()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete commitment.")
    } finally {
      setSaving(false)
    }
  }

  const openConvert = (item: Commitment) => {
    setConverting(item)
    setTaskForm(defaultTaskForm(item))
    setConvertError("")
  }

  const convertToTask = async () => {
    if (!converting) return
    setSaving(true)
    setConvertError("")
    try {
      const response = await fetch("/api/commitments/convert-to-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: converting.id, ...taskForm }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Failed to create related task.")
      setConverting(null)
      await fetchData()
    } catch (conversionError) {
      setConvertError(conversionError instanceof Error ? conversionError.message : "Failed to create related task.")
    } finally {
      setSaving(false)
    }
  }

  const emptyTitle =
    search ? "No matching commitments" :
    view === "due_soon" ? "No commitments due soon" :
    view === "at_risk" ? "No commitments at risk" :
    view === "completed" ? "No completed commitments yet" :
    view === "missed" ? "No missed commitments" :
    "No open commitments"

  const emptyCopy =
    view === "due_soon" ? "Due soon shows open or at-risk commitments due in the next 7 days." :
    view === "at_risk" ? "Mark a commitment at risk when it needs extra attention." :
    view === "completed" ? "Completed promises and obligations will collect here." :
    view === "missed" ? "Missed commitments stay visible without changing anything automatically." :
    "Track promises, obligations, and responsibilities you have committed to."

  if (authLoading || !user) {
    return (
      <DashboardLayout title="Commitments">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Commitments" subtitle="Track promises and obligations you made.">
      <div className="space-y-6">
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Commitments
                </CardTitle>
                <CardDescription>Keep promises to yourself and others visible until they are handled.</CardDescription>
              </div>
              <Button onClick={openCreate} className="gap-2">
                <Plus className="h-4 w-4" />
                Add commitment
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">active</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-2xl font-bold">{stats.dueSoon}</p>
                <p className="text-xs text-muted-foreground">due soon</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-2xl font-bold">{stats.atRisk}</p>
                <p className="text-xs text-muted-foreground">at risk</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-2xl font-bold">{stats.overdue}</p>
                <p className="text-xs text-muted-foreground">overdue open</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-2xl font-bold">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">completed</p>
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
            <LifeAreaSelect areas={lifeAreas} value={lifeAreaFilter} onChange={setLifeAreaFilter} placeholder="All life domains" />
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search commitments..."
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
              <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 text-lg font-semibold">{emptyTitle}</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{emptyCopy}</p>
              <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Add commitment
              </Button>
            </div>
          ) : (
            filteredItems.map((item) => {
              const area = areaForItem(item, lifeAreas)
              const dueSoon = item.is_due_soon ?? itemDueSoon(item)
              const overdue = item.is_overdue ?? itemOverdue(item)

              return (
                <Card key={item.id} className={dueSoon || overdue || item.status === "at_risk" ? "border-primary/30" : undefined}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="truncate text-lg">{item.title}</CardTitle>
                          <Badge variant={statusVariant(item.status)}>{titleCase(item.status)}</Badge>
                          <Badge variant="outline">{titleCase(item.commitment_type)}</Badge>
                          {dueSoon && <Badge variant="secondary">Due soon</Badge>}
                          {overdue && <Badge variant="destructive">Overdue</Badge>}
                          <LifeAreaBadge area={area} fallback="No area" />
                        </div>
                        <CardDescription className="mt-1">
                          Committed to {item.committed_to} · Updated {formatDate(item.updated_at)}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.status !== "completed" && (
                          <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "completed" })} disabled={saving} className="gap-2">
                            <CheckCircle2 className="h-4 w-4" />
                            Complete
                          </Button>
                        )}
                        {item.status !== "at_risk" && item.status !== "completed" && item.status !== "cancelled" && (
                          <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "at_risk" })} disabled={saving}>
                            At risk
                          </Button>
                        )}
                        {item.status !== "missed" && item.status !== "completed" && item.status !== "cancelled" && (
                          <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "missed" })} disabled={saving}>
                            Missed
                          </Button>
                        )}
                        {(item.status === "completed" || item.status === "missed" || item.status === "cancelled") && (
                          <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "open" })} disabled={saving} className="gap-2">
                            <RotateCcw className="h-4 w-4" />
                            Reopen
                          </Button>
                        )}
                        {item.status !== "cancelled" && item.status !== "completed" && (
                          <Button size="sm" variant="outline" onClick={() => updateItem(item, { status: "cancelled" })} disabled={saving} className="gap-2">
                            <XCircle className="h-4 w-4" />
                            Cancel
                          </Button>
                        )}
                        {!item.related_task_id && item.status !== "completed" && item.status !== "cancelled" && (
                          <Button size="sm" variant="outline" onClick={() => openConvert(item)} disabled={saving} className="gap-2">
                            <FileCheck2 className="h-4 w-4" />
                            Make task
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
                        <p className="text-xs text-muted-foreground">Due</p>
                        <p className="mt-1 text-sm font-medium">{formatDate(item.due_date)}</p>
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
                      <div className="rounded-md border bg-muted/40 p-3">
                        <p className="text-xs text-muted-foreground">Task</p>
                        {item.related_task_id ? (
                          <Link href="/tasks" className="mt-1 flex items-center gap-1 text-sm font-medium hover:underline">
                            <FileCheck2 className="h-3.5 w-3.5" />
                            <span className="truncate">{item.related_task_title || "Open task"}</span>
                          </Link>
                        ) : (
                          <p className="mt-1 text-sm font-medium">None</p>
                        )}
                      </div>
                    </div>

                    {item.description ? (
                      <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">{item.description}</p>
                    ) : (
                      <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">No description saved.</p>
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
            <DialogTitle>{editing ? "Edit commitment" : "Add commitment"}</DialogTitle>
            <DialogDescription>Track what you promised and who it matters to.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(event) => setFormField("title", event.target.value)} placeholder="Send recommendation letter" />
              </div>
              <div className="space-y-2">
                <Label>Committed to *</Label>
                <Input value={form.committed_to} onChange={(event) => setFormField("committed_to", event.target.value)} placeholder="A friend, client, team, or yourself" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.commitment_type} onValueChange={(value) => setFormField("commitment_type", value as CommitmentType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {commitmentTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setFormField("status", value as CommitmentStatus)}>
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
                <Label>Due date</Label>
                <Input type="date" value={form.due_date} onChange={(event) => setFormField("due_date", event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Life Domain</Label>
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
              <div className="space-y-2">
                <Label>Related task</Label>
                <Select value={form.related_task_id || "none"} onValueChange={(value) => setFormField("related_task_id", value === "none" ? null : value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No task" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No task</SelectItem>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={String(task.id)}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(event) => setFormField("description", event.target.value)} className="min-h-[100px]" />
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
              {editing ? "Save changes" : "Create commitment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(converting)} onOpenChange={(open) => !open && setConverting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create related task</DialogTitle>
            <DialogDescription>Review the task before linking it to this commitment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Task title</Label>
              <Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input type="date" value={taskForm.due_date} onChange={(event) => setTaskForm((current) => ({ ...current, due_date: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={taskForm.priority} onValueChange={(value) => setTaskForm((current) => ({ ...current, priority: value as TaskForm["priority"] }))}>
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
                <Label>Life Domain</Label>
                <LifeAreaSelect
                  areas={lifeAreas}
                  value={taskForm.life_area_id}
                  onChange={(value) => setTaskForm((current) => ({ ...current, life_area_id: value }))}
                />
              </div>
            </div>
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
            <Button onClick={convertToTask} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Create task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
