"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Flame,
  FolderPlus,
  History,
  Loader2,
  Network,
  Save,
  Target,
  Trophy,
  Wallet,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

type Review = {
  id: string | null
  week_start: string
  week_end: string
  reflection_wins: string
  reflection_challenges: string
  reflection_lessons: string
  reflection_next_week_focus: string
  updated_at: string | null
}

type HistoryReview = {
  id: string
  week_start: string
  week_end: string
  reflection_wins: string
  reflection_next_week_focus: string
  updated_at: string | null
}

type WeeklySummary = {
  week_start: string
  week_end: string
  unavailable: string[]
  tasks: { completed: number; overdue: number; created_updated: number }
  goals: { progressed: number; upcoming_deadlines: number }
  habits: { completed_checkins: number; habits_completed: number; total_checkins: number }
  projects: { updated: number; active: number; overdue: number; activity: number }
  notes: { created: number; updated: number }
  finance: {
    income: number
    expenses: number
    net: number
    transactions: number
    near_budget_categories: Array<{ id: string; name: string; spent: number; budget_limit: number; percent_used: number }>
    income_sources_updated: number
    active_income_amount: number
    investments_updated: number
    investment_tracked_value: number
  }
  life_areas: Array<{ key: string; name: string; icon: string; color: string; activity_count: number }>
}

type WeeklyReviewResponse = {
  week: { week_start: string; week_end: string }
  review: Review
  history: HistoryReview[]
  summary: WeeklySummary
}

const emptyReview: Review = {
  id: null,
  week_start: "",
  week_end: "",
  reflection_wins: "",
  reflection_challenges: "",
  reflection_lessons: "",
  reflection_next_week_focus: "",
  updated_at: null,
}

function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function formatDate(value?: string | null) {
  if (!value) return "No date"
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function toNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value || 0))
  return Number.isFinite(parsed) ? parsed : 0
}

function totalActivity(summary: WeeklySummary | null) {
  if (!summary) return 0
  return (
    toNumber(summary.tasks.completed) +
    toNumber(summary.tasks.created_updated) +
    toNumber(summary.goals.progressed) +
    toNumber(summary.habits.completed_checkins) +
    toNumber(summary.projects.updated) +
    toNumber(summary.projects.activity) +
    toNumber(summary.notes.created) +
    toNumber(summary.notes.updated) +
    toNumber(summary.finance.transactions)
  )
}

function SummaryMetric({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ElementType
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      {children}
    </div>
  )
}

