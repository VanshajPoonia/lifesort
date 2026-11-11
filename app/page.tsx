"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Flame,
  GripVertical,
  Inbox,
  Lightbulb,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DomainTodayOverview } from "@/components/domain-today-overview"
import { useDomainFocus } from "@/components/domain-focus-provider"
import { OnboardingModal } from "@/components/onboarding-modal"
import { SortableList } from "@/components/sortable-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

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
  life_area_id: string | null
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
  life_area_id?: string | null
  // Only past-due tasks carry these, so a decision on them can be undone.
  status?: string | null
  email_reminder?: boolean | null
}

type TodayPlan = {
  id: string | null
  plan_date: string
  focus_items: TodayItem[]
  today_item_order?: string[]
  energy_level: "low" | "medium" | "high"
  available_focus_minutes: number | null
  mood: string
  day_type: "normal" | "busy" | "travel" | "sick" | "school" | "work-heavy" | "recovery"
  reflection_went_well: string
  reflection_did_not_go_well: string
  reflection_improve_tomorrow: string
}

type TodayTab = "today" | "week"

type WeekTask = {
  id: number | string
  title: string
  priority?: string | null
  completed?: boolean
  due_date?: string | null
  description?: string | null
}

type CapacityForm = {
  energy_level: TodayPlan["energy_level"]
  available_focus_minutes: string
  mood: string
  day_type: TodayPlan["day_type"]
}

type CapacitySummary = {
  recommended_focus_count: number
  estimated_task_capacity: number
  overload: boolean
  warnings: Array<{ type: string; message: string }>
}

