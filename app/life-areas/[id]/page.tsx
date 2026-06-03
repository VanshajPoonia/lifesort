"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, ChevronDown, ExternalLink, FolderKanban, Loader2 } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { LifeAreaIcon } from "@/components/life-area-controls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { type LifeArea, normalizeLifeArea } from "@/lib/life-areas"
import { cn } from "@/lib/utils"

type RecordItem = Record<string, any>
type DataState = {
  tasks: RecordItem[]
  goals: RecordItem[]
  habits: RecordItem[]
  projects: RecordItem[]
  notes: RecordItem[]
  categories: RecordItem[]
  wishlist: RecordItem[]
}

const emptyData: DataState = {
  tasks: [],
  goals: [],
  habits: [],
  projects: [],
  notes: [],
  categories: [],
  wishlist: [],
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function itemDate(value: unknown) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

function hrefFor(section: keyof DataState, areaId: string) {
  const encoded = encodeURIComponent(areaId)
  const routes: Record<keyof DataState, string> = {
    tasks: `/tasks?life_area_id=${encoded}`,
    goals: `/goals?life_area_id=${encoded}`,
    habits: `/habits?life_area_id=${encoded}`,
    projects: `/projects?life_area_id=${encoded}`,
    notes: `/notes?life_area_id=${encoded}`,
    categories: `/money?tab=budget&life_area_id=${encoded}`,
    wishlist: `/money?tab=wishlist&life_area_id=${encoded}`,
  }
  return routes[section]
}

function openHref(section: keyof DataState, item: RecordItem, areaId: string) {
  const base = hrefFor(section, areaId)
  if (section === "notes" && item.id) return `${base}&note=${item.id}`
  if (section === "tasks" && item.id) return `${base}&task=${item.id}`
  if (section === "goals" && item.id) return `${base}&goal=${item.id}`
  if (section === "projects" && item.id) return `${base}&project=${item.id}`
  return base
}

function itemSubtitle(section: keyof DataState, item: RecordItem) {
  if (section === "tasks") return item.due_date ? `Due ${itemDate(item.due_date)}` : item.priority || "No due date"
  if (section === "goals") return item.target_date ? `Target ${itemDate(item.target_date)}` : item.status || "Active"
  if (section === "habits") return item.frequency || "Habit"
  if (section === "projects") return item.due_date ? `Due ${itemDate(item.due_date)}` : item.status || "Active"
  if (section === "notes") return item.updated_at ? `Updated ${itemDate(item.updated_at)}` : "Recent note"
  if (section === "categories") return item.budget_limit ? `Limit $${Number(item.budget_limit).toLocaleString()}` : "Budget category"
  if (section === "wishlist") return item.price ? `$${Number(item.price).toLocaleString()}` : item.priority || "Wishlist item"
  return ""
}

function titleFor(section: keyof DataState, item: RecordItem) {
  return item.title || item.name || item.category || item.description || section
}

export default function LifeAreaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const [area, setArea] = useState<LifeArea | null>(null)
  const [data, setData] = useState<DataState>(emptyData)
  const [loadingData, setLoadingData] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoadingData(true)
    try {
      const query = `life_area_id=${encodeURIComponent(id)}`
      const [areasRes, tasksRes, goalsRes, habitsRes, projectsRes, notesRes, budgetRes, wishlistRes] = await Promise.all([
        fetch("/api/life-areas"),
        fetch(`/api/tasks?${query}`),
        fetch(`/api/goals?${query}`),
        fetch(`/api/habits?${query}`),
        fetch(`/api/projects?${query}`),
        fetch(`/api/notes?${query}`),
        fetch(`/api/budget?type=categories&${query}`),
        fetch(`/api/wishlist?${query}`),
      ])

      if (!areasRes.ok) throw new Error("Could not load life areas")
      const areas = await areasRes.json()
      const found = Array.isArray(areas) ? areas.map(normalizeLifeArea).find((item) => item.id === id) : null
      if (!found) {
        setArea(null)
        setData(emptyData)
        return
      }

      const [tasks, goals, habits, projects, notes, budget, wishlist] = await Promise.all([
        tasksRes.ok ? tasksRes.json() : [],
        goalsRes.ok ? goalsRes.json() : [],
        habitsRes.ok ? habitsRes.json() : [],
        projectsRes.ok ? projectsRes.json() : [],
        notesRes.ok ? notesRes.json() : [],
        budgetRes.ok ? budgetRes.json() : { categories: [] },
        wishlistRes.ok ? wishlistRes.json() : [],
      ])

      setArea(found)
      setData({
        tasks: Array.isArray(tasks) ? tasks.filter((task) => !task.completed) : [],
        goals: Array.isArray(goals) ? goals.filter((goal) => goal.status !== "completed") : [],
        habits: Array.isArray(habits) ? habits.filter((habit) => habit.is_active !== false) : [],
        projects: Array.isArray(projects) ? projects.filter((project) => !["completed", "archived"].includes(project.status)) : [],
        notes: Array.isArray(notes) ? notes.slice(0, 8) : [],
        categories: Array.isArray(budget.categories) ? budget.categories : [],
        wishlist: Array.isArray(wishlist) ? wishlist.filter((item) => !item.purchased) : [],
      })
    } catch (error) {
      console.error("[life-areas] detail load failed:", error)
      toast({ title: "Could not load this life area", description: "Try refreshing the page.", variant: "destructive" })
    } finally {
      setLoadingData(false)
    }
  }, [id, toast])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }
    if (user) fetchData()
  }, [fetchData, loading, router, user])

  const sections = useMemo(
    () => [
      { key: "tasks" as const, title: "Active Tasks", items: data.tasks, done: "Mark done" },
      { key: "goals" as const, title: "Active Goals", items: data.goals, done: "Complete" },
      { key: "habits" as const, title: "Active Habits", items: data.habits, done: "Check in" },
      { key: "projects" as const, title: "Active Projects", items: data.projects, done: "Complete" },
      { key: "notes" as const, title: "Recent Notes", items: data.notes },
      { key: "categories" as const, title: "Budget Categories", items: data.categories },
      { key: "wishlist" as const, title: "Wishlist Items", items: data.wishlist, done: "Purchased" },
    ],
    [data],
  )

  const quickDone = async (section: keyof DataState, item: RecordItem) => {
    if (!item.id) return
    const scopedId = `${section}-${item.id}`
    setActionId(scopedId)
    try {
      if (section === "tasks") {
        await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, completed: true }) })
      } else if (section === "goals") {
        await fetch("/api/goals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, status: "completed", progress: 100 }) })
      } else if (section === "habits") {
        await fetch("/api/habits/checkins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ habit_id: item.id, checkin_date: todayString(), count: item.target_count || 1 }) })
      } else if (section === "projects") {
        await fetch("/api/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, status: "completed", progress: 100 }) })
      } else if (section === "wishlist") {
        await fetch("/api/wishlist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, purchased: true }) })
      }
      toast({ title: "Updated", description: `${titleFor(section, item)} was updated.` })
      fetchData()
    } catch (error) {
      console.error("[life-areas] quick action failed:", error)
      toast({ title: "Update failed", description: "The item was not changed.", variant: "destructive" })
    } finally {
      setActionId(null)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <DashboardLayout title={area?.name || "Life Area"} subtitle="Everything connected to this part of your life">
      <div className="space-y-6">
        <Button variant="ghost" className="gap-2" onClick={() => router.push("/life-areas")}>
          <ArrowLeft className="h-4 w-4" />
          Life Areas
        </Button>

        {loadingData ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-52" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)}
            </CardContent>
          </Card>
        ) : !area ? (
          <Card>
            <CardHeader>
              <CardTitle>Life area not found</CardTitle>
              <CardDescription>This area may have been deleted or belongs to another account.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <section className="rounded-lg border bg-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: area.color }}>
                    <LifeAreaIcon name={area.icon} className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-foreground">{area.name}</h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{area.description || "No description yet."}</p>
                  </div>
                </div>
                <Badge variant="outline" className="w-fit gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: area.color }} />
                  {sections.reduce((sum, section) => sum + section.items.length, 0)} linked items
                </Badge>
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              {sections.map((section, index) => (
                <Collapsible key={section.key} defaultOpen={index < 4}>
                  <Card>
                    <CardHeader className="space-y-0">
                      <div className="flex items-center justify-between gap-3">
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" className="min-w-0 justify-start gap-2 px-0 text-left">
                            <ChevronDown className="h-4 w-4 shrink-0" />
                            <span className="truncate font-semibold">{section.title}</span>
                            <Badge variant="secondary">{section.items.length}</Badge>
                          </Button>
                        </CollapsibleTrigger>
                        <Button asChild variant="outline" size="sm" className="shrink-0 gap-2">
                          <Link href={hrefFor(section.key, area.id)}>
                            View all
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="space-y-2">
                        {section.items.length === 0 ? (
                          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                            No linked {section.title.toLowerCase()} yet.
                          </div>
                        ) : (
                          section.items.slice(0, 6).map((item) => (
                            <div key={`${section.key}-${item.id}`} className="flex items-center justify-between gap-3 rounded-md border bg-background/60 p-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{titleFor(section.key, item)}</p>
                                <p className="truncate text-xs text-muted-foreground">{itemSubtitle(section.key, item)}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                {section.done && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={cn("gap-1.5", section.key === "wishlist" && "text-success")}
                                    disabled={actionId === `${section.key}-${item.id}`}
                                    onClick={() => quickDone(section.key, item)}
                                  >
                                    {actionId === `${section.key}-${item.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    <span className="hidden sm:inline">{section.done}</span>
                                  </Button>
                                )}
                                <Button asChild size="icon" variant="outline" title="Open full item">
                                  <Link href={openHref(section.key, item, area.id)}>
                                    <ExternalLink className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderKanban className="h-5 w-5 text-primary" />
                  Connected Planning
                </CardTitle>
                <CardDescription>Use the section links above to manage this life area in its full workspace.</CardDescription>
              </CardHeader>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
