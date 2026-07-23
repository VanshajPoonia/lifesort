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
  FileText,
  Flame,
  GripVertical,
  Lightbulb,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Star,
  Target,
  X,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DomainTodayOverview } from "@/components/domain-today-overview"
import { useDomainFocus } from "@/components/domain-focus-provider"
import { SortableList } from "@/components/sortable-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
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
}

type DailyPriority = "must" | "should" | "could"

type PrioritizedTodayItem = TodayItem & {
  dailyPriority: DailyPriority
  priorityLabel: "Must" | "Should" | "Could"
  priorityReason: string
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

type JournalPreview = {
  id: number
  journal_date: string
  mood: number | null
  gratitude: string[]
  affirmation_text: string | null
  notes_from_today: string | null
  updated_at: string | null
}

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

const defaultCapacity: CapacityForm = {
  energy_level: "medium",
  available_focus_minutes: "",
  mood: "",
  day_type: "normal",
}

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

function normalizeTodayTab(value: string | null): TodayTab {
  return value === "week" ? "week" : "today"
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
    project: "Project",
    habit: "Habit",
    inbox: "Inbox",
    waiting: "Waiting For",
    commitment: "Commitment",
    maintenance: "Maintenance",
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

export default function TodayPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { focus: domainFocus } = useDomainFocus()
  const [planDate] = useState(localDateString)
  const [activeTab, setActiveTab] = useState<TodayTab>(() => normalizeTodayTab(searchParams.get("tab")))
  const [focusSession, setFocusSession] = useState<TodayItem | null>(null)
  const [plan, setPlan] = useState<TodayPlan | null>(null)
  const [candidates, setCandidates] = useState<TodayResponse["candidates"]>(emptyCandidates)
  const [todaySummary, setTodaySummary] = useState<TodayResponse["summary"]>({
    focusItems: 0,
    dueOrOverdueTasks: 0,
    dueOrOverdueItems: 0,
    highPriorityDueTasks: 0,
    calendarToday: 0,
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [todayOrderState, setTodayOrderState] = useState<SaveState>("idle")
  const [dailyPriorityFilter, setDailyPriorityFilter] = useState<"all" | DailyPriority>("all")
  const [customFocus, setCustomFocus] = useState("")
  const [reflection, setReflection] = useState({
    reflection_went_well: "",
    reflection_did_not_go_well: "",
    reflection_improve_tomorrow: "",
  })
  const [capacity, setCapacity] = useState<CapacityForm>(defaultCapacity)
  const [habitsToday, setHabitsToday] = useState<HabitToday[]>([])
  const [habitsLoaded, setHabitsLoaded] = useState(false)
  const [aiPlan, setAiPlan] = useState<AiTodayPlanResult | null>(null)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [aiError, setAiError] = useState("")
  const [createTaskTitle, setCreateTaskTitle] = useState("")
  const [creatingTask, setCreatingTask] = useState(false)
  const [journalPreview, setJournalPreview] = useState<JournalPreview | null>(null)
  const [journalLoaded, setJournalLoaded] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, router, user])

  useEffect(() => {
    setActiveTab(normalizeTodayTab(searchParams.get("tab")))
  }, [searchParams])

  const switchTab = (tab: TodayTab) => {
    setActiveTab(tab)
    router.replace(tab === "week" ? "/today?tab=week" : "/today", { scroll: false })
  }

  const fetchToday = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    try {
      const response = await fetch(`/api/today-plan?date=${planDate}`)
      if (!response.ok) throw new Error("Failed to load today plan")
      const data = (await response.json()) as TodayResponse
      setPlan(data.plan)
      setCandidates(data.candidates || emptyCandidates)
      setTodaySummary(data.summary || {
        focusItems: data.plan.focus_items?.length || 0,
        dueOrOverdueTasks: 0,
        dueOrOverdueItems: 0,
        highPriorityDueTasks: 0,
        calendarToday: 0,
      })
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

  const fetchJournalPreview = useCallback(async () => {
    try {
      const response = await fetch(`/api/journal/${planDate}`)
      if (!response.ok) return
      const data = await response.json().catch(() => null)
      setJournalPreview(data?.entry || null)
    } catch {
      // non-fatal
    } finally {
      setJournalLoaded(true)
    }
  }, [planDate])

  useEffect(() => {
    if (user) fetchJournalPreview()
  }, [fetchJournalPreview, user])

  const fetchHabitsToday = useCallback(async () => {
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
      setHabitsToday(active.map((h) => {
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
            reflection_went_well: "",
            reflection_did_not_go_well: "",
            reflection_improve_tomorrow: "",
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

  const focusItems = plan?.focus_items || []
  const focusIds = useMemo(() => new Set(focusItems.map((item) => item.id)), [focusItems])
  const todayLabel = new Date(`${planDate}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  const capacitySummary = useMemo(
    () => deriveCapacitySummary({
      capacity,
      focusCount: focusItems.length,
      dueOrOverdueItems: todaySummary.dueOrOverdueItems || todaySummary.dueOrOverdueTasks,
      highPriorityDueTasks: todaySummary.highPriorityDueTasks,
    }),
    [capacity, focusItems.length, todaySummary.dueOrOverdueItems, todaySummary.dueOrOverdueTasks, todaySummary.highPriorityDueTasks],
  )
  const dueOrOverdueCount = todaySummary.dueOrOverdueItems || todaySummary.dueOrOverdueTasks
  const dailyItems = useMemo(() => {
    const seen = new Set<string>()
    const mark = (item: TodayItem, dailyPriority: DailyPriority, priorityLabel: PrioritizedTodayItem["priorityLabel"], priorityReason: string): PrioritizedTodayItem | null => {
      if (seen.has(item.id)) return null
      seen.add(item.id)
      return { ...item, dailyPriority, priorityLabel, priorityReason }
    }
    const mustItems = [
      ...focusItems.map((item) => mark(item, "must", "Must", "Focused today")),
      ...(candidates.todayToDo.length ? candidates.todayToDo : candidates.mustDo).map((item) => mark(item, "must", "Must", "Due or overdue")),
    ].filter(Boolean) as PrioritizedTodayItem[]
    const shouldItems = candidates.shouldDo
      .map((item) => mark(item, "should", "Should", "Helpful next action"))
      .filter(Boolean) as PrioritizedTodayItem[]
    const couldItems = candidates.couldDo
      .map((item) => mark(item, "could", "Could", "Optional if capacity allows"))
      .filter(Boolean) as PrioritizedTodayItem[]
    const baseItems = [...mustItems, ...shouldItems, ...couldItems]
    const order = plan?.today_item_order || []
    if (order.length === 0) return baseItems
    const byId = new Map(baseItems.map((item) => [item.id, item]))
    const ordered = order.map((id) => byId.get(id)).filter(Boolean) as PrioritizedTodayItem[]
    const orderedIds = new Set(ordered.map((item) => item.id))
    return [...ordered, ...baseItems.filter((item) => !orderedIds.has(item.id))]
  }, [candidates.couldDo, candidates.mustDo, candidates.shouldDo, candidates.todayToDo, focusItems, plan?.today_item_order])
  const domainScopedDailyItems = dailyItems.filter(
    (item) => !domainFocus || !item.life_area_id || item.life_area_id === domainFocus.id,
  )
  const filteredDailyItems = dailyPriorityFilter === "all"
    ? domainScopedDailyItems
    : domainScopedDailyItems.filter((item) => item.dailyPriority === dailyPriorityFilter)
  const dailyCounts = {
    all: domainScopedDailyItems.length,
    must: domainScopedDailyItems.filter((item) => item.dailyPriority === "must").length,
    should: domainScopedDailyItems.filter((item) => item.dailyPriority === "should").length,
    could: domainScopedDailyItems.filter((item) => item.dailyPriority === "could").length,
  }
  const visibleHabitsToday = habitsToday.filter(
    (habit) => !domainFocus || !habit.life_area_id || habit.life_area_id === domainFocus.id,
  )
  const journalMood = journalPreview?.mood ? ["😟", "😕", "😐", "🙂", "😊"][journalPreview.mood - 1] : null
  const journalPreviewText =
    journalPreview?.affirmation_text ||
    journalPreview?.gratitude?.find(Boolean) ||
    journalPreview?.notes_from_today ||
    ""

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
    toast({ title: "Notes appended", description: "Session notes were added to the task." })
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
    toast({ title: "Notes appended", description: "Session notes were added to today's Journal." })
    fetchJournalPreview()
  }

  const completeFocusSession = async (item: TodayItem) => {
    if (item.source_type === "task" && item.source_id) {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.source_id, completed: true }),
      })
      if (!response.ok) throw new Error("Could not complete task")
      await removeFocus(item.id)
      fetchToday()
      toast({ title: "Task completed", description: item.title })
    }
    setFocusSession(null)
  }

  const saveReflection = async () => {
    await savePlan(focusItems, reflection)
  }

  const saveCapacity = async () => {
    await savePlan(focusItems, reflection, capacity)
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

  const handleTodayToDoReorder = async (orderedItems: TodayItem[]) => {
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
      console.error("Failed to save Today To-Do order:", error)
      setCandidates(previousCandidates)
      setPlan((current) => (current ? { ...current, today_item_order: previousOrder } : current))
      setTodayOrderState("error")
    }
  }

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Today" subtitle="Know what to focus on today">
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Today" subtitle={todayLabel}>
      <div className="space-y-5 md:space-y-6">
        <div className="flex w-full overflow-x-auto rounded-lg border bg-card p-1 sm:w-fit">
          <Button
            variant={activeTab === "today" ? "default" : "ghost"}
            size="sm"
            className="shrink-0"
            onClick={() => switchTab("today")}
          >
            Today
          </Button>
          <Button
            variant={activeTab === "week" ? "default" : "ghost"}
            size="sm"
            className="shrink-0"
            onClick={() => switchTab("week")}
          >
            This Week
          </Button>
        </div>

        {loadError ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">{loadError}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Refresh the page or try again in a moment.</p>
              <Button className="mt-4" onClick={fetchToday}>Try again</Button>
            </CardContent>
          </Card>
        ) : activeTab === "week" ? (
          <WeekPlanner />
        ) : (
          <>
            <DomainTodayOverview />

            <Card className="surface-card section-enter border-primary/20">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      Today
                    </CardTitle>
                    <CardDescription>
                      Focus, due items, calendar events, and habits are gathered here for {todayLabel}.
                    </CardDescription>
                  </div>
                  <Badge variant={dueOrOverdueCount > 0 ? "secondary" : "outline"} className={dueOrOverdueCount > 0 ? "bg-primary/10 text-primary" : "bg-background/70 text-muted-foreground"}>
                    {dueOrOverdueCount > 0 ? `${dueOrOverdueCount} due item${dueOrOverdueCount === 1 ? "" : "s"}` : "0 due"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="surface-card rounded-md border bg-background/70 p-3">
                    <p className="text-2xl font-bold">{focusItems.length}/3</p>
                    <p className="text-xs text-muted-foreground">focus items selected</p>
                  </div>
                  <div className="surface-card rounded-md border bg-background/70 p-3">
                    <p className="text-2xl font-bold">{dueOrOverdueCount}</p>
                    <p className="text-xs text-muted-foreground">due or overdue items</p>
                  </div>
                  <div className="surface-card rounded-md border bg-background/70 p-3">
                    <p className="text-2xl font-bold">{todaySummary.calendarToday}</p>
                    <p className="text-xs text-muted-foreground">calendar events today</p>
                  </div>
                  <div className="surface-card rounded-md border bg-background/70 p-3">
                    <p className="text-2xl font-bold">{habitsToday.filter((habit) => habit.done).length}/{habitsToday.length}</p>
                    <p className="text-xs text-muted-foreground">habits checked off</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {(candidates.unavailable?.length || 0) > 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>Some sources could not load: {candidates.unavailable?.join(", ")}.</span>
                </div>
              </div>
            )}

            <Card className="surface-card section-enter border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-primary" />
                      Today
                    </CardTitle>
                    <CardDescription>Must, Should, and Could items in one daily list.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <SaveStatus state={saveState} />
                    <Button
                      onClick={generateAiPlan}
                      disabled={generatingAi || loading}
                      variant="secondary"
                      size="sm"
                      className="gap-2 bg-background/80"
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
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 w-full gap-2"
                          onClick={() => setFocusSession(item)}
                        >
                          <Target className="h-3.5 w-3.5" />
                          Focus
                        </Button>
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Prioritized daily list</p>
                    <SaveStatus state={todayOrderState} />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {([
                      ["all", "All", dailyCounts.all],
                      ["must", "Must", dailyCounts.must],
                      ["should", "Should", dailyCounts.should],
                      ["could", "Could", dailyCounts.could],
                    ] as const).map(([value, label, count]) => (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={dailyPriorityFilter === value ? "default" : "outline"}
                        className="shrink-0"
                        onClick={() => setDailyPriorityFilter(value)}
                      >
                        {label} {count}
                      </Button>
                    ))}
                  </div>
                  <SectionList
                    title="Today"
                    items={filteredDailyItems}
                    empty="No daily items yet. Add a custom focus if something is on your mind."
                    action={(item) => (
                      <Button
                        size="sm"
                        variant={focusIds.has(item.id) ? "secondary" : "outline"}
                        disabled={(!focusIds.has(item.id) && focusItems.length >= 3) || item.source_type === "custom"}
                        onClick={() => addFocus(item)}
                      >
                        {focusIds.has(item.id) ? "Focused" : "Focus"}
                      </Button>
                    )}
                    compact
                    hideTitle
                    reorderable
                    onReorder={handleTodayToDoReorder}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="surface-card section-enter border-amber-500/20 bg-amber-500/5">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpenText className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                      Journal
                    </CardTitle>
                    <CardDescription>
                      {journalLoaded && journalPreview
                        ? "Your reflection for today has started."
                        : "Capture gratitude, intentions, and a short end-of-day reflection."}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={journalPreview ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-background/70 text-muted-foreground"}>
                      {journalLoaded ? (journalPreview ? "Started" : "Not started") : "Loading"}
                    </Badge>
                    {journalMood && <span className="text-xl" aria-label={`Mood ${journalPreview?.mood}`}>{journalMood}</span>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {journalPreviewText || "No journal notes for this date yet."}
                </p>
                <Button asChild variant="outline" className="shrink-0 gap-2">
                  <Link href={`/journal?date=${planDate}`}>
                    Open Journal
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="surface-card section-enter">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Capacity
                    </CardTitle>
                    <CardDescription>Plan around the time and energy you actually have today.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={capacitySummary.overload ? "outline" : "secondary"} className={capacitySummary.overload ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-primary/10 text-primary"}>
                      {capacitySummary.recommended_focus_count} focus item{capacitySummary.recommended_focus_count === 1 ? "" : "s"} recommended
                    </Badge>
                    <SaveStatus state={saveState} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Energy level</Label>
                    <Select
                      value={capacity.energy_level}
                      onValueChange={(value: CapacityForm["energy_level"]) => setCapacity((prev) => ({ ...prev, energy_level: value }))}
                    >
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
                    <Label htmlFor="available-focus-minutes">Available focus time</Label>
                    <Input
                      id="available-focus-minutes"
                      type="number"
                      min={0}
                      max={1440}
                      value={capacity.available_focus_minutes}
                      onChange={(event) => setCapacity((prev) => ({ ...prev, available_focus_minutes: event.target.value }))}
                      placeholder="Minutes"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mood">Mood</Label>
                    <Input
                      id="mood"
                      value={capacity.mood}
                      onChange={(event) => setCapacity((prev) => ({ ...prev, mood: event.target.value }))}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Day type</Label>
                    <Select
                      value={capacity.day_type}
                      onValueChange={(value: CapacityForm["day_type"]) => setCapacity((prev) => ({ ...prev, day_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="sick">Sick</SelectItem>
                        <SelectItem value="school">School</SelectItem>
                        <SelectItem value="work-heavy">Work-heavy</SelectItem>
                        <SelectItem value="recovery">Recovery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {capacitySummary.overload ? (
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Today may be overloaded.</p>
                        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {capacitySummary.warnings.map((warning) => (
                            <li key={warning.type}>{warning.message}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-muted-foreground">
                    Your current plan looks realistic for the capacity you entered.
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <Button onClick={saveCapacity} disabled={saveState === "saving"} className="gap-2">
                    {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Capacity
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Estimated task capacity: {capacitySummary.estimated_task_capacity} item{capacitySummary.estimated_task_capacity === 1 ? "" : "s"}.
                  </p>
                </div>
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

            {habitsLoaded && habitsToday.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-orange-500" />
                      Habits Today
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">
                      {visibleHabitsToday.filter((h) => h.done).length}/{visibleHabitsToday.length} done
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleHabitsToday.map((habit) => (
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

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
  reorderable = false,
  onReorder,
  saveState = "idle",
}: {
  icon: ReactNode
  title: string
  description: string
  items: TodayItem[]
  empty: string
  reorderable?: boolean
  onReorder?: (items: TodayItem[]) => void
  saveState?: SaveState
}) {
  return (
    <Card className="surface-card section-enter">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {reorderable && <SaveStatus state={saveState} />}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <SectionList
          title={title}
          items={items}
          empty={empty}
          hideTitle
          compact
          reorderable={reorderable}
          onReorder={onReorder}
        />
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
  reorderable = false,
  onReorder,
}: {
  title: string
  items: TodayItem[]
  empty: string
  action?: (item: TodayItem) => ReactNode
  compact?: boolean
  hideTitle?: boolean
  reorderable?: boolean
  onReorder?: (items: TodayItem[]) => void
}) {
  if (items.length === 0) {
    return <EmptyPanel title={title} description={empty} />
  }

  const renderItem = (item: TodayItem, dragHandle: ReactNode, isDragging = false) => {
    const prioritized = item as TodayItem & Partial<PrioritizedTodayItem>
    return (
      <div
        key={item.id}
        className={cn(
          "flex items-center justify-between gap-3 rounded-md border p-3 transition-shadow",
          isDragging && "bg-background shadow-xl ring-2 ring-primary/30",
        )}
      >
        {dragHandle}
        <Link href={item.href} className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`truncate font-medium ${compact ? "text-sm" : ""}`}>{item.title}</p>
            {prioritized.priorityLabel && (
              <Badge variant={prioritized.dailyPriority === "must" ? "secondary" : "outline"}>
                {prioritized.priorityLabel}
              </Badge>
            )}
            <Badge variant="outline">{sourceLabel(item.source_type)}</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {prioritized.priorityReason || item.subtitle || formatDate(item.date) || "Open in LifeSort"}
          </p>
        </Link>
        {action?.(item)}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {!hideTitle && <p className="text-sm font-medium">{title}</p>}
      {reorderable && onReorder ? (
        <SortableList
          items={items}
          getLabel={(item) => item.title}
          onReorder={onReorder}
          className="space-y-2"
          renderItem={(item, { dragHandle, isDragging }) => renderItem(item, dragHandle, isDragging)}
        />
      ) : (
        items.map((item) => renderItem(item, null))
      )}
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
    setLoading(true)
    try {
      const overdueEnd = dateString(addDays(week[0].date, -1))
      const [weekTasksRes, overdueRes, planResults] = await Promise.all([
        fetch(`/api/tasks?date_from=${start}&date_to=${end}&completed=false`),
        fetch(`/api/tasks?date_to=${overdueEnd}&completed=false`),
        Promise.all(week.map((day) => fetch(`/api/today-plan?date=${day.key}`).then((res) => (res.ok ? res.json() : null)).catch(() => null))),
      ])
      const weekTasks = weekTasksRes.ok ? await weekTasksRes.json() : []
      const overdueTasks = overdueRes.ok ? await overdueRes.json() : []
      setTasks([...(Array.isArray(overdueTasks) ? overdueTasks : []), ...(Array.isArray(weekTasks) ? weekTasks : [])])
      setFocusByDate(
        Object.fromEntries(
          week.map((day, index) => [day.key, Array.isArray(planResults[index]?.plan?.focus_items) ? planResults[index].plan.focus_items : []]),
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [end, start, week])

  useEffect(() => {
    fetchWeek()
  }, [fetchWeek])

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
    if (response.ok) fetchWeek()
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
