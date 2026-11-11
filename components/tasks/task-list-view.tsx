"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import type { ReactNode } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock,
  FolderKanban,
  ArrowUpDown,
  ListChecks,
  Plus,
  Repeat,
  Tag,
  Timer,
  Trash2,
  X,
} from "lucide-react"
import { Card, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { EditableText } from "@/components/editable-text"
import { ReminderSettings } from "@/components/reminder-settings"
import { LifeAreaSelect } from "@/components/life-area-controls"
import { SortableList } from "@/components/sortable-list"
import { TagPicker, type Tag as ItemTag } from "@/components/tag-picker"
import { TaskChecklist } from "@/components/task-checklist"
import { TaskDependencies } from "@/components/task-dependencies"
import { RelatedItems } from "@/components/related-items"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import type { LifeArea } from "@/lib/life-areas"
import { normalizeLifeArea } from "@/lib/life-areas"
import { cn } from "@/lib/utils"

type Priority = "low" | "medium" | "high"
type TaskStatus = "inbox" | "next" | "in_progress" | "waiting" | "someday" | "completed" | "cancelled"
type SortMode = "manual" | "due_date"
type ListFilter = "todo" | "today" | "waiting" | "later" | "done" | "all"

interface Task {
  id: number | string
  title: string
  description?: string | null
  completed: boolean
  priority: Priority
  status: TaskStatus
  category?: string | null
  due_date?: string | null
  due_time?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
  duration_minutes?: number | null
  reminder_at?: string | null
  email_reminder?: boolean | null
  reminder_days?: number | null
  reminder_sent?: boolean | null
  life_area_id?: string | number | null
  sort_order?: number | null
  updated_at?: string | null
}

interface Project {
  id: number | string
  title: string
  status?: string | null
}

type RecurrenceFrequency = "" | "daily" | "weekdays" | "weekly" | "monthly" | "yearly" | "custom"
type RecurrenceEndType = "never" | "on_date" | "after_count"

interface ReminderForm {
  due_date: string
  due_time: string
  scheduled_date: string
  scheduled_time: string
  duration_minutes: string
  email_reminder: boolean
  reminder_days: number
  recurrence_frequency: RecurrenceFrequency
  recurrence_interval: string
  recurrence_repeat_after_completion: boolean
  recurrence_end_type: RecurrenceEndType
  recurrence_ends_on: string
  recurrence_ends_after_count: string
}

function recurrenceIntervalUnit(frequency: RecurrenceFrequency) {
  switch (frequency) {
    case "daily":
    case "custom":
      return "day(s)"
    case "weekly":
      return "week(s)"
    case "monthly":
      return "month(s)"
    case "yearly":
      return "year(s)"
    default:
      return ""
  }
}

// The list filter lives in ?status= so old links like /waiting and /someday land on the right chip.
const listFilters: Array<{ value: ListFilter; label: string; params: string[] }> = [
  { value: "todo", label: "To do", params: [] },
  { value: "today", label: "Today", params: ["today"] },
  { value: "waiting", label: "Waiting", params: ["waiting"] },
  { value: "later", label: "Later", params: ["someday", "later"] },
  { value: "done", label: "Done", params: ["done", "completed"] },
  { value: "all", label: "All", params: ["all"] },
]

function filterFromParam(value: string | null): ListFilter {
  return listFilters.find((filter) => value !== null && filter.params.includes(value))?.value ?? "todo"
}

const emptyCopy: Record<ListFilter, string> = {
  todo: "Nothing to do. Add a task above when something comes up.",
  today: "Nothing is due today.",
  waiting: "Nothing you're waiting on. Set a task to Waiting when it's in someone else's hands.",
  later: "Nothing parked for later. Tasks you move to Later from Today land here.",
  done: "Nothing finished yet. Ticked tasks show up here.",
  all: "No tasks yet. Add one above.",
}

const addPlaceholder: Record<ListFilter, string> = {
  todo: "Add a task and press Enter",
  today: "Add a task for today",
  waiting: "Add something you're waiting on",
  later: "Add something for later",
  done: "Add a task and press Enter",
  all: "Add a task and press Enter",
}

// Everyday words for the workflow statuses. "someday" reads as Later everywhere.
const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "inbox", label: "Inbox" },
  { value: "next", label: "To do" },
  { value: "in_progress", label: "Doing" },
  { value: "waiting", label: "Waiting" },
  { value: "someday", label: "Later" },
  { value: "completed", label: "Done" },
  { value: "cancelled", label: "Let go" },
]

