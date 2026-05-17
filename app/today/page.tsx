"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  Flame,
  Lightbulb,
  ListChecks,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

type SaveState = "idle" | "saving" | "saved" | "error"

type AiTodayPlanResult = {
  top_priorities: Array<{ id: string; title: string; reason: string }>
  schedule_blocks: Array<{ label: string; suggestion: string }>
  defer: Array<{ id: string; title: string; reason: string }>
  risks: string[]
  small_win: string
}

type HabitToday = {
  id: number
  name: string
  color: string
  target_count: number
  done: boolean
  count: number
}

type TodayItem = {
  id: string
  source_type: string
  source_id: string | null
  title: string
  subtitle?: string
  href: string
  custom: boolean
  priority?: string
  date?: string | null
}

type TodayPlan = {
  id: string | null
  plan_date: string
  focus_items: TodayItem[]
  reflection_went_well: string
  reflection_did_not_go_well: string
  reflection_improve_tomorrow: string
}

type TodayResponse = {
  plan: TodayPlan
  candidates: {
    focusSuggestions: TodayItem[]
    mustDo: TodayItem[]
    shouldDo: TodayItem[]
    couldDo: TodayItem[]
    upcomingDeadlines: TodayItem[]
    calendarToday: TodayItem[]
    quickNotes: TodayItem[]
    unavailable?: string[]
  }
}

const emptyCandidates: TodayResponse["candidates"] = {
  focusSuggestions: [],
  mustDo: [],
  shouldDo: [],
  couldDo: [],
  upcomingDeadlines: [],
  calendarToday: [],
  quickNotes: [],
  unavailable: [],
}

function localDateString() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function formatDate(value?: string | null) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function sourceLabel(sourceType: string) {
  const labels: Record<string, string> = {
    task: "Task",
    goal: "Goal",
    calendar: "Calendar",
    note: "Note",
    budget: "Budget",
    wishlist: "Wishlist",
    custom: "Custom",
  }
  return labels[sourceType] || sourceType
}

function toFocusItem(item: TodayItem): TodayItem {
  return {
    id: item.id,
    source_type: item.source_type,
    source_id: item.source_id ?? null,
    title: item.title,
    href: item.href,
    custom: Boolean(item.custom),
  }
}

