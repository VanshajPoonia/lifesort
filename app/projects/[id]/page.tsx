"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  Activity,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { LifeAreaBadge, LifeAreaSelect } from "@/components/life-area-controls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/components/auth-provider"
import type { LifeArea } from "@/lib/life-areas"
import { denormalizedLifeArea, normalizeLifeArea } from "@/lib/life-areas"

type ProjectStatus = "active" | "paused" | "completed" | "archived"
type ProjectPriority = "low" | "medium" | "high"
type ItemType = "task" | "goal" | "note" | "link" | "wishlist" | "budget_category" | "budget_transaction" | "budget_goal"

type Project = {
  id: number | string
  title: string
  description?: string | null
  life_area_id?: number | string | null
  life_area_name?: string | null
  life_area_icon?: string | null
  life_area_color?: string | null
  status: ProjectStatus
  priority: ProjectPriority
  start_date?: string | null
  due_date?: string | null
  progress: number | string
  item_count?: number | string | null
  next_action_count?: number | string | null
}

type ProjectItem = {
  id: number | string
  item_type: ItemType
  item_id: number | string
  label: string
  title: string
  subtitle?: string | null
  href: string
  missing?: boolean
  task_completed?: boolean | null
  goal_status?: string | null
}

type Candidate = {
  id: number | string
  item_type: ItemType
  title: string
  subtitle?: string | null
  href: string
}

type ActivityRow = {
  id: number | string
  action: string
  message: string
  created_at: string
}

type ProjectForm = {
  title: string
  description: string
  life_area_id: string | null
  status: ProjectStatus
  priority: ProjectPriority
  start_date: string
  due_date: string
  progress: string
}

const itemTypeOptions: Array<{ value: ItemType; label: string }> = [
  { value: "task", label: "Tasks" },
  { value: "goal", label: "Goals" },
  { value: "note", label: "Notes" },
  { value: "link", label: "Links" },
  { value: "wishlist", label: "Wishlist" },
  { value: "budget_category", label: "Budget Categories" },
  { value: "budget_transaction", label: "Budget Transactions" },
  { value: "budget_goal", label: "Budget Goals" },
]

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0))
  return Number.isFinite(parsed) ? parsed : 0
}

function dateOnly(value?: string | null) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

function formatDate(value?: string | null) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff)) return "Recently"
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formFromProject(project: Project): ProjectForm {
  return {
    title: project.title || "",
    description: project.description || "",
    life_area_id: project.life_area_id ? String(project.life_area_id) : null,
    status: project.status || "active",
    priority: project.priority || "medium",
    start_date: dateOnly(project.start_date),
    due_date: dateOnly(project.due_date),
    progress: String(toNumber(project.progress)),
  }
}

