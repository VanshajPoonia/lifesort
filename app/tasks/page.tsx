"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  Circle,
  CircleDot,
  Clock,
  Filter,
  FolderKanban,
  ArrowUpDown,
  ListChecks,
  Plus,
  Tag,
  Timer,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { EditableText } from "@/components/editable-text"
import { ReminderSettings } from "@/components/reminder-settings"
import { LifeAreaBadge, LifeAreaSelect } from "@/components/life-area-controls"
import { SortableList } from "@/components/sortable-list"
import { TagPicker, type Tag as ItemTag } from "@/components/tag-picker"
import { TaskChecklist } from "@/components/task-checklist"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { LifeArea } from "@/lib/life-areas"
import { normalizeLifeArea } from "@/lib/life-areas"
import { cn } from "@/lib/utils"

type Priority = "low" | "medium" | "high"
type PriorityFilter = "all" | Priority
type TaskStatus = "inbox" | "next" | "in_progress" | "waiting" | "someday" | "completed" | "cancelled"
type StatusFilter = "all" | TaskStatus
type CompletionFilter = "all" | "open" | "completed"
type SortMode = "manual" | "due_date"
type TaskView = "all" | "today" | "overdue" | "no_due_date"

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
}

interface Project {
  id: number | string
  title: string
  status?: string | null
}

interface ReminderForm {
  due_date: string
  due_time: string
  scheduled_date: string
  scheduled_time: string
  duration_minutes: string
  email_reminder: boolean
  reminder_days: number
}

const taskViews: Array<{ value: TaskView; label: string }> = [
  { value: "all", label: "All" },
  { value: "today", label: "Due Today" },
  { value: "overdue", label: "Overdue" },
  { value: "no_due_date", label: "No Due Date" },
]

