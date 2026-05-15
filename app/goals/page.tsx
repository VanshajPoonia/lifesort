"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Calendar, Clock, MoreVertical, Plus, Target, TrendingUp, Zap } from "lucide-react"

import { AddGoalDialog } from "@/components/add-goal-dialog"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { GoalModal } from "@/components/goal-modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type GoalStatus = "active" | "completed" | "paused"
type GoalFilter = GoalStatus | "overdue"
type Priority = "low" | "medium" | "high"
type PriorityFilter = Priority | "all"

export interface Goal {
  id: number
  title: string
  description: string | null
  category: string
  target_date: string | null
  status: GoalStatus
  priority: Priority
  progress: number
  target_value: number | null
  current_value: number | null
  value_unit: string | null
  email_reminder: boolean
  reminder_days: number
  reminder_sent?: boolean
}

export interface GoalTask {
  id: number
  title: string
  completed: boolean
  priority: Priority
  due_date: string | null
  goal_id: number | null
}

type AddGoalPayload = {
  title: string
  description: string
  category: string
  target_date: string
  status: string
  priority: string
  email_reminder?: boolean
  reminder_days?: number
  target_value?: number | null
  current_value?: number | null
  value_unit?: string | null
}

const statusTabs: Array<{ value: GoalFilter; label: string }> = [
  { value: "active", label: "Active" },
  { value: "overdue", label: "Overdue" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
]

const priorityOptions: Array<{ value: PriorityFilter; label: string }> = [
  { value: "all", label: "All priorities" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

function cleanDate(value: unknown) {
  if (!value) return null
  const date = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

function cleanNumber(value: unknown, fallback: number | null = null) {
  if (value === null || value === undefined || value === "") return fallback
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : fallback
}

function cleanProgress(value: unknown) {
  const parsed = cleanNumber(value, 0) ?? 0
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

function cleanStatus(value: unknown): GoalStatus {
  if (value === "completed" || value === "paused") return value
  return "active"
}

function cleanPriority(value: unknown): Priority {
  if (value === "low" || value === "high") return value
  return "medium"
}

function normalizeGoal(goal: Record<string, unknown>): Goal {
  const targetValue = cleanNumber(goal.target_value)
  const currentValue = cleanNumber(goal.current_value, targetValue ? 0 : null)
  const derivedProgress =
    targetValue && targetValue > 0 && currentValue !== null
      ? Math.min(100, Math.round((currentValue / targetValue) * 100))
      : cleanProgress(goal.progress)

  return {
    id: Number(goal.id),
    title: String(goal.title || "Untitled goal"),
    description: typeof goal.description === "string" ? goal.description : null,
    category: typeof goal.category === "string" && goal.category.trim() ? goal.category : "personal",
    target_date: cleanDate(goal.target_date),
    status: cleanStatus(goal.status === "in_progress" ? "active" : goal.status),
    priority: cleanPriority(goal.priority),
    progress: derivedProgress,
    target_value: targetValue,
    current_value: currentValue,
    value_unit: typeof goal.value_unit === "string" && goal.value_unit.trim() ? goal.value_unit : null,
    email_reminder: Boolean(goal.email_reminder && goal.target_date),
    reminder_days: Number.isFinite(Number(goal.reminder_days)) ? Number(goal.reminder_days) : 3,
    reminder_sent: Boolean(goal.reminder_sent),
  }
}

function normalizeTask(task: Record<string, unknown>): GoalTask {
  return {
    id: Number(task.id),
    title: String(task.title || "Untitled task"),
    completed: Boolean(task.completed),
    priority: cleanPriority(task.priority),
    due_date: cleanDate(task.due_date),
    goal_id: task.goal_id ? Number(task.goal_id) : null,
  }
}

function isOverdue(goal: Goal) {
  if (!goal.target_date || goal.status === "completed") return false
  const today = new Date().toISOString().slice(0, 10)
  return goal.target_date < today
}

function formatDate(value: string | null) {
  if (!value) return "No deadline"
  return new Date(`${value}T00:00:00`).toLocaleDateString()
}

function getPriorityColor(priority: Priority) {
  const colors = {
    high: "border-destructive/30 bg-destructive/10 text-destructive",
    medium: "border-warning/30 bg-warning/10 text-warning",
    low: "border-success/30 bg-success/10 text-success",
  }

  return colors[priority]
}

function getStatusColor(goal: Goal) {
  if (isOverdue(goal)) return "border-destructive/30 bg-destructive/10 text-destructive"
  if (goal.status === "completed") return "border-success/30 bg-success/10 text-success"
  if (goal.status === "paused") return "border-muted bg-muted text-muted-foreground"
  return "border-primary/30 bg-primary/10 text-primary"
}

function emptyMessage(filter: GoalFilter) {
  const messages = {
    active: "No active goals yet",
    overdue: "No overdue goals",
    paused: "No paused goals",
    completed: "No completed goals yet",
  }

  return messages[filter]
}

export default function GoalsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [goals, setGoals] = useState<Goal[]>([])
  const [tasks, setTasks] = useState<GoalTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<GoalFilter>("active")
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all")
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [authLoading, router, user])

  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function fetchData() {
      setLoading(true)
      setError(null)

      try {
        const [goalsResponse, tasksResponse] = await Promise.all([fetch("/api/goals"), fetch("/api/tasks")])

        if (!goalsResponse.ok) {
          throw new Error("Failed to load goals")
        }

        const goalsData = await goalsResponse.json()
        const tasksData = tasksResponse.ok ? await tasksResponse.json() : []

        if (!cancelled) {
          setGoals((Array.isArray(goalsData) ? goalsData : []).map(normalizeGoal))
          setTasks((Array.isArray(tasksData) ? tasksData : []).map(normalizeTask))
        }
      } catch (fetchError) {
        console.error("Failed to fetch goals:", fetchError)
        if (!cancelled) {
          setError("Goals are unavailable right now.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [user])

  const filteredGoals = useMemo(() => {
    return goals
      .filter((goal) => {
        if (activeFilter === "overdue") return isOverdue(goal)
        return goal.status === activeFilter
      })
      .filter((goal) => priorityFilter === "all" || goal.priority === priorityFilter)
  }, [activeFilter, goals, priorityFilter])

  const stats = useMemo(() => {
    return {
      totalGoals: goals.length,
      activeGoals: goals.filter((goal) => goal.status === "active").length,
      overdueGoals: goals.filter(isOverdue).length,
      averageProgress: goals.length
        ? Math.round(goals.reduce((total, goal) => total + goal.progress, 0) / goals.length)
        : 0,
    }
  }, [goals])

  async function handleAddGoal(goalData: AddGoalPayload) {
    const response = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(goalData),
    })

    if (!response.ok) {
      throw new Error("Failed to add goal")
    }

    const data = await response.json()
    setGoals((current) => [normalizeGoal(data), ...current])
  }

  async function handleUpdateGoal(id: number, updates: Partial<Goal>) {
    const response = await fetch("/api/goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    })

    if (!response.ok) {
      throw new Error("Failed to update goal")
    }

    const data = normalizeGoal(await response.json())
    setGoals((current) => current.map((goal) => (goal.id === id ? data : goal)))
    setSelectedGoal((current) => (current?.id === id ? data : current))
  }

  async function handleDeleteGoal(id: number) {
    const response = await fetch("/api/goals", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })

    if (!response.ok) {
      throw new Error("Failed to delete goal")
    }

    setGoals((current) => current.filter((goal) => goal.id !== id))
    setTasks((current) => current.map((task) => (task.goal_id === id ? { ...task, goal_id: null } : task)))
    setSelectedGoal((current) => (current?.id === id ? null : current))
  }

  async function updateTaskGoal(taskId: number, goalId: number | null) {
    const response = await fetch("/api/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, goal_id: goalId }),
    })

    if (!response.ok) {
      throw new Error("Failed to update linked task")
    }

    const updatedTask = normalizeTask(await response.json())
    setTasks((current) => current.map((task) => (task.id === taskId ? updatedTask : task)))
  }

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading goals...</p>
        </div>
      </div>
    )
  }

  const firstName = user?.name?.split(" ")[0] || "Your"

  return (
    <DashboardLayout title={`${firstName}'s Goals`} subtitle="Track priorities, deadlines, and progress">
      <div className="space-y-4 md:space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard title="Total Goals" value={stats.totalGoals} icon={<Target className="h-4 w-4 text-muted-foreground" />} />
          <StatCard title="Active" value={stats.activeGoals} icon={<Zap className="h-4 w-4 text-primary" />} />
          <StatCard title="Overdue" value={stats.overdueGoals} icon={<Clock className="h-4 w-4 text-destructive" />} />
          <StatCard title="Progress" value={`${stats.averageProgress}%`} icon={<TrendingUp className="h-4 w-4 text-success" />} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">My Goals</h2>
            <p className="text-sm text-muted-foreground">Filter, edit, and link tasks to your goals.</p>
          </div>
          <Button type="button" onClick={() => setIsAddDialogOpen(true)} className="gap-2 sm:w-auto">
            <Plus className="h-4 w-4" />
            Add Goal
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={activeFilter} onValueChange={(value) => setActiveFilter(value as GoalFilter)}>
            <TabsList className="grid w-full grid-cols-4 lg:w-auto">
              {statusTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value as PriorityFilter)}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="glass-strong border">
                <CardHeader>
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="glass-strong border">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{error}</h3>
              <p className="mt-2 text-sm text-muted-foreground">Refresh the page or try again in a moment.</p>
            </CardContent>
          </Card>
        ) : filteredGoals.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredGoals.map((goal) => (
              <Card
                key={goal.id}
                className={`glass-strong border transition-all hover:shadow-lg cursor-pointer ${
                  goal.status === "completed" ? "opacity-70" : ""
                }`}
                onClick={() => setSelectedGoal(goal)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle className={`text-base ${goal.status === "completed" ? "line-through" : ""}`}>
                          {goal.title}
                        </CardTitle>
                        <Badge className={getStatusColor(goal)} variant="outline">
                          {isOverdue(goal) ? "overdue" : goal.status}
                        </Badge>
                        <Badge className={getPriorityColor(goal.priority)} variant="outline">
                          {goal.priority}
                        </Badge>
                      </div>
                      <CardDescription className="mt-2 line-clamp-2">
                        {goal.description || "No description added."}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation()
                            handleUpdateGoal(goal.id, { status: goal.status === "completed" ? "active" : "completed" })
                          }}
                        >
                          {goal.status === "completed" ? "Mark active" : "Mark complete"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation()
                            handleUpdateGoal(goal.id, { status: goal.status === "paused" ? "active" : "paused" })
                          }}
                        >
                          {goal.status === "paused" ? "Resume goal" : "Pause goal"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteGoal(goal.id)
                          }}
                          className="text-destructive"
                        >
                          Delete goal
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <div className="flex items-center gap-2">
                        {goal.target_value !== null && goal.target_value > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {goal.current_value ?? 0}/{goal.target_value}
                            {goal.value_unit ? ` ${goal.value_unit}` : ""}
                          </span>
                        )}
                        <span className="font-medium text-foreground">{goal.progress}%</span>
                      </div>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{formatDate(goal.target_date)}</span>
                    </div>
                    <Badge variant="outline">{goal.category}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="glass-strong border">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Target className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">{emptyMessage(activeFilter)}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {goals.length === 0
                  ? "Create your first goal and start tracking progress."
                  : "Try another status or priority filter."}
              </p>
              {goals.length === 0 && (
                <Button className="mt-4 gap-2" onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add Goal
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AddGoalDialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)} onAdd={handleAddGoal} />

      <GoalModal
        goal={selectedGoal}
        open={!!selectedGoal}
        tasks={selectedGoal ? tasks.filter((task) => task.goal_id === selectedGoal.id) : []}
        availableTasks={tasks.filter((task) => !task.goal_id)}
        onClose={() => setSelectedGoal(null)}
        onUpdate={handleUpdateGoal}
        onDelete={handleDeleteGoal}
        onLinkTask={(taskId) => {
          if (selectedGoal) return updateTaskGoal(taskId, selectedGoal.id)
        }}
        onUnlinkTask={(taskId) => updateTaskGoal(taskId, null)}
      />
    </DashboardLayout>
  )
}

function StatCard({ title, value, icon }: { title: string; value: number | string; icon: ReactNode }) {
  return (
    <Card className="glass border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}