function getLifeArea(project: Project | null, areas: LifeArea[]) {
  if (!project?.life_area_id) return null
  return (
    areas.find((area) => String(area.id) === String(project.life_area_id)) ||
    denormalizedLifeArea({
      id: String(project.life_area_id),
      name: project.life_area_name || "Life domain",
      icon: project.life_area_icon,
      color: project.life_area_color,
    })
  )
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const rawId = params?.id
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId

  const [project, setProject] = useState<Project | null>(null)
  const [items, setItems] = useState<ProjectItem[]>([])
  const [activity, setActivity] = useState<ActivityRow[]>([])
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [loadingProject, setLoadingProject] = useState(true)
  const [error, setError] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ProjectForm | null>(null)
  const [candidateType, setCandidateType] = useState<ItemType>("task")
  const [candidateQuery, setCandidateQuery] = useState("")
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [linkingId, setLinkingId] = useState<string | number | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }
    if (user && projectId) {
      fetchProject()
    }
  }, [user, loading, projectId, router])

  useEffect(() => {
    if (linkOpen && projectId) {
      fetchCandidates()
    }
  }, [linkOpen, candidateType, candidateQuery, projectId])

  const fetchProject = async () => {
    setLoadingProject(true)
    setError("")
    try {
      const [projectRes, itemsRes, activityRes, areasRes] = await Promise.all([
        fetch(`/api/projects?id=${projectId}`),
        fetch(`/api/projects/items?project_id=${projectId}`),
        fetch(`/api/projects/activity?project_id=${projectId}`),
        fetch("/api/life-areas"),
      ])
      const projectData = await projectRes.json().catch(() => null)
      if (!projectRes.ok) throw new Error(projectData?.error || "Project could not be loaded.")
      const itemsData = itemsRes.ok ? await itemsRes.json() : { items: [] }
      const activityData = activityRes.ok ? await activityRes.json() : { activity: [] }
      const areaData = areasRes.ok ? await areasRes.json() : []
      setProject(projectData)
      setItems(Array.isArray(itemsData.items) ? itemsData.items : [])
      setActivity(Array.isArray(activityData.activity) ? activityData.activity : [])
      setLifeAreas(Array.isArray(areaData) ? areaData.map((area) => normalizeLifeArea(area)) : [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Project could not be loaded.")
    } finally {
      setLoadingProject(false)
    }
  }

  const fetchCandidates = async () => {
    setCandidatesLoading(true)
    try {
      const response = await fetch(
        `/api/projects/items?project_id=${projectId}&type=${candidateType}&q=${encodeURIComponent(candidateQuery)}`,
      )
      const data = await response.json().catch(() => null)
      setCandidates(response.ok && Array.isArray(data?.candidates) ? data.candidates : [])
    } finally {
      setCandidatesLoading(false)
    }
  }

  const openEdit = () => {
    if (!project) return
    setForm(formFromProject(project))
    setEditOpen(true)
    setError("")
  }

  const saveProject = async () => {
    if (!project || !form) return
    if (!form.title.trim()) {
      setError("Project title is required.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const response = await fetch("/api/projects", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: project.id,
          title: form.title,
          description: form.description || null,
          life_area_id: form.life_area_id,
          status: form.status,
          priority: form.priority,
          start_date: form.start_date || null,
          due_date: form.due_date || null,
          progress: form.progress,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Project could not be saved.")
      setProject(data)
      setEditOpen(false)
      await fetchProject()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Project could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  const linkItem = async (candidate: Candidate) => {
    setLinkingId(candidate.id)
    setError("")
    try {
      const response = await fetch("/api/projects/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, item_type: candidate.item_type, item_id: candidate.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Item could not be linked.")
      await fetchProject()
      await fetchCandidates()
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : "Item could not be linked.")
    } finally {
      setLinkingId(null)
    }
  }

  const unlinkItem = async (item: ProjectItem) => {
    setError("")
    try {
      const response = await fetch("/api/projects/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Item could not be unlinked.")
      setItems((current) => current.filter((currentItem) => String(currentItem.id) !== String(item.id)))
      await fetchProject()
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? unlinkError.message : "Item could not be unlinked.")
    }
  }

  const groupedItems = useMemo(() => {
    return itemTypeOptions.map((option) => ({
      ...option,
      items: items.filter((item) => item.item_type === option.value),
    }))
  }, [items])

  const nextActions = items.filter(
    (item) =>
      !item.missing &&
      ((item.item_type === "task" && item.task_completed === false) ||
        (item.item_type === "goal" && item.goal_status !== "completed")),
  )

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const area = getLifeArea(project, lifeAreas)
  const progress = toNumber(project?.progress)

  return (
    <DashboardLayout title="Project">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/projects">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Projects
            </Link>
          </Button>
          {project && (
            <Button onClick={openEdit} className="gap-2">
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loadingProject ? (
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-72" />
          </div>
        ) : !project ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">Project not found.</CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-2xl">{project.title}</CardTitle>
                      <Badge>{project.status}</Badge>
                      <Badge variant="outline">{project.priority}</Badge>
                      <LifeAreaBadge area={area} />
                    </div>
                    <CardDescription className="mt-2 max-w-3xl">
                      {project.description || "No description yet. Add one when the shape of this project becomes clearer."}
                    </CardDescription>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Due {formatDate(project.due_date)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className="text-2xl font-bold">{progress}%</p>
                    <Progress value={progress} className="mt-3 h-2" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Linked Items</p>
                    <p className="text-2xl font-bold">{items.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Next Actions</p>
                    <p className="text-2xl font-bold">{nextActions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card>
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>Linked Items</CardTitle>
                    <CardDescription>Existing LifeSort records linked to this project.</CardDescription>
                  </div>
                  <Button onClick={() => setLinkOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Link Item
                  </Button>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-center">
                      <Link2 className="mx-auto h-8 w-8 text-muted-foreground" />
                      <h3 className="mt-3 font-semibold">No linked items yet</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Link tasks, notes, goals, links, wishlist items, or budget records to build the project context.
                      </p>
                      <Button className="mt-4 gap-2" onClick={() => setLinkOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Link Item
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {groupedItems
                        .filter((group) => group.items.length > 0)
                        .map((group) => (
                          <section key={group.value} className="space-y-2">
                            <h3 className="text-sm font-semibold">{group.label}</h3>
                            <div className="space-y-2">
                              {group.items.map((item) => (
                                <div key={item.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium">{item.title}</p>
                                      {item.missing && <Badge variant="destructive">Missing</Badge>}
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.subtitle}</p>
                                  </div>
                                  <div className="flex gap-1">
                                    {!item.missing && (
                                      <Button asChild size="icon" variant="ghost">
                                        <Link href={item.href}>
                                          <ExternalLink className="h-4 w-4" />
                                        </Link>
                                      </Button>
                                    )}
                                    <Button size="icon" variant="ghost" onClick={() => unlinkItem(item)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Next Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {nextActions.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Link incomplete tasks or active goals to see them here.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {nextActions.slice(0, 6).map((item) => (
                          <Link key={item.id} href={item.href} className="block rounded-md border p-3 hover:bg-muted/50">
                            <p className="font-medium">{item.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activity.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Project changes and linked item updates will appear here.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activity.map((entry) => (
                          <div key={entry.id} className="border-l-2 border-primary/30 pl-3">
                            <p className="text-sm font-medium">{entry.message}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{timeAgo(entry.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update the project without changing linked source records.</DialogDescription>
          </DialogHeader>
          {form && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                saveProject()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="project-title">Title *</Label>
                <Input id="project-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea
                  id="project-description"
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="min-h-[110px]"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Life Domain</Label>
                  <LifeAreaSelect areas={lifeAreas} value={form.life_area_id} onChange={(value) => setForm({ ...form, life_area_id: value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as ProjectStatus })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(value) => setForm({ ...form, priority: value as ProjectPriority })}>
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
                <div className="space-y-2">
                  <Label htmlFor="project-progress">Progress</Label>
                  <Input
                    id="project-progress"
                    type="number"
                    min="0"
                    max="100"
                    value={form.progress}
                    onChange={(event) => setForm({ ...form, progress: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-start">Start date</Label>
                  <Input id="project-start" type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project-due">Due date</Label>
                  <Input id="project-due" type="date" value={form.due_date} onChange={(event) => setForm({ ...form, due_date: event.target.value })} />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Project"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Existing Item</DialogTitle>
            <DialogDescription>Choose an existing LifeSort record. Source records stay where they are.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={candidateType} onValueChange={(value) => setCandidateType(value as ItemType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {itemTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-item-search">Search</Label>
              <Input
                id="project-item-search"
                value={candidateQuery}
                onChange={(event) => setCandidateQuery(event.target.value)}
                placeholder="Search existing items"
              />
            </div>
          </div>
          <div className="space-y-2">
            {candidatesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16" />
                <Skeleton className="h-16" />
              </div>
            ) : candidates.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No matching unlinked items found.
              </div>
            ) : (
              candidates.map((candidate) => (
                <div key={`${candidate.item_type}-${candidate.id}`} className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{candidate.title}</p>
                    <p className="truncate text-sm text-muted-foreground">{candidate.subtitle}</p>
                  </div>
                  <Button size="sm" onClick={() => linkItem(candidate)} disabled={linkingId === candidate.id}>
                    {linkingId === candidate.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Link"}
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
