"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Heart,
  Link2,
  ListTodo,
  NotebookText,
  PiggyBank,
  Plus,
  Target,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { OnboardingModal } from "@/components/onboarding-modal"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface DashboardData {
  stats: {
    totalGoals: number
    completedGoals: number
    goalsProgress: number
    tasksToday: number
    completedTasksToday: number
    portfolioValue: number
    monthlyIncome: number
    monthlyBudgetIncome: number
    monthlyExpenses: number
    monthlyBalance: number
    wishlistOpenValue: number
    notesCount: number
    linksCount: number
  }
  today: {
    tasks: Array<{ id: string; title: string; completed: boolean; priority?: string; due_date?: string }>
    events: Array<{ id: string; title: string; event_date: string; start_time?: string; location?: string }>
  }
  upcoming: {
    events: Array<{ id: string; title: string; event_date: string; start_time?: string; location?: string }>
    deadlines: Array<{ id: string; title: string; type: string; date: string; href: string }>
  }
  recent: {
    notes: Array<{ id: string; title?: string; content?: string; updated_at?: string }>
    links: Array<{ id: string; title: string; url?: string }>
    activity: Array<{ label: string; title: string; href: string; type: string; at: string }>
  }
}

const emptyDashboard: DashboardData = {
  stats: {
    totalGoals: 0,
    completedGoals: 0,
    goalsProgress: 0,
    tasksToday: 0,
    completedTasksToday: 0,
    portfolioValue: 0,
    monthlyIncome: 0,
    monthlyBudgetIncome: 0,
    monthlyExpenses: 0,
    monthlyBalance: 0,
    wishlistOpenValue: 0,
    notesCount: 0,
    linksCount: 0,
  },
  today: { tasks: [], events: [] },
  upcoming: { events: [], deadlines: [] },
  recent: { notes: [], links: [], activity: [] },
}

