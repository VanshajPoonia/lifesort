"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  FileText,
  Flame,
  FolderPlus,
  History,
  Heart,
  LayoutDashboard,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  Wallet,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/components/auth-provider"
import { LifeAreaIcon } from "@/components/life-area-controls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { cn } from "@/lib/utils"

type AreaMetrics = {
  key: string
  life_area_id: string | null
  name: string
  icon: string
  color: string
  tasks: { active: number; completed: number; overdue: number; recent_updates: number }
  goals: { active: number; completed: number; overdue: number; recent_updates: number }
  habits: { active: number; total: number; checkins_7d: number; completed_7d: number }
  projects: { active: number; overdue: number; completed: number; recent_updates: number }
  notes: { total: number; recent_updates: number }
  budget: { categories: number; income_30d: number; expenses_30d: number }
  score: number
}

type LifeBalanceMetrics = {
  generated_at: string
  areas: AreaMetrics[]
  summary: {
    total_areas: number
    tracked_areas: number
    ignored_areas: string[]
    top_area: string | null
    unassigned_score: number
  }
  weekly_reviews: Array<{
    week_start: string | null
    week_end: string | null
    wins: string
    challenges: string
    lessons: string
    next_week_focus: string
  }>
  unavailable: string[]
}

type AiLifeBalanceResult = {
  summary: string
  over_focused_areas: Array<{ area: string; reason: string; evidence: string }>
  ignored_areas: Array<{ area: string; reason: string; suggested_attention: string }>
  potential_stress_points: Array<{ title: string; reason: string }>
  suggested_small_actions: Array<{
    title: string
    description: string
    life_area_id: string | null
    life_area_name: string | null
    priority: "low" | "medium" | "high"
  }>
  suggested_next_week_balance: Array<{ area: string; focus: string }>
}

type IgnoringSignalSource =
  | "life_area"
  | "goal"
  | "project"
  | "waiting"
  | "commitment"
  | "habit"
  | "maintenance"
  | "vault"
  | "finance"

type IgnoringSignal = {
  id: string
  source: IgnoringSignalSource
  title: string
  description: string
  evidence: string
  href: string
  date: string | null
  days_inactive: number | null
  severity: "low" | "medium" | "high"
  life_area_id: string | null
  life_area_name: string | null
  life_area_color: string | null
}

type IgnoringInsightsData = {
  generated_at: string
  signals: IgnoringSignal[]
  summary: {
    total: number
    high: number
    medium: number
    low: number
    life_areas_quiet_14d: number
    life_areas_quiet_30d: number
    stale_goals: number
    stale_projects: number
    hidden_risks: number
  }
  unavailable: string[]
}

type AiIgnoringResult = {
  summary: string
  ignored_items: Array<{ title: string; why_it_may_matter: string; evidence: string }>
  hidden_risks: Array<{ title: string; why_it_matters: string; severity: "low" | "medium" | "high" }>
  suggested_actions: Array<{
    title: string
    description: string
    priority: "low" | "medium" | "high"
    life_area_id: string | null
    life_area_name: string | null
  }>
}

