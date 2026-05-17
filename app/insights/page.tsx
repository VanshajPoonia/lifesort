"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  CheckSquare,
  FileText,
  Flame,
  FolderPlus,
  Loader2,
  Plus,
  Sparkles,
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
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

function MetricPill({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  )
}

export default function InsightsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [metrics, setMetrics] = useState<LifeBalanceMetrics | null>(null)
  const [analysis, setAnalysis] = useState<AiLifeBalanceResult | null>(null)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState("")
  const [analysisError, setAnalysisError] = useState("")
  const [createdActions, setCreatedActions] = useState<Set<number>>(new Set())
  const [creatingAction, setCreatingAction] = useState<number | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }
    if (user) fetchMetrics()
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

  const visibleAreas = useMemo(() => {
    if (!metrics) return []
    return [...metrics.areas].sort((a, b) => b.score - a.score)
  }, [metrics])

  const maxScore = Math.max(1, ...visibleAreas.map((area) => area.score))
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

  if (loading || !user) {
    return (
      <DashboardLayout title="Insights" subtitle="Life balance metrics and AI analysis">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Insights" subtitle="See which parts of life are getting attention and which ones may need care.">
      <div className="space-y-6">
        <section className="rounded-lg border bg-card p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Life Balance</p>
              <h1 className="mt-1 text-2xl font-bold">Where your energy is going</h1>
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

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          </div>
        )}

        {loadingMetrics ? (
          <div className="grid gap-4 md:grid-cols-5">
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

            <div className="grid gap-4 md:grid-cols-5">
              <MetricPill icon={CheckSquare} label="Active tasks" value={totals.tasks} />
              <MetricPill icon={Target} label="Active goals" value={totals.goals} />
              <MetricPill icon={Flame} label="Active habits" value={totals.habits} />
              <MetricPill icon={FolderPlus} label="Active projects" value={totals.projects} />
              <MetricPill icon={FileText} label="Recent notes" value={totals.notes} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <Card>
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
                    visibleAreas.map((area) => (
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
                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
                          <div><span className="font-medium">{area.tasks.active}</span><p className="text-xs text-muted-foreground">tasks</p></div>
                          <div><span className="font-medium">{area.goals.active}</span><p className="text-xs text-muted-foreground">goals</p></div>
                          <div><span className="font-medium">{area.habits.active}</span><p className="text-xs text-muted-foreground">habits</p></div>
                          <div><span className="font-medium">{area.projects.active}</span><p className="text-xs text-muted-foreground">projects</p></div>
                          <div><span className="font-medium">{area.notes.recent_updates}</span><p className="text-xs text-muted-foreground">notes</p></div>
                          <div><span className="font-medium">{formatCurrency(area.budget.expenses_30d)}</span><p className="text-xs text-muted-foreground">30d spend</p></div>
                        </div>
                      </div>
                    ))
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
        ) : null}

        {(analysisError || analysis) && (
          <Card className="border-primary/20">
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
