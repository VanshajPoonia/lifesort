"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  FolderPlus,
  Gauge,
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
  updated_at?: string | null
  created_at?: string | null
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

const emptyForm: ProjectForm = {
  title: "",
  description: "",
  life_area_id: null,
  status: "active",
  priority: "medium",
  start_date: "",
  due_date: "",
  progress: "0",
}

const templates = [
  {
    name: "Learning plan",
    area: "Learning",
    title: "Learning plan",
    description: "Define the skill, collect resources, schedule practice blocks, and track milestones.",
    priority: "medium" as ProjectPriority,
    days: 45,
  },
  {
    name: "Fitness plan",
    area: "Fitness",
    title: "Fitness plan",
    description: "Plan workouts, recovery, measurements, and the next actions that keep momentum visible.",
    priority: "medium" as ProjectPriority,
    days: 60,
  },
  {
    name: "Business launch",
    area: "Business",
    title: "Business launch",
    description: "Shape the offer, validate demand, build launch assets, and track budget and outreach.",
    priority: "high" as ProjectPriority,
    days: 90,
  },
  {
    name: "Job search",
    area: "Work",
    title: "Job search",
    description: "Track target roles, resumes, networking, applications, interviews, and follow-ups.",
    priority: "high" as ProjectPriority,
    days: 60,
  },
  {
    name: "Travel plan",
    area: "Travel",
    title: "Travel plan",
    description: "Organize itinerary, bookings, packing, budget, links, notes, and calendar deadlines.",
    priority: "medium" as ProjectPriority,
    days: 30,
  },
  {
    name: "Finance plan",
    area: "Finance",
    title: "Finance plan",
    description: "Map goals, budget categories, savings targets, income changes, and investment actions.",
    priority: "high" as ProjectPriority,
    days: 75,
  },
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

function addDays(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function isOverdue(project: Project) {
  if (!project.due_date || project.status === "completed" || project.status === "archived") return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(project.due_date)
  due.setHours(0, 0, 0, 0)
  return due < today
}

function getLifeArea(project: Project, areas: LifeArea[]) {
  if (!project.life_area_id) return null
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

export default function ProjectsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const lifeAreaFilter = searchParams.get("life_area_id")
  const [projects, setProjects] = useState<Project[]>([])
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [error, setError] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [form, setForm] = useState<ProjectForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | number | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }
    if (user) {
      fetchData()
    }
  }, [user, loading, router, lifeAreaFilter])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (detail?.type === "project") fetchData()
    }
    window.addEventListener("lifesort:quick-add-created", handler)
    return () => window.removeEventListener("lifesort:quick-add-created", handler)
  }, [])

  const fetchData = async () => {
    setLoadingProjects(true)
    setError("")
    try {
      const [projectsRes, areasRes] = await Promise.all([
        fetch(lifeAreaFilter ? `/api/projects?life_area_id=${encodeURIComponent(lifeAreaFilter)}` : "/api/projects"),
        fetch("/api/life-areas"),
      ])
      if (!projectsRes.ok) throw new Error("Projects could not be loaded.")
      const projectData = await projectsRes.json()
      const areaData = areasRes.ok ? await areasRes.json() : []
      setProjects(Array.isArray(projectData) ? projectData : [])
      setLifeAreas(Array.isArray(areaData) ? areaData.map((area) => normalizeLifeArea(area)) : [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Projects could not be loaded.")
    } finally {
      setLoadingProjects(false)
    }
  }

  const openCreate = (nextForm: ProjectForm = emptyForm) => {
    setEditingProject(null)
    setForm(nextForm)
    setError("")
    setDialogOpen(true)
  }

  const openEdit = (project: Project) => {
    setEditingProject(project)
    setForm(formFromProject(project))
    setError("")
    setDialogOpen(true)
  }

  const openTemplate = (template: (typeof templates)[number]) => {
    const area = lifeAreas.find((lifeArea) => lifeArea.name.toLowerCase() === template.area.toLowerCase())
    openCreate({
      ...emptyForm,
      title: template.title,
      description: template.description,
      priority: template.priority,
      due_date: addDays(template.days),
      life_area_id: area ? area.id : null,
    })
  }

  const submitProject = async () => {
    if (!form.title.trim()) {
      setError("Project title is required.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const payload = {
        ...(editingProject ? { id: editingProject.id } : {}),
        title: form.title,
        description: form.description || null,
        life_area_id: form.life_area_id,
        status: form.status,
        priority: form.priority,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        progress: form.progress,
      }
      const response = await fetch("/api/projects", {
        method: editingProject ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Project could not be saved.")
      await fetchData()
      setDialogOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Project could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  const deleteProject = async (projectId: string | number) => {
    setDeleteId(projectId)
    setError("")
    try {
      const response = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Project could not be deleted.")
      setProjects((current) => current.filter((project) => String(project.id) !== String(projectId)))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Project could not be deleted.")
    } finally {
      setDeleteId(null)
    }
  }

  const stats = useMemo(() => {
    const active = projects.filter((project) => project.status === "active")
    const overdue = projects.filter(isOverdue)
    const averageProgress = projects.length
      ? Math.round(projects.reduce((sum, project) => sum + toNumber(project.progress), 0) / projects.length)
      : 0
    const nextActions = projects.reduce((sum, project) => sum + toNumber(project.next_action_count), 0)
    return { active: active.length, overdue: overdue.length, averageProgress, nextActions }
  }, [projects])

  const nextActionProjects = projects
    .filter((project) => toNumber(project.next_action_count) > 0 && project.status !== "archived" && project.status !== "completed")
    .slice(0, 4)

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

  return (
    <DashboardLayout title="Projects">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 rounded-lg border bg-card p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Life Projects</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Organize the bigger efforts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Link tasks, goals, notes, links, wishlist items, and budget records under one project.
            </p>
          </div>
          <Button onClick={() => openCreate()} className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </section>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {loadingProjects ? (
            <>
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <FolderPlus className="h-4 w-4 text-primary" />
                    Active Projects
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">{stats.active}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    Overdue
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">{stats.overdue}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Gauge className="h-4 w-4 text-primary" />
                    Avg Progress
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.averageProgress}%</div>
                  <Progress value={stats.averageProgress} className="mt-3 h-2" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    Next Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">{stats.nextActions}</CardContent>
              </Card>
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Project Templates</CardTitle>
            <CardDescription>Start with a lightweight preset. It pre-fills the project only.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <Button
                key={template.name}
                type="button"
                variant="outline"
                className="h-auto justify-start px-3 py-3 text-left"
                onClick={() => openTemplate(template)}
              >
                <span>
                  <span className="block font-medium">{template.name}</span>
                  <span className="block text-xs text-muted-foreground">{template.area} · {template.priority} priority</span>
                </span>
              </Button>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
              <CardDescription>Active projects are shown first, followed by paused, completed, and archived work.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProjects ? (
                <div className="space-y-3">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : projects.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center">
                  <FolderPlus className="mx-auto h-8 w-8 text-muted-foreground" />
                  <h3 className="mt-3 font-semibold">No projects yet</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a project from scratch or use a template to gather related LifeSort items.
                  </p>
                  <Button className="mt-4 gap-2" onClick={() => openCreate()}>
                    <Plus className="h-4 w-4" />
                    Create Project
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => {
                    const progress = toNumber(project.progress)
                    const area = getLifeArea(project, lifeAreas)
                    return (
                      <div key={project.id} className="rounded-lg border p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link href={`/projects/${project.id}`} className="font-semibold text-foreground hover:underline">
                                {project.title}
                              </Link>
                              <Badge variant={project.status === "active" ? "default" : "outline"}>{project.status}</Badge>
                              <Badge variant="outline">{project.priority}</Badge>
                              {isOverdue(project) && <Badge variant="destructive">Overdue</Badge>}
                              <LifeAreaBadge area={area} />
                            </div>
                            {project.description && (
                              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5" />
                                Due {formatDate(project.due_date)}
                              </span>
                              <span>{toNumber(project.item_count)} linked items</span>
                              <span>{toNumber(project.next_action_count)} next actions</span>
                            </div>
                            <Progress value={progress} className="mt-3 h-2" />
                          </div>
                          <div className="flex gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/projects/${project.id}`}>
                                Open
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => openEdit(project)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteProject(project.id)}
                              disabled={deleteId === project.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next Actions</CardTitle>
              <CardDescription>Projects with linked incomplete tasks.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingProjects ? (
                <div className="space-y-3">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </div>
              ) : nextActionProjects.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Link active tasks to a project and they will show up here.
                </div>
              ) : (
                <div className="space-y-3">
                  {nextActionProjects.map((project) => (
                    <Link key={project.id} href={`/projects/${project.id}`} className="block rounded-md border p-3 hover:bg-muted/50">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{project.title}</span>
                        <Badge variant="outline">{toNumber(project.next_action_count)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(project.due_date)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProject ? "Edit Project" : "New Project"}</DialogTitle>
            <DialogDescription>Projects are optional containers for work across LifeSort modules.</DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              submitProject()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="project-title">Title *</Label>
              <Input
                id="project-title"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Launch portfolio site"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-[110px]"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Life Domain</Label>
                <LifeAreaSelect
                  areas={lifeAreas}
                  value={form.life_area_id}
                  onChange={(value) => setForm((current) => ({ ...current, life_area_id: value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value as ProjectStatus }))}>
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
                <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value as ProjectPriority }))}>
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
                  onChange={(event) => setForm((current) => ({ ...current, progress: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-start">Start date</Label>
                <Input
                  id="project-start"
                  type="date"
                  value={form.start_date}
                  onChange={(event) => setForm((current) => ({ ...current, start_date: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-due">Due date</Label>
                <Input
                  id="project-due"
                  type="date"
                  value={form.due_date}
                  onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))}
                />
              </div>
            </div>

            {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Project"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
