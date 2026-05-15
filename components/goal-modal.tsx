"use client"

import { useEffect, useMemo, useState } from "react"
import { Calendar, Link2, Target, Trash2, Unlink, X } from "lucide-react"

import { ReminderSettings } from "@/components/reminder-settings"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

type GoalStatus = "active" | "completed" | "paused"
type Priority = "low" | "medium" | "high"

interface Goal {
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
}

interface GoalTask {
  id: number
  title: string
  completed: boolean
  priority: Priority
  due_date: string | null
  goal_id: number | null
}

interface GoalModalProps {
  goal: Goal | null
  open: boolean
  tasks: GoalTask[]
  availableTasks: GoalTask[]
  onClose: () => void
  onUpdate: (id: number, updates: Partial<Goal>) => Promise<void> | void
  onDelete?: (id: number) => Promise<void> | void
  onLinkTask?: (taskId: number) => Promise<void> | void
  onUnlinkTask?: (taskId: number) => Promise<void> | void
}

function calculateProgress(currentValue: number | null, targetValue: number | null, fallback: number) {
  if (targetValue && targetValue > 0 && currentValue !== null) {
    return Math.min(100, Math.max(0, Math.round((currentValue / targetValue) * 100)))
  }

  return Math.min(100, Math.max(0, Math.round(fallback)))
}

function formatTaskDate(value: string | null) {
  if (!value) return "No due date"
  return new Date(`${value}T00:00:00`).toLocaleDateString()
}

