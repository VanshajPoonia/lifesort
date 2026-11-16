"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Activity, ArrowRight, BookOpenText, CheckCircle2, Flame, Heart, Star, Target } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const JournalMoodTrend = dynamic(() => import("./journal-insights-charts").then((mod) => mod.JournalMoodTrend), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
})
const JournalRatingBreakdown = dynamic(() => import("./journal-insights-charts").then((mod) => mod.JournalRatingBreakdown), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
})

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

type JournalInsightsEntry = {
  journal_date: string
  mood: number | null
  work_stars: number | null
  personal_stars: number | null
  family_stars: number | null
  gratitude: string[]
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

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function entryHasSignal(entry: JournalInsightsEntry) {
  return Boolean(entry.mood || entry.work_stars || entry.personal_stars || entry.family_stars || entry.gratitude.some(Boolean))
}

function journalStats(entries: JournalInsightsEntry[]) {
  const days = new Set(entries.filter(entryHasSignal).map((entry) => entry.journal_date))
  let current = 0
  for (let date = new Date(); days.has(localDateStringFor(date)); date = addDays(date, -1)) current += 1
  let longest = 0
  let run = 0
  Array.from(days).sort().forEach((day, index, sorted) => {
    const previous = sorted[index - 1]
    if (previous && day === localDateStringFor(addDays(new Date(`${previous}T00:00:00`), 1))) run += 1
    else run = 1
    longest = Math.max(longest, run)
  })
  const moods = entries.map((entry) => entry.mood).filter((mood): mood is number => typeof mood === "number")
  const averageMood = moods.length ? Math.round((moods.reduce((sum, mood) => sum + mood, 0) / moods.length) * 10) / 10 : null
  return { current, longest, total: days.size, averageMood }
}

function localDateStringFor(date: Date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function gratitudeWords(entries: JournalInsightsEntry[]) {
  const stop = new Set(["the", "and", "for", "with", "that", "this", "you", "are", "was", "were", "from", "have", "has", "had", "but", "not", "today", "very", "into"])
  const counts = new Map<string, number>()
  entries.flatMap((entry) => entry.gratitude).join(" ").toLowerCase().split(/[^a-z0-9']+/).forEach((word) => {
    if (word.length < 3 || stop.has(word)) return
    counts.set(word, (counts.get(word) || 0) + 1)
  })
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10)
}

function journalHeatmapDays(entries: JournalInsightsEntry[]) {
  const days = new Set(entries.filter(entryHasSignal).map((entry) => entry.journal_date))
  const start = addDays(new Date(), -89)
  return Array.from({ length: 90 }, (_, index) => {
    const date = localDateStringFor(addDays(start, index))
    return { date, active: days.has(date) }
  })
}

// Reflect's Journal tab: this week's digest plus 90 days of journal insights.
export function JournalInsightsView() {
  const [journalDigest, setJournalDigest] = useState<JournalDigest | null>(null)
  const [journalInsights, setJournalInsights] = useState<JournalInsightsEntry[]>([])
  const [loadingJournal, setLoadingJournal] = useState(true)
  const [journalError, setJournalError] = useState("")
  const journalInsightStats = useMemo(() => journalStats(journalInsights), [journalInsights])
  const journalWordCounts = useMemo(() => gratitudeWords(journalInsights), [journalInsights])
  const journalHeatmap = useMemo(() => journalHeatmapDays(journalInsights), [journalInsights])

  const fetchJournalDigest = useCallback(async () => {
    setLoadingJournal(true)
    setJournalError("")
    try {
      const [digestResponse, insightsResponse] = await Promise.all([
        fetch(`/api/journal/weekly-digest?weekOf=${localDateString()}`),
        fetch("/api/journal/insights"),
      ])
      const data = await digestResponse.json().catch(() => null)
      const insightsData = await insightsResponse.json().catch(() => null)
      if (!digestResponse.ok) throw new Error(data?.error || "Could not load journal digest")
      if (!insightsResponse.ok) throw new Error(insightsData?.error || "Could not load journal insights")
      setJournalDigest(data)
      setJournalInsights(Array.isArray(insightsData?.entries) ? insightsData.entries : [])
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "Could not load journal digest")
    } finally {
      setLoadingJournal(false)
    }
  }, [])

  useEffect(() => {
    // Flagged by react-hooks/set-state-in-effect: fetchJournalDigest turns the
    // loading state on before it fetches.
    void fetchJournalDigest()
  }, [fetchJournalDigest])

  return (
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
            <a href="/library?tab=journal">
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
              <MetricPill icon={Flame} label="Current streak" value={`${journalInsightStats.current}d`} />
              <MetricPill icon={Target} label="Longest streak" value={`${journalInsightStats.longest}d`} />
              <MetricPill icon={BookOpenText} label="Total entries" value={journalInsightStats.total} />
              <MetricPill icon={Star} label="Avg mood" value={journalInsightStats.averageMood ?? "No data"} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="bg-background/80">
                <CardHeader>
                  <CardTitle className="text-base">Mood Trend</CardTitle>
                  <CardDescription>Last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <JournalMoodTrend entries={journalInsights} />
                </CardContent>
              </Card>
              <Card className="bg-background/80">
                <CardHeader>
                  <CardTitle className="text-base">Day Rating Breakdown</CardTitle>
                  <CardDescription>Weekly averages across the last 8 weeks</CardDescription>
                </CardHeader>
                <CardContent>
                  <JournalRatingBreakdown entries={journalInsights} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card className="bg-background/80">
                <CardHeader>
                  <CardTitle className="text-base">Journaling Consistency</CardTitle>
                  <CardDescription>Last 90 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-1">
                    {journalHeatmap.map((day) => (
                      <span
                        key={day.date}
                        title={formatDateLabel(day.date)}
                        className={cn("h-2.5 rounded-sm", day.active ? "bg-amber-500" : "bg-muted")}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-background/80">
                <CardHeader>
                  <CardTitle className="text-base">Gratitude Words</CardTitle>
                </CardHeader>
                <CardContent>
                  {journalWordCounts.length === 0 ? (
                    <EmptyState>No gratitude words to summarize yet.</EmptyState>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {journalWordCounts.map(([word, count]) => (
                        <Badge key={word} variant="secondary" className="gap-1">
                          {word}
                          <span className="text-muted-foreground">{count}</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

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
                        href={`/library?tab=journal&date=${entry.journal_date}`}
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
  )
}