function statusLabel(status: TaskStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? status
}

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "due_date", label: "Due date" },
]

function dateInputValue(value?: string | null) {
  if (!value) return ""
  return value.slice(0, 10)
}

function timeInputValue(value?: string | null) {
  if (!value) return ""
  return value.slice(0, 5)
}

function parseTaskDate(value?: string | null) {
  const dateValue = dateInputValue(value)
  if (!dateValue) return null
  const [year, month, day] = dateValue.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function isSameDay(date: Date | null, other: Date) {
  return Boolean(
    date &&
      date.getFullYear() === other.getFullYear() &&
      date.getMonth() === other.getMonth() &&
      date.getDate() === other.getDate(),
  )
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function shortDate(date: Date) {
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })
}

function matchesFilter(task: Task, filter: ListFilter, today: Date) {
  const open = !task.completed
  if (filter === "todo") return open && task.status !== "waiting" && task.status !== "someday"
  if (filter === "today") return open && task.status !== "someday" && isSameDay(parseTaskDate(task.due_date), today)
  if (filter === "waiting") return open && task.status === "waiting"
  if (filter === "later") return open && task.status === "someday"
  if (filter === "done") return task.completed
  return true
}

function sortByRecentlyUpdated(a: Task, b: Task) {
  return String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
}

// One calm line under the title. Past dates read "Was due", never "Overdue".
function taskMeta(task: Task, areaName?: string | null) {
  const parts: string[] = []
  const today = startOfToday()
  const due = parseTaskDate(task.due_date)
  if (due && !task.completed) {
    if (isSameDay(due, today)) parts.push("Due today")
    else if (due < today) parts.push(`Was due ${shortDate(due)}`)
    else parts.push(`Due ${shortDate(due)}`)
  }
  if (task.status !== "next" && task.status !== "completed") parts.push(statusLabel(task.status))
  if (task.priority === "high" && !task.completed) parts.push("High priority")
  if (areaName) parts.push(areaName)
  return parts.join(" · ") || "No date"
}