export function GoalModal({
  goal,
  open,
  tasks,
  availableTasks,
  onClose,
  onUpdate,
  onDelete,
  onLinkTask,
  onUnlinkTask,
}: GoalModalProps) {
  const [localGoal, setLocalGoal] = useState<Goal | null>(goal)
  const [selectedTaskId, setSelectedTaskId] = useState("")
  const [savingTaskLink, setSavingTaskLink] = useState(false)

  useEffect(() => {
    setLocalGoal(goal)
    setSelectedTaskId("")
  }, [goal])

  const sortedAvailableTasks = useMemo(() => {
    return [...availableTasks].sort((a, b) => Number(a.completed) - Number(b.completed) || a.title.localeCompare(b.title))
  }, [availableTasks])

  if (!localGoal) return null

  async function updateGoal(updates: Partial<Goal>) {
    if (!localGoal) return

    const currentGoal = localGoal
    const nextGoal: Goal = { ...currentGoal, ...updates }
    setLocalGoal(nextGoal)
    await onUpdate(currentGoal.id, updates)
  }

  async function linkSelectedTask() {
    const taskId = Number(selectedTaskId)
    if (!taskId || !onLinkTask) return

    setSavingTaskLink(true)
    try {
      await onLinkTask(taskId)
      setSelectedTaskId("")
    } finally {
      setSavingTaskLink(false)
    }
  }

  async function unlinkTask(taskId: number) {
    if (!onUnlinkTask) return

    setSavingTaskLink(true)
    try {
      await onUnlinkTask(taskId)
    } finally {
      setSavingTaskLink(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="goal-modal-content max-w-4xl max-h-[85vh] overflow-hidden p-0 bg-background border border-border shadow-2xl [&>button]:hidden">
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{localGoal.category}</Badge>
                <Badge variant="outline">{localGoal.priority}</Badge>
                <Badge variant="outline">{localGoal.status}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this goal?")) {
                      onDelete(localGoal.id)
                      onClose()
                    }
                  }}
                  className="rounded-full hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain p-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="goal-title">Title</Label>
                  <Input
                    id="goal-title"
                    value={localGoal.title}
                    onChange={(event) => setLocalGoal({ ...localGoal, title: event.target.value })}
                    onBlur={() => updateGoal({ title: localGoal.title })}
                    className="text-lg font-semibold"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal-description">Description</Label>
                  <Textarea
                    id="goal-description"
                    value={localGoal.description || ""}
                    onChange={(event) => setLocalGoal({ ...localGoal, description: event.target.value })}
                    onBlur={() => updateGoal({ description: localGoal.description })}
                    placeholder="Add a description..."
                    className="min-h-[120px]"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Progress</Label>
                    <span className="text-sm font-bold text-primary">{localGoal.progress}%</span>
                  </div>
                  <Progress value={localGoal.progress} className="h-3" />

                  <div className="rounded-lg bg-muted/50 p-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="goal-current" className="text-xs text-muted-foreground">
                          Current
                        </Label>
                        <Input
                          id="goal-current"
                          type="number"
                          min="0"
                          value={localGoal.current_value ?? ""}
                          onChange={(event) => {
                            const currentValue = event.target.value ? Number.parseFloat(event.target.value) : null
                            setLocalGoal({
                              ...localGoal,
                              current_value: currentValue,
                              progress: calculateProgress(currentValue, localGoal.target_value, localGoal.progress),
                            })
                          }}
                          onBlur={() =>
                            updateGoal({
                              current_value: localGoal.current_value,
                              progress: localGoal.progress,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="goal-target" className="text-xs text-muted-foreground">
                          Target
                        </Label>
                        <Input
                          id="goal-target"
                          type="number"
                          min="1"
                          value={localGoal.target_value ?? ""}
                          onChange={(event) => {
                            const targetValue = event.target.value ? Number.parseFloat(event.target.value) : null
                            setLocalGoal({
                              ...localGoal,
                              target_value: targetValue,
                              progress: calculateProgress(localGoal.current_value, targetValue, localGoal.progress),
                            })
                          }}
                          onBlur={() =>
                            updateGoal({
                              target_value: localGoal.target_value,
                              progress: localGoal.progress,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="goal-unit" className="text-xs text-muted-foreground">
                          Unit
                        </Label>
                        <Input
                          id="goal-unit"
                          value={localGoal.value_unit || ""}
                          onChange={(event) => setLocalGoal({ ...localGoal, value_unit: event.target.value || null })}
                          onBlur={() => updateGoal({ value_unit: localGoal.value_unit })}
                          placeholder="pages, km"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="goal-progress" className="text-xs text-muted-foreground">
                      Manual percentage
                    </Label>
                    <input
                      id="goal-progress"
                      type="range"
                      min="0"
                      max="100"
                      value={localGoal.progress}
                      onChange={(event) => {
                        const progress = Number.parseInt(event.target.value, 10)
                        const updates: Partial<Goal> = { progress }

                        if (localGoal.target_value) {
                          updates.current_value = Math.round((progress / 100) * localGoal.target_value)
                        }

                        setLocalGoal({ ...localGoal, ...updates })
                      }}
                      onMouseUp={(event) => {
                        const progress = Number.parseInt((event.target as HTMLInputElement).value, 10)
                        const updates: Partial<Goal> = { progress }

                        if (localGoal.target_value) {
                          updates.current_value = Math.round((progress / 100) * localGoal.target_value)
                        }

                        updateGoal(updates)
                      }}
                      onTouchEnd={(event) => {
                        const progress = Number.parseInt((event.target as HTMLInputElement).value, 10)
                        const updates: Partial<Goal> = { progress }

                        if (localGoal.target_value) {
                          updates.current_value = Math.round((progress / 100) * localGoal.target_value)
                        }

                        updateGoal(updates)
                      }}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <Label>Related Tasks</Label>
                  </div>

                  {tasks.length > 0 ? (
                    <div className="space-y-2">
                      {tasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
                          <div className="min-w-0">
                            <p className={`truncate text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatTaskDate(task.due_date)}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={savingTaskLink}
                            onClick={() => unlinkTask(task.id)}
                            aria-label="Unlink task"
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">No tasks linked to this goal yet.</p>
                  )}

                  {sortedAvailableTasks.length > 0 && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an unlinked task" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedAvailableTasks.map((task) => (
                            <SelectItem key={task.id} value={String(task.id)}>
                              {task.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={linkSelectedTask} disabled={!selectedTaskId || savingTaskLink}>
                        Link
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={localGoal.status} onValueChange={(value) => updateGoal({ status: value as GoalStatus })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={localGoal.priority} onValueChange={(value) => updateGoal({ priority: value as Priority })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal-category">Category</Label>
                  <Input
                    id="goal-category"
                    value={localGoal.category}
                    onChange={(event) => setLocalGoal({ ...localGoal, category: event.target.value })}
                    onBlur={() => updateGoal({ category: localGoal.category || "personal" })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal-deadline">Deadline</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="goal-deadline"
                      type="date"
                      value={localGoal.target_date || ""}
                      onChange={(event) => {
                        const targetDate = event.target.value || null
                        updateGoal({
                          target_date: targetDate,
                          email_reminder: targetDate ? localGoal.email_reminder : false,
                        })
                      }}
                    />
                  </div>
                </div>

                {localGoal.target_date && (
                  <ReminderSettings
                    enabled={localGoal.email_reminder}
                    reminderDays={localGoal.reminder_days}
                    onEnabledChange={(enabled) => updateGoal({ email_reminder: enabled })}
                    onReminderDaysChange={(days) => updateGoal({ reminder_days: days })}
                  />
                )}
              </aside>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