const quickActions = [
  { title: "Add task", href: "/tasks", icon: ListTodo },
  { title: "Add goal", href: "/goals", icon: Target },
  { title: "Write note", href: "/notes", icon: NotebookText },
  { title: "Save link", href: "/links", icon: Link2 },
  { title: "Track spend", href: "/budget", icon: Wallet },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value?: string) {
  if (!value) return "No date"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatTime(value?: string) {
  if (!value) return ""
  return value.slice(0, 5)
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard)
  const [dashboardLoading, setDashboardLoading] = useState(true)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }

    if (user) {
      checkOnboarding()
      fetchDashboard()
    }
  }, [user, loading, router])

  const checkOnboarding = async () => {
    try {
      if (sessionStorage.getItem("onboarding_completed") === "true") return

      const response = await fetch("/api/onboarding")
      if (!response.ok) return

      const data = await response.json()
      if (data.onboarding_completed === false) {
        setShowOnboarding(true)
      } else {
        sessionStorage.setItem("onboarding_completed", "true")
      }
    } catch (error) {
      console.error("Error checking onboarding:", error)
    }
  }

  const fetchDashboard = async () => {
    setDashboardLoading(true)
    try {
      const response = await fetch("/api/dashboard")
      if (response.ok) {
        setDashboard(await response.json())
      }
    } catch (error) {
      console.error("Error fetching dashboard:", error)
    } finally {
      setDashboardLoading(false)
    }
  }

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

  const firstName = user.name?.split(" ")[0] || "there"
  const tasksProgress = dashboard.stats.tasksToday
    ? Math.round((dashboard.stats.completedTasksToday / dashboard.stats.tasksToday) * 100)
    : 0

  return (
    <DashboardLayout>
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false)
          sessionStorage.setItem("onboarding_completed", "true")
          sessionStorage.removeItem("sidebar_prefs")
          fetchDashboard()
        }}
      />

      <div className="space-y-6">
        <section className="flex flex-col gap-4 rounded-lg border bg-card p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Today at a glance</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Welcome back, {firstName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your tasks, deadlines, notes, and money snapshot are ready.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button asChild key={action.href} variant="outline" size="sm">
                <Link href={action.href} className="gap-2">
                  <action.icon className="h-4 w-4" />
                  {action.title}
                </Link>
              </Button>
            ))}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Tasks Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.stats.completedTasksToday}/{dashboard.stats.tasksToday}
              </div>
              <Progress value={tasksProgress} className="mt-3 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Target className="h-4 w-4 text-primary" />
                Goals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard.stats.completedGoals}/{dashboard.stats.totalGoals}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{dashboard.stats.goalsProgress}% complete</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <TrendingUp className="h-4 w-4 text-primary" />
                Portfolio
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(dashboard.stats.portfolioValue)}</div>
              <p className="mt-2 text-sm text-muted-foreground">Current tracked value</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <PiggyBank className="h-4 w-4 text-primary" />
                Budget Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(dashboard.stats.monthlyBalance)}</div>
              <p className="mt-2 text-sm text-muted-foreground">This month from budget entries</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-primary" />
                Today View
              </CardTitle>
              <CardDescription>Tasks and events that need attention today.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {dashboardLoading ? (
                <p className="text-sm text-muted-foreground">Loading today...</p>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Tasks</h3>
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/tasks">
                          <Plus className="mr-2 h-4 w-4" />
                          Add
                        </Link>
                      </Button>
                    </div>
                    {dashboard.today.tasks.length === 0 ? (
                      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        No tasks for today. Add one small next step.
                      </p>
                    ) : (
                      dashboard.today.tasks.map((task) => (
                        <Link key={task.id} href="/tasks" className="flex items-center justify-between rounded-md border p-3 hover:bg-secondary">
                          <div>
                            <p className="font-medium">{task.title}</p>
                            <p className="text-xs text-muted-foreground">{task.priority || "medium"} priority</p>
                          </div>
                          <Badge variant={task.completed ? "default" : "outline"}>
                            {task.completed ? "Done" : "Open"}
                          </Badge>
                        </Link>
                      ))
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Events</h3>
                      <Button asChild variant="ghost" size="sm">
                        <Link href="/calendar">
                          <CalendarDays className="mr-2 h-4 w-4" />
                          Calendar
                        </Link>
                      </Button>
                    </div>
                    {dashboard.today.events.length === 0 ? (
                      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        No events scheduled today.
                      </p>
                    ) : (
                      dashboard.today.events.map((event) => (
                        <Link key={event.id} href="/calendar" className="flex items-center justify-between rounded-md border p-3 hover:bg-secondary">
                          <div>
                            <p className="font-medium">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{event.location || "No location"}</p>
                          </div>
                          <Badge variant="secondary">{formatTime(event.start_time)}</Badge>
                        </Link>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Upcoming
              </CardTitle>
              <CardDescription>Deadlines and scheduled events.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...dashboard.upcoming.deadlines, ...dashboard.upcoming.events.map(event => ({
                id: `event-${event.id}`,
                title: event.title,
                type: "Event",
                date: event.event_date,
                href: "/calendar",
              }))].slice(0, 7).map((item) => (
                <Link key={item.id} href={item.href} className="flex items-center justify-between rounded-md border p-3 hover:bg-secondary">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.type}</p>
                  </div>
                  <Badge variant="outline">{formatDate(item.date)}</Badge>
                </Link>
              ))}
              {dashboard.upcoming.deadlines.length === 0 && dashboard.upcoming.events.length === 0 && (
                <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No upcoming deadlines yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Money Snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Income sources</span>
                <span className="font-medium">{formatCurrency(dashboard.stats.monthlyIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget income</span>
                <span className="font-medium">{formatCurrency(dashboard.stats.monthlyBudgetIncome)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Budget expenses</span>
                <span className="font-medium">{formatCurrency(dashboard.stats.monthlyExpenses)}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">Open wishlist value</span>
                <span className="font-medium">{formatCurrency(dashboard.stats.wishlistOpenValue)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Recent Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.recent.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                dashboard.recent.notes.slice(0, 4).map((note) => (
                  <Link key={note.id} href="/notes" className="block rounded-md border p-3 hover:bg-secondary">
                    <p className="truncate font-medium">{note.title || "Untitled"}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{note.content || "Empty note"}</p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboard.recent.activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Your recent updates will show here.</p>
              ) : (
                dashboard.recent.activity.slice(0, 5).map((activity) => (
                  <Link key={`${activity.type}-${activity.title}-${activity.at}`} href={activity.href} className="block rounded-md border p-3 hover:bg-secondary">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{activity.title}</p>
                      <Badge variant="outline">{activity.type}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activity.label} · {timeAgo(activity.at)}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" />
              Saved Links
            </CardTitle>
            <CardDescription>Your newest bookmarks and saved resources.</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.recent.links.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No saved links yet. Build your personal library from My Links.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {dashboard.recent.links.map((link) => (
                  <Link key={link.id} href="/links" className="rounded-md border p-3 hover:bg-secondary">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <p className="truncate font-medium">{link.title}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{link.url || "Saved item"}</p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