export default function TodayPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [planDate] = useState(localDateString)
  const [plan, setPlan] = useState<TodayPlan | null>(null)
  const [candidates, setCandidates] = useState<TodayResponse["candidates"]>(emptyCandidates)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [customFocus, setCustomFocus] = useState("")
  const [reflection, setReflection] = useState({
    reflection_went_well: "",
    reflection_did_not_go_well: "",
    reflection_improve_tomorrow: "",
  })
  const [habitsToday, setHabitsToday] = useState<HabitToday[]>([])
  const [habitsLoaded, setHabitsLoaded] = useState(false)
  const [aiPlan, setAiPlan] = useState<AiTodayPlanResult | null>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [aiError, setAiError] = useState("")
  const [createTaskTitle, setCreateTaskTitle] = useState("")
  const [creatingTask, setCreatingTask] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, router, user])

  const fetchToday = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const response = await fetch(`/api/today-plan?date=${planDate}`)
      if (!response.ok) throw new Error("Failed to load today plan")
      const data = (await response.json()) as TodayResponse
      setPlan(data.plan)
      setCandidates(data.candidates || emptyCandidates)
      setReflection({
        reflection_went_well: data.plan.reflection_went_well || "",
        reflection_did_not_go_well: data.plan.reflection_did_not_go_well || "",
        reflection_improve_tomorrow: data.plan.reflection_improve_tomorrow || "",
      })
    } catch (error) {
      console.error("Failed to load today plan:", error)
      setLoadError("Today Plan could not be loaded.")
    } finally {
      setLoading(false)
    }
  }, [planDate])

  useEffect(() => {
    if (user) fetchToday()
  }, [fetchToday, user])

  const fetchHabitsToday = useCallback(async () => {
    try {
      const [habitsRes, checkinsRes] = await Promise.all([
        fetch("/api/habits"),
        fetch(`/api/habits/checkins?date=${planDate}`),
      ])
      if (!habitsRes.ok || !checkinsRes.ok) return
      type RawHabit = { id: number; name: string; color: string; is_active: boolean; frequency: string; custom_days: number[]; target_count: number }
      type RawCheckin = { habit_id: number; count: number }
      type RawCheckinData = { checkins: RawCheckin[] }
      const habitsData: RawHabit[] = await habitsRes.json()
      const checkinsData: RawCheckinData = await checkinsRes.json()
      const todayDay = new Date().getDay()
      const active = habitsData.filter((h) => {
        if (!h.is_active) return false
        if (h.frequency === "daily") return true
        if (h.frequency === "weekly") return true
        if (h.frequency === "custom") return (h.custom_days || []).includes(todayDay)
        return false
      })
      const checkinMap = new Map((checkinsData.checkins || []).map((c) => [c.habit_id, c.count]))
      setHabitsToday(active.map((h) => {
        const count = checkinMap.get(h.id) ?? 0
        return { id: h.id, name: h.name, color: h.color || "#2563EB", target_count: h.target_count, done: count >= h.target_count, count }
      }))
    } catch {
      // non-fatal
    } finally {
      setHabitsLoaded(true)
    }
  }, [planDate])

  useEffect(() => {
    if (user) fetchHabitsToday()
  }, [fetchHabitsToday, user])

  const toggleHabit = async (habit: HabitToday) => {
    const newCount = habit.done ? 0 : habit.target_count
    setHabitsToday((prev) => prev.map((h) => h.id === habit.id ? { ...h, done: !habit.done, count: newCount } : h))
    try {
      await fetch("/api/habits/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habit_id: habit.id, checkin_date: planDate, count: newCount }),
      })
    } catch {
      // revert
      setHabitsToday((prev) => prev.map((h) => h.id === habit.id ? habit : h))
    }
  }

  const savePlan = useCallback(
    async (focusItems: TodayItem[], nextReflection = reflection) => {
      setSaveState("saving")
      try {
        const response = await fetch("/api/today-plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_date: planDate,
            focus_items: focusItems.map(toFocusItem),
            ...nextReflection,
          }),
        })

        if (!response.ok) throw new Error("Failed to save today plan")
        const data = await response.json()
        setPlan((current) => ({
          ...(current || {
            id: null,
            plan_date: planDate,
            reflection_went_well: "",
            reflection_did_not_go_well: "",
            reflection_improve_tomorrow: "",
          }),
          ...data.plan,
        }))
        setSaveState("saved")
      } catch (error) {
        console.error("Failed to save today plan:", error)
        setSaveState("error")
      }
    },
    [planDate, reflection]
  )

  const focusItems = plan?.focus_items || []
  const focusIds = useMemo(() => new Set(focusItems.map((item) => item.id)), [focusItems])
  const todayLabel = new Date(`${planDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })

  const addFocus = async (item: TodayItem) => {
    if (focusItems.length >= 3 || focusIds.has(item.id)) return
    const next = [...focusItems, toFocusItem(item)]
    setPlan((current) => (current ? { ...current, focus_items: next } : current))
    await savePlan(next)
  }

  const removeFocus = async (id: string) => {
    const next = focusItems.filter((item) => item.id !== id)
    setPlan((current) => (current ? { ...current, focus_items: next } : current))
    await savePlan(next)
  }

  const addCustomFocus = async () => {
    const title = customFocus.trim()
    if (!title || focusItems.length >= 3) return
    const item: TodayItem = {
      id: `custom-${Date.now()}`,
      source_type: "custom",
      source_id: null,
      title,
      href: "/today",
      custom: true,
    }
    setCustomFocus("")
    await addFocus(item)
  }

  const saveReflection = async () => {
    await savePlan(focusItems, reflection)
  }

  const generateAiPlan = async () => {
    if (loading || generatingAi) return
    setGeneratingAi(true)
    setAiError("")
    setAiPlan(null)

    const simplify = (item: TodayItem) => ({
      id: item.id,
      title: item.title,
      subtitle: item.subtitle ? item.subtitle.slice(0, 80) : undefined,
      date: item.date ?? undefined,
    })

    try {
      const response = await fetch("/api/ai/today-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_date: planDate,
          must_do: candidates.mustDo.map(simplify),
          should_do: candidates.shouldDo.map(simplify),
          could_do: candidates.couldDo.map(simplify),
          calendar_today: candidates.calendarToday.map(simplify),
          habits_today: habitsToday.map((h) => ({ id: h.id, name: h.name, done: h.done })),
          upcoming_deadlines: candidates.upcomingDeadlines.map(simplify),
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "AI plan generation failed")
      setAiPlan(data.result)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI plan generation failed")
    } finally {
      setGeneratingAi(false)
    }
  }

  const addPriorityToFocus = async (priorityId: string) => {
    const allItems = [
      ...candidates.mustDo,
      ...candidates.shouldDo,
      ...candidates.couldDo,
      ...candidates.upcomingDeadlines,
      ...candidates.calendarToday,
    ]
    const item = allItems.find((i) => i.id === priorityId)
    if (item) await addFocus(item)
  }

  const createTaskFromSmallWin = async () => {
    const title = createTaskTitle.trim()
    if (!title || creatingTask) return
    setCreatingTask(true)
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, priority: "medium" }),
      })
      setCreateTaskTitle("")
    } catch {
      // non-fatal; task creation is optional
    } finally {
      setCreatingTask(false)
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Today Plan" subtitle="Know what to focus on today">
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Today Plan" subtitle={todayLabel}>
      <div className="space-y-6">
        {loadError ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">{loadError}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Refresh the page or try again in a moment.</p>
              <Button className="mt-4" onClick={fetchToday}>Try again</Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {(candidates.unavailable?.length || 0) > 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Some sources could not load: {candidates.unavailable?.join(", ")}.</span>
                </div>
              </div>
            )}

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-primary" />
                      Today's Focus
                    </CardTitle>
                    <CardDescription>Pick 1-3 items that would make today feel successful.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <SaveStatus state={saveState} />
                    <Button
                      onClick={generateAiPlan}
                      disabled={generatingAi || loading}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      {generatingAi
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Sparkles className="h-3.5 w-3.5" />}
                      Plan My Day with AI
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {focusItems.length === 0 ? (
                  <EmptyPanel
                    icon={<Target className="h-5 w-5" />}
                    title="No focus selected yet"
                    description="Choose from your suggestions or add a simple custom focus."
                  />
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    {focusItems.map((item, index) => (
                      <div key={item.id} className="rounded-lg border bg-background p-3">
                        <div className="flex items-start justify-between gap-2">
                          <Badge variant="secondary">Focus {index + 1}</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => removeFocus(item.id)}
                            aria-label={`Remove ${item.title} from today's focus`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="mt-2 text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{sourceLabel(item.source_type)}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={customFocus}
                    onChange={(event) => setCustomFocus(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault()
                        addCustomFocus()
                      }
                    }}
                    placeholder="Add a custom focus for today"
                    aria-label="Add a custom focus for today"
                  />
                  <Button onClick={addCustomFocus} disabled={!customFocus.trim() || focusItems.length >= 3} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                </div>

                <SectionList
                  title="Suggested focus"
                  items={candidates.focusSuggestions}
                  empty="No suggestions yet. A custom focus works perfectly."
                  action={(item) => (
                    <Button
                      size="sm"
                      variant={focusIds.has(item.id) ? "secondary" : "outline"}
                      disabled={focusIds.has(item.id) || focusItems.length >= 3}
                      onClick={() => addFocus(item)}
                    >
                      {focusIds.has(item.id) ? "Added" : "Focus"}
                    </Button>
                  )}
                  compact
                />
              </CardContent>
            </Card>

            {(generatingAi || aiPlan || aiError) && (
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        AI Day Plan
                      </CardTitle>
                      <CardDescription>
                        Suggestions based on your tasks, habits, and calendar. Your task titles are shared with AI.
                        Nothing applies automatically — every action requires your confirmation.
                      </CardDescription>
                    </div>
                    {aiPlan && !generatingAi && (
                      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setAiPlan(null)}>
                        Dismiss
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {generatingAi && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Planning your day...
                    </div>
                  )}
                  {aiError && !generatingAi && (
                    <p className="text-sm text-destructive">{aiError}</p>
                  )}
                  {aiPlan && !generatingAi && (
                    <>
                      {aiPlan.top_priorities.length > 0 && (
                        <div>
                          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                            <Star className="h-4 w-4 text-primary" />
                            Suggested Top Priorities
                          </p>
                          <div className="space-y-2">
                            {aiPlan.top_priorities.map((priority, i) => (
                              <div
                                key={priority.id || i}
                                className="flex items-start justify-between gap-3 rounded-md border p-3"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium">{priority.title}</p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">{priority.reason}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant={focusIds.has(priority.id) ? "secondary" : "outline"}
                                  disabled={focusIds.has(priority.id) || focusItems.length >= 3}
                                  onClick={() => addPriorityToFocus(priority.id)}
                                >
                                  {focusIds.has(priority.id) ? "Added" : "Add to Focus"}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {aiPlan.schedule_blocks.length > 0 && (
                        <div>
                          <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                            <Clock className="h-4 w-4 text-primary" />
                            Suggested Schedule
                          </p>
                          <div className="grid gap-3 sm:grid-cols-3">
                            {aiPlan.schedule_blocks.map((block, i) => (
                              <div key={i} className="rounded-md border p-3">
                                <p className="text-sm font-medium">{block.label}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{block.suggestion}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {aiPlan.defer.length > 0 && (
                        <div>
                          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <X className="h-4 w-4" />
                            Consider Deferring
                          </p>
                          <div className="space-y-2">
                            {aiPlan.defer.map((item, i) => (
                              <div
                                key={item.id || i}
                                className="rounded-md border border-dashed p-3"
                              >
                                <p className="text-sm">{item.title}</p>
                                <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {aiPlan.risks.length > 0 && (
                        <div>
                          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            Risk
                          </p>
                          <ul className="space-y-1">
                            {aiPlan.risks.map((risk, i) => (
                              <li key={i} className="text-sm text-muted-foreground">{risk}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                          <Lightbulb className="h-4 w-4 text-yellow-500" />
                          Small Win for Today
                        </p>
                        <p className="text-sm text-muted-foreground">{aiPlan.small_win}</p>
                        {!createTaskTitle && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 gap-2"
                            onClick={() => setCreateTaskTitle(aiPlan.small_win)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Create Task from this
                          </Button>
                        )}
                        {createTaskTitle && (
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                            <Input
                              value={createTaskTitle}
                              onChange={(e) => setCreateTaskTitle(e.target.value)}
                              placeholder="Task title"
                              onKeyDown={(e) => { if (e.key === "Enter") createTaskFromSmallWin() }}
                            />
                            <Button
                              onClick={createTaskFromSmallWin}
                              disabled={creatingTask || !createTaskTitle.trim()}
                              size="sm"
                              className="gap-2"
                            >
                              {creatingTask && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              Create Task
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setCreateTaskTitle("")}>
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 xl:grid-cols-3">
              <SectionCard
                icon={<ListChecks className="h-5 w-5 text-destructive" />}
                title="Must Do"
                description="Overdue tasks and higher-priority tasks due today."
                items={candidates.mustDo}
                empty="No urgent tasks. Pick one useful thing and keep the day light."
              />
              <SectionCard
                icon={<CheckCircle2 className="h-5 w-5 text-primary" />}
                title="Should Do"
                description="Helpful next actions, goals, and money reminders."
                items={candidates.shouldDo}
                empty="Nothing pressing here. Nice little pocket of breathing room."
              />
              <SectionCard
                icon={<Lightbulb className="h-5 w-5 text-warning" />}
                title="Could Do"
                description="Optional tasks, recent notes, and savings nudges."
                items={candidates.couldDo}
                empty="No optional ideas yet. Add a custom focus if something is on your mind."
              />
            </div>

            {habitsLoaded && habitsToday.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Habits Today
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {habitsToday.filter((h) => h.done).length}/{habitsToday.length} done
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {habitsToday.map((habit) => (
                      <button
                        key={habit.id}
                        className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all hover:border-primary/50 ${habit.done ? "bg-muted/50" : ""}`}
                        onClick={() => toggleHabit(habit)}
                      >
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all"
                          style={habit.done ? { background: habit.color, borderColor: habit.color } : { borderColor: habit.color }}
                        >
                          {habit.done && <Check className="h-3 w-3 text-white" />}
                        </span>
                        <span className={`text-sm font-medium leading-tight ${habit.done ? "line-through text-muted-foreground" : ""}`}>
                          {habit.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <SectionCard
                icon={<Clock className="h-5 w-5 text-primary" />}
                title="Upcoming Deadlines"
                description="Tasks and goals due in the next 14 days."
                items={candidates.upcomingDeadlines}
                empty="No deadlines coming up soon."
              />
              <SectionCard
                icon={<CalendarDays className="h-5 w-5 text-primary" />}
                title="Calendar Today"
                description="Events scheduled for today."
                items={candidates.calendarToday}
                empty="No calendar events today."
              />
              <SectionCard
                icon={<FileText className="h-5 w-5 text-primary" />}
                title="Quick Notes"
                description="Notes updated in the last week."
                items={candidates.quickNotes}
                empty="No recent notes yet."
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  End of Day Reflection
                </CardTitle>
                <CardDescription>Capture the lesson while it is still fresh.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  <ReflectionField
                    label="What went well?"
                    value={reflection.reflection_went_well}
                    onChange={(value) => setReflection((prev) => ({ ...prev, reflection_went_well: value }))}
                  />
                  <ReflectionField
                    label="What did not?"
                    value={reflection.reflection_did_not_go_well}
                    onChange={(value) => setReflection((prev) => ({ ...prev, reflection_did_not_go_well: value }))}
                  />
                  <ReflectionField
                    label="Improve tomorrow"
                    value={reflection.reflection_improve_tomorrow}
                    onChange={(value) => setReflection((prev) => ({ ...prev, reflection_improve_tomorrow: value }))}
                  />
                </div>
                <Button onClick={saveReflection} disabled={saveState === "saving"} className="gap-2">
                  {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Reflection
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving
      </span>
    )
  }
  if (state === "saved") {
    return <span className="text-xs text-muted-foreground">Saved</span>
  }
  if (state === "error") {
    return <span className="text-xs text-destructive">Save failed</span>
  }
  return null
}

function ReflectionField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} />
    </div>
  )
}

function SectionCard({
  icon,
  title,
  description,
  items,
  empty,
}: {
  icon: ReactNode
  title: string
  description: string
  items: TodayItem[]
  empty: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <SectionList title={title} items={items} empty={empty} hideTitle compact />
      </CardContent>
    </Card>
  )
}

function SectionList({
  title,
  items,
  empty,
  action,
  compact = false,
  hideTitle = false,
}: {
  title: string
  items: TodayItem[]
  empty: string
  action?: (item: TodayItem) => ReactNode
  compact?: boolean
  hideTitle?: boolean
}) {
  if (items.length === 0) {
    return <EmptyPanel title={title} description={empty} />
  }

  return (
    <div className="space-y-2">
      {!hideTitle && <p className="text-sm font-medium">{title}</p>}
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
          <Link href={item.href} className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={`truncate font-medium ${compact ? "text-sm" : ""}`}>{item.title}</p>
              <Badge variant="outline">{sourceLabel(item.source_type)}</Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {item.subtitle || formatDate(item.date) || "Open in LifeSort"}
            </p>
          </Link>
          {action?.(item)}
        </div>
      ))}
    </div>
  )
}

function EmptyPanel({
  icon,
  title,
  description,
}: {
  icon?: ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="mt-1">{description}</p>
        </div>
      </div>
    </div>
  )
}