export default function WeeklyReviewPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(localDateString())
  const [summary, setSummary] = useState<WeeklySummary | null>(null)
  const [review, setReview] = useState<Review>(emptyReview)
  const [history, setHistory] = useState<HistoryReview[]>([])
  const [loadingReview, setLoadingReview] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<"idle" | "saved" | "failed">("idle")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }

    if (user) {
      fetchReview(selectedDate)
    }
  }, [user, loading, router, selectedDate])

  const fetchReview = async (date: string) => {
    setLoadingReview(true)
    setError("")
    setSaveState("idle")

    try {
      const response = await fetch(`/api/weekly-review?date=${date}`)
      const data = (await response.json().catch(() => null)) as WeeklyReviewResponse | null
      if (!response.ok || !data) {
        throw new Error((data as { error?: string } | null)?.error || "Weekly review could not be loaded.")
      }

      setSummary(data.summary)
      setReview(data.review)
      setHistory(data.history || [])
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Weekly review could not be loaded.")
      setSummary(null)
      setReview(emptyReview)
      setHistory([])
    } finally {
      setLoadingReview(false)
    }
  }

  const saveReview = async () => {
    setSaving(true)
    setSaveState("idle")
    setError("")

    try {
      const response = await fetch("/api/weekly-review", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          reflection_wins: review.reflection_wins,
          reflection_challenges: review.reflection_challenges,
          reflection_lessons: review.reflection_lessons,
          reflection_next_week_focus: review.reflection_next_week_focus,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || "Weekly review could not be saved.")
      }

      setReview(data.review)
      setSummary(data.summary)
      setSaveState("saved")
      await fetchReview(selectedDate)
    } catch (saveError) {
      setSaveState("failed")
      setError(saveError instanceof Error ? saveError.message : "Weekly review could not be saved.")
    } finally {
      setSaving(false)
    }
  }

  const statusLabel = useMemo(() => {
    if (saving) return "Saving..."
    if (saveState === "saved") return "Saved"
    if (saveState === "failed") return "Save failed"
    return review.id ? "Saved review" : "Not saved yet"
  }, [review.id, saveState, saving])

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
    <DashboardLayout title="Weekly Review">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 rounded-lg border bg-card p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Monday-Sunday review</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">Review your week</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Look across tasks, goals, habits, projects, notes, finance, and life areas before choosing next week&apos;s focus.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Badge variant={saveState === "failed" ? "destructive" : "outline"}>{statusLabel}</Badge>
            <Button onClick={saveReview} disabled={saving || loadingReview} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Review
            </Button>
          </div>
        </section>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarCheck className="h-5 w-5 text-primary" />
                      {loadingReview || !summary ? "This Week" : `${formatDate(summary.week_start)} - ${formatDate(summary.week_end)}`}
                    </CardTitle>
                    <CardDescription>Derived from existing LifeSort records. Source records are not changed.</CardDescription>
                  </div>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loadingReview ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                    <Skeleton className="h-28" />
                  </div>
                ) : !summary ? (
                  <EmptyState>Weekly metrics are unavailable right now.</EmptyState>
                ) : totalActivity(summary) === 0 ? (
                  <EmptyState>
                    There is not much activity for this week yet. You can still save reflections and set a next-week focus.
                  </EmptyState>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryMetric
                      title="Tasks"
                      value={summary.tasks.completed}
                      subtitle={`${summary.tasks.overdue} overdue · ${summary.tasks.created_updated} created or updated`}
                      icon={ClipboardCheck}
                    />
                    <SummaryMetric
                      title="Goals"
                      value={summary.goals.progressed}
                      subtitle={`${summary.goals.upcoming_deadlines} upcoming deadlines`}
                      icon={Target}
                    />
                    <SummaryMetric
                      title="Habits"
                      value={summary.habits.completed_checkins}
                      subtitle={`${summary.habits.habits_completed} habits completed this week`}
                      icon={Flame}
                    />
                    <SummaryMetric
                      title="Projects"
                      value={summary.projects.updated}
                      subtitle={`${summary.projects.activity} activity items · ${summary.projects.overdue} overdue`}
                      icon={FolderPlus}
                    />
                    <SummaryMetric
                      title="Notes"
                      value={summary.notes.created + summary.notes.updated}
                      subtitle={`${summary.notes.created} created · ${summary.notes.updated} updated`}
                      icon={FileText}
                    />
                    <SummaryMetric
                      title="Budget Net"
                      value={formatCurrency(summary.finance.net)}
                      subtitle={`${formatCurrency(summary.finance.income)} in · ${formatCurrency(summary.finance.expenses)} out`}
                      icon={Wallet}
                    />
                    <SummaryMetric
                      title="Investments"
                      value={formatCurrency(summary.finance.investment_tracked_value)}
                      subtitle={`${summary.finance.investments_updated} updated investments`}
                      icon={Trophy}
                    />
                    <SummaryMetric
                      title="Income"
                      value={summary.finance.income_sources_updated}
                      subtitle={`${formatCurrency(summary.finance.active_income_amount)} active source amount`}
                      icon={CheckCircle2}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {summary?.unavailable?.length ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <div>
                    <p className="font-medium text-foreground">Some sections are unavailable.</p>
                    <p className="mt-1">{summary.unavailable.join(", ")}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-primary" />
                    Life Area Balance
                  </CardTitle>
                  <CardDescription>Activity grouped by assigned Life Area.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingReview ? (
                    <div className="space-y-3">
                      <Skeleton className="h-14" />
                      <Skeleton className="h-14" />
                    </div>
                  ) : !summary?.life_areas?.length ? (
                    <EmptyState>Assign items to Life Areas to see weekly balance here.</EmptyState>
                  ) : (
                    <div className="space-y-3">
                      {summary.life_areas.map((area) => {
                        const total = Math.max(...summary.life_areas.map((item) => item.activity_count), 1)
                        return (
                          <div key={area.key} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: area.color }} />
                                <span className="font-medium">{area.name}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">{area.activity_count}</span>
                            </div>
                            <Progress value={(area.activity_count / total) * 100} className="h-2" />
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Finance Highlights</CardTitle>
                  <CardDescription>Budget categories near or over their monthly limit.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingReview ? (
                    <div className="space-y-3">
                      <Skeleton className="h-14" />
                      <Skeleton className="h-14" />
                    </div>
                  ) : !summary?.finance.near_budget_categories.length ? (
                    <EmptyState>No budget categories are near their limit.</EmptyState>
                  ) : (
                    <div className="space-y-3">
                      {summary.finance.near_budget_categories.map((category) => (
                        <div key={category.id} className="rounded-md border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{category.name}</p>
                            <Badge variant={category.percent_used >= 100 ? "destructive" : "outline"}>
                              {category.percent_used}%
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatCurrency(category.spent)} of {formatCurrency(category.budget_limit)}
                          </p>
                          <Progress value={Math.min(100, category.percent_used)} className="mt-3 h-2" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Reflection</CardTitle>
                <CardDescription>Save your written review for this week.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="wins-this-week">Wins this week</label>
                  <Textarea
                    id="wins-this-week"
                    value={review.reflection_wins}
                    onChange={(event) => {
                      setReview((current) => ({ ...current, reflection_wins: event.target.value }))
                      setSaveState("idle")
                    }}
                    className="min-h-[140px]"
                    placeholder="What went well?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="challenges">Challenges</label>
                  <Textarea
                    id="challenges"
                    value={review.reflection_challenges}
                    onChange={(event) => {
                      setReview((current) => ({ ...current, reflection_challenges: event.target.value }))
                      setSaveState("idle")
                    }}
                    className="min-h-[140px]"
                    placeholder="What got in the way?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="lessons-learned">Lessons learned</label>
                  <Textarea
                    id="lessons-learned"
                    value={review.reflection_lessons}
                    onChange={(event) => {
                      setReview((current) => ({ ...current, reflection_lessons: event.target.value }))
                      setSaveState("idle")
                    }}
                    className="min-h-[140px]"
                    placeholder="What did this week teach you?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="next-week-focus">Next week focus</label>
                  <Textarea
                    id="next-week-focus"
                    value={review.reflection_next_week_focus}
                    onChange={(event) => {
                      setReview((current) => ({ ...current, reflection_next_week_focus: event.target.value }))
                      setSaveState("idle")
                    }}
                    className="min-h-[140px]"
                    placeholder="What deserves your attention next?"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Previous Reviews
              </CardTitle>
              <CardDescription>Saved weekly reflections from earlier weeks.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingReview ? (
                <div className="space-y-3">
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                  <Skeleton className="h-20" />
                </div>
              ) : history.length === 0 ? (
                <EmptyState>No previous reviews yet. Save this week and history will build from here.</EmptyState>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50"
                      onClick={() => setSelectedDate(String(item.week_start).slice(0, 10))}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">
                          {formatDate(item.week_start)} - {formatDate(item.week_end)}
                        </p>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {item.reflection_wins || item.reflection_next_week_focus || "No reflection preview."}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href="/today">
              Open Today Plan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
