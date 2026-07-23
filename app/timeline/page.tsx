"use client"

import { useCallback, useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CheckSquare,
  Target,
  FolderOpen,
  FileText,
  ClipboardList,
  Flame,
  ShoppingBag,
  TrendingUp,
  Wallet,
  History,
  X,
  Filter,
  Wrench,
  Shield,
  Users,
  ClipboardCheck,
  Sparkles,
} from "lucide-react"
import type { EventType, TimelineEvent, LifeAreaRow } from "@/lib/timeline"

const EVENT_TYPE_CONFIG: Record<
  EventType,
  { label: string; Icon: React.ComponentType<{ className?: string }>; badge: string; dot: string }
> = {
  task_completed: {
    label: "Task Completed",
    Icon: CheckSquare,
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  goal_completed: {
    label: "Goal Achieved",
    Icon: Target,
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  project_completed: {
    label: "Project Completed",
    Icon: FolderOpen,
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  project_milestone: {
    label: "Project Milestone",
    Icon: Sparkles,
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  note_created: {
    label: "Note Created",
    Icon: FileText,
    badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    dot: "bg-green-500",
  },
  weekly_review: {
    label: "Weekly Review",
    Icon: ClipboardList,
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  habit_streak: {
    label: "Habit Milestone",
    Icon: Flame,
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  wishlist_purchased: {
    label: "Wishlist Purchased",
    Icon: ShoppingBag,
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    dot: "bg-pink-500",
  },
  investment_added: {
    label: "Investment Added",
    Icon: TrendingUp,
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  budget_milestone: {
    label: "Budget Milestone",
    Icon: Wallet,
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  maintenance_completed: {
    label: "Maintenance Done",
    Icon: Wrench,
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
    dot: "bg-slate-500",
  },
  vault_renewal_completed: {
    label: "Vault Renewal",
    Icon: Shield,
    badge: "bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300",
    dot: "bg-lime-500",
  },
  people_followup_completed: {
    label: "Follow-up Done",
    Icon: Users,
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    dot: "bg-cyan-500",
  },
  commitment_completed: {
    label: "Commitment Done",
    Icon: ClipboardCheck,
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    dot: "bg-purple-500",
  },
}

const ALL_TYPES = Object.entries(EVENT_TYPE_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (isNaN(diff) || diff < 0) return "recently"
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function groupByPeriod(events: TimelineEvent[], by: "month" | "week"): [string, TimelineEvent[]][] {
  const map = new Map<string, TimelineEvent[]>()
  for (const event of events) {
    const date = new Date(event.occurred_at)
    let key: string
    if (by === "month") {
      key = date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    } else {
      const monday = new Date(date)
      const day = monday.getDay()
      monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1))
      key = "Week of " + monday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    }
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(event)
  }
  return Array.from(map.entries())
}

export default function TimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [lifeAreas, setLifeAreas] = useState<LifeAreaRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [lifeAreaFilter, setLifeAreaFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [groupBy, setGroupBy] = useState<"month" | "week">("month")

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const fetchTimeline = useCallback(() => {
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (typeFilter !== "all") params.set("type", typeFilter)
    if (lifeAreaFilter !== "all") params.set("life_area_id", lifeAreaFilter)
    if (startDate) params.set("start_date", startDate)
    if (endDate) params.set("end_date", endDate)

    setLoading(true)
    setError(false)
    fetch(`/api/timeline?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed")
        return r.json()
      })
      .then((d) => {
        setEvents(d.events ?? [])
        setTotal(d.total ?? 0)
        setLifeAreas(d.life_areas ?? [])
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [search, typeFilter, lifeAreaFilter, startDate, endDate])

  useEffect(() => {
    fetchTimeline()
  }, [fetchTimeline])

  const hasFilters = search.length > 0 || typeFilter !== "all" || lifeAreaFilter !== "all" || startDate.length > 0 || endDate.length > 0

  function clearFilters() {
    setSearchInput("")
    setSearch("")
    setTypeFilter("all")
    setLifeAreaFilter("all")
    setStartDate("")
    setEndDate("")
  }

  const groups = groupByPeriod(events, groupBy)

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-6 w-6 text-primary" />
              Life Timeline
            </h1>
            <p className="text-muted-foreground mt-1">
              A chronological record of your meaningful life activity.
              {!loading && !error && (
                <span className="ml-1.5 text-xs font-medium">{total} events</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant={groupBy === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setGroupBy("month")}
            >
              Month
            </Button>
            <Button
              variant={groupBy === "week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setGroupBy("week")}
            >
              Week
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_160px_150px_150px_auto] md:items-center">
              <div className="relative flex-1 max-w-xs">
                <Input
                  placeholder="Search events…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pr-8"
                />
                {searchInput && (
                  <button
                    onClick={() => { setSearchInput(""); setSearch("") }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[190px]">
                  <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All event types</SelectItem>
                  {ALL_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={lifeAreaFilter} onValueChange={setLifeAreaFilter} disabled={lifeAreas.length === 0}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <SelectValue placeholder="Life domain" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All life domains</SelectItem>
                  {lifeAreas.map((la) => (
                    <SelectItem key={la.id} value={String(la.id)}>{la.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                aria-label="Start date"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                aria-label="End date"
              />
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeline content */}
        {loading ? (
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Card>
                  <CardContent className="pt-4 space-y-4">
                    {[0, 1, 2, 3].map((j) => (
                      <div key={j} className="flex gap-3 items-start">
                        <Skeleton className="h-2.5 w-2.5 rounded-full mt-1.5 shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/3" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Could not load timeline. Please try again.
            </CardContent>
          </Card>
        ) : events.length === 0 ? (
          <Card>
            <CardContent className="pt-10 pb-10 text-center space-y-2">
              <History className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              {hasFilters ? (
                <>
                  <p className="text-sm font-medium">No events match your filters.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Your timeline is empty.</p>
                  <p className="text-xs text-muted-foreground">
                    Complete tasks, goals, projects, commitments, maintenance, habits, reviews, and other milestones to see them here.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groups.map(([period, periodEvents]) => (
              <div key={period}>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-semibold text-foreground">{period}</p>
                  <span className="text-xs text-muted-foreground">({periodEvents.length})</span>
                </div>
                <Card>
                  <CardContent className="pt-4 pb-2">
                    <div className="relative">
                      {/* Vertical connector line */}
                      <div className="absolute left-[4px] top-2 bottom-2 w-px bg-border" />
                      <div className="space-y-0">
                        {periodEvents.map((event) => {
                          const config = EVENT_TYPE_CONFIG[event.type]
                          if (!config) return null
                          return (
                            <div key={event.id} className="flex gap-3 items-start py-2.5 relative">
                              <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 z-10 ${config.dot}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${config.badge}`}>
                                      <config.Icon className="h-3 w-3" />
                                      {config.label}
                                    </span>
                                    <span className="text-sm font-medium truncate">{event.title}</span>
                                  </div>
                                  {event.life_area_name && (
                                    <Badge variant="outline" className="text-xs shrink-0 font-normal">
                                      {event.life_area_name}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {event.label} · {formatDate(event.occurred_at)} · {timeAgo(event.occurred_at)}
                                  {event.type === "habit_streak" && Boolean(event.meta.milestone) && (
                                    <span className="ml-1 font-medium">🔥 {Number(event.meta.milestone)} check-ins</span>
                                  )}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
