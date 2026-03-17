"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import {
  Target,
  CheckSquare,
  Clock,
  Timer,
  Heart,
  TrendingUp,
  DollarSign,
  Menu,
  Search,
  Bell,
  Settings,
  LayoutGrid,
  Calendar as CalendarIcon,
  Zap,
  Activity,
  FileText,
  Sparkles,
  FolderPlus,
  Link2,
  Crown,
  Coffee,
  X,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { DailyPopup } from "@/components/daily-popup"
import { OnboardingModal } from "@/components/onboarding-modal"

const DEFAULT_SIDEBAR_PREFS = {
  dashboard: true,
  calendar: true,
  links: true,
  daily_content: true,
  budget: true,
  custom_sections: true,
  notes: true,
  tasks: true,
  goals: true,
  bookmarks: true,
  wishlist: true,
  nuke: true,
  pomodoro: true,
  investments: true,
  income: true,
  ai_assistant: true,
}

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [sidebarPrefs, setSidebarPrefs] = useState<Record<string, boolean> | null>(null)
  const [stats, setStats] = useState({
    goalsCompleted: 0,
    totalGoals: 0,
    tasksToday: 0,
    tasksCompleted: 0,
    pomodoroSessions: 0,
    investmentValue: 0,
    incomeStreams: 0,
  })
  const [recentActivity, setRecentActivity] = useState([
    { text: "Completed morning workout", time: "2 hours ago", type: "task" },
    { text: "Finished 3 Pomodoro sessions", time: "3 hours ago", type: "pomodoro" },
    { text: "Added new goal: Learn Spanish", time: "Yesterday", type: "goal" },
    { text: "Investment portfolio +2.4%", time: "Yesterday", type: "investment" },
  ])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
      return
    }
    
    if (user) {
      // Check subscription status
      const now = new Date()
      const trialEnd = user.trial_ends_at ? new Date(user.trial_ends_at) : null
      const hasActiveSubscription = user.is_subscribed && 
        user.subscription_ends_at && 
        new Date(user.subscription_ends_at) > now

      // Show upgrade button if no active subscription
      if (!hasActiveSubscription) {
        setShowUpgrade(true)
      }
      
      // Check onboarding status
      checkOnboarding()
      fetchStats()
      fetchSidebarPrefs()
    }
  }, [user, loading, router])

  const fetchSidebarPrefs = async () => {
    try {
      // Check sessionStorage cache first
      const cached = sessionStorage.getItem("sidebar_prefs")
      if (cached) {
        try {
          const cachedPrefs = JSON.parse(cached)
          setSidebarPrefs({ ...DEFAULT_SIDEBAR_PREFS, ...cachedPrefs })
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }
      
      const response = await fetch("/api/sidebar-preferences")
      if (response.ok) {
        const data = await response.json()
        if (data.preferences && typeof data.preferences === 'object') {
          const finalPrefs = { ...DEFAULT_SIDEBAR_PREFS, ...data.preferences }
          setSidebarPrefs(finalPrefs)
          sessionStorage.setItem("sidebar_prefs", JSON.stringify(data.preferences))
        } else {
          setSidebarPrefs(DEFAULT_SIDEBAR_PREFS)
        }
      } else {
        setSidebarPrefs(DEFAULT_SIDEBAR_PREFS)
      }
    } catch (error) {
      console.error("Error fetching sidebar preferences:", error)
      setSidebarPrefs(DEFAULT_SIDEBAR_PREFS)
    }
  }

  // Fetch real stats from database
  useEffect(() => {
    if (user) {
      fetchStats()
    }
  }, [user])

  const checkOnboarding = async () => {
    try {
      // Check if onboarding was just completed in this session
      const onboardingSkipped = sessionStorage.getItem("onboarding_completed")
      if (onboardingSkipped === "true") {
        return
      }
      
      const response = await fetch("/api/onboarding")
      
      if (response.ok) {
        const data = await response.json()
        
        // Only show onboarding if explicitly false (not null, undefined, or error)
        if (data.onboarding_completed === false) {
          setShowOnboarding(true)
        } else {
          // Mark as completed in session storage to avoid repeated checks
          sessionStorage.setItem("onboarding_completed", "true")
        }
      }
    } catch (error) {
      console.error("Error checking onboarding:", error)
    }
  }

  const fetchStats = async () => {
    try {
      const activities: Array<{text: string, time: string, type: string}> = []

      // Fetch goals stats
      const goalsRes = await fetch('/api/goals')
      if (goalsRes.ok) {
        const goals = await goalsRes.json()
        const totalGoals = goals.length
        const goalsCompleted = goals.filter((g: any) => g.status === 'completed').length
        setStats(prev => ({ ...prev, totalGoals, goalsCompleted }))
        
        // Add recent goals to activity
        goals.slice(0, 2).forEach((goal: any) => {
          const timeAgo = getTimeAgo(new Date(goal.created_at))
          activities.push({
            text: `Goal: ${goal.title}`,
            time: timeAgo,
            type: 'goal'
          })
        })
      }

      // Fetch tasks stats
      const tasksRes = await fetch('/api/tasks')
      if (tasksRes.ok) {
        const tasks = await tasksRes.json()
        const today = new Date().toDateString()
        const todayTasks = tasks.filter((t: any) => 
          new Date(t.created_at).toDateString() === today
        )
        const tasksToday = todayTasks.length
        const tasksCompleted = todayTasks.filter((t: any) => t.completed).length
        setStats(prev => ({ ...prev, tasksToday, tasksCompleted }))
        
        // Add completed tasks to activity
        tasks.filter((t: any) => t.completed).slice(0, 2).forEach((task: any) => {
          const timeAgo = getTimeAgo(new Date(task.updated_at || task.created_at))
          activities.push({
            text: `Completed: ${task.title}`,
            time: timeAgo,
            type: 'task'
          })
        })
      }

      // Fetch investments stats
      const investmentsRes = await fetch('/api/investments')
      if (investmentsRes.ok) {
        const investments = await investmentsRes.json()
        const investmentValue = investments.reduce((sum: number, inv: any) => sum + parseFloat(inv.current_value || inv.amount || 0), 0)
        setStats(prev => ({ ...prev, investmentValue }))
        
        // Add recent investment to activity
        if (investments.length > 0) {
          const latestInv = investments[0]
          const timeAgo = getTimeAgo(new Date(latestInv.created_at))
          activities.push({
            text: `Investment: ${latestInv.name}`,
            time: timeAgo,
            type: 'investment'
          })
        }
      }

      // Sort by most recent and take top 4
      setRecentActivity(activities.slice(0, 4).sort((a, b) => new Date(b.time) - new Date(a.time)))
    } catch (error) {
      console.error('[v0] Failed to fetch stats:', error)
    }
  }

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
    return date.toLocaleDateString()
  }

  // Use defaults while loading, then use actual prefs
  const prefs = sidebarPrefs || DEFAULT_SIDEBAR_PREFS

  const quickActions = [
    {
      title: "Goals",
      description: "Track your life goals",
      icon: Target,
      href: "/goals",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Daily Tasks",
      description: "Today's to-do list",
      icon: CheckSquare,
      href: "/tasks",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Nuke Goal",
      description: "Major milestone tracker",
      icon: Zap,
      href: "/nuke",
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Pomodoro",
      description: "Focus timer",
      icon: Timer,
      href: "/pomodoro",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "Wishlist",
      description: "Things you want",
      icon: Heart,
      href: "/wishlist",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Investments",
      description: "Track your assets",
      icon: TrendingUp,
      href: "/investments",
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Budget",
      description: "Manage finances",
      icon: DollarSign,
      href: "/budget",
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ]

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false)
          // Mark as completed in session to prevent showing again during this session
          sessionStorage.setItem("onboarding_completed", "true")
          // Clear sidebar cache so it reloads with new preferences
          sessionStorage.removeItem("sidebar_prefs")
          // Small delay to ensure database write completes before reload
          setTimeout(() => {
            window.location.reload()
          }, 500)
        }}
      />
      
      {/* Daily Popup */}
      <DailyPopup />
      
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-50 w-64 md:relative md:translate-x-0 border-r border-border bg-card transition-transform duration-300`}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center justify-between border-b border-border px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                <LayoutGrid className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                LifeSort
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {/* Go Pro Button - Highlighted for non-premium users */}
            {showUpgrade && (
              <a 
                href="https://buymeacoffee.com/lifesort" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block mb-3"
              >
                <Button 
                  className="w-full justify-start gap-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/50"
                >
                  <Crown className="h-5 w-5" />
                  <span className="font-bold">Go Pro</span>
                  <Coffee className="h-4 w-4 ml-auto" />
                </Button>
              </a>
            )}

            {prefs.dashboard && (
              <Link href="/">
                <Button variant="secondary" className="w-full justify-start gap-3 text-secondary-foreground">
                  <LayoutGrid className="h-5 w-5 text-secondary-foreground" />
                  Dashboard
                </Button>
              </Link>
            )}
            {prefs.calendar && (
              <Link href="/calendar">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <CalendarIcon className="h-5 w-5 text-foreground" />
                  Calendar
                </Button>
              </Link>
            )}
            {prefs.goals && (
              <Link href="/goals">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <Target className="h-5 w-5 text-foreground" />
                  Goals
                </Button>
              </Link>
            )}
            {prefs.tasks && (
              <Link href="/tasks">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <CheckSquare className="h-5 w-5 text-foreground" />
                  Daily Tasks
                </Button>
              </Link>
            )}
            {prefs.nuke && (
              <Link href="/nuke">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <Zap className="h-5 w-5 text-foreground" />
                  Nuke Goal
                </Button>
              </Link>
            )}
            {prefs.pomodoro && (
              <Link href="/pomodoro">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <Timer className="h-5 w-5 text-foreground" />
                  Pomodoro
                </Button>
              </Link>
            )}
            {prefs.notes && (
              <Link href="/notes">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <FileText className="h-5 w-5 text-foreground" />
                  Notes
                </Button>
              </Link>
            )}
            {prefs.wishlist && (
              <Link href="/wishlist">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <Heart className="h-5 w-5 text-foreground" />
                  Wishlist
                </Button>
              </Link>
            )}
            {prefs.investments && (
              <Link href="/investments">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <TrendingUp className="h-5 w-5 text-foreground" />
                  Investments
                </Button>
              </Link>
            )}
            {prefs.income && (
              <Link href="/income">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <DollarSign className="h-5 w-5 text-foreground" />
                  Income
                </Button>
              </Link>
            )}
            <div className="my-2 h-px bg-border" />
            {prefs.links && (
              <Link href="/links">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <Link2 className="h-5 w-5 text-foreground" />
                  My Links
                </Button>
              </Link>
            )}
            {prefs.daily_content && (
              <Link href="/daily-content">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <Sparkles className="h-5 w-5 text-foreground" />
                  Daily Quotes & Games
                </Button>
              </Link>
            )}
            {prefs.custom_sections && (
              <Link href="/custom-sections">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <FolderPlus className="h-5 w-5 text-foreground" />
                  Custom Sections
                </Button>
              </Link>
            )}
            {prefs.ai_assistant && (
              <Link href="/ai-chat">
                <Button variant="ghost" className="w-full justify-start gap-3 text-foreground hover:text-foreground hover:bg-secondary">
                  <Sparkles className="h-5 w-5 text-foreground" />
                  AI Assistant
                </Button>
              </Link>
            )}
          </nav>

          {/* User Profile */}
          <div className="border-t border-border p-4">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">ID: {user?.id}</p>
              </div>
<Link href="/settings">
  <Button variant="ghost" size="icon" title="Settings">
    <Settings className="h-4 w-4 text-foreground" />
  </Button>
</Link>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search..." className="w-48 lg:w-64 pl-9" />
            </div>
            <ThemeSwitcher />
            <Button variant="ghost" size="icon" className="hidden sm:flex">
              <Bell className="h-5 w-5 text-foreground" />
            </Button>
<Link href="/settings">
  <Button variant="ghost" size="icon" className="hidden sm:flex">
    <Settings className="h-5 w-5 text-foreground" />
  </Button>
</Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
        {/* Welcome Section */}
          <div className="rounded-lg bg-gradient-to-r from-primary/20 to-accent/20 p-6">
            <h2 className="text-2xl font-bold text-foreground">Welcome back, {user?.name?.split(" ")[0] || "there"}!</h2>
            <p className="mt-2 text-muted-foreground">
              Here's an overview of your life organization. Keep pushing forward!
            </p>
            </div>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Goals Progress</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.goalsCompleted}/{stats.totalGoals}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stats.totalGoals > 0 ? Math.round((stats.goalsCompleted / stats.totalGoals) * 100) : 0}% complete
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tasks Today</CardTitle>
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.tasksCompleted}/{stats.tasksToday}
                  </div>
                  <p className="text-xs text-muted-foreground">Keep going!</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pomodoro Sessions</CardTitle>
                  <Timer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pomodoroSessions}</div>
                  <p className="text-xs text-muted-foreground">Today's focus time</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Investments</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${stats.investmentValue.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">Current portfolio value</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div>
              <h3 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {quickActions.map((action, index) => (
                  <Link key={index} href={action.href}>
                    <Card className="group cursor-pointer transition-all hover:border-primary hover:shadow-lg">
                      <CardHeader>
                        <div className="flex items-center gap-4">
                          <div className={`rounded-lg ${action.bgColor} p-3`}>
                            <action.icon className={`h-6 w-6 ${action.color}`} />
                          </div>
                          <div>
                            <CardTitle className="text-base">{action.title}</CardTitle>
                            <CardDescription className="text-sm">{action.description}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Your latest updates and achievements</CardDescription>
              </CardHeader>
              <CardContent>
                {recentActivity.length > 0 ? (
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                          <Activity className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{activity.text}</p>
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                        </div>
                        <Badge variant="outline">{activity.type}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent activity. Start by adding a goal or task!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  )
}
