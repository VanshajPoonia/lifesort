"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import gsap from "gsap"
import {
  CheckSquare,
  Plus,
  Trash2,
  Circle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { EditableText } from "@/components/editable-text"
import { ReminderSettings } from "@/components/reminder-settings"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Bell } from "lucide-react"

interface Task {
  id: number
  title: string
  description: string
  completed: boolean
  priority: "low" | "medium" | "high"
  due_time?: string
  due_date?: string
  email_reminder?: boolean
  reminder_days?: number
}

export default function TasksPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [reminderForm, setReminderForm] = useState({
    due_date: "",
    email_reminder: true,
    reminder_days: 1,
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchTasks()
    }
  }, [user])

  useEffect(() => {
    if (tasks.length > 0) {
      gsap.fromTo(
        cardsRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.1, duration: 0.5, ease: "power2.out" }
      )
    }
  }, [tasks.length])

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks')
      if (response.ok) {
        const data = await response.json()
        setTasks(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTask = async () => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Task',
          description: '',
          priority: 'medium',
        }),
      })
      if (response.ok) {
        const newTask = await response.json()
        setTasks(prev => [...prev, newTask])
        // Re-fetch to ensure we have the latest data
        await fetchTasks()
      }
    } catch (error) {
      console.error('Failed to add task:', error)
    }
  }

  const handleUpdateTask = async (id: number, updates: Partial<Task>) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
      })
      if (response.ok) {
        const data = await response.json()
        setTasks(tasks.map(task => task.id === id ? data : task))
      }
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  const handleToggleTask = async (id: number, completed: boolean) => {
    await handleUpdateTask(id, { completed })
  }

  const handleDeleteTask = async (id: number) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (response.ok) {
        setTasks(tasks.filter(task => task.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  const openReminderDialog = (task: Task) => {
    setSelectedTask(task)
    setReminderForm({
      due_date: task.due_date || "",
      email_reminder: task.email_reminder ?? true,
      reminder_days: task.reminder_days ?? 1,
    })
    setReminderDialogOpen(true)
  }

  const handleSaveReminder = async () => {
    if (!selectedTask) return
    await handleUpdateTask(selectedTask.id, {
      due_date: reminderForm.due_date,
      email_reminder: reminderForm.email_reminder,
      reminder_days: reminderForm.reminder_days,
    })
    setReminderDialogOpen(false)
    setSelectedTask(null)
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-muted text-muted-foreground border-muted",
      medium: "bg-warning/10 text-warning border-warning/30",
      high: "bg-destructive/10 text-destructive border-destructive/30",
    }
    return colors[priority as keyof typeof colors]
  }

  const getStatusBadge = (task: Task) => {
    if (task.completed) {
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">Completed</Badge>
    }
    if (task.due_date) {
      const dueDate = new Date(task.due_date)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      dueDate.setHours(0, 0, 0, 0)
      
      if (dueDate < today) {
        return <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400">Overdue</Badge>
      }
      if (dueDate.getTime() === today.getTime()) {
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400">Due Today</Badge>
      }
    }
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">In Progress</Badge>
  }

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.completed).length,
    remaining: tasks.filter(t => !t.completed).length,
    completionRate: tasks.length ? Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100) : 0,
  }

  if (authLoading || loading || !user) {
    return (
      <DashboardLayout>
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const firstName = user?.name?.split(" ")[0] || "Your"

  return (
    <DashboardLayout title={`${firstName}'s Tasks`} subtitle={new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}>
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
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
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardContent>
          </Card>

          <Card className="glass border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              <Circle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.remaining}</div>
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
        </div>

        {/* Add Task Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Today's Tasks</h2>
            <p className="text-sm text-muted-foreground">Click any task to edit it inline</p>
          </div>
          <Button onClick={handleAddTask} className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {tasks.map((task, index) => (
            <Card
              key={task.id}
              ref={(el) => {cardsRef.current[index] = el}}
              className={`glass-strong border transition-all hover:shadow-lg ${task.completed ? "opacity-60" : ""}`}
            >
              <CardContent className="flex items-center gap-4 p-4">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => handleToggleTask(task.id, !task.completed)}
                  className="h-5 w-5"
                />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <EditableText
                      value={task.title}
                      onSave={(value) => handleUpdateTask(task.id, { title: value })}
                      className={`font-medium text-foreground ${task.completed ? "line-through" : ""}`}
                      placeholder="Enter task name..."
                    />
                    <div className="flex items-center gap-2">
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                      {getStatusBadge(task)}
                    </div>
                  </div>
                  <EditableText
                    value={task.description}
                    onSave={(value) => handleUpdateTask(task.id, { description: value })}
                    className="text-sm text-muted-foreground"
                    placeholder="Add description..."
                    multiline
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    {task.due_time && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Due at {task.due_time}</span>
                      </div>
                    )}
                    {task.due_date && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(task.due_date).toLocaleDateString()}</span>
                        {task.email_reminder && (
                          <Badge variant="outline" className="text-xs py-0 px-1.5 gap-1">
                            <Bell className="h-2.5 w-2.5" />
                            {task.reminder_days}d
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openReminderDialog(task)}
                    className="text-muted-foreground hover:text-primary"
                    title="Set deadline & reminder"
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {tasks.length === 0 && (
          <Card className="glass-strong border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckSquare className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">No tasks yet</h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Add your first task to get started with your day
              </p>
            </CardContent>
          </Card>
        )}

        {/* Reminder Dialog */}
        <Dialog open={reminderDialogOpen} onOpenChange={setReminderDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Set Deadline & Reminder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="due-date">Due Date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={reminderForm.due_date}
                  onChange={(e) => setReminderForm({ ...reminderForm, due_date: e.target.value })}
                />
              </div>
              
              {reminderForm.due_date && (
                <ReminderSettings
                  enabled={reminderForm.email_reminder}
                  reminderDays={reminderForm.reminder_days}
                  onEnabledChange={(enabled) => setReminderForm({ ...reminderForm, email_reminder: enabled })}
                  onReminderDaysChange={(days) => setReminderForm({ ...reminderForm, reminder_days: days })}
                />
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReminderDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveReminder}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