type TodayResponse = {
  plan: TodayPlan
  capacity: CapacitySummary
  summary: {
    focusItems: number
    dueOrOverdueTasks: number
    dueOrOverdueItems: number
    highPriorityDueTasks: number
    calendarToday: number
  }
  candidates: {
    todayToDo: TodayItem[]
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

type Decision = "today" | "later" | "done" | "let_go"

const emptyCandidates: TodayResponse["candidates"] = {
  todayToDo: [],
  focusSuggestions: [],
  mustDo: [],
  shouldDo: [],
  couldDo: [],
  upcomingDeadlines: [],
  calendarToday: [],
  quickNotes: [],
  unavailable: [],
}

const emptySummary: TodayResponse["summary"] = {
  focusItems: 0,
  dueOrOverdueTasks: 0,
  dueOrOverdueItems: 0,
  highPriorityDueTasks: 0,
  calendarToday: 0,
}

const emptyReflection = {
  reflection_went_well: "",
  reflection_did_not_go_well: "",
  reflection_improve_tomorrow: "",
}

const defaultCapacity: CapacityForm = {
  energy_level: "medium",
  available_focus_minutes: "",
  mood: "",
  day_type: "normal",
}

const energyOptions: Array<{ value: CapacityForm["energy_level"]; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Okay" },
  { value: "high", label: "Good" },
]

const decisionOptions: Array<{ value: Decision; label: string }> = [
  { value: "today", label: "Today" },
  { value: "later", label: "Later" },
  { value: "done", label: "Done" },
  { value: "let_go", label: "Let go" },
]

const LAST_VISIT_KEY = "lifesort:today:last-visit"
const FRESH_START_DISMISSED_KEY = "lifesort:today:fresh-start-dismissed"
// A pile this big, or coming back after this many days, earns a fresh-start offer.
const BIG_PILE = 6
const AWAY_DAYS = 3
const WRAP_UP_HOUR = 17
const DECISIONS_PREVIEW = 5

function localDateString() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function dateString(date: Date) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function weekStart(date = new Date()) {
  const start = new Date(date)
  const day = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - day)
  start.setHours(0, 0, 0, 0)
  return start
}

function daysBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`).getTime()
  const end = new Date(`${to}T00:00:00`).getTime()
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.round((end - start) / 86_400_000)
}

function normalizeTodayTab(value: string | null): TodayTab {
  return value === "week" ? "week" : "today"
}

function formatDate(value?: string | null) {
  if (!value) return null
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function greetingFor(hour: number) {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Private mode or blocked storage. The page works without it.
  }
}

function sourceLabel(sourceType: string) {
  const labels: Record<string, string> = {
    task: "Task",
    goal: "Goal",
    calendar: "Calendar",
    note: "Note",
    budget: "Budget",
    wishlist: "Wishlist",
    project: "Project",
    habit: "Habit",
    inbox: "Inbox",
    waiting: "Waiting For",
    commitment: "Commitment",
    maintenance: "Maintenance",
    custom: "Your focus",
  }
  return labels[sourceType] || sourceType
}

function isTask(item: TodayItem) {
  return item.source_type === "task" && Boolean(item.source_id)
}

function isPastDueTask(item: TodayItem, planDate: string) {
  return isTask(item) && Boolean(item.date) && String(item.date).slice(0, 10) < planDate
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

function focusMinutesValue(value: string) {
  if (!value.trim()) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1440, parsed)) : null
}

function baseRecommendedFocus(energyLevel: CapacityForm["energy_level"]) {
  if (energyLevel === "low") return 1
  if (energyLevel === "high") return 3
  return 2
}

function deriveCapacitySummary(input: {
  capacity: CapacityForm
  focusCount: number
  dueOrOverdueItems: number
  highPriorityDueTasks: number
}): CapacitySummary {
  const focusMinutes = focusMinutesValue(input.capacity.available_focus_minutes)
  let recommended = baseRecommendedFocus(input.capacity.energy_level)
  if (focusMinutes !== null) {
    if (focusMinutes < 60) recommended = Math.min(recommended, 1)
    else if (focusMinutes < 120) recommended = Math.min(recommended, 2)
  }
  if (["busy", "travel", "sick", "recovery"].includes(input.capacity.day_type)) {
    recommended = Math.min(recommended, 2)
  }

  const estimatedTaskCapacity =
    focusMinutes === null ? recommended + 2 : Math.max(1, Math.min(8, Math.floor(focusMinutes / 45)))
  const warnings: CapacitySummary["warnings"] = []

  if (input.focusCount > recommended) {
    warnings.push({
      type: "focus_count",
      message: `You picked ${input.focusCount} focus items; ${recommended} may fit better today.`,
    })
  }
  if (input.dueOrOverdueItems > estimatedTaskCapacity) {
    warnings.push({
      type: "task_load",
      message: `${input.dueOrOverdueItems} due or overdue items may be too much for the focus time available.`,
    })
  }
  if (input.highPriorityDueTasks >= 3) {
    warnings.push({
      type: "high_priority",
      message: `${input.highPriorityDueTasks} high-priority due or overdue items may make today feel overloaded.`,
    })
  }

  return {
    recommended_focus_count: recommended,
    estimated_task_capacity: estimatedTaskCapacity,
    overload: warnings.length > 0,
    warnings,
  }
}

function focusHint(recommended: number) {
  if (recommended <= 1) return "One thing is plenty today."
  if (recommended === 2) return "Two things make a good day."
  return "Room for up to three things today."
}

function decisionBody(decision: Decision, id: string, planDate: string): Record<string, unknown> {
  if (decision === "today") return { id, due_date: planDate }
  if (decision === "later") return { id, due_date: null, status: "someday" }
  if (decision === "done") return { id, completed: true }
  return { id, status: "cancelled" }
}

// Undo sends back only fields the item carried, so it never blanks data it never saw.
function undoBody(decision: Decision, item: TodayItem): Record<string, unknown> {
  const id = item.source_id
  const dueDate = item.date ? String(item.date).slice(0, 10) : null
  const status = item.status || "next"
  if (decision === "done") return { id, completed: false }
  if (decision === "let_go") return { id, status }
  if (decision === "today") return { id, due_date: dueDate }
  return {
    id,
    due_date: dueDate,
    status,
    ...(typeof item.email_reminder === "boolean" ? { email_reminder: item.email_reminder } : {}),
  }
}

function decisionToast(decision: Decision, items: TodayItem[]) {
  const count = items.length
  const what = count === 1 ? `"${items[0].title}"` : `${count} tasks`
  if (decision === "today") return { title: `Moved ${what} to today` }
  if (decision === "later") return { title: `Moved ${what} to Later`, description: "No date for now. It's in Tasks under Someday." }
  if (decision === "done") return { title: count === 1 ? "Done" : `${count} tasks done`, description: count === 1 ? items[0].title : undefined }
  return { title: `Let go of ${what}`, description: "It stays in Tasks as cancelled." }
}

export default function TodayPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { focus: domainFocus } = useDomainFocus()
  const [planDate] = useState(localDateString)
  // Derived directly from the URL rather than mirrored into its own state.
  const activeTab: TodayTab = normalizeTodayTab(searchParams.get("tab"))
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [focusSession, setFocusSession] = useState<TodayItem | null>(null)
  const [plan, setPlan] = useState<TodayPlan | null>(null)
  const [candidates, setCandidates] = useState<TodayResponse["candidates"]>(emptyCandidates)
  const [todaySummary, setTodaySummary] = useState<TodayResponse["summary"]>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [todayOrderState, setTodayOrderState] = useState<SaveState>("idle")
  const [customFocus, setCustomFocus] = useState("")
  const [reflection, setReflection] = useState(emptyReflection)
  const [capacity, setCapacity] = useState<CapacityForm>(defaultCapacity)
  const [habitsToday, setHabitsToday] = useState<HabitToday[]>([])
  const [inboxCount, setInboxCount] = useState(0)
  const [aiPlan, setAiPlan] = useState<AiTodayPlanResult | null>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [aiError, setAiError] = useState("")
  const [createTaskTitle, setCreateTaskTitle] = useState("")
  const [creatingTask, setCreatingTask] = useState(false)
  // Rows hidden the moment you act on them, before the server confirms.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set())
  const [lastVisit, setLastVisit] = useState<string | null>(null)
  const [freshStartDismissed, setFreshStartDismissed] = useState(false)
  const [showAllDecisions, setShowAllDecisions] = useState(false)
  const [wrapUpOpen, setWrapUpOpen] = useState(() => new Date().getHours() >= WRAP_UP_HOUR)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, router, user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        if (sessionStorage.getItem("onboarding_completed") === "true") return
        const response = await fetch("/api/onboarding")
        if (!response.ok || cancelled) return
        const data = await response.json()
        if (cancelled) return
        if (data.onboarding_completed === false) setShowOnboarding(true)
        else sessionStorage.setItem("onboarding_completed", "true")
      } catch (error) {
        console.error("Error checking onboarding:", error)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetch("/api/inbox?status=unsorted&limit=100")
      .then((response) => (response.ok ? response.json() : []))
      .then((items: unknown) => { if (!cancelled) setInboxCount(Array.isArray(items) ? items.length : 0) })
      .catch(() => {
        // The Inbox nudge is optional.
      })
    return () => { cancelled = true }
  }, [user])

  const switchTab = (tab: TodayTab) => {
    router.replace(tab === "week" ? "/?tab=week" : "/", { scroll: false })
  }

  const applyTodayData = useCallback((data: TodayResponse) => {
    setPlan(data.plan)
    setCandidates(data.candidates || emptyCandidates)
    setTodaySummary(data.summary || { ...emptySummary, focusItems: data.plan.focus_items?.length || 0 })
    setCapacity({
      energy_level: data.plan.energy_level || "medium",
      available_focus_minutes: data.plan.available_focus_minutes === null || data.plan.available_focus_minutes === undefined
        ? ""
        : String(data.plan.available_focus_minutes),
      mood: data.plan.mood || "",
      day_type: data.plan.day_type || "normal",
    })
    setReflection({
      reflection_went_well: data.plan.reflection_went_well || "",
      reflection_did_not_go_well: data.plan.reflection_did_not_go_well || "",
      reflection_improve_tomorrow: data.plan.reflection_improve_tomorrow || "",
    })
  }, [])

  // Pure fetch, no setState. Callers own loading and error state so the
  // mount effect can ignore a stale response.
  const fetchToday = useCallback(async (): Promise<TodayResponse> => {
    const response = await fetch(`/api/today-plan?date=${planDate}`)
    if (!response.ok) throw new Error("Failed to load today plan")
    return (await response.json()) as TodayResponse
  }, [planDate])

  const refreshToday = useCallback(async () => {
    try {
      applyTodayData(await fetchToday())
      setLoadError("")
      return true
    } catch (error) {
      console.error("Failed to refresh today plan:", error)
      return false
    }
  }, [applyTodayData, fetchToday])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchToday()
      .then((data) => {
        if (cancelled) return
        applyTodayData(data)
        setLoadError("")
        // Read the last visit before overwriting it, so a return after days away is noticed once.
        setLastVisit(readStorage(LAST_VISIT_KEY))
        setFreshStartDismissed(readStorage(FRESH_START_DISMISSED_KEY) === planDate)
        writeStorage(LAST_VISIT_KEY, planDate)
      })
      .catch((error) => {
        if (cancelled) return
        console.error("Failed to load today plan:", error)
        setLoadError("Today couldn't be loaded.")
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fetchToday, user, applyTodayData, planDate])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const [habitsRes, checkinsRes] = await Promise.all([
          fetch("/api/habits"),
          fetch(`/api/habits/checkins?date=${planDate}`),
        ])
        if (!habitsRes.ok || !checkinsRes.ok) return
        type RawHabit = { id: number; name: string; color: string; is_active: boolean; frequency: string; custom_days: number[]; target_count: number; life_area_id?: number | string | null }
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
        const nextHabitsToday = active.map((h) => {
          const count = checkinMap.get(h.id) ?? 0
          return {
            id: h.id,
            name: h.name,
            color: h.color || "#2563EB",
            target_count: h.target_count,
            done: count >= h.target_count,
            count,
            life_area_id: h.life_area_id != null ? String(h.life_area_id) : null,
          }
        })
        if (!cancelled) setHabitsToday(nextHabitsToday)
      } catch {
        // Habits are optional on Today.
      }
    })()
    return () => { cancelled = true }
  }, [planDate, user])

  const toggleHabit = async (habit: HabitToday) => {
    const newCount = habit.done ? 0 : habit.target_count
    setHabitsToday((prev) => prev.map((h) => h.id === habit.id ? { ...h, done: !habit.done, count: newCount } : h))
    try {
      const response = await fetch("/api/habits/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habit_id: habit.id, checkin_date: planDate, count: newCount }),
      })
      if (!response.ok) throw new Error("Check-in failed")
    } catch {
      setHabitsToday((prev) => prev.map((h) => h.id === habit.id ? habit : h))
    }
  }

  const savePlan = useCallback(
    async (focusItems: TodayItem[], nextReflection = reflection, nextCapacity = capacity) => {
      setSaveState("saving")
      try {
        const response = await fetch("/api/today-plan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan_date: planDate,
            focus_items: focusItems.map(toFocusItem),
            energy_level: nextCapacity.energy_level,
            available_focus_minutes: focusMinutesValue(nextCapacity.available_focus_minutes),
            mood: nextCapacity.mood,
            day_type: nextCapacity.day_type,
            ...nextReflection,
          }),
        })

        if (!response.ok) throw new Error("Failed to save today plan")
        const data = await response.json()
        setPlan((current) => ({
          ...(current || {
            id: null,
            plan_date: planDate,
            focus_items: [],
            energy_level: nextCapacity.energy_level,
            available_focus_minutes: focusMinutesValue(nextCapacity.available_focus_minutes),
            mood: nextCapacity.mood,
            day_type: nextCapacity.day_type,
            ...emptyReflection,
          }),
          ...data.plan,
        }))
        if (data.plan) {
          setCapacity({
            energy_level: data.plan.energy_level || nextCapacity.energy_level,
            available_focus_minutes: data.plan.available_focus_minutes === null || data.plan.available_focus_minutes === undefined
              ? ""
              : String(data.plan.available_focus_minutes),
            mood: data.plan.mood || "",
            day_type: data.plan.day_type || nextCapacity.day_type,
          })
        }
        setSaveState("saved")
      } catch (error) {
        console.error("Failed to save today plan:", error)
        setSaveState("error")
      }
    },
    [capacity, planDate, reflection]
  )

  const focusItems = useMemo(() => plan?.focus_items || [], [plan?.focus_items])
  const focusIds = useMemo(() => new Set(focusItems.map((item) => item.id)), [focusItems])
  const capacitySummary = useMemo(
    () => deriveCapacitySummary({
      capacity,
      focusCount: focusItems.length,
      dueOrOverdueItems: todaySummary.dueOrOverdueItems || todaySummary.dueOrOverdueTasks,
      highPriorityDueTasks: todaySummary.highPriorityDueTasks,
    }),
    [capacity, focusItems.length, todaySummary.dueOrOverdueItems, todaySummary.dueOrOverdueTasks, todaySummary.highPriorityDueTasks],
  )
  // Due today and coming up soon, minus focus items and past-due tasks (those get their own section).
  const dayItems = useMemo(() => {
    const seen = new Set<string>()
    const base = [...candidates.todayToDo, ...candidates.shouldDo].filter((item) => {
      if (seen.has(item.id) || focusIds.has(item.id) || isPastDueTask(item, planDate)) return false
      seen.add(item.id)
      return true
    })
    const order = plan?.today_item_order || []
    if (order.length === 0) return base
    const byId = new Map(base.map((item) => [item.id, item]))
    const ordered = order.map((id) => byId.get(id)).filter((item): item is TodayItem => Boolean(item))
    const orderedIds = new Set(ordered.map((item) => item.id))
    return [...ordered, ...base.filter((item) => !orderedIds.has(item.id))]
  }, [candidates.shouldDo, candidates.todayToDo, focusIds, plan?.today_item_order, planDate])

  const inDomain = (lifeAreaId?: string | null) => !domainFocus || !lifeAreaId || lifeAreaId === domainFocus.id
  const isVisible = (item: TodayItem) => !hiddenIds.has(item.id) && inDomain(item.life_area_id)
  const visibleFocus = focusItems.filter((item) => !hiddenIds.has(item.id))
  const visibleDayItems = dayItems.filter(isVisible)
  const needsDecision = candidates.todayToDo.filter(
    (item) => isPastDueTask(item, planDate) && !focusIds.has(item.id) && isVisible(item),
  )
  const decisionsShown = showAllDecisions ? needsDecision : needsDecision.slice(0, DECISIONS_PREVIEW)
  const anytimeItems = candidates.couldDo.filter((item) => isTask(item) && !focusIds.has(item.id) && isVisible(item))
  const visibleHabits = habitsToday.filter((habit) => inDomain(habit.life_area_id))
  const calendarToday = candidates.calendarToday.filter((item) => inDomain(item.life_area_id))
  const awayDays = lastVisit ? daysBetween(lastVisit, planDate) : 0
  const showFreshStart =
    !freshStartDismissed &&
    needsDecision.length > 0 &&
    (needsDecision.length >= BIG_PILE || awayDays >= AWAY_DAYS)
  // energy_level always has a default, so only treat it as chosen once a plan exists for today.
  const energyChosen = Boolean(plan?.id)
  const canAddFocus = focusItems.length < 3

  const unhide = (ids: string[]) => {
    setHiddenIds((current) => {
      const next = new Set(current)
      ids.forEach((id) => next.delete(id))
      return next
    })
  }

  const putTask = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error("Task update failed")
  }

  const undoDecision = async (decision: Decision, items: TodayItem[]) => {
    const results = await Promise.allSettled(items.map((item) => putTask(undoBody(decision, item))))
    const failed = results.filter((result) => result.status === "rejected").length
    await refreshToday()
    if (failed > 0) {
      toast({
        title: "Couldn't undo everything",
        description: `${failed} task${failed === 1 ? "" : "s"} kept the new state.`,
        variant: "destructive",
      })
    }
  }

  // Returns how many tasks were saved.
  const decide = async (items: TodayItem[], decision: Decision) => {
    const tasks = items.filter(isTask)
    if (tasks.length === 0) return 0
    const ids = tasks.map((item) => item.id)
    setHiddenIds((current) => new Set([...current, ...ids]))

    const results = await Promise.allSettled(
      tasks.map((item) => putTask(decisionBody(decision, item.source_id as string, planDate))),
    )
    const saved = tasks.filter((_, index) => results[index].status === "fulfilled")
    const failedIds = tasks.filter((_, index) => results[index].status === "rejected").map((item) => item.id)

    // Fresh data puts each item where it now belongs. "Today" moves it into today's list.
    const refreshed = await refreshToday()
    unhide(refreshed ? ids : failedIds)

    if (saved.length === 0) {
      toast({ title: "Couldn't save that", description: "Nothing changed. Try again in a moment.", variant: "destructive" })
      return 0
    }
    const copy = decisionToast(decision, saved)
    toast({
      ...copy,
      // Long enough to read and reach Undo. The 5s default closed before a click in testing.
      duration: 10_000,
      ...(failedIds.length > 0 ? { description: `${failedIds.length} couldn't be saved. Try those again.` } : {}),
      action: (
        <ToastAction altText="Undo" onClick={() => void undoDecision(decision, saved)}>
          Undo
        </ToastAction>
      ),
    })
    return saved.length
  }

  const dismissFreshStart = () => {
    setFreshStartDismissed(true)
    writeStorage(FRESH_START_DISMISSED_KEY, planDate)
  }

  const startFresh = async () => {
    dismissFreshStart()
    await decide(needsDecision, "later")
  }

  const setEnergy = async (energy: CapacityForm["energy_level"]) => {
    if (energy === capacity.energy_level && energyChosen) return
    const next = { ...capacity, energy_level: energy }
    setCapacity(next)
    await savePlan(focusItems, reflection, next)
  }

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

  const completeFocusItem = async (item: TodayItem) => {
    const saved = await decide([item], "done")
    if (saved > 0) await removeFocus(item.id)
  }

  const addCustomFocus = async () => {
    const title = customFocus.trim()
    if (!title || focusItems.length >= 3) return
    const item: TodayItem = {
      id: `custom-${Date.now()}`,
      source_type: "custom",
      source_id: null,
      title,
      href: "/",
      custom: true,
    }
    setCustomFocus("")
    await addFocus(item)
  }

  const appendNotesToTask = async (item: TodayItem, notes: string) => {
    if (item.source_type !== "task" || !item.source_id || !notes.trim()) return
    const response = await fetch("/api/tasks")
    if (!response.ok) throw new Error("Could not load task")
    const tasks = await response.json()
    const task = Array.isArray(tasks) ? tasks.find((candidate) => String(candidate.id) === String(item.source_id)) : null
    const existing = typeof task?.description === "string" ? task.description.trim() : ""
    const sessionNote = `Focus session - ${item.title}\n${notes.trim()}`
    const description = existing ? `${existing}\n\n${sessionNote}` : sessionNote
    const update = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.source_id, description }),
    })
    if (!update.ok) throw new Error("Could not append notes")
    toast({ title: "Notes added", description: "Session notes were added to the task." })
  }

  const appendNotesToJournal = async (item: TodayItem, notes: string) => {
    if (!notes.trim()) return
    const response = await fetch(`/api/journal/${planDate}`)
    const data = response.ok ? await response.json().catch(() => null) : null
    const entry = data?.entry || {}
    const existing = typeof entry.notes_from_today === "string" ? entry.notes_from_today.trim() : ""
    const sessionNote = `Focus session - ${item.title}\n${notes.trim()}`
    const notes_from_today = existing ? `${existing}\n\n${sessionNote}` : sessionNote
    const update = await fetch(`/api/journal/${planDate}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mood: entry.mood ?? null,
        gratitude: Array.isArray(entry.gratitude) ? entry.gratitude : ["", "", ""],
        affirmation_text: entry.affirmation_text ?? null,
        affirmation_pinned_until: entry.affirmation_pinned_until ?? null,
        work_todo: Array.isArray(entry.work_todo) ? entry.work_todo : [],
        personal_todo: Array.isArray(entry.personal_todo) ? entry.personal_todo : [],
        family_todo: Array.isArray(entry.family_todo) ? entry.family_todo : [],
        what_went_well: entry.what_went_well ?? null,
        what_could_be_better: entry.what_could_be_better ?? null,
        notes_from_today,
        how_to_make_tomorrow_better: entry.how_to_make_tomorrow_better ?? null,
        work_stars: entry.work_stars ?? null,
        work_stars_note: entry.work_stars_note ?? null,
        personal_stars: entry.personal_stars ?? null,
        personal_stars_note: entry.personal_stars_note ?? null,
        family_stars: entry.family_stars ?? null,
        family_stars_note: entry.family_stars_note ?? null,
        tomorrow_focus: entry.tomorrow_focus ?? null,
        tomorrow_avoid: entry.tomorrow_avoid ?? null,
        energy_level: entry.energy_level ?? null,
        tags: Array.isArray(entry.tags) ? entry.tags : [],
      }),
    })
    if (!update.ok) throw new Error("Could not append journal notes")
    toast({ title: "Notes added", description: "Session notes were added to today's journal." })
  }

  const completeFocusSession = async (item: TodayItem) => {
    if (isTask(item)) await completeFocusItem(item)
    setFocusSession(null)
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
          capacity: {
            energy_level: capacity.energy_level,
            available_focus_minutes: focusMinutesValue(capacity.available_focus_minutes),
            mood: capacity.mood,
            day_type: capacity.day_type,
            recommended_focus_count: capacitySummary.recommended_focus_count,
            overload: capacitySummary.overload,
            warnings: capacitySummary.warnings,
          },
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
      ...candidates.todayToDo,
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
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, priority: "medium" }),
      })
      if (!response.ok) throw new Error("Task creation failed")
      setCreateTaskTitle("")
      toast({ title: "Task added", description: title })
      await refreshToday()
    } catch {
      toast({ title: "Couldn't add the task", description: "Try again in a moment.", variant: "destructive" })
    } finally {
      setCreatingTask(false)
    }
  }

  const handleDayReorder = async (orderedItems: TodayItem[]) => {
    const previousCandidates = candidates
    const previousOrder = plan?.today_item_order || []
    const orderedIds = orderedItems.map((item) => item.id)
    const todayToDoIds = new Set(previousCandidates.todayToDo.map((item) => item.id))
    const orderedTodayToDo = orderedItems.filter((item) => todayToDoIds.has(item.id))
    const orderedTodayToDoIds = new Set(orderedTodayToDo.map((item) => item.id))
    setCandidates((current) => ({
      ...current,
      todayToDo: [
        ...orderedTodayToDo,
        ...current.todayToDo.filter((item) => !orderedTodayToDoIds.has(item.id)),
      ],
      mustDo: orderedTodayToDo.length ? orderedTodayToDo.slice(0, 12) : current.mustDo,
    }))
    setPlan((current) => (current ? { ...current, today_item_order: orderedIds } : current))
    setTodayOrderState("saving")

    try {
      const response = await fetch("/api/today-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_date: planDate,
          today_item_order: orderedIds,
        }),
      })

      if (!response.ok) throw new Error("Today order could not be saved.")
      const data = await response.json().catch(() => null)
      if (data?.plan?.today_item_order) {
        setPlan((current) => (current ? { ...current, today_item_order: data.plan.today_item_order } : current))
      }
      setTodayOrderState("saved")
      window.setTimeout(() => setTodayOrderState("idle"), 1200)
    } catch (error) {
      console.error("Failed to save today order:", error)
      setCandidates(previousCandidates)
      setPlan((current) => (current ? { ...current, today_item_order: previousOrder } : current))
      setTodayOrderState("error")
    }
  }

  if (authLoading || !user) {
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
  const longDate = new Date(`${planDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  const sectionTitle = "text-base font-semibold tracking-tight text-foreground"
  const sectionCount = "ml-2 text-sm font-normal tabular-nums text-muted-foreground"
  const sectionLink =
    "inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary transition-colors hover:text-primary-hover"
  const listShell = "divide-y divide-border/70 overflow-hidden rounded-xl border bg-card"
  const emptyShell = "rounded-xl border border-dashed bg-card/60 p-5 text-sm text-muted-foreground"
  const segment = (selected: boolean) =>
    cn(
      "h-8 rounded-md px-3 text-sm font-medium transition-colors duration-150",
      selected ? "bg-primary-tint text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
    )

  return (
    <DashboardLayout>
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false)
          try {
            sessionStorage.setItem("onboarding_completed", "true")
            sessionStorage.removeItem("sidebar_prefs")
          } catch {
            // Storage blocked. Onboarding is still saved on the server.
          }
          void refreshToday()
        }}
      />

      <div className="section-enter mx-auto w-full max-w-6xl space-y-6" aria-busy={loading}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              {greetingFor(new Date().getHours())}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{longDate}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2 bg-card">
              <Link href={`/journal?date=${planDate}`}>
                <BookOpenText className="h-4 w-4" aria-hidden="true" />
                Journal
              </Link>
            </Button>
            {activeTab === "today" && (
              <Button type="button" className="gap-2" onClick={generateAiPlan} disabled={generatingAi || loading || Boolean(loadError)}>
                {generatingAi ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                Plan my day
              </Button>
            )}
          </div>
        </header>

        <div role="group" aria-label="View" className="inline-flex rounded-lg border bg-card p-1">
          <button type="button" aria-pressed={activeTab === "today"} className={segment(activeTab === "today")} onClick={() => switchTab("today")}>
            Today
          </button>
          <button type="button" aria-pressed={activeTab === "week"} className={segment(activeTab === "week")} onClick={() => switchTab("week")}>
            This week
          </button>
        </div>

        {activeTab === "week" ? (
          <WeekPlanner />
        ) : loadError ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">{loadError}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Check your connection and try again.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => void refreshToday()}>
              Try again
            </Button>
          </div>
        ) : loading ? (
          <TodaySkeleton />
        ) : (
          <>
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-6">
              <div className="min-w-0 space-y-8">
                {showFreshStart && (
                  <section aria-labelledby="today-fresh-start" className="rounded-xl border border-primary/20 bg-primary-tint p-4 sm:p-5">
                    <h2 id="today-fresh-start" className={sectionTitle}>
                      {awayDays >= AWAY_DAYS ? "Welcome back. Want a fresh start?" : "Want a fresh start?"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {needsDecision.length === 1
                        ? "1 task went past its date. Move it to Later and start today clean."
                        : `${needsDecision.length} tasks went past their dates. Move them to Later and start today clean.`}{" "}
                      Nothing gets deleted, and you can undo.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void startFresh()}>
                        Start fresh
                      </Button>
                      <Button size="sm" variant="ghost" onClick={dismissFreshStart}>
                        I&apos;ll sort them myself
                      </Button>
                    </div>
                  </section>
                )}

                <section aria-labelledby="today-energy" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 id="today-energy" className="text-sm font-medium text-foreground">How&apos;s your energy?</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {energyChosen ? focusHint(capacitySummary.recommended_focus_count) : "One tap. It sets how much to plan for."}
                    </p>
                  </div>
                  <div role="group" aria-label="Energy today" className="inline-flex w-fit shrink-0 rounded-lg border bg-card p-1">
                    {energyOptions.map((option) => {
                      const selected = energyChosen && capacity.energy_level === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={selected}
                          className={segment(selected)}
                          onClick={() => void setEnergy(option.value)}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </section>

                {(generatingAi || aiPlan || aiError) && (
                  <Card className="rounded-xl">
                    <CardHeader>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                            Your day, suggested
                          </CardTitle>
                          <CardDescription>
                            Based on your tasks, habits and calendar. Your task titles are shared with the AI. Nothing changes until you tap.
                          </CardDescription>
                        </div>
                        {(aiPlan || aiError) && !generatingAi && (
                          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => { setAiPlan(null); setAiError("") }}>
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {generatingAi && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          Planning your day...
                        </div>
                      )}
                      {aiError && !generatingAi && <p className="text-sm text-destructive">{aiError}</p>}
                      {aiPlan && !generatingAi && (
                        <>
                          {aiPlan.top_priorities.length > 0 && (
                            <div>
                              <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                                <Star className="h-4 w-4 text-primary" aria-hidden="true" />
                                Worth focusing on
                              </p>
                              <div className="space-y-2">
                                {aiPlan.top_priorities.map((priority, i) => (
                                  <div key={priority.id || i} className="flex items-start justify-between gap-3 rounded-md border p-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium">{priority.title}</p>
                                      <p className="mt-0.5 text-xs text-muted-foreground">{priority.reason}</p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant={focusIds.has(priority.id) ? "secondary" : "outline"}
                                      disabled={focusIds.has(priority.id) || !canAddFocus}
                                      onClick={() => void addPriorityToFocus(priority.id)}
                                    >
                                      {focusIds.has(priority.id) ? "Added" : "Add to focus"}
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {aiPlan.schedule_blocks.length > 0 && (
                            <div>
                              <p className="mb-3 flex items-center gap-2 text-sm font-medium">
                                <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                                A rough shape for the day
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
                                <X className="h-4 w-4" aria-hidden="true" />
                                Fine to leave for later
                              </p>
                              <div className="space-y-2">
                                {aiPlan.defer.map((item, i) => (
                                  <div key={item.id || i} className="rounded-md border border-dashed p-3">
                                    <p className="text-sm">{item.title}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {aiPlan.risks.length > 0 && (
                            <div>
                              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                                <AlertCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                Watch out for
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
                              <Lightbulb className="h-4 w-4 text-yellow-500" aria-hidden="true" />
                              A small win for today
                            </p>
                            <p className="text-sm text-muted-foreground">{aiPlan.small_win}</p>
                            {!createTaskTitle ? (
                              <Button variant="outline" size="sm" className="mt-2 gap-2" onClick={() => setCreateTaskTitle(aiPlan.small_win)}>
                                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                Make it a task
                              </Button>
                            ) : (
                              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                <Input
                                  value={createTaskTitle}
                                  onChange={(e) => setCreateTaskTitle(e.target.value)}
                                  placeholder="Task title"
                                  aria-label="Task title"
                                  onKeyDown={(e) => { if (e.key === "Enter") void createTaskFromSmallWin() }}
                                />
                                <Button
                                  onClick={() => void createTaskFromSmallWin()}
                                  disabled={creatingTask || !createTaskTitle.trim()}
                                  size="sm"
                                  className="gap-2"
                                >
                                  {creatingTask && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                                  Add task
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

                <section aria-labelledby="today-focus">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 id="today-focus" className={sectionTitle}>
                      Focus
                      <span className={sectionCount}>{visibleFocus.length}/3</span>
                    </h2>
                    <SaveStatus state={saveState} />
                  </div>
                  {visibleFocus.length > 0 && (
                    <ol className={listShell}>
                      {visibleFocus.map((item, index) => (
                        <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                          {isTask(item) ? (
                            <Checkbox
                              checked={false}
                              onCheckedChange={() => void completeFocusItem(item)}
                              aria-label={`Mark ${item.title} done`}
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[11px] font-semibold tabular-nums text-primary"
                            >
                              {index + 1}
                            </span>
                          )}
                          {item.custom ? (
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{sourceLabel(item.source_type)}</span>
                            </span>
                          ) : (
                            <Link href={item.href || "/tasks"} className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{sourceLabel(item.source_type)}</span>
                            </Link>
                          )}
                          <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={() => setFocusSession(item)}>
                            <Play className="h-3.5 w-3.5" aria-hidden="true" />
                            Start
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 shrink-0 text-muted-foreground"
                            onClick={() => void removeFocus(item.id)}
                            aria-label={`Remove ${item.title} from focus`}
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ol>
                  )}
                  {canAddFocus && (
                    <div className={cn("flex gap-2", visibleFocus.length > 0 && "mt-3")}>
                      <Input
                        value={customFocus}
                        onChange={(event) => setCustomFocus(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            void addCustomFocus()
                          }
                        }}
                        placeholder={visibleFocus.length === 0 ? "What matters most today?" : "Add another focus"}
                        aria-label="Add a focus for today"
                        className="bg-card"
                      />
                      <Button type="button" variant="outline" onClick={() => void addCustomFocus()} disabled={!customFocus.trim()} className="shrink-0 gap-1.5 bg-card">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        Add
                      </Button>
                    </div>
                  )}
                  {visibleFocus.length === 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Or tap <Target className="inline h-3 w-3 align-[-2px]" aria-label="the target" /> on anything in your list below.
                    </p>
                  )}
                </section>

                <section aria-labelledby="today-list">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 id="today-list" className={sectionTitle}>
                      Today
                      {visibleDayItems.length > 0 && <span className={sectionCount}>{visibleDayItems.length}</span>}
                    </h2>
                    <SaveStatus state={todayOrderState} />
                  </div>
                  {visibleDayItems.length === 0 ? (
                    <p className={emptyShell}>
                      Nothing is due today.{anytimeItems.length > 0 ? " Pull something from Anytime if you want to." : ""}
                    </p>
                  ) : (
                    <SortableList
                      items={visibleDayItems}
                      getLabel={(item) => item.title}
                      onReorder={handleDayReorder}
                      className={listShell}
                      renderItem={(item, { dragHandle, isDragging }) => (
                        <DayRow
                          item={item}
                          dragHandle={dragHandle}
                          isDragging={isDragging}
                          canFocus={canAddFocus}
                          onDone={(row) => void decide([row], "done")}
                          onFocus={(row) => void addFocus(row)}
                        />
                      )}
                    />
                  )}
                </section>

                {needsDecision.length > 0 && (
                  <section aria-labelledby="today-decisions">
                    <div className="mb-3">
                      <h2 id="today-decisions" className={sectionTitle}>
                        Needs a decision
                        <span className={sectionCount}>{needsDecision.length}</span>
                      </h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">These went past their date. Pick what happens next.</p>
                    </div>
                    <ul className={listShell}>
                      {decisionsShown.map((item) => (
                        <li key={item.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                          <Link href={item.href} className="min-w-0">
                            <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                            <span className="block text-xs text-muted-foreground">
                              {formatDate(item.date) ? `Was due ${formatDate(item.date)}` : "Past its date"}
                            </span>
                          </Link>
                          <div role="group" aria-label={`Decide on ${item.title}`} className="flex shrink-0 flex-wrap gap-1">
                            {decisionOptions.map((option) => (
                              <Button
                                key={option.value}
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 bg-card px-2.5 text-xs"
                                onClick={() => void decide([item], option.value)}
                              >
                                {option.label}
                              </Button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {needsDecision.length > DECISIONS_PREVIEW && (
                      <button
                        type="button"
                        className="mt-2 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                        onClick={() => setShowAllDecisions((current) => !current)}
                      >
                        {showAllDecisions ? "Show fewer" : `Show all ${needsDecision.length}`}
                      </button>
                    )}
                  </section>
                )}

                {anytimeItems.length > 0 && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <button type="button" className="group flex w-full items-center justify-between gap-3 rounded-md text-left">
                        <span>
                          <span className={sectionTitle}>Anytime</span>
                          <span className={sectionCount}>{anytimeItems.length}</span>
                          <span className="mt-0.5 block text-sm text-muted-foreground">Tasks with no date. Pull one in if you have room.</span>
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="collapsible-content">
                      <div className={cn(listShell, "mt-3")}>
                        {anytimeItems.map((item) => (
                          <DayRow
                            key={item.id}
                            item={item}
                            canFocus={canAddFocus}
                            onDone={(row) => void decide([row], "done")}
                            onFocus={(row) => void addFocus(row)}
                          />
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>

              <aside className="min-w-0 space-y-8" aria-label="Also today">
                <section aria-labelledby="today-calendar">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 id="today-calendar" className={sectionTitle}>Calendar</h2>
                    <Link href="/tasks?tab=calendar" className={sectionLink}>
                      Open
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                  {calendarToday.length === 0 ? (
                    <p className={emptyShell}>Nothing on your calendar today.</p>
                  ) : (
                    <ul className={listShell}>
                      {calendarToday.map((event) => (
                        <li key={event.id}>
                          <Link href={event.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50">
                            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-foreground">{event.title}</span>
                              {event.subtitle && <span className="block truncate text-xs text-muted-foreground">{event.subtitle}</span>}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section aria-labelledby="today-habits">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h2 id="today-habits" className={sectionTitle}>
                      Habits
                      {visibleHabits.length > 0 && (
                        <span className={sectionCount}>
                          {visibleHabits.filter((habit) => habit.done).length}/{visibleHabits.length}
                        </span>
                      )}
                    </h2>
                    <Link href="/tasks?tab=habits" className={sectionLink}>
                      Open
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                  {visibleHabits.length === 0 ? (
                    <p className={emptyShell}>No habits for today. Add one in Habits when you&apos;re ready.</p>
                  ) : (
                    <ul className={listShell}>
                      {visibleHabits.map((habit) => (
                        <li key={habit.id}>
                          <button
                            type="button"
                            aria-pressed={habit.done}
                            onClick={() => void toggleHabit(habit)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                          >
                            <span
                              aria-hidden="true"
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                              style={habit.done ? { background: habit.color, borderColor: habit.color } : { borderColor: habit.color }}
                            >
                              {habit.done && <Check className="h-3 w-3 text-white" />}
                            </span>
                            <span className={cn("min-w-0 flex-1 truncate text-sm font-medium text-foreground", habit.done && "text-muted-foreground line-through")}>
                              {habit.name}
                            </span>
                            <Flame className={cn("h-4 w-4 shrink-0", habit.done ? "text-orange-500" : "text-muted-foreground/40")} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {inboxCount > 0 && (
                  <Link
                    href="/inbox"
                    className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-foreground">
                        {inboxCount >= 100 ? "100+" : inboxCount} in your Inbox
                      </span>
                      <span className="block text-xs text-muted-foreground">Sort them when you have a minute.</span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                )}

                <DomainTodayOverview />
              </aside>
            </div>

            <Collapsible open={wrapUpOpen} onOpenChange={setWrapUpOpen}>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span aria-hidden="true" className="h-px flex-1 bg-border" />
                  <span>Evening wrap-up</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("h-4 w-4 transition-transform duration-200 motion-reduce:transition-none", wrapUpOpen && "rotate-180")}
                  />
                  <span aria-hidden="true" className="h-px flex-1 bg-border" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="collapsible-content">
                <section aria-label="Evening wrap-up" className="mt-4 rounded-xl border bg-card p-4 sm:p-5">
                  <p className="text-sm text-muted-foreground">Two minutes to close the day.</p>
                  <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <ReflectionField
                      id="wrap-up-went-well"
                      label="What went well?"
                      value={reflection.reflection_went_well}
                      onChange={(value) => setReflection((prev) => ({ ...prev, reflection_went_well: value }))}
                    />
                    <ReflectionField
                      id="wrap-up-did-not"
                      label="What didn't?"
                      value={reflection.reflection_did_not_go_well}
                      onChange={(value) => setReflection((prev) => ({ ...prev, reflection_did_not_go_well: value }))}
                    />
                    <ReflectionField
                      id="wrap-up-tomorrow"
                      label="One thing for tomorrow"
                      value={reflection.reflection_improve_tomorrow}
                      onChange={(value) => setReflection((prev) => ({ ...prev, reflection_improve_tomorrow: value }))}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <Button onClick={() => void saveReflection()} disabled={saveState === "saving"}>
                      Save
                    </Button>
                    <Link href={`/journal?date=${planDate}`} className={sectionLink}>
                      Write more in your journal
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </section>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </div>
      {focusSession && (
        <FocusOverlay
          item={focusSession}
          onClose={() => setFocusSession(null)}
          onAppendToTask={appendNotesToTask}
          onAppendToJournal={appendNotesToJournal}
          onDone={completeFocusSession}
        />
      )}
    </DashboardLayout>
  )
}

function TodaySkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-6">
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[60px] w-full" />
        <Skeleton className="h-[60px] w-full" />
        <Skeleton className="h-[60px] w-full" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  )
}

function DayRow({
  item,
  dragHandle,
  isDragging = false,
  canFocus,
  onDone,
  onFocus,
}: {
  item: TodayItem
  dragHandle?: ReactNode
  isDragging?: boolean
  canFocus: boolean
  onDone: (item: TodayItem) => void
  onFocus: (item: TodayItem) => void
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 bg-card py-2 pr-2",
        dragHandle ? "pl-1" : "pl-4",
        isDragging && "shadow-lg ring-2 ring-primary/30",
      )}
    >
      {dragHandle}
      {isTask(item) ? (
        <Checkbox checked={false} onCheckedChange={() => onDone(item)} aria-label={`Mark ${item.title} done`} />
      ) : (
        <span aria-hidden="true" className="h-4 w-4 shrink-0" />
      )}
      <Link href={item.href} className="min-w-0 flex-1 rounded-md px-1.5 py-1">
        <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {isTask(item) ? item.subtitle || "Task" : `${sourceLabel(item.source_type)}${item.subtitle ? ` · ${item.subtitle}` : ""}`}
        </span>
      </Link>
      {item.source_type !== "budget" && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
          disabled={!canFocus}
          title={canFocus ? "Add to focus" : "Focus is full"}
          aria-label={`Add ${item.title} to focus`}
          onClick={() => onFocus(item)}
        >
          <Target className="h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

function ReflectionField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
    </div>
  )
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === "saving") {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground transition-opacity duration-150 motion-reduce:transition-none">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving
      </span>
    )
  }
  if (state === "saved") {
    return <span className="animate-in fade-in text-xs text-success duration-150 motion-reduce:animate-none">Saved</span>
  }
  if (state === "error") {
    return <span className="text-xs text-destructive">Save failed</span>
  }
  return null
}

function FocusOverlay({
  item,
  onClose,
  onAppendToTask,
  onAppendToJournal,
  onDone,
}: {
  item: TodayItem
  onClose: () => void
  onAppendToTask: (item: TodayItem, notes: string) => Promise<void>
  onAppendToJournal: (item: TodayItem, notes: string) => Promise<void>
  onDone: (item: TodayItem) => Promise<void>
}) {
  const duration = 25 * 60
  const [secondsLeft, setSecondsLeft] = useState(duration)
  const [running, setRunning] = useState(false)
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState<"idle" | "task" | "journal" | "done">("idle")
  const progress = Math.round(((duration - secondsLeft) / duration) * 100)
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setRunning(false)
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  const runAction = async (mode: "task" | "journal" | "done", action: () => Promise<void>) => {
    setSaving(mode)
    try {
      await action()
    } finally {
      setSaving("idle")
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/85 p-4 backdrop-blur-md">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge variant="secondary" className="mb-3">Focus Session</Badge>
            <h2 className="text-2xl font-bold text-foreground sm:text-4xl">{item.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{sourceLabel(item.source_type)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close focus session">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[16rem_1fr] lg:items-center">
          <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${progress}%, hsl(var(--muted)) ${progress}% 100%)` }}>
            <div className="flex h-44 w-44 flex-col items-center justify-center rounded-full bg-card text-center">
              <span className="font-mono text-5xl font-bold">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
              <span className="mt-2 text-xs text-muted-foreground">{progress}% complete</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setRunning((current) => !current)} className="gap-2">
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {running ? "Pause" : "Start"}
              </Button>
              <Button variant="outline" onClick={() => { setRunning(false); setSecondsLeft(duration) }} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button variant="outline" onClick={() => { setRunning(false); setSecondsLeft(5 * 60) }}>
                Skip to 5-min break
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="focus-session-notes">Notes during this session</Label>
              <Textarea
                id="focus-session-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={6}
                placeholder="Capture decisions, blockers, or the next tiny step."
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {item.source_type === "task" && item.source_id && (
                <Button
                  variant="outline"
                  disabled={!notes.trim() || saving !== "idle"}
                  onClick={() => runAction("task", () => onAppendToTask(item, notes))}
                >
                  {saving === "task" ? "Appending..." : "Append to Task"}
                </Button>
              )}
              <Button
                variant="outline"
                disabled={!notes.trim() || saving !== "idle"}
                onClick={() => runAction("journal", () => onAppendToJournal(item, notes))}
              >
                {saving === "journal" ? "Appending..." : "Append to Journal"}
              </Button>
              {item.source_type === "task" && item.source_id ? (
                <Button disabled={saving !== "idle"} onClick={() => runAction("done", () => onDone(item))} className="gap-2">
                  <Check className="h-4 w-4" />
                  {saving === "done" ? "Completing..." : "Done"}
                </Button>
              ) : (
                <Button onClick={onClose} className="gap-2">
                  <Check className="h-4 w-4" />
                  Finish session
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function WeekPlanner() {
  const week = useMemo(() => {
    const start = weekStart()
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(start, index)
      return {
        date,
        key: dateString(date),
        label: date.toLocaleDateString("en-US", { weekday: "short" }),
        day: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      }
    })
  }, [])
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor))
  const [tasks, setTasks] = useState<WeekTask[]>([])
  const [focusByDate, setFocusByDate] = useState<Record<string, TodayItem[]>>({})
  const [quickAdd, setQuickAdd] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [carryOpen, setCarryOpen] = useState(false)
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const start = week[0].key
  const end = week[6].key

  const fetchWeek = useCallback(async () => {
    const overdueEnd = dateString(addDays(week[0].date, -1))
    const [weekTasksRes, overdueRes, planResults] = await Promise.all([
      fetch(`/api/tasks?date_from=${start}&date_to=${end}&completed=false`),
      fetch(`/api/tasks?date_to=${overdueEnd}&completed=false`),
      Promise.all(week.map((day) => fetch(`/api/today-plan?date=${day.key}`).then((res) => (res.ok ? res.json() : null)).catch(() => null))),
    ])
    const weekTasks = weekTasksRes.ok ? await weekTasksRes.json() : []
    const overdueTasks = overdueRes.ok ? await overdueRes.json() : []
    return {
      tasks: [...(Array.isArray(overdueTasks) ? overdueTasks : []), ...(Array.isArray(weekTasks) ? weekTasks : [])],
      focusByDate: Object.fromEntries(
        week.map((day, index) => [day.key, Array.isArray(planResults[index]?.plan?.focus_items) ? planResults[index].plan.focus_items : []]),
      ) as Record<string, TodayItem[]>,
    }
  }, [end, start, week])

  const applyWeekData = useCallback((data: { tasks: WeekTask[]; focusByDate: Record<string, TodayItem[]> }) => {
    setTasks(data.tasks)
    setFocusByDate(data.focusByDate)
  }, [])

  useEffect(() => {
    // loading already starts true; week/start/end are stable so this only
    // ever runs once in practice.
    let cancelled = false
    fetchWeek()
      .then((data) => { if (!cancelled) applyWeekData(data) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fetchWeek, applyWeekData])

  const tasksByDate = useMemo(() => {
    const grouped: Record<string, WeekTask[]> = {}
    week.forEach((day) => { grouped[day.key] = [] })
    tasks.forEach((task) => {
      const dueDate = task.due_date ? String(task.due_date).slice(0, 10) : ""
      if (grouped[dueDate]) grouped[dueDate].push(task)
    })
    return grouped
  }, [tasks, week])

  const overdueTasks = useMemo(
    () => tasks.filter((task) => task.due_date && String(task.due_date).slice(0, 10) < start && !task.completed),
    [start, tasks],
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const taskId = event.active.data.current?.taskId
    const date = event.over?.data.current?.date
    if (!taskId || !date) return

    const previous = tasks
    setTasks((current) => current.map((task) => String(task.id) === String(taskId) ? { ...task, due_date: date } : task))
    setSavingDate(date)
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, due_date: date }),
      })
      if (!response.ok) throw new Error("Reschedule failed")
    } catch {
      setTasks(previous)
    } finally {
      setSavingDate(null)
    }
  }

  const createTask = async (date: string) => {
    const title = (quickAdd[date] || "").trim()
    if (!title) return
    setQuickAdd((current) => ({ ...current, [date]: "" }))
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, due_date: date, priority: "medium" }),
    })
    if (response.ok) applyWeekData(await fetchWeek())
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-7">
          {Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-48 w-full" />)}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>This Week</CardTitle>
          <CardDescription>Drag tasks between days to reschedule them. Focus items are shown for context.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <Button variant="ghost" className="w-fit gap-2 px-0" onClick={() => setCarryOpen((open) => !open)}>
            <ChevronDown className={cn("h-4 w-4 transition-transform", carryOpen && "rotate-180")} />
            Carry forward
            <Badge variant="secondary">{overdueTasks.length}</Badge>
          </Button>
        </CardHeader>
        {carryOpen && (
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No overdue tasks to carry forward.</p>
            ) : overdueTasks.map((task) => <WeekTaskCard key={`overdue-${task.id}`} task={task} />)}
          </CardContent>
        )}
      </Card>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div className="grid gap-3 lg:grid-cols-7">
          {week.map((day) => (
            <WeekDayColumn
              key={day.key}
              date={day.key}
              label={day.label}
              day={day.day}
              tasks={tasksByDate[day.key] || []}
              focusItems={focusByDate[day.key] || []}
              quickValue={quickAdd[day.key] || ""}
              saving={savingDate === day.key}
              onQuickChange={(value) => setQuickAdd((current) => ({ ...current, [day.key]: value }))}
              onQuickSubmit={() => createTask(day.key)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}

function WeekDayColumn({
  date,
  label,
  day,
  tasks,
  focusItems,
  quickValue,
  saving,
  onQuickChange,
  onQuickSubmit,
}: {
  date: string
  label: string
  day: string
  tasks: WeekTask[]
  focusItems: TodayItem[]
  quickValue: string
  saving: boolean
  onQuickChange: (value: string) => void
  onQuickSubmit: () => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `week-day-${date}`, data: { date } })
  return (
    <div ref={setNodeRef} className={cn("min-h-[22rem] rounded-lg border bg-card p-3 transition-colors", isOver && "bg-primary/10 ring-2 ring-primary/30")}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{day}</p>
        </div>
        <Badge variant={tasks.length ? "secondary" : "outline"}>{tasks.length}</Badge>
      </div>
      <div className="space-y-2">
        {focusItems.slice(0, 2).map((item) => (
          <div key={`${date}-${item.id}`} className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs">
            <p className="truncate font-medium">{item.title}</p>
            <p className="text-muted-foreground">Focus</p>
          </div>
        ))}
        {tasks.slice(0, 5).map((task) => <WeekTaskCard key={task.id} task={task} />)}
        {tasks.length > 5 && <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">+{tasks.length - 5} more tasks</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <Input
          value={quickValue}
          onChange={(event) => onQuickChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              onQuickSubmit()
            }
          }}
          placeholder="Quick add"
          aria-label={`Quick add task for ${label}`}
        />
        <Button size="icon" onClick={onQuickSubmit} disabled={!quickValue.trim() || saving} aria-label={`Add task for ${label}`}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

function WeekTaskCard({ task }: { task: WeekTask }) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } = useDraggable({
    id: `week-task-${task.id}`,
    data: { taskId: task.id },
  })
  return (
    <div ref={setNodeRef} className={cn("rounded-md border bg-background p-2 text-xs shadow-sm", isDragging && "opacity-40")}>
      <div className="flex items-start gap-2">
        <button ref={setActivatorNodeRef} type="button" className="mt-0.5 cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Drag ${task.title}`} {...attributes} {...listeners}>
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0">
          <p className="truncate font-medium">{task.title}</p>
          <p className="text-muted-foreground">{task.priority || "medium"}</p>
        </div>
      </div>
    </div>
  )
}
