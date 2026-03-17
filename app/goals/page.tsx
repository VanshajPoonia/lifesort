"use client"

import Link from "next/link"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import gsap from "gsap"
import {
  Target,
  CheckSquare,
  Timer,
  Heart,
  TrendingUp,
  DollarSign,
  Menu,
  LayoutGrid,
  Zap,
  Plus,
  Trash2,
  Check,
  MoreVertical,
  Calendar as CalendarIcon,
  FileText,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GoalModal } from "@/components/goal-modal"
import { AddGoalDialog } from "@/components/add-goal-dialog"
import { ThemeSwitcher } from "@/components/theme-switcher"

interface Goal {
  id: number
  title: string
  description: string
  category: string
  progress: number
  deadline: string
  target_date?: string
  status: "active" | "completed" | "paused"
  notes?: string
  comments?: Array<{id: string, text: string, author: string, timestamp: string}>
  target_value?: number | null
  current_value?: number | null
  value_unit?: string | null
}

export default function GoalsPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (user) {
      fetchGoals()
    }
  }, [user])

  useEffect(() => {
    if (goals.length > 0) {
      gsap.fromTo(
        cardsRef.current,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, stagger: 0.1, duration: 0.4, ease: "back.out(1.7)" }
      )
    }
  }, [goals.length])

  const fetchGoals = async () => {
    try {
      const response = await fetch('/api/goals')
      if (response.ok) {
        const data = await response.json()
        // Map target_date from API to deadline for frontend and calculate progress
        const mappedData = (Array.isArray(data) ? data : []).map((goal: Record<string, unknown>) => {
          const targetValue = goal.target_value as number | null
          const currentValue = goal.current_value as number | null
          
          // Calculate progress from current/target if available
          let calculatedProgress = (goal.progress as number) ?? 0
          if (targetValue && targetValue > 0 && currentValue != null) {
            calculatedProgress = Math.min(100, Math.round((currentValue / targetValue) * 100))
          }
          
          return {
            ...goal,
            deadline: goal.target_date || goal.deadline || "",
            progress: calculatedProgress,
          }
        })
        setGoals(mappedData)
      }
    } catch (error) {
      console.error('Failed to fetch goals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddGoal = async (goalData: {
    title: string
    description: string
    category: string
    target_date: string
    status: string
  }) => {
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData),
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // Process the new goal data same way as fetchGoals
        const targetValue = data.target_value as number | null
        const currentValue = data.current_value as number | null
        
        let calculatedProgress = (data.progress as number) ?? 0
        if (targetValue && targetValue > 0 && currentValue != null) {
          calculatedProgress = Math.min(100, Math.round((currentValue / targetValue) * 100))
        }
        
        const processedGoal = {
          ...data,
          deadline: data.target_date || data.deadline || "",
          progress: calculatedProgress,
        }
        
        setGoals([...goals, processedGoal])
      }
    } catch (error) {
      console.error('Failed to add goal:', error)
      throw error
    }
  }

  const handleUpdateGoal = async (id: number, updates: Partial<Goal>) => {
    try {
      // Map deadline to target_date for API
      const apiUpdates = {
        ...updates,
        target_date: updates.deadline || updates.target_date,
      }
      
      const response = await fetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...apiUpdates }),
      })
      if (response.ok) {
        const data = await response.json()
        
        // Process the response data same way as fetchGoals
        const targetValue = data.target_value as number | null
        const currentValue = data.current_value as number | null
        
        let calculatedProgress = (data.progress as number) ?? 0
        if (targetValue && targetValue > 0 && currentValue != null) {
          calculatedProgress = Math.min(100, Math.round((currentValue / targetValue) * 100))
        }
        
        const processedGoal = {
          ...data,
          deadline: data.target_date || data.deadline || "",
          progress: calculatedProgress,
        }
        
        setGoals(goals.map(goal => goal.id === id ? processedGoal : goal))
        if (selectedGoal && selectedGoal.id === id) {
          setSelectedGoal(processedGoal)
        }
      }
    } catch (error) {
      console.error('Failed to update goal:', error)
    }
  }

  const handleDeleteGoal = async (id: number) => {
    try {
      const response = await fetch('/api/goals', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (response.ok) {
        setGoals(goals.filter(goal => goal.id !== id))
        if (selectedGoal?.id === id) {
          setSelectedGoal(null)
        }
      }
    } catch (error) {
      console.error('Failed to delete goal:', error)
    }
  }

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      Education: "bg-primary/10 text-primary border-primary/30",
      Health: "bg-success/10 text-success border-success/30",
      Career: "bg-warning/10 text-warning border-warning/30",
      Personal: "bg-accent/10 text-accent border-accent/30",
      Finance: "bg-destructive/10 text-destructive border-destructive/30",
    }
    return colors[category] || "bg-muted text-muted-foreground"
  }

  const stats = {
    totalGoals: goals.length,
    activeGoals: goals.filter((g) => g.status === "active").length,
    completedGoals: goals.filter((g) => g.status === "completed").length,
    averageProgress: goals.length ? Math.round(goals.reduce((acc, goal) => acc + goal.progress, 0) / goals.length) : 0,
  }

  if (authLoading || loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const firstName = user?.name?.split(" ")[0] || "Your"

  return (
    <DashboardLayout title={`${firstName}'s Goals`} subtitle="Track and achieve your life goals">
      <div className="space-y-4 md:space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="glass border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Goals</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalGoals}</div>
            </CardContent>
          </Card>

          <Card className="glass border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Zap className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeGoals}</div>
            </CardContent>
          </Card>

          <Card className="glass border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Check className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedGoals}</div>
            </CardContent>
          </Card>

          <Card className="glass border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageProgress}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Add Goal Button */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">My Goals</h2>
            <p className="text-sm text-muted-foreground">Click any goal to view and edit details</p>
          </div>
          <Button type="button" onClick={() => setIsAddDialogOpen(true)} className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Goal</span>
          </Button>
        </div>

        {/* Goals List */}
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((goal, index) => (
            <Card
              key={goal.id}
              ref={(el) => {cardsRef.current[index] = el}}
              className={`glass-strong border transition-all hover:shadow-lg cursor-pointer ${goal.status === "completed" ? "opacity-60" : ""}`}
              onClick={() => setSelectedGoal(goal)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className={`text-base ${goal.status === "completed" ? "line-through" : ""}`}>
                        {goal.title}
                      </CardTitle>
                      <Badge className={getCategoryColor(goal.category)}>{goal.category}</Badge>
                    </div>
                    <CardDescription className="mt-2 line-clamp-2">{goal.description}</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation()
                        handleUpdateGoal(goal.id, { status: goal.status === "completed" ? "active" : "completed" })
                      }}>
                        {goal.status === "completed" ? "Mark as Active" : "Mark as Complete"}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteGoal(goal.id)
                        }} 
                        className="text-destructive"
                      >
                        Delete Goal
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
                      {goal.target_value != null && goal.target_value > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {goal.current_value ?? 0}/{goal.target_value}{goal.value_unit ? ` ${goal.value_unit}` : ""}
                        </span>
                      )}
                      <span className="font-medium text-foreground">{goal.progress ?? 0}%</span>
                    </div>
                  </div>
                  <Progress value={goal.progress ?? 0} className="h-2" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Target className="h-4 w-4" />
                    <span>Deadline:</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {goal.deadline && !isNaN(new Date(goal.deadline).getTime()) 
                      ? new Date(goal.deadline).toLocaleDateString() 
                      : 'No deadline set'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {goals.length === 0 && (
          <Card className="glass-strong border">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">No goals yet</h3>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Start by creating your first goal and tracking your progress
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      {/* Add Goal Dialog */}
      <AddGoalDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={handleAddGoal}
      />

      {/* Goal Modal */}
      {selectedGoal && (
        <GoalModal
          goal={selectedGoal}
          open={!!selectedGoal}
          onClose={() => setSelectedGoal(null)}
          onUpdate={(updatedGoal) => handleUpdateGoal(updatedGoal.id, updatedGoal)}
          onDelete={(id) => handleDeleteGoal(Number(id))}
        />
      )}
    </DashboardLayout>
  )
}