function formatDate(value?: string | null) {
  const date = parseTaskDate(value)
  if (!date) return "No due date"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function formatTime(value?: string | null) {
  const time = timeInputValue(value)
  if (!time) return ""
  const [hour, minute] = time.split(":").map(Number)
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

function formatDuration(minutes?: number | null) {
  if (!minutes || minutes <= 0) return ""
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

function computeReminderAt(dueDate: string, dueTime: string, enabled: boolean, reminderDays: number) {
  if (!enabled || !dueDate) return ""
  const [year, month, day] = dueDate.split("-").map(Number)
  const [hour, minute] = (dueTime || "09:00").split(":").map(Number)
  const reminder = new Date(year, month - 1, day, hour, minute)
  reminder.setDate(reminder.getDate() - reminderDays)
  return reminder.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function sortTasks(a: Task, b: Task) {
  const aDate = parseTaskDate(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER
  const bDate = parseTaskDate(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER
  if (aDate !== bDate) return aDate - bDate
  return String(a.title).localeCompare(String(b.title))
}

function sortManualTasks(a: Task, b: Task) {
  const aOrder = typeof a.sort_order === "number" ? a.sort_order : Number.MAX_SAFE_INTEGER
  const bOrder = typeof b.sort_order === "number" ? b.sort_order : Number.MAX_SAFE_INTEGER
  if (aOrder !== bOrder) return aOrder - bOrder
  return sortTasks(a, b)
}

function getStatusColor(status: TaskStatus) {
  const colors: Record<TaskStatus, string> = {
    inbox: "bg-muted text-muted-foreground border-muted",
    next: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
    in_progress: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400",
    waiting: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
    someday: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400",
    completed: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400",
    cancelled: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400",
  }
  return colors[status] || colors.next
}

function TaskListSkeleton() {
  return (
    <div className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TaskListView() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lifeAreaFilter = searchParams.get("life_area_id")
  const activeFilter = filterFromParam(searchParams.get("status"))
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [taskTagsById, setTaskTagsById] = useState<Record<string, ItemTag[]>>({})
  const [creating, setCreating] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>("manual")
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [bulkPriority, setBulkPriority] = useState<Priority>("medium")
  const [bulkProjectId, setBulkProjectId] = useState("")
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [reminderForm, setReminderForm] = useState<ReminderForm>({
    due_date: "",
    due_time: "",
    scheduled_date: "",
    scheduled_time: "",
    duration_minutes: "",
    email_reminder: false,
    reminder_days: 1,
    recurrence_frequency: "",
    recurrence_interval: "1",
    recurrence_repeat_after_completion: false,
    recurrence_end_type: "never",
    recurrence_ends_on: "",
    recurrence_ends_after_count: "",
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  const fetchLifeAreas = useCallback(async (): Promise<LifeArea[] | null> => {
    try {
      const response = await fetch("/api/life-areas")
      if (!response.ok) return null
      const data = await response.json()
      return Array.isArray(data) ? data.map(normalizeLifeArea) : []
    } catch (error) {
      console.error("Failed to fetch life domains:", error)
      return null
    }
  }, [])

  const fetchTaskTags = useCallback(async (forTasks: Task[]): Promise<Record<string, ItemTag[]> | null> => {
    if (forTasks.length === 0) return null
    try {
      const ids = forTasks.map((task) => task.id).join(",")
      const response = await fetch(`/api/item-tags?item_type=task&item_ids=${encodeURIComponent(ids)}`)
      if (!response.ok) return null
      const map = await response.json()
      return map && typeof map === "object" ? map : {}
    } catch (error) {
      console.error("Failed to fetch task tags:", error)
      return null
    }
  }, [])

  const fetchTasks = useCallback(async (): Promise<{ tasks: Task[]; error: string }> => {
    try {
      const response = await fetch(lifeAreaFilter ? `/api/tasks?life_area_id=${encodeURIComponent(lifeAreaFilter)}` : "/api/tasks")
      if (!response.ok) return { tasks: [], error: "Tasks could not be loaded." }
      const data = await response.json()
      return { tasks: Array.isArray(data) ? data : [], error: "" }
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
      return { tasks: [], error: "Tasks could not be loaded." }
    }
  }, [lifeAreaFilter])

  const saveTaskTags = async (taskId: Task["id"], tags: ItemTag[]) => {
    setTaskTagsById((prev) => ({ ...prev, [String(taskId)]: tags }))
    try {
      await fetch("/api/item-tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: "task", item_id: taskId, tag_ids: tags.map((tag) => tag.id) }),
      })
    } catch (error) {
      console.error("Failed to save task tags:", error)
    }
  }

  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch("/api/projects")
      if (!response.ok) return null
      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error("Failed to fetch projects:", error)
      return null
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    // Flagged by react-hooks/set-state-in-effect: this re-runs when
    // lifeAreaFilter changes, and needs to flip loading back on immediately
    // for UX -- there's no render-time equivalent since it's genuinely
    // reacting to a filter change, not deriving from existing state.
    setLoading(true)
    fetchTasks().then(({ tasks: nextTasks, error }) => {
      if (cancelled) return
      setTasks(nextTasks)
      setLoadError(error)
      setLoading(false)
      if (nextTasks.length) fetchTaskTags(nextTasks).then((tags) => { if (!cancelled && tags) setTaskTagsById(tags) })
    })
    fetchLifeAreas().then((data) => { if (!cancelled && data) setLifeAreas(data) })
    fetchProjects().then((data) => { if (!cancelled && data) setProjects(data) })
    return () => { cancelled = true }
  }, [user, lifeAreaFilter, fetchTasks, fetchLifeAreas, fetchProjects, fetchTaskTags])

  useEffect(() => {
    if (!user) return

    const handleQuickAdd = (event: Event) => {
      if ((event as CustomEvent).detail?.type === "task") {
        fetchTasks().then(({ tasks: nextTasks, error }) => {
          setTasks(nextTasks)
          setLoadError(error)
          if (nextTasks.length) fetchTaskTags(nextTasks).then((tags) => { if (tags) setTaskTagsById(tags) })
        })
      }
    }

    window.addEventListener("lifesort:quick-add-created", handleQuickAdd)
    return () => window.removeEventListener("lifesort:quick-add-created", handleQuickAdd)
  }, [user, fetchTasks, fetchTaskTags])

  const setFilter = (filter: ListFilter) => {
    const params = new URLSearchParams(searchParams.toString())
    const param = listFilters.find((option) => option.value === filter)?.params[0]
    if (param) params.set("status", param)
    else params.delete("status")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    setExpandedId(null)
  }

  const handleAddTask = async (title = newTaskTitle.trim()) => {
    if (!title) return
    setCreating(true)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: "",
          priority: "medium",
          category: null,
          completed: false,
          email_reminder: false,
          // A task added while a domain is filtered belongs to that domain, or it would vanish on reload.
          life_area_id: lifeAreaFilter || null,
          // A new task lands in the list you're looking at.
          ...(activeFilter === "waiting" ? { status: "waiting" } : {}),
          ...(activeFilter === "later" ? { status: "someday" } : {}),
          ...(activeFilter === "today" ? { due_date: localDateKey() } : {}),
        }),
      })
      if (response.ok) {
        const newTask = await response.json()
        setTasks((prev) => [newTask, ...prev])
        setNewTaskTitle("")
        if (activeFilter === "done") setFilter("todo")
      }
    } catch (error) {
      console.error("Failed to add task:", error)
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateTask = async (id: Task["id"], updates: Partial<Task>) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      })
      if (response.ok) {
        const data = await response.json()
        setTasks((prev) => prev.map((task) => (String(task.id) === String(id) ? data : task)))
      }
    } catch (error) {
      console.error("Failed to update task:", error)
    }
  }

  const handleToggleTask = async (id: Task["id"], completed: boolean) => {
    await handleUpdateTask(id, { completed })
  }

  const handleDeleteTask = async (id: Task["id"]) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (response.ok) {
        setTasks((prev) => prev.filter((task) => String(task.id) !== String(id)))
        setSelectedTaskIds((current) => current.filter((taskId) => taskId !== String(id)))
      }
    } catch (error) {
      console.error("Failed to delete task:", error)
    }
  }

  const openReminderDialog = async (task: Task) => {
    setSelectedTask(task)
    setReminderForm({
      due_date: dateInputValue(task.due_date),
      due_time: timeInputValue(task.due_time),
      scheduled_date: dateInputValue(task.scheduled_date),
      scheduled_time: timeInputValue(task.scheduled_time),
      duration_minutes: task.duration_minutes ? String(task.duration_minutes) : "",
      email_reminder: Boolean(task.email_reminder),
      reminder_days: task.reminder_days ?? 1,
      recurrence_frequency: "",
      recurrence_interval: "1",
      recurrence_repeat_after_completion: false,
      recurrence_end_type: "never",
      recurrence_ends_on: "",
      recurrence_ends_after_count: "",
    })
    setReminderDialogOpen(true)

    try {
      const response = await fetch(`/api/tasks/${task.id}/recurrence`)
      if (!response.ok) return
      const rule = await response.json()
      if (!rule) return
      setReminderForm((current) => ({
        ...current,
        recurrence_frequency: rule.frequency,
        recurrence_interval: String(rule.interval_count ?? 1),
        recurrence_repeat_after_completion: Boolean(rule.repeat_after_completion),
        recurrence_end_type: rule.ends_on ? "on_date" : rule.ends_after_count ? "after_count" : "never",
        recurrence_ends_on: dateInputValue(rule.ends_on),
        recurrence_ends_after_count: rule.ends_after_count ? String(rule.ends_after_count) : "",
      }))
    } catch (error) {
      console.error("Failed to load recurrence rule:", error)
    }
  }

  const handleSaveReminder = async () => {
    if (!selectedTask) return
    await handleUpdateTask(selectedTask.id, {
      due_date: reminderForm.due_date || null,
      due_time: reminderForm.due_time || null,
      scheduled_date: reminderForm.scheduled_date || null,
      scheduled_time: reminderForm.scheduled_time || null,
      duration_minutes: reminderForm.duration_minutes ? Number(reminderForm.duration_minutes) : null,
      email_reminder: Boolean(reminderForm.email_reminder && reminderForm.due_date),
      reminder_days: reminderForm.reminder_days,
    })

    try {
      if (reminderForm.recurrence_frequency) {
        await fetch(`/api/tasks/${selectedTask.id}/recurrence`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            frequency: reminderForm.recurrence_frequency,
            interval_count: reminderForm.recurrence_interval ? Number(reminderForm.recurrence_interval) : 1,
            repeat_after_completion: reminderForm.recurrence_repeat_after_completion,
            ends_on: reminderForm.recurrence_end_type === "on_date" ? reminderForm.recurrence_ends_on || null : null,
            ends_after_count:
              reminderForm.recurrence_end_type === "after_count" && reminderForm.recurrence_ends_after_count
                ? Number(reminderForm.recurrence_ends_after_count)
                : null,
          }),
        })
      } else {
        await fetch(`/api/tasks/${selectedTask.id}/recurrence`, { method: "DELETE" })
      }
    } catch (error) {
      console.error("Failed to save recurrence rule:", error)
    }

    setReminderDialogOpen(false)
    setSelectedTask(null)
  }

  const areaById = useMemo(() => new Map(lifeAreas.map((area) => [String(area.id), area])), [lifeAreas])
  const selectedTaskSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds])
  const taskOptions = useMemo(() => tasks.map((task) => ({ id: task.id, title: task.title })), [tasks])

  const filterCounts = useMemo(() => {
    const today = startOfToday()
    return Object.fromEntries(
      listFilters.map((filter) => [filter.value, tasks.filter((task) => matchesFilter(task, filter.value, today)).length]),
    ) as Record<ListFilter, number>
  }, [tasks])

  const visibleTasks = useMemo(() => {
    const today = startOfToday()
    const matching = tasks.filter((task) => matchesFilter(task, activeFilter, today))
    if (activeFilter === "done") return matching.sort(sortByRecentlyUpdated)
    return matching.sort(sortMode === "manual" ? sortManualTasks : sortTasks)
  }, [activeFilter, sortMode, tasks])

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedTaskSet.has(String(task.id))),
    [selectedTaskSet, tasks],
  )

  const allVisibleSelected =
    visibleTasks.length > 0 && visibleTasks.every((task) => selectedTaskSet.has(String(task.id)))

  const toggleTaskSelection = (id: Task["id"]) => {
    const taskId = String(id)
    setSelectedTaskIds((current) =>
      current.includes(taskId) ? current.filter((item) => item !== taskId) : [...current, taskId],
    )
  }

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(visibleTasks.map((task) => String(task.id)))
      setSelectedTaskIds((current) => current.filter((taskId) => !visibleIds.has(taskId)))
      return
    }

    setSelectedTaskIds((current) => Array.from(new Set([...current, ...visibleTasks.map((task) => String(task.id))])))
  }

  const clearSelection = () => {
    setSelectedTaskIds([])
    setSelectionMode(false)
  }

  const bulkMarkDone = async () => {
    await Promise.all(selectedTasks.map((task) => handleUpdateTask(task.id, { completed: true })))
    clearSelection()
  }

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedTasks.length} selected task${selectedTasks.length === 1 ? "" : "s"}?`)) return
    await Promise.all(selectedTasks.map((task) => handleDeleteTask(task.id)))
    clearSelection()
  }

  const bulkChangePriority = async () => {
    await Promise.all(selectedTasks.map((task) => handleUpdateTask(task.id, { priority: bulkPriority })))
    clearSelection()
  }

  const bulkMoveToProject = async () => {
    if (!bulkProjectId) return

    await Promise.all(
      selectedTasks.map((task) =>
        fetch("/api/projects/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: bulkProjectId, item_type: "task", item_id: task.id }),
        }),
      ),
    )
    setBulkProjectId("")
    clearSelection()
  }

  const handleReorderTasks = async (orderedVisibleTasks: Task[]) => {
    if (sortMode !== "manual") return

    const previousTasks = tasks
    const visibleIds = new Set(visibleTasks.map((task) => String(task.id)))
    const nextVisibleQueue = [...orderedVisibleTasks]
    const fullManualOrder = [...tasks].sort(sortManualTasks)
    const reorderedFull = fullManualOrder.map((task) => {
      if (!visibleIds.has(String(task.id))) return task
      return nextVisibleQueue.shift() || task
    })
    const normalized = reorderedFull.map((task, index) => ({ ...task, sort_order: index }))
    const normalizedById = new Map(normalized.map((task) => [String(task.id), task]))

    setTasks((current) => current.map((task) => normalizedById.get(String(task.id)) || task))

    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: normalized.map((task) => task.id) }),
      })

      if (!response.ok) throw new Error("Task order could not be saved.")
      const data = await response.json()
      if (Array.isArray(data.tasks)) {
        setTasks(data.tasks)
      }
    } catch (error) {
      console.error("Failed to reorder tasks:", error)
      setTasks(previousTasks)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  const reminderPreview = computeReminderAt(
    reminderForm.due_date,
    reminderForm.due_time,
    reminderForm.email_reminder,
    reminderForm.reminder_days,
  )

  const renderTaskRow = (task: Task, dragHandle: ReactNode, isDragging: boolean) => {
    const id = String(task.id)
    const expanded = expandedId === id
    const area = task.life_area_id ? areaById.get(String(task.life_area_id)) : null
    const detailsId = `task-${id}-details`
    return (
      <div className={cn("bg-card", isDragging && "relative z-10 shadow-lg ring-2 ring-primary/30")}>
        <div className={cn("flex items-center gap-2 py-1.5 pr-2", dragHandle ? "pl-1" : "pl-4")}>
          {dragHandle}
          {selectionMode && (
            <Checkbox
              checked={selectedTaskSet.has(id)}
              onCheckedChange={() => toggleTaskSelection(task.id)}
              aria-label={`Select ${task.title}`}
            />
          )}
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => void handleToggleTask(task.id, !task.completed)}
            aria-label={task.completed ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
          />
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpandedId(expanded ? null : id)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
          >
            <span className="min-w-0 flex-1">
              <span className={cn("block truncate text-sm font-medium text-foreground", task.completed && "text-muted-foreground line-through")}>
                {task.title}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{taskMeta(task, area?.name)}</span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")}
            />
          </button>
        </div>

        {expanded && (
          <div id={detailsId} className="space-y-4 border-t border-border/70 bg-background/40 px-4 py-4">
            <EditableText
              value={task.title}
              onSave={(value) => handleUpdateTask(task.id, { title: value })}
              className="font-medium text-foreground"
              placeholder="Task name"
            />
            <EditableText
              value={task.description || ""}
              onSave={(value) => handleUpdateTask(task.id, { description: value || null })}
              className="text-sm text-muted-foreground"
              placeholder="Add a note..."
              multiline
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={task.status} onValueChange={(value) => handleUpdateTask(task.id, { status: value as TaskStatus })}>
                  <SelectTrigger className={cn("h-9", getStatusColor(task.status))}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Priority</Label>
                <Select value={task.priority} onValueChange={(value) => handleUpdateTask(task.id, { priority: value as Priority })}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Life domain</Label>
                <LifeAreaSelect
                  areas={lifeAreas}
                  value={task.life_area_id || null}
                  onChange={(value) => handleUpdateTask(task.id, { life_area_id: value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Label</Label>
                <div className="flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <EditableText
                    value={task.category || ""}
                    onSave={(value) => handleUpdateTask(task.id, { category: value || null })}
                    className="min-w-0 flex-1"
                    placeholder="Add label"
                  />
                </div>
              </div>
            </div>

            <TagPicker selected={taskTagsById[id] || []} onChange={(tags) => saveTaskTags(task.id, tags)} />
            <TaskChecklist taskId={Number(task.id)} />
            <TaskDependencies taskId={Number(task.id)} allTasks={taskOptions} />
            <RelatedItems itemType="task" itemId={Number(task.id)} />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {task.due_date ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDate(task.due_date)}
                  </span>
                ) : (
                  <span>No due date</span>
                )}
                {task.due_time && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatTime(task.due_time)}
                  </span>
                )}
                {task.email_reminder && task.reminder_at && (
                  <span className="flex items-center gap-1.5">
                    <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                    Reminder set
                  </span>
                )}
                {task.scheduled_date && (
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                    Scheduled {formatDate(task.scheduled_date)}
                    {task.scheduled_time ? ` at ${formatTime(task.scheduled_time)}` : ""}
                  </span>
                )}
                {task.duration_minutes ? (
                  <span className="flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDuration(task.duration_minutes)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-card" onClick={() => void openReminderDialog(task)}>
                  <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                  Dates and reminders
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => void handleDeleteTask(task.id)}
                  aria-label={`Delete ${task.title}`}
                  title="Delete task"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={newTaskTitle}
            onChange={(event) => setNewTaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && newTaskTitle.trim()) {
                event.preventDefault()
                void handleAddTask(newTaskTitle.trim())
              }
            }}
            placeholder={addPlaceholder[activeFilter]}
            aria-label="Add a task"
            className="bg-card"
          />
          <Button onClick={() => void handleAddTask()} disabled={creating || !newTaskTitle.trim()} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {creating ? "Adding..." : "Add"}
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Show tasks" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0">
            {listFilters.map((filter) => {
              const selected = activeFilter === filter.value
              const count = filterCounts[filter.value]
              return (
                <button
                  key={filter.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setFilter(filter.value)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
                    selected
                      ? "border-primary/30 bg-primary-tint text-primary"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {filter.label}
                  {count > 0 && filter.value !== "done" && filter.value !== "all" && (
                    <span className="tabular-nums opacity-80">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {activeFilter !== "done" && (
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger className="h-8 w-[140px] bg-card text-xs" aria-label="Sort tasks">
                  <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              variant={selectionMode ? "secondary" : "outline"}
              size="sm"
              className="h-8 gap-1.5 bg-card"
              onClick={() => {
                setSelectionMode((current) => !current)
                if (selectionMode) setSelectedTaskIds([])
              }}
            >
              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
              {selectionMode ? "Stop selecting" : "Select"}
            </Button>
          </div>
        </div>

        {selectionMode && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="bg-card" onClick={toggleSelectAllVisible}>
              {allVisibleSelected ? "Clear visible" : "Select all"}
            </Button>
            {selectedTasks.length > 0 && <Badge variant="secondary">{selectedTasks.length} selected</Badge>}
          </div>
        )}

        {loadError && (
          <p role="status" className="flex items-center gap-2 rounded-xl border border-dashed bg-card/60 p-4 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {loadError} Refresh to try again.
          </p>
        )}

          {selectedTasks.length > 0 && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" className="gap-2" onClick={bulkMarkDone}>
                    <CheckCircle2 className="h-4 w-4" />
                    Mark done
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="gap-2" onClick={bulkDelete}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                  <div className="flex min-w-[220px] items-center gap-2">
                    <Select value={bulkPriority} onValueChange={(value) => setBulkPriority(value as Priority)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High priority</SelectItem>
                        <SelectItem value="medium">Medium priority</SelectItem>
                        <SelectItem value="low">Low priority</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" onClick={bulkChangePriority}>
                      Change
                    </Button>
                  </div>
                  <div className="flex min-w-[260px] items-center gap-2">
                    <Select value={bulkProjectId} onValueChange={setBulkProjectId}>
                      <SelectTrigger className="h-9">
                        <FolderKanban className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Move to project" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={String(project.id)}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" disabled={!bulkProjectId} onClick={bulkMoveToProject}>
                      Move
                    </Button>
                  </div>
                </div>
                <Button type="button" size="sm" variant="ghost" className="gap-2 self-start lg:self-auto" onClick={clearSelection}>
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              </CardContent>
            </Card>
          )}

        {loading ? (
          <TaskListSkeleton />
        ) : visibleTasks.length === 0 ? (
          <p className="rounded-xl border border-dashed bg-card/60 p-5 text-sm text-muted-foreground">{emptyCopy[activeFilter]}</p>
        ) : (
          <SortableList
            items={visibleTasks}
            getLabel={(task) => task.title}
            onReorder={handleReorderTasks}
            disabled={sortMode !== "manual" || selectionMode || activeFilter === "done"}
            className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card"
            renderItem={(task, { dragHandle, isDragging }) => renderTaskRow(task, dragHandle, isDragging)}
          />
        )}

        <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Dates, Duration, Repeat & Reminder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="due-date">Due Date</Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={reminderForm.due_date}
                    onChange={(event) =>
                      setReminderForm((current) => ({
                        ...current,
                        due_date: event.target.value,
                        email_reminder: event.target.value ? current.email_reminder : false,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due-time">Due Time</Label>
                  <Input
                    id="due-time"
                    type="time"
                    value={reminderForm.due_time}
                    disabled={!reminderForm.due_date}
                    onChange={(event) => setReminderForm((current) => ({ ...current, due_time: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="scheduled-date">Scheduled Date</Label>
                  <Input
                    id="scheduled-date"
                    type="date"
                    value={reminderForm.scheduled_date}
                    onChange={(event) => setReminderForm((current) => ({ ...current, scheduled_date: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scheduled-time">Scheduled Time</Label>
                  <Input
                    id="scheduled-time"
                    type="time"
                    value={reminderForm.scheduled_time}
                    disabled={!reminderForm.scheduled_date}
                    onChange={(event) => setReminderForm((current) => ({ ...current, scheduled_time: event.target.value }))}
                  />
                </div>
              </div>
              <CardDescription>
                Due is the deadline; Scheduled is when you plan to actually work on it.
              </CardDescription>

              <div className="space-y-2">
                <Label htmlFor="duration-minutes">Estimated Duration (minutes)</Label>
                <Input
                  id="duration-minutes"
                  type="number"
                  min={1}
                  placeholder="e.g. 30"
                  value={reminderForm.duration_minutes}
                  onChange={(event) => setReminderForm((current) => ({ ...current, duration_minutes: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="recurrence-frequency" className="flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5" />
                  Repeat
                </Label>
                <Select
                  value={reminderForm.recurrence_frequency || "none"}
                  onValueChange={(value) =>
                    setReminderForm((current) => ({
                      ...current,
                      recurrence_frequency: value === "none" ? "" : (value as RecurrenceFrequency),
                    }))
                  }
                >
                  <SelectTrigger id="recurrence-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Does not repeat</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekdays">Every weekday (Mon-Fri)</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="custom">Custom interval (days)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {reminderForm.recurrence_frequency && (
                <div className="space-y-3 rounded-md border p-3">
                  {reminderForm.recurrence_frequency !== "weekdays" && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground">Every</span>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={reminderForm.recurrence_interval}
                        onChange={(event) =>
                          setReminderForm((current) => ({ ...current, recurrence_interval: event.target.value }))
                        }
                        className="h-8 w-20"
                      />
                      <span className="text-muted-foreground">
                        {recurrenceIntervalUnit(reminderForm.recurrence_frequency)}
                      </span>
                    </div>
                  )}

                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={reminderForm.recurrence_repeat_after_completion}
                      onCheckedChange={(checked) =>
                        setReminderForm((current) => ({
                          ...current,
                          recurrence_repeat_after_completion: Boolean(checked),
                        }))
                      }
                    />
                    Repeat from completion date, not the fixed schedule
                  </label>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Ends</Label>
                    <Select
                      value={reminderForm.recurrence_end_type}
                      onValueChange={(value) =>
                        setReminderForm((current) => ({ ...current, recurrence_end_type: value as RecurrenceEndType }))
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="on_date">On date</SelectItem>
                        <SelectItem value="after_count">After a number of times</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {reminderForm.recurrence_end_type === "on_date" && (
                    <Input
                      type="date"
                      value={reminderForm.recurrence_ends_on}
                      onChange={(event) =>
                        setReminderForm((current) => ({ ...current, recurrence_ends_on: event.target.value }))
                      }
                    />
                  )}
                  {reminderForm.recurrence_end_type === "after_count" && (
                    <Input
                      type="number"
                      min={1}
                      placeholder="e.g. 10"
                      value={reminderForm.recurrence_ends_after_count}
                      onChange={(event) =>
                        setReminderForm((current) => ({ ...current, recurrence_ends_after_count: event.target.value }))
                      }
                    />
                  )}
                </div>
              )}

              {reminderForm.due_date && (
                <ReminderSettings
                  enabled={reminderForm.email_reminder}
                  reminderDays={reminderForm.reminder_days}
                  onEnabledChange={(enabled) => setReminderForm((current) => ({ ...current, email_reminder: enabled }))}
                  onReminderDaysChange={(days) => setReminderForm((current) => ({ ...current, reminder_days: days }))}
                />
              )}

              <div className="space-y-2">
                <Label htmlFor="reminder-preview">Reminder Date/Time</Label>
                <Input
                  id="reminder-preview"
                  readOnly
                  disabled
                  value={reminderPreview || "No reminder scheduled"}
                />
                <CardDescription>
                  Reminders use the due time when set, otherwise 9:00 AM on the due date.
                </CardDescription>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                variant="outline"
                onClick={() =>
                  setReminderForm({
                    due_date: "",
                    due_time: "",
                    scheduled_date: "",
                    scheduled_time: "",
                    duration_minutes: "",
                    email_reminder: false,
                    reminder_days: 1,
                    recurrence_frequency: "",
                    recurrence_interval: "1",
                    recurrence_repeat_after_completion: false,
                    recurrence_end_type: "never",
                    recurrence_ends_on: "",
                    recurrence_ends_after_count: "",
                  })
                }
              >
                Clear
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveReminder}>Save</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}