type JournalDigest = {
  week: { start: string; end: string }
  entries: Array<{
    id: number
    journal_date: string
    mood: number | null
    gratitude: string[]
    affirmation_text: string | null
    notes_from_today: string | null
    work_stars: number | null
    personal_stars: number | null
    family_stars: number | null
  }>
  averages: {
    mood: number | null
    work_stars: number | null
    personal_stars: number | null
    family_stars: number | null
  }
  counts: {
    entries: number
    gratitude_items: number
    completed_intentions: number
  }
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function MetricPill({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string | number }) {
  return (
    <div className="surface-card rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

const IGNORING_SOURCE_LABELS: Record<IgnoringSignalSource, string> = {
  life_area: "Quiet Life Areas",
  goal: "Stale Goals",
  project: "Stale Projects",
  waiting: "Waiting For",
  commitment: "Commitments",
  habit: "Missed Habits",
  maintenance: "Maintenance",
  vault: "Vault Renewals",
  finance: "Finance Review",
}

type ReflectTab = "weekly-review" | "life-balance" | "ignored-signals" | "journal" | "timeline" | "lifescore" | "reset"

const reflectTabs: Array<{ value: ReflectTab; label: string }> = [
  { value: "weekly-review", label: "Weekly Review" },
  { value: "life-balance", label: "Life Balance" },
  { value: "ignored-signals", label: "Ignored Signals" },
  { value: "journal", label: "Journal" },
  { value: "timeline", label: "Timeline" },
  { value: "lifescore", label: "LifeScore" },
  { value: "reset", label: "Reset" },
]

function normalizeReflectTab(value: string | null): ReflectTab {
  return value === "weekly-review" || value === "ignored-signals" || value === "journal" || value === "timeline" || value === "lifescore" || value === "reset"
    ? value
    : "life-balance"
}

function getReflectHubCards(currentHref: "/reflect" | "/insights") {
  return [
  {
    title: "Life Balance",
    description: "Area balance metrics and ignored-life signals.",
    href: currentHref,
    icon: Activity,
    badge: "Current page",
    priority: "primary" as const,
  },
  {
    title: "Weekly Review",
    description: "Reflect on the week and save next-week focus.",
    href: "/review",
    icon: CheckSquare,
    statusKey: "weeklyReviewPending",
    statusLabel: "pending",
    zeroLabel: "0 pending",
    priority: "primary" as const,
  },
  {
    title: "Journal",
    description: "Review daily reflections, gratitude, and star ratings.",
    href: "/journal",
    icon: BookOpenText,
    badge: "Daily",
    priority: "primary" as const,
  },
  {
    title: "Life Timeline",
    description: "Review milestones and meaningful activity over time.",
    href: "/timeline",
    icon: History,
    priority: "primary" as const,
  },
  {
    title: "Reset My Life",
    description: "Recover from stale, overdue, and overwhelming items.",
    href: "/reset",
    icon: ShieldAlert,
    statusKey: "overdueTasks",
    statusLabel: "overdue",
    zeroLabel: "0 overdue",
  },
  {
    title: "LifeSort Coach",
    description: "Ask app-aware questions with read-only LifeSort context.",
    href: "/ai-chat",
    icon: Sparkles,
  },
  {
    title: "Life Areas",
    description: "Manage the areas used for balance and organization.",
    href: "/life-areas",
    icon: Target,
  },
  {
    title: "What Am I Ignoring?",
    description: "Review non-AI risk signals and optional read-only AI context.",
    href: currentHref,
    icon: Search,
    badge: "Current page",
  },
  {
    title: "LifeScore",
    description: "See the explainable organization signal on Home.",
    href: "/",
    icon: LayoutDashboard,
    badge: "Open Home",
  },
  ]
}

function formatDateLabel(value: string | null) {
  if (!value) return "No date"
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function localDateString() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function ReflectExperience() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { isMobile, isTablet } = useBreakpoint()
  const compatibility = pathname.startsWith("/insights")
  const routeTitle = compatibility ? "Insights" : "Reflect"
  const routeHref = compatibility ? "/insights" : "/reflect"
  const [activeReflectTab, setActiveReflectTab] = useState<ReflectTab>("life-balance")
  const [metrics, setMetrics] = useState<LifeBalanceMetrics | null>(null)
  const [analysis, setAnalysis] = useState<AiLifeBalanceResult | null>(null)
  const [ignoringInsights, setIgnoringInsights] = useState<IgnoringInsightsData | null>(null)
  const [ignoringAnalysis, setIgnoringAnalysis] = useState<AiIgnoringResult | null>(null)
  const [journalDigest, setJournalDigest] = useState<JournalDigest | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [loadingIgnoring, setLoadingIgnoring] = useState(true)
  const [loadingJournal, setLoadingJournal] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzingIgnoring, setAnalyzingIgnoring] = useState(false)
  const [error, setError] = useState("")
  const [analysisError, setAnalysisError] = useState("")
  const [ignoringError, setIgnoringError] = useState("")
  const [ignoringAnalysisError, setIgnoringAnalysisError] = useState("")
  const [journalError, setJournalError] = useState("")
  const [createdActions, setCreatedActions] = useState<Set<number>>(new Set())
  const [createdIgnoringActions, setCreatedIgnoringActions] = useState<Set<number>>(new Set())
  const [creatingAction, setCreatingAction] = useState<number | null>(null)
  const [creatingIgnoringAction, setCreatingIgnoringAction] = useState<number | null>(null)
  const [expandedAreaRows, setExpandedAreaRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (typeof window === "undefined") return
    setActiveReflectTab(normalizeReflectTab(new URL(window.location.href).searchParams.get("tab")))
  }, [pathname])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }
    if (user) {
      fetchMetrics()
      fetchIgnoringSignals()
      fetchJournalDigest()
    }
  }, [loading, router, user])

  const fetchMetrics = async () => {
    setLoadingMetrics(true)
    setError("")
    try {
      const response = await fetch("/api/ai/life-balance")
      if (response.status === 401) {
        router.push("/login")
        return
      }
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not load life balance metrics")
      setMetrics(data.metrics)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load life balance metrics")
    } finally {
      setLoadingMetrics(false)
    }
  }

  const fetchIgnoringSignals = async () => {
    setLoadingIgnoring(true)
    setIgnoringError("")
    try {
      const response = await fetch("/api/ai/what-am-i-ignoring")
      if (response.status === 401) {
        router.push("/login")
        return
      }
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not load ignored-life signals")
      setIgnoringInsights(data.insights)
    } catch (err) {
      setIgnoringError(err instanceof Error ? err.message : "Could not load ignored-life signals")
    } finally {
      setLoadingIgnoring(false)
    }
  }

  const fetchJournalDigest = async () => {
    setLoadingJournal(true)
    setJournalError("")
    try {
      const response = await fetch(`/api/journal/weekly-digest?weekOf=${localDateString()}`)
      if (response.status === 401) {
        router.push("/login")
        return
      }
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not load journal digest")
      setJournalDigest(data)
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "Could not load journal digest")
    } finally {
      setLoadingJournal(false)
    }
  }

  const analyzeBalance = async () => {
    setAnalyzing(true)
    setAnalysisError("")
    try {
      const response = await fetch("/api/ai/life-balance", { method: "POST" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not analyze your balance")
      setAnalysis(data.analysis)
      if (data.metrics) setMetrics(data.metrics)
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Could not analyze your balance")
    } finally {
      setAnalyzing(false)
    }
  }

  const analyzeIgnoring = async () => {
    setAnalyzingIgnoring(true)
    setIgnoringAnalysisError("")
    try {
      const response = await fetch("/api/ai/what-am-i-ignoring", { method: "POST" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not analyze ignored-life signals")
      setIgnoringAnalysis(data.analysis)
      if (data.insights) setIgnoringInsights(data.insights)
    } catch (err) {
      setIgnoringAnalysisError(err instanceof Error ? err.message : "Could not analyze ignored-life signals")
    } finally {
      setAnalyzingIgnoring(false)
    }
  }

  const createSuggestedTask = async (action: AiLifeBalanceResult["suggested_small_actions"][number], index: number) => {
    if (createdActions.has(index)) return
    const confirmed = window.confirm(`Create this task?\n\n${action.title}`)
    if (!confirmed) return

    setCreatingAction(index)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: action.title,
          description: action.description,
          priority: action.priority,
          life_area_id: action.life_area_id,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not create task")
      setCreatedActions((prev) => new Set(prev).add(index))
      await fetchMetrics()
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Could not create task")
    } finally {
      setCreatingAction(null)
    }
  }

  const createIgnoringSuggestedTask = async (action: AiIgnoringResult["suggested_actions"][number], index: number) => {
    if (createdIgnoringActions.has(index)) return
    const confirmed = window.confirm(`Create this task?\n\n${action.title}`)
    if (!confirmed) return

    setCreatingIgnoringAction(index)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: action.title,
          description: action.description,
          priority: action.priority,
          life_area_id: action.life_area_id,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not create task")
      setCreatedIgnoringActions((prev) => new Set(prev).add(index))
      await Promise.all([fetchIgnoringSignals(), fetchMetrics()])
    } catch (err) {
      setIgnoringAnalysisError(err instanceof Error ? err.message : "Could not create task")
    } finally {
      setCreatingIgnoringAction(null)
    }
  }

  const visibleAreas = useMemo(() => {
    if (!metrics) return []
    return [...metrics.areas].sort((a, b) => b.score - a.score)
  }, [metrics])

  const maxScore = Math.max(1, ...visibleAreas.map((area) => area.score))
  const toggleAreaRow = (key: string) => {
    setExpandedAreaRows((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }
  const totals = useMemo(() => {
    return visibleAreas.reduce(
      (acc, area) => {
        acc.tasks += area.tasks.active
        acc.goals += area.goals.active
        acc.habits += area.habits.active
        acc.projects += area.projects.active
        acc.notes += area.notes.recent_updates
        return acc
      },
      { tasks: 0, goals: 0, habits: 0, projects: 0, notes: 0 },
    )
  }, [visibleAreas])

  const ignoringGroups = useMemo(() => {
    const groups = new Map<IgnoringSignalSource, IgnoringSignal[]>()
    for (const signal of ignoringInsights?.signals ?? []) {
      const group = groups.get(signal.source) ?? []
      group.push(signal)
      groups.set(signal.source, group)
    }
    return Array.from(groups.entries())
  }, [ignoringInsights])

  const changeReflectTab = (value: string) => {
    const next = normalizeReflectTab(value)
    setActiveReflectTab(next)
    router.replace(`${routeHref}?tab=${next}`, { scroll: false })
  }

  if (loading || !user) {
    return (
      <DashboardLayout title={routeTitle} subtitle="Life balance metrics and AI analysis">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title={routeTitle} subtitle="See which parts of life are getting attention and which ones may need care.">
      <div className="space-y-5 md:space-y-6">
        <Tabs value={activeReflectTab} onValueChange={changeReflectTab} className="section-enter space-y-4">
          <TabsList className="flex w-full justify-start overflow-x-auto rounded-lg bg-muted/70 p-1">
            {reflectTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="min-w-max">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {activeReflectTab === "weekly-review" && (
          <ReflectLinkPanel
            icon={<CheckSquare className="h-5 w-5 text-primary" />}
            title="Weekly Review"
            description="Reflect on the week, save lessons, and choose next-week focus."
            href="/review"
            action="Open Weekly Review"
          />
        )}

        {activeReflectTab === "journal" && (
          <Card className="surface-card section-enter border-amber-500/20 bg-amber-500/5">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpenText className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                    Journal
                  </CardTitle>
                  <CardDescription>
                    Daily gratitude, intentions, and star ratings for the current week.
                  </CardDescription>
                </div>
                <Button asChild className="gap-2">
                  <a href="/journal">
                    Open Journal
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {journalError && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {journalError}
                </div>
              )}

              {loadingJournal ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-24 w-full" />
                  ))}
                </div>
              ) : journalDigest ? (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricPill icon={BookOpenText} label="Entries this week" value={journalDigest.counts.entries} />
                    <MetricPill icon={Heart} label="Gratitude notes" value={journalDigest.counts.gratitude_items} />
                    <MetricPill icon={CheckCircle2} label="Completed intentions" value={journalDigest.counts.completed_intentions} />
                    <MetricPill icon={Star} label="Avg mood" value={journalDigest.averages.mood ?? "No data"} />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                    <Card className="bg-background/80">
                      <CardHeader>
                        <CardTitle className="text-base">Star Averages</CardTitle>
                        <CardDescription>{formatDateLabel(journalDigest.week.start)} to {formatDateLabel(journalDigest.week.end)}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {[
                          ["Work", journalDigest.averages.work_stars],
                          ["Personal", journalDigest.averages.personal_stars],
                          ["Family", journalDigest.averages.family_stars],
                        ].map(([label, value]) => (
                          <div key={label} className="flex items-center justify-between rounded-md border bg-muted/20 p-3">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-medium">{value ?? "No data"}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card className="bg-background/80">
                      <CardHeader>
                        <CardTitle className="text-base">Recent Journal Entries</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {journalDigest.entries.length === 0 ? (
                          <EmptyState>No journal entries this week yet. Start with one small note from today.</EmptyState>
                        ) : (
                          journalDigest.entries.slice(0, 5).map((entry) => (
                            <a
                              key={entry.id}
                              href={`/journal?date=${entry.journal_date}`}
                              className="block rounded-md border bg-muted/20 p-3 text-sm transition-colors hover:bg-muted/40"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">{formatDateLabel(entry.journal_date)}</span>
                                {entry.mood && <span aria-label={`Mood ${entry.mood}`}>{["😟", "😕", "😐", "🙂", "😊"][entry.mood - 1]}</span>}
                              </div>
                              <p className="mt-1 line-clamp-2 text-muted-foreground">
                                {entry.affirmation_text || entry.gratitude.find(Boolean) || entry.notes_from_today || "Journal entry"}
                              </p>
                            </a>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : (
                <EmptyState>Journal digest is not available yet.</EmptyState>
              )}
            </CardContent>
          </Card>
        )}

        {activeReflectTab === "timeline" && (
          <ReflectLinkPanel
            icon={<History className="h-5 w-5 text-primary" />}
            title="Life Timeline"
            description="Review milestones and meaningful activity over time."
            href="/timeline"
            action="Open Timeline"
          />
        )}

        {activeReflectTab === "lifescore" && (
          <ReflectLinkPanel
            icon={<LayoutDashboard className="h-5 w-5 text-primary" />}
            title="LifeScore"
            description="See the explainable organization signal on Home."
            href="/"
            action="Open Home"
          />
        )}

        {activeReflectTab === "reset" && (
          <ReflectLinkPanel
            icon={<ShieldAlert className="h-5 w-5 text-primary" />}
            title="Reset My Life"
            description="Triage stale, overdue, and overwhelming items safely."
            href="/reset"
            action="Open Reset"
          />
        )}

        <section className={cn("surface-card section-enter rounded-lg border bg-card/95 p-4 md:p-5", activeReflectTab !== "life-balance" && "hidden")}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Life Balance</p>
              <h1 className="mt-1 text-xl font-bold sm:text-2xl">Where your energy is going</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Metrics are calculated locally from your Life Areas, tasks, goals, habits, projects, notes, budget, and weekly reviews.
              </p>
            </div>
            <Button onClick={analyzeBalance} disabled={analyzing || loadingMetrics} className="gap-2">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Analyze my balance
            </Button>
          </div>
        </section>

        {activeReflectTab === "life-balance" && error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </div>
        )}

        {activeReflectTab === "life-balance" && (loadingMetrics ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        ) : metrics ? (
          <>
            {metrics.unavailable.length > 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Some sources are unavailable: {metrics.unavailable.join(", ")}.
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <MetricPill icon={CheckSquare} label="Active tasks" value={totals.tasks} />
              <MetricPill icon={Target} label="Active goals" value={totals.goals} />
              <MetricPill icon={Flame} label="Active habits" value={totals.habits} />
              <MetricPill icon={FolderPlus} label="Active projects" value={totals.projects} />
              <MetricPill icon={FileText} label="Recent notes" value={totals.notes} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Card className="surface-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Balance By Life Area
                  </CardTitle>
                  <CardDescription>Non-AI metrics. Higher scores mean more current activity or pressure.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {visibleAreas.length === 0 ? (
                    <EmptyState>Add Life Areas or assign records to see balance metrics.</EmptyState>
                  ) : (
                    visibleAreas.map((area) => {
                      const metricItems = [
                        { label: "tasks", value: area.tasks.active },
                        { label: "goals", value: area.goals.active },
                        { label: "habits", value: area.habits.active },
                        { label: "projects", value: area.projects.active },
                        { label: "notes", value: area.notes.recent_updates },
                        { label: "30d spend", value: formatCurrency(area.budget.expenses_30d) },
                      ]
                      const expanded = expandedAreaRows.has(area.key)
                      const compactLimit = isMobile ? 2 : isTablet ? 4 : metricItems.length
                      const showToggle = (isMobile || isTablet) && metricItems.length > compactLimit
                      const visibleMetricItems = showToggle && !expanded ? metricItems.slice(0, compactLimit) : metricItems

                      return (
                      <div key={area.key} className="rounded-md border p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                              style={{ backgroundColor: `${area.color}22`, color: area.color }}
                            >
                              <LifeAreaIcon name={area.icon} className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{area.name}</p>
                              <p className="text-xs text-muted-foreground">Score {area.score}</p>
                            </div>
                          </div>
                          <Badge variant={area.score === 0 ? "outline" : area.score === maxScore ? "default" : "secondary"}>
                            {area.score === 0 ? "Quiet" : area.score === maxScore ? "Most active" : "Active"}
                          </Badge>
                        </div>
                        <Progress value={(area.score / maxScore) * 100} className="mt-3 h-2" />
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-6">
                          {visibleMetricItems.map((metric) => (
                            <div key={metric.label}>
                              <span className="font-medium">{metric.value}</span>
                              <p className="text-xs text-muted-foreground">{metric.label}</p>
                            </div>
                          ))}
                        </div>
                        {showToggle && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-8 px-0 text-xs text-muted-foreground"
                            onClick={() => toggleAreaRow(area.key)}
                          >
                            {expanded ? "Less" : "More"}
                            <ChevronDown className={cn("ml-1 h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
                          </Button>
                        )}
                      </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Quick Read
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Tracked areas</span>
                      <span className="font-medium">{metrics.summary.tracked_areas}/{metrics.summary.total_areas}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Most active</span>
                      <span className="font-medium">{metrics.summary.top_area || "None yet"}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Unassigned activity</span>
                      <span className="font-medium">{metrics.summary.unassigned_score}</span>
                    </div>
                    {metrics.summary.ignored_areas.length > 0 ? (
                      <div className="rounded-md bg-muted/50 p-3">
                        <p className="font-medium">Quiet areas</p>
                        <p className="mt-1 text-muted-foreground">{metrics.summary.ignored_areas.slice(0, 6).join(", ")}</p>
                      </div>
                    ) : (
                      <EmptyState>No ignored Life Areas detected from the current metrics.</EmptyState>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-primary" />
                      Weekly Review Context
                    </CardTitle>
                    <CardDescription>Used as limited AI context when available.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {metrics.weekly_reviews.length === 0 ? (
                      <EmptyState>Save a weekly review to give future balance analysis more reflection context.</EmptyState>
                    ) : (
                      metrics.weekly_reviews.map((review, index) => (
                        <div key={`${review.week_start}-${index}`} className="rounded-md border p-3 text-sm">
                          <p className="font-medium">{review.week_start || "Recent review"} to {review.week_end || "now"}</p>
                          <p className="mt-1 line-clamp-2 text-muted-foreground">
                            {review.next_week_focus || review.challenges || review.wins || "Reflection saved."}
                          </p>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : null)}

        <Card className={cn("surface-card section-enter border-primary/20", activeReflectTab !== "ignored-signals" && "hidden")}>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" />
                  What Am I Ignoring?
                </CardTitle>
                <CardDescription>
                  Non-AI signals for quiet life areas, stale work, overdue follow-ups, missed habits, renewals, and finance review gaps.
                </CardDescription>
              </div>
              <Button onClick={analyzeIgnoring} disabled={analyzingIgnoring || loadingIgnoring} className="gap-2">
                {analyzingIgnoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Analyze what I&apos;m ignoring
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {ignoringError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {ignoringError}
              </div>
            )}

            {loadingIgnoring ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-24 w-full" />
                ))}
              </div>
            ) : ignoringInsights ? (
              <>
                {ignoringInsights.unavailable.length > 0 && (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Some ignored-life sources are unavailable: {ignoringInsights.unavailable.join(", ")}.
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricPill icon={ShieldAlert} label="Signals found" value={ignoringInsights.summary.total} />
                  <MetricPill icon={AlertCircle} label="High attention" value={ignoringInsights.summary.high} />
                  <MetricPill icon={Target} label="Stale goals" value={ignoringInsights.summary.stale_goals} />
                  <MetricPill icon={FolderPlus} label="Stale projects" value={ignoringInsights.summary.stale_projects} />
                </div>

                {ignoringInsights.signals.length === 0 ? (
                  <EmptyState>
                    Nothing looks ignored right now. Keep using Today, Weekly Review, and Life Areas so future signals stay useful.
                  </EmptyState>
                ) : (
                  <div className="space-y-4">
                    {ignoringGroups.map(([source, signals]) => (
                      <div key={source} className="surface-card rounded-md border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold">{IGNORING_SOURCE_LABELS[source]}</h3>
                          <Badge variant="secondary">{signals.length}</Badge>
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          {signals.slice(0, 6).map((signal) => (
                            <div key={signal.id} className="rounded-md bg-muted/30 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium">{signal.title}</p>
                                  <p className="mt-1 text-sm text-muted-foreground">{signal.description}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">{signal.evidence}</p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    signal.severity === "high" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
                                    signal.severity === "medium" && "border-primary/25 bg-primary/10 text-primary",
                                    signal.severity === "low" && "bg-background/70 text-muted-foreground",
                                  )}
                                >
                                  {signal.severity}
                                </Badge>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {signal.life_area_name && <Badge variant="outline">{signal.life_area_name}</Badge>}
                                <span>{formatDateLabel(signal.date)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <EmptyState>Ignored-life signals are not available yet.</EmptyState>
            )}

            {(ignoringAnalysisError || ignoringAnalysis) && (
              <div className="rounded-lg border border-primary/20 p-4">
                <div className="mb-4">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Ignored-Life Explanation
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Read-only analysis. Suggested tasks are not created unless you confirm them.
                  </p>
                </div>

                {ignoringAnalysisError && (
                  <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                    {ignoringAnalysisError}
                  </div>
                )}

                {ignoringAnalysis && (
                  <div className="space-y-5">
                    <p className="text-sm leading-6 text-muted-foreground">{ignoringAnalysis.summary}</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <InsightList title="What seems ignored" items={ignoringAnalysis.ignored_items.map((item) => `${item.title}: ${item.why_it_may_matter} (${item.evidence})`)} />
                      <InsightList title="Hidden risks" items={ignoringAnalysis.hidden_risks.map((item) => `${item.title}: ${item.why_it_matters}`)} />
                    </div>

                    <div className="space-y-3">
                      <h3 className="font-semibold">Small actions to consider</h3>
                      {ignoringAnalysis.suggested_actions.length === 0 ? (
                        <EmptyState>No suggested tasks returned this time.</EmptyState>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                          {ignoringAnalysis.suggested_actions.map((action, index) => (
                            <div key={`${action.title}-${index}`} className="rounded-md border p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">{action.title}</p>
                                  <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                                </div>
                                <Badge variant="outline">{action.priority}</Badge>
                              </div>
                              <div className="mt-3 flex items-center justify-between gap-3">
                                <span className="text-xs text-muted-foreground">{action.life_area_name || "Unassigned"}</span>
                                <Button
                                  size="sm"
                                  variant={createdIgnoringActions.has(index) ? "secondary" : "outline"}
                                  className="gap-2"
                                  disabled={creatingIgnoringAction === index || createdIgnoringActions.has(index)}
                                  onClick={() => createIgnoringSuggestedTask(action, index)}
                                >
                                  {creatingIgnoringAction === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                  {createdIgnoringActions.has(index) ? "Created" : "Create task"}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {activeReflectTab === "life-balance" && (analysisError || analysis) && (
          <Card className="surface-card section-enter border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Life Balance Insight
              </CardTitle>
              <CardDescription>Read-only analysis. Suggested actions are not created unless you confirm them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {analysisError && (
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {analysisError}
                </div>
              )}

              {analysis && (
                <>
                  <p className="text-sm leading-6 text-muted-foreground">{analysis.summary}</p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <InsightList title="Over-focused areas" items={analysis.over_focused_areas.map((item) => `${item.area}: ${item.reason} (${item.evidence})`)} />
                    <InsightList title="Ignored areas" items={analysis.ignored_areas.map((item) => `${item.area}: ${item.suggested_attention}`)} />
                    <InsightList title="Potential stress points" items={analysis.potential_stress_points.map((item) => `${item.title}: ${item.reason}`)} />
                    <InsightList title="Next week balance" items={analysis.suggested_next_week_balance.map((item) => `${item.area}: ${item.focus}`)} />
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold">Suggested small actions</h3>
                    {analysis.suggested_small_actions.length === 0 ? (
                      <EmptyState>No suggested actions returned this time.</EmptyState>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {analysis.suggested_small_actions.map((action, index) => (
                          <div key={`${action.title}-${index}`} className="rounded-md border p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium">{action.title}</p>
                                <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                              </div>
                              <Badge variant="outline">{action.priority}</Badge>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className="text-xs text-muted-foreground">{action.life_area_name || "Unassigned"}</span>
                              <Button
                                size="sm"
                                variant={createdActions.has(index) ? "secondary" : "outline"}
                                className="gap-2"
                                disabled={creatingAction === index || createdActions.has(index)}
                                onClick={() => createSuggestedTask(action, index)}
                              >
                                {creatingAction === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                {createdActions.has(index) ? "Created" : "Create task"}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function InsightsPage() {
  return <ReflectExperience />
}

function ReflectLinkPanel({
  icon,
  title,
  description,
  href,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  href: string
  action: string
}) {
  return (
    <Card className="surface-card section-enter border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="gap-2">
          <a href={href}>
            {action}
            <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border p-3">
      <h3 className="font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing flagged.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="flex gap-2">
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
