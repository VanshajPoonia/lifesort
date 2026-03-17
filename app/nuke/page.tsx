"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Trash2, Check, Zap, Target, Calendar, Loader2 } from "lucide-react"
import { ReminderSettings } from "@/components/reminder-settings"

interface Milestone {
  id: string
  title: string
  completed: boolean
}

interface NukeGoal {
  id?: string
  title: string
  description: string
  deadline: string
  milestones: Milestone[]
  completed?: boolean
  email_reminder?: boolean
  reminder_days?: number
}

export default function NukeGoalPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [nukeGoal, setNukeGoal] = useState<NukeGoal>({
    title: "",
    description: "",
    deadline: "",
    milestones: [],
    email_reminder: true,
    reminder_days: 3,
  })
  const [isEditMode, setIsEditMode] = useState(false)
  const [newMilestone, setNewMilestone] = useState("")

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchNukeGoal()
    }
  }, [user])

  const fetchNukeGoal = async () => {
    try {
      const response = await fetch("/api/nuke-goal")
      if (response.ok) {
        const data = await response.json()
        if (data) {
          const parsedMilestones = typeof data.milestones === 'string' 
            ? JSON.parse(data.milestones) 
            : data.milestones || []
          
          setNukeGoal({
            ...data,
            milestones: parsedMilestones,
          })
        }
      }
    } catch (error) {
      console.error("[v0] Error fetching nuke goal:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveGoal = async () => {
    if (!nukeGoal.title.trim()) {
      alert("Please enter a goal title")
      return
    }
    
    try {
      const response = await fetch("/api/nuke-goal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nukeGoal,
          milestones: JSON.stringify(nukeGoal.milestones),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setNukeGoal({
          ...data,
          milestones: typeof data.milestones === 'string' 
            ? JSON.parse(data.milestones) 
            : data.milestones || [],
        })
        setIsEditMode(false)
      }
    } catch (error) {
      console.error("[v0] Error saving nuke goal:", error)
    }
  }

  const handleAddMilestone = () => {
    if (newMilestone.trim()) {
      setNukeGoal({
        ...nukeGoal,
        milestones: [
          ...nukeGoal.milestones,
          {
            id: crypto.randomUUID(),
            title: newMilestone,
            completed: false,
          },
        ],
      })
      setNewMilestone("")
    }
  }

  const handleToggleMilestone = async (id: string) => {
    const updatedMilestones = nukeGoal.milestones.map((m) =>
      m.id === id ? { ...m, completed: !m.completed } : m
    )
    
    const updatedGoal = { ...nukeGoal, milestones: updatedMilestones }
    setNukeGoal(updatedGoal)

    try {
      await fetch("/api/nuke-goal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestones: updatedMilestones }),
      })
    } catch (error) {
      console.error("[v0] Error updating milestone:", error)
    }
  }

  const handleDeleteMilestone = (id: string) => {
    setNukeGoal({
      ...nukeGoal,
      milestones: nukeGoal.milestones.filter((m) => m.id !== id),
    })
  }

  const completedMilestones = nukeGoal.milestones.filter((m) => m.completed).length
  const totalMilestones = nukeGoal.milestones.length
  const progress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0

  const daysUntilDeadline = nukeGoal.deadline
    ? Math.ceil((new Date(nukeGoal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Nuke Goal" subtitle="Your one massive goal to dominate">
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title="Nuke Goal" subtitle="Your one massive goal to dominate">
      <div className="space-y-6">
        {!nukeGoal.title ? (
          <Card className="border-2 border-dashed">
            <CardHeader className="text-center">
              <Zap className="h-16 w-16 mx-auto mb-4 text-primary" />
              <CardTitle className="text-2xl">Set Your Nuke Goal</CardTitle>
              <CardDescription>
                Choose ONE massive goal to focus all your energy on. This is your nuclear option - your main mission.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => setIsEditMode(true)} size="lg">
                <Target className="mr-2 h-5 w-5" />
                Create Nuke Goal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-6 w-6 text-primary" />
                      <CardTitle className="text-2xl">{nukeGoal.title}</CardTitle>
                    </div>
                    <CardDescription className="text-base">{nukeGoal.description}</CardDescription>
                  </div>
                  <Button variant="outline" onClick={() => setIsEditMode(true)}>
                    Edit Goal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold">
                          {daysUntilDeadline !== null
                            ? daysUntilDeadline > 0
                              ? `${daysUntilDeadline} days`
                              : "Overdue"
                            : "No deadline"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {nukeGoal.deadline ? new Date(nukeGoal.deadline).toLocaleDateString() : "Set a deadline"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold">{progress.toFixed(0)}%</p>
                        <p className="text-sm text-muted-foreground">Complete</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Check className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-2xl font-bold">
                          {completedMilestones}/{totalMilestones}
                        </p>
                        <p className="text-sm text-muted-foreground">Milestones</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{progress.toFixed(0)}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Milestones</CardTitle>
                <CardDescription>Break down your nuke goal into actionable milestones</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {nukeGoal.milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleMilestone(milestone.id)}
                      >
                        <div
                          className={`h-5 w-5 rounded border-2 flex items-center justify-center ${
                            milestone.completed
                              ? "bg-primary border-primary"
                              : "border-muted-foreground"
                          }`}
                        >
                          {milestone.completed && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                      </Button>
                      <span
                        className={`flex-1 ${
                          milestone.completed ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {milestone.title}
                      </span>
                      {isEditMode && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDeleteMilestone(milestone.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}

                  {isEditMode && (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a new milestone..."
                        value={newMilestone}
                        onChange={(e) => setNewMilestone(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleAddMilestone()}
                      />
                      <Button onClick={handleAddMilestone}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        <Dialog open={isEditMode} onOpenChange={setIsEditMode}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{nukeGoal.title ? "Edit Nuke Goal" : "Create Nuke Goal"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Goal Title</Label>
                <Input
                  placeholder="Launch my SaaS product"
                  value={nukeGoal.title}
                  onChange={(e) => setNukeGoal({ ...nukeGoal, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe your massive goal in detail..."
                  value={nukeGoal.description}
                  onChange={(e) => setNukeGoal({ ...nukeGoal, description: e.target.value })}
                  rows={4}
                />
              </div>
              <div>
                <Label>Deadline</Label>
                <Input
                  type="date"
                  value={nukeGoal.deadline}
                  onChange={(e) => setNukeGoal({ ...nukeGoal, deadline: e.target.value })}
                />
              </div>
              
              {/* Email Reminder Option */}
              {nukeGoal.deadline && (
                <ReminderSettings
                  enabled={nukeGoal.email_reminder ?? true}
                  reminderDays={nukeGoal.reminder_days ?? 3}
                  onEnabledChange={(enabled) => setNukeGoal({ ...nukeGoal, email_reminder: enabled })}
                  onReminderDaysChange={(days) => setNukeGoal({ ...nukeGoal, reminder_days: days })}
                />
              )}
              
              <div className="flex gap-2">
                <Button onClick={handleSaveGoal} className="flex-1">
                  Save Goal
                </Button>
                <Button variant="outline" onClick={() => setIsEditMode(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
