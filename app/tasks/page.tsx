"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  Filter,
  Plus,
  Tag,
  Trash2,
  TrendingUp,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { EditableText } from "@/components/editable-text"
import { ReminderSettings } from "@/components/reminder-settings"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Priority = "low" | "medium" | "high"
type TaskView = "today" | "upcoming" | "overdue" | "completed"
type PriorityFilter = "all" | Priority
type CompletionFilter = "all" | "open" | "completed"

interface Task {
  id: number | string
  title: string
  description?: string | null
  completed: boolean
  priority: Priority
  category?: string | null
  due_date?: string | null
  due_time?: string | null
  reminder_at?: string | null
  email_reminder?: boolean | null
  reminder_days?: number | null
  reminder_sent?: boolean | null
}

interface ReminderForm {
  due_date: string
  due_time: string
  email_reminder: boolean
  reminder_days: number
}

const taskViews: Array<{ value: TaskView; label: string }> = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
]

const priorityOptions: Array<{ value: PriorityFilter; label: string }> = [
  { value: "all", label: "All priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

const completionOptions: Array<{ value: CompletionFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "completed", label: "Completed" },
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

function isUpcoming(task: Task, today = startOfToday()) {
  const dueDate = parseTaskDate(task.due_date)
  return Boolean(!task.completed && dueDate && dueDate > today)
}

function isTodayTask(task: Task, today = startOfToday()) {
  const dueDate = parseTaskDate(task.due_date)
  return Boolean(!task.completed && (!dueDate || isSameDay(dueDate, today)))
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

function getPriorityColor(priority: string) {
  const colors = {
    low: "bg-muted text-muted-foreground border-muted",
    medium: "bg-warning/10 text-warning border-warning/30",
    high: "bg-destructive/10 text-destructive border-destructive/30",
  }
  return colors[priority as keyof typeof colors] || colors.medium
}

function getStatusBadge(task: Task) {
  const today = startOfToday()
  const dueDate = parseTaskDate(task.due_date)

  if (task.completed) {
    return (
      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Completed
      </Badge>
    )
  }
  if (dueDate && dueDate < today) {
    return <Badge className="border-red-200 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Overdue</Badge>
  }
  if (isSameDay(dueDate, today)) {
    return <Badge className="border-amber-200 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Due Today</Badge>
  }
  return <Badge className="border-blue-200 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Open</Badge>
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
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [creating, setCreating] = useState(false)
  const [activeView, setActiveView] = useState<TaskView>("today")
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all")
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>("all")
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [reminderForm, setReminderForm] = useState<ReminderForm>({
    due_date: "",
    due_time: "",
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
    }
  }, [user])

  const fetchTasks = async () => {
    setLoading(true)
    setLoadError("")
    try {
      const response = await fetch("/api/tasks")
      if (!response.ok) {
        setLoadError("Tasks could not be loaded.")
        setTasks([])
        return
      }

      const data = await response.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to fetch tasks:", error)
      setLoadError("Tasks could not be loaded.")
      setTasks([])
    } finally {
      setLoading(false)
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

  const handleAddTask = async () => {
    setCreating(true)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Task",
          description: "",
          priority: "medium",
          category: null,
          completed: false,
          email_reminder: false,
        }),
      })
      if (response.ok) {
        const newTask = await response.json()
        setTasks((prev) => [newTask, ...prev])
        setActiveView("today")
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
      email_reminder: Boolean(reminderForm.email_reminder && reminderForm.due_date),
      reminder_days: reminderForm.reminder_days,
    })
    setReminderDialogOpen(false)
    setSelectedTask(null)
  }

  const stats = useMemo(() => {
    const today = startOfToday()
    const completed = tasks.filter((task) => task.completed).length
    return {
      total: tasks.length,
      completed,
      today: tasks.filter((task) => isTodayTask(task, today)).length,
      overdue: tasks.filter((task) => isOverdue(task, today)).length,
      completionRate: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
    }
  }, [tasks])

  const visibleTasks = useMemo(() => {
    const today = startOfToday()
    return tasks
      .filter((task) => {
        if (activeView === "today") return isTodayTask(task, today)
        if (activeView === "upcoming") return isUpcoming(task, today)
        if (activeView === "overdue") return isOverdue(task, today)
        return task.completed
      })
      .filter((task) => priorityFilter === "all" || task.priority === priorityFilter)
      .filter((task) => {
        if (completionFilter === "open") return !task.completed
        if (completionFilter === "completed") return task.completed
        return true
      })
      .sort(sortTasks)
  }, [activeView, completionFilter, priorityFilter, tasks])

  const emptyCopy = {
    today: {
      title: "No tasks due today",
      description: "Tasks without a due date and tasks due today will appear here.",
    },
    upcoming: {
      title: "No upcoming tasks",
      description: "Add due dates to future tasks to build your upcoming plan.",
    },
    overdue: {
      title: "No overdue tasks",
      description: "Nice. Anything past its due date will show here until it is completed.",
    },
    completed: {
      title: "No completed tasks yet",
      description: "Completed tasks will collect here as you check them off.",
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
        <div className="grid gap-4 md:grid-cols-4">
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
          <Button onClick={handleAddTask} disabled={creating} className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
            <Plus className="h-4 w-4" />
            {creating ? "Adding..." : "Add Task"}
          </Button>
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
            <TabsList className="grid w-full grid-cols-2 md:w-auto md:grid-cols-4">
              {taskViews.map((view) => (
                <TabsTrigger key={view.value} value={view.value}>
                  {view.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilter)}>
                <SelectTrigger className="min-w-[170px]">
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

              <Select value={completionFilter} onValueChange={(value) => setCompletionFilter(value as CompletionFilter)}>
                <SelectTrigger className="min-w-[170px]">
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

          {taskViews.map((view) => (
            <TabsContent key={view.value} value={view.value} className="space-y-3">
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
                  onAddTask={handleAddTask}
                />
              ) : (
                <div className="space-y-3">
                  {visibleTasks.map((task) => (
                    <Card
                      key={task.id}
                      className={`glass-strong border transition-all hover:shadow-lg ${task.completed ? "opacity-70" : ""}`}
                    >
                      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-start">
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
                              className={`min-w-[180px] font-medium text-foreground ${task.completed ? "line-through" : ""}`}
                              placeholder="Enter task name..."
                            />
                            <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                            {getStatusBadge(task)}
                          </div>

                          <EditableText
                            value={task.description || ""}
                            onSave={(value) => handleUpdateTask(task.id, { description: value || null })}
                            className="text-sm text-muted-foreground"
                            placeholder="Add description..."
                            multiline
                          />

                          <div className="grid gap-3 lg:grid-cols-[180px_1fr]">
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
                          </div>
                        </div>

                        <div className="flex items-center gap-1 self-end md:self-start">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openReminderDialog(task)}
                            className="text-muted-foreground hover:text-primary"
                            title="Set deadline and reminder"
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
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Set Deadline & Reminder</DialogTitle>
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