const priorityOptions: Array<{ value: PriorityFilter; label: string }> = [
  { value: "all", label: "All priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

const completionOptions: Array<{ value: CompletionFilter; label: string }> = [
  { value: "all", label: "All tasks" },
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
]

const statusOptions: Array<{ value: TaskStatus; label: string }> = [
  { value: "inbox", label: "Inbox" },
  { value: "next", label: "Next" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "someday", label: "Someday" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  ...statusOptions,
]

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

function isOverdue(task: Task, today = startOfToday()) {
  const dueDate = parseTaskDate(task.due_date)
  return Boolean(!task.completed && dueDate && dueDate < today)
}

function isTodayTask(task: Task, today = startOfToday()) {
  const dueDate = parseTaskDate(task.due_date)
  return Boolean(!task.completed && dueDate && isSameDay(dueDate, today))
}

function hasNoDueDate(task: Task) {
  return !parseTaskDate(task.due_date)
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

function getPriorityColor(priority: string) {
  const colors = {
    low: "bg-muted text-muted-foreground border-muted",
    medium: "bg-warning/10 text-warning border-warning/30",
    high: "bg-destructive/10 text-destructive border-destructive/30",
  }
  return colors[priority as keyof typeof colors] || colors.medium
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

// Due-date urgency is orthogonal to workflow status, so it's a separate,
// contextual badge rather than folded into the status Select -- only shown
// for tasks that are still active (isOverdue/isTodayTask already exclude
// completed/cancelled since those set `completed = true`).
function getUrgencyBadge(task: Task) {
  const today = startOfToday()
  if (isOverdue(task, today)) {
    return <Badge className="border-red-200 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Overdue</Badge>
  }
  if (isTodayTask(task, today)) {
    return <Badge className="border-amber-200 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Due Today</Badge>
  }
  return null
}

function EmptyState({
  title,
  description,
  onAddTask,
}: {
  title: string
  description: string
  onAddTask: () => void
}) {
  return (
    <Card className="glass-strong border">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <CheckSquare className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
        <Button onClick={onAddTask} variant="outline" className="mt-4 gap-2">
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </CardContent>
    </Card>
  )
}

function TaskListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <Card key={item} className="glass-strong border">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-5 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const lifeAreaFilter = searchParams.get("life_area_id")
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [taskTagsById, setTaskTagsById] = useState<Record<string, ItemTag[]>>({})
  const [creating, setCreating] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [activeView, setActiveView] = useState<TaskView>("all")
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all")
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
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchTasks()
      fetchLifeAreas()
      fetchProjects()
    }
  }, [user, lifeAreaFilter])

  const fetchLifeAreas = async () => {
    try {
      const response = await fetch("/api/life-areas")
      if (!response.ok) return
      const data = await response.json()
      setLifeAreas(Array.isArray(data) ? data.map(normalizeLifeArea) : [])
    } catch (error) {
      console.error("Failed to fetch life domains:", error)
    }
  }

  const fetchTasks = async () => {
    setLoading(true)
    setLoadError("")
    try {
      const response = await fetch(lifeAreaFilter ? `/api/tasks?life_area_id=${encodeURIComponent(lifeAreaFilter)}` : "/api/tasks")
      if (!response.ok) {
        setLoadError("Tasks could not be loaded.")
        setTasks([])
        return
      }

      const data = await response.json()
      const nextTasks = Array.isArray(data) ? data : []
      setTasks(nextTasks)
      fetchTaskTags(nextTasks)
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
      setLoadError("Tasks could not be loaded.")
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const fetchTaskTags = async (forTasks: Task[]) => {
    if (forTasks.length === 0) return
    try {
      const ids = forTasks.map((task) => task.id).join(",")
      const response = await fetch(`/api/item-tags?item_type=task&item_ids=${encodeURIComponent(ids)}`)
      if (!response.ok) return
      const map = await response.json()
      setTaskTagsById(map && typeof map === "object" ? map : {})
    } catch (error) {
      console.error("Failed to fetch task tags:", error)
    }
  }

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

  const fetchProjects = async () => {
    try {
      const response = await fetch("/api/projects")
      if (!response.ok) return
      const data = await response.json()
      setProjects(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to fetch projects:", error)
    }
  }

  useEffect(() => {
    if (!user) return

    const handleQuickAdd = (event: Event) => {
      if ((event as CustomEvent).detail?.type === "task") {
        fetchTasks()
      }
    }

    window.addEventListener("lifesort:quick-add-created", handleQuickAdd)
    return () => window.removeEventListener("lifesort:quick-add-created", handleQuickAdd)
  }, [user])

  const handleAddTask = async (title = newTaskTitle.trim() || "New Task") => {
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
          life_area_id: null,
        }),
      })
      if (response.ok) {
        const newTask = await response.json()
        setTasks((prev) => [newTask, ...prev])
        setNewTaskTitle("")
        setActiveView("all")
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

  const openReminderDialog = (task: Task) => {
    setSelectedTask(task)
    setReminderForm({
      due_date: dateInputValue(task.due_date),
      due_time: timeInputValue(task.due_time),
      scheduled_date: dateInputValue(task.scheduled_date),
      scheduled_time: timeInputValue(task.scheduled_time),
      duration_minutes: task.duration_minutes ? String(task.duration_minutes) : "",
      email_reminder: Boolean(task.email_reminder),
      reminder_days: task.reminder_days ?? 1,
    })
    setReminderDialogOpen(true)
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
    setReminderDialogOpen(false)
    setSelectedTask(null)
  }

  const stats = useMemo(() => {
    const today = startOfToday()
    // Cancelled tasks are excluded from the completion rate entirely (neither
    // "done" nor "still open") rather than counted as completed, even though
    // both set `completed = true` server-side -- see AI_DECISIONS.md.
    const completed = tasks.filter((task) => task.status === "completed").length
    const cancelled = tasks.filter((task) => task.status === "cancelled").length
    const ratedTotal = tasks.length - cancelled
    return {
      total: tasks.length,
      completed,
      today: tasks.filter((task) => isTodayTask(task, today)).length,
      overdue: tasks.filter((task) => isOverdue(task, today)).length,
      completionRate: ratedTotal > 0 ? Math.round((completed / ratedTotal) * 100) : 0,
    }
  }, [tasks])

  const areaById = useMemo(() => new Map(lifeAreas.map((area) => [String(area.id), area])), [lifeAreas])
  const selectedTaskSet = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds])

  const visibleTasks = useMemo(() => {
    const today = startOfToday()
    return tasks
      .filter((task) => {
        if (activeView === "all") return true
        if (activeView === "today") return isTodayTask(task, today)
        if (activeView === "overdue") return isOverdue(task, today)
        return hasNoDueDate(task)
      })
      .filter((task) => priorityFilter === "all" || task.priority === priorityFilter)
      .filter((task) => statusFilter === "all" || task.status === statusFilter)
      .filter((task) => {
        if (completionFilter === "open") return !task.completed
        if (completionFilter === "completed") return task.completed
        return true
      })
      .sort(sortMode === "manual" ? sortManualTasks : sortTasks)
  }, [activeView, completionFilter, priorityFilter, sortMode, statusFilter, tasks])

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

  const emptyCopy = {
    all: {
      title: "No tasks yet",
      description: "Create a task, then use filters when the list starts to grow.",
    },
    today: {
      title: "No tasks due today",
      description: "Tasks due today will appear here.",
    },
    overdue: {
      title: "No overdue tasks",
      description: "Nice. Anything past its due date will show here until it is completed.",
    },
    no_due_date: {
      title: "No unscheduled tasks",
      description: "Tasks without due dates will collect here.",
    },
  }[activeView]

  if (authLoading || !user) {
    return (
      <DashboardLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const firstName = user.name?.split(" ")[0] || "Your"
  const reminderPreview = computeReminderAt(
    reminderForm.due_date,
    reminderForm.due_time,
    reminderForm.email_reminder,
    reminderForm.reminder_days,
  )

  return (
    <DashboardLayout
      title={`${firstName}'s Tasks`}
      subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            [0, 1, 2, 3].map((item) => (
              <Card key={item} className="glass border">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          ) : (
            <>
              <Card className="glass border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                </CardContent>
              </Card>

              <Card className="glass border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today</CardTitle>
                  <Circle className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.today}</div>
                </CardContent>
              </Card>

              <Card className="glass border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                  <AlertCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.overdue}</div>
                </CardContent>
              </Card>

              <Card className="glass border">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion</CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.completionRate}%</div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Daily Tasks</h2>
            <p className="text-sm text-muted-foreground">Plan by due date, priority, label, and reminders.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
            <Input
              value={newTaskTitle}
              onChange={(event) => setNewTaskTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && newTaskTitle.trim()) {
                  event.preventDefault()
                  handleAddTask(newTaskTitle.trim())
                }
              }}
              placeholder="Type a task and press Enter"
              className="sm:w-72"
            />
            <Button onClick={() => handleAddTask()} disabled={creating} className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
              <Plus className="h-4 w-4" />
              {creating ? "Adding..." : "Add Task"}
            </Button>
          </div>
        </div>

        {loadError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {loadError}
            </CardContent>
          </Card>
        )}

        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as TaskView)} className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto">
              {taskViews.map((view) => (
                <TabsTrigger key={view.value} value={view.value}>
                  {view.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger className="w-full sm:min-w-[150px]">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
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

              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilter)}>
                <SelectTrigger className="w-full sm:min-w-[170px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                <SelectTrigger className="w-full sm:min-w-[170px]">
                  <CircleDot className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusFilterOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={completionFilter} onValueChange={(value) => setCompletionFilter(value as CompletionFilter)}>
                <SelectTrigger className="w-full sm:min-w-[170px]">
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {completionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={selectionMode ? "secondary" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => {
                  setSelectionMode((current) => !current)
                  if (selectionMode) setSelectedTaskIds([])
                }}
              >
                <ListChecks className="h-4 w-4" />
                {selectionMode ? "Selecting" : "Select"}
              </Button>
              {selectionMode && (
                <Button type="button" variant="outline" size="sm" onClick={toggleSelectAllVisible}>
                  {allVisibleSelected ? "Clear visible" : "Select all"}
                </Button>
              )}
            </div>
            {selectedTasks.length > 0 && (
              <Badge variant="secondary">{selectedTasks.length} selected</Badge>
            )}
          </div>

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

          <TabsContent value={activeView} className="space-y-3">
              {loading ? (
                <TaskListSkeleton />
              ) : visibleTasks.length === 0 ? (
                <EmptyState
                  title={
                    tasks.length === 0 || (priorityFilter === "all" && completionFilter === "all")
                      ? emptyCopy.title
                      : "No tasks match these filters"
                  }
                  description={
                    tasks.length === 0 || (priorityFilter === "all" && completionFilter === "all")
                      ? emptyCopy.description
                      : "Try another priority or completion filter to widen this task view."
                  }
                  onAddTask={() => handleAddTask()}
                />
              ) : (
                <SortableList
                  items={visibleTasks}
                  getLabel={(task) => task.title}
                  onReorder={handleReorderTasks}
                  disabled={sortMode !== "manual" || selectionMode}
                  className="space-y-3"
                  renderItem={(task, { dragHandle, isDragging }) => (
                    <Card
                      key={task.id}
                      className={cn(
                        "glass-strong border transition-all hover:shadow-lg",
                        task.completed && "opacity-70",
                        isDragging && "shadow-xl ring-2 ring-primary/30",
                      )}
                    >
                      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
                        {dragHandle ? <div className="md:pt-0.5">{dragHandle}</div> : null}
                        {selectionMode && (
                          <Checkbox
                            checked={selectedTaskSet.has(String(task.id))}
                            onCheckedChange={() => toggleTaskSelection(task.id)}
                            className="mt-1 h-5 w-5"
                            aria-label={`Select ${task.title}`}
                          />
                        )}
                        <Checkbox
                          checked={task.completed}
                          onCheckedChange={() => handleToggleTask(task.id, !task.completed)}
                          className="mt-1 h-5 w-5"
                        />

                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <EditableText
                              value={task.title}
                              onSave={(value) => handleUpdateTask(task.id, { title: value })}
                              className={`min-w-0 font-medium text-foreground ${task.completed ? "line-through" : ""}`}
                              placeholder="Enter task name..."
                            />
                            <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                            <LifeAreaBadge area={task.life_area_id ? areaById.get(String(task.life_area_id)) : null} fallback="No area" />
                            {getUrgencyBadge(task)}
                          </div>

                          <EditableText
                            value={task.description || ""}
                            onSave={(value) => handleUpdateTask(task.id, { description: value || null })}
                            className="text-sm text-muted-foreground"
                            placeholder="Add description..."
                            multiline
                          />

                          <div className="grid gap-3 lg:grid-cols-[160px_160px_200px_1fr]">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Priority</Label>
                              <Select
                                value={task.priority}
                                onValueChange={(value) => handleUpdateTask(task.id, { priority: value as Priority })}
                              >
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
                              <Label className="text-xs text-muted-foreground">Status</Label>
                              <Select
                                value={task.status}
                                onValueChange={(value) => handleUpdateTask(task.id, { status: value as TaskStatus })}
                              >
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
                              <Label className="text-xs text-muted-foreground">Life Domain</Label>
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

                          <TagPicker
                            selected={taskTagsById[String(task.id)] || []}
                            onChange={(tags) => saveTaskTags(task.id, tags)}
                          />

                          <TaskChecklist taskId={Number(task.id)} />

                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {task.due_date ? (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>{formatDate(task.due_date)}</span>
                              </div>
                            ) : (
                              <span>No due date</span>
                            )}
                            {task.due_time && (
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{formatTime(task.due_time)}</span>
                              </div>
                            )}
                            {task.email_reminder && task.reminder_at && (
                              <Badge variant="outline" className="gap-1 py-0 text-xs">
                                <Bell className="h-3 w-3" />
                                Reminder set
                              </Badge>
                            )}
                            {task.scheduled_date && (
                              <div className="flex items-center gap-2">
                                <CalendarClock className="h-3.5 w-3.5" />
                                <span>
                                  Scheduled {formatDate(task.scheduled_date)}
                                  {task.scheduled_time ? ` at ${formatTime(task.scheduled_time)}` : ""}
                                </span>
                              </div>
                            )}
                            {task.duration_minutes ? (
                              <div className="flex items-center gap-2">
                                <Timer className="h-3.5 w-3.5" />
                                <span>{formatDuration(task.duration_minutes)}</span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 self-end md:self-start">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openReminderDialog(task)}
                            className="text-muted-foreground hover:text-primary"
                            title="Set dates, duration & reminder"
                          >
                            <Bell className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Delete task"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                />
              )}
          </TabsContent>
        </Tabs>

        <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Dates, Duration & Reminder</DialogTitle>
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
    </DashboardLayout>
  )
}
