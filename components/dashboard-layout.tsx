"use client"

import React from "react"
import { X } from "lucide-react" // Import X from lucide-react

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import {
  Target,
  CheckSquare,
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
  FileText,
  Sparkles,
  FolderPlus,
  Link2,
  Coffee,
  Crown,
  Wallet,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { DailyPopup } from "@/components/daily-popup"

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  showGreeting?: boolean
}

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

export function DashboardLayout({ children, title, subtitle, showGreeting = false }: DashboardLayoutProps) {
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good Morning"
    if (hour < 17) return "Good Afternoon"
    return "Good Evening"
  }
  
  const formatDate = () => {
    return new Date().toLocaleDateString("en-US", { 
      weekday: "long", 
      day: "numeric", 
      month: "long" 
    })
  }
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [sidebarPrefs, setSidebarPrefs] = useState<Record<string, boolean> | null>(null)
  const [prefsLoaded, setPrefsLoaded] = useState(false)

  useEffect(() => {
    fetchSidebarPrefs()
  }, [])
  
  const fetchSidebarPrefs = async () => {
    try {
      // Check sessionStorage cache first for instant load
      const cached = sessionStorage.getItem("sidebar_prefs")
      if (cached) {
        try {
          const cachedPrefs = JSON.parse(cached)
          setSidebarPrefs({ ...DEFAULT_SIDEBAR_PREFS, ...cachedPrefs })
          setPrefsLoaded(true)
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }
      
      const response = await fetch("/api/sidebar-preferences")
      if (response.ok) {
        const data = await response.json()
        if (data.preferences && typeof data.preferences === 'object') {
          // Merge with defaults to ensure all keys exist
          const finalPrefs = { ...DEFAULT_SIDEBAR_PREFS, ...data.preferences }
          setSidebarPrefs(finalPrefs)
          // Cache in sessionStorage for faster loads on navigation
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
    } finally {
      setPrefsLoaded(true)
    }
  }
  
  // Use defaults while loading, then use actual prefs
  const prefs = sidebarPrefs || DEFAULT_SIDEBAR_PREFS
  const isActivePath = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
  const navButtonClass = (href: string) =>
    `w-full justify-start gap-3 ${isActivePath(href) ? "text-secondary-foreground" : "text-foreground hover:text-foreground hover:bg-secondary"}`
  const navIconClass = (href: string) => `h-5 w-5 ${isActivePath(href) ? "text-secondary-foreground" : "text-foreground"}`

  useEffect(() => {
    if (!user) return

    const now = new Date()
    const trialEnd = new Date(user.trial_ends_at)
    const hasActiveSubscription = user.is_subscribed && 
      user.subscription_ends_at && 
      new Date(user.subscription_ends_at) > now

    // Show upgrade button if trial expired or trial is active but not subscribed
    if (!hasActiveSubscription) {
      setShowUpgrade(true)
    }
  }, [user])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Daily Content Popup */}
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
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
                <LayoutGrid className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">LifeSort</span>
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
          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {/* Go Pro Button - Highlighted for non-premium users */}
            {showUpgrade && (
              <a 
                href="https://buymeacoffee.com/lifesort" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block mb-3"
              >
                <Button 
                  className="w-full justify-start gap-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 text-white shadow-lg shadow-amber-500/30"
                >
                  <Crown className="h-5 w-5" />
                  <span className="font-bold">Go Pro</span>
                  <Coffee className="h-4 w-4 ml-auto" />
                </Button>
              </a>
            )}

            {prefs.dashboard && (
              <Link href="/">
                <Button variant={isActivePath("/") ? "secondary" : "ghost"} className={navButtonClass("/")}>
                  <LayoutGrid className={navIconClass("/")} />
                  Dashboard
                </Button>
              </Link>
            )}
            {prefs.calendar && (
              <Link href="/calendar">
                <Button variant={isActivePath("/calendar") ? "secondary" : "ghost"} className={navButtonClass("/calendar")}>
                  <CalendarIcon className={navIconClass("/calendar")} />
                  Calendar
                </Button>
              </Link>
            )}
            {prefs.goals && (
              <Link href="/goals">
                <Button variant={isActivePath("/goals") ? "secondary" : "ghost"} className={navButtonClass("/goals")}>
                  <Target className={navIconClass("/goals")} />
                  Goals
                </Button>
              </Link>
            )}
            {prefs.tasks && (
              <Link href="/tasks">
                <Button variant={isActivePath("/tasks") ? "secondary" : "ghost"} className={navButtonClass("/tasks")}>
                  <CheckSquare className={navIconClass("/tasks")} />
                  Daily Tasks
                </Button>
              </Link>
            )}
            {prefs.nuke && (
              <Link href="/nuke">
                <Button variant={isActivePath("/nuke") ? "secondary" : "ghost"} className={navButtonClass("/nuke")}>
                  <Zap className={navIconClass("/nuke")} />
                  Nuke Goal
                </Button>
              </Link>
            )}
            {prefs.pomodoro && (
              <Link href="/pomodoro">
                <Button variant={isActivePath("/pomodoro") ? "secondary" : "ghost"} className={navButtonClass("/pomodoro")}>
                  <Timer className={navIconClass("/pomodoro")} />
                  Pomodoro
                </Button>
              </Link>
            )}
            {prefs.notes && (
              <Link href="/notes">
                <Button variant={isActivePath("/notes") ? "secondary" : "ghost"} className={navButtonClass("/notes")}>
                  <FileText className={navIconClass("/notes")} />
                  Notes
                </Button>
              </Link>
            )}
            {prefs.wishlist && (
              <Link href="/wishlist">
                <Button variant={isActivePath("/wishlist") ? "secondary" : "ghost"} className={navButtonClass("/wishlist")}>
                  <Heart className={navIconClass("/wishlist")} />
                  Wishlist
                </Button>
              </Link>
            )}
            {prefs.investments && (
              <Link href="/investments">
                <Button variant={isActivePath("/investments") ? "secondary" : "ghost"} className={navButtonClass("/investments")}>
                  <TrendingUp className={navIconClass("/investments")} />
                  Investments
                </Button>
              </Link>
            )}
            {prefs.income && (
              <Link href="/income">
                <Button variant={isActivePath("/income") ? "secondary" : "ghost"} className={navButtonClass("/income")}>
                  <DollarSign className={navIconClass("/income")} />
                  Income
                </Button>
              </Link>
            )}
            {prefs.budget && (
              <Link href="/budget">
                <Button variant={isActivePath("/budget") ? "secondary" : "ghost"} className={navButtonClass("/budget")}>
                  <Wallet className={navIconClass("/budget")} />
                  Budget
                </Button>
              </Link>
            )}
            <div className="my-2 h-px bg-border" />
            {prefs.links && (
              <Link href="/links">
                <Button variant={isActivePath("/links") ? "secondary" : "ghost"} className={navButtonClass("/links")}>
                  <Link2 className={navIconClass("/links")} />
                  My Links
                </Button>
              </Link>
            )}
            {prefs.custom_sections && (
              <Link href="/custom-sections">
                <Button variant={isActivePath("/custom-sections") ? "secondary" : "ghost"} className={navButtonClass("/custom-sections")}>
                  <FolderPlus className={navIconClass("/custom-sections")} />
                  Custom Sections
                </Button>
              </Link>
            )}
            {prefs.daily_content && (
              <Link href="/daily-content">
                <Button variant={isActivePath("/daily-content") ? "secondary" : "ghost"} className={navButtonClass("/daily-content")}>
                  <Sparkles className={navIconClass("/daily-content")} />
                  Daily Quotes & Games
                </Button>
              </Link>
            )}
            {prefs.ai_assistant && (
              <Link href="/ai-chat">
                <Button variant={isActivePath("/ai-chat") ? "secondary" : "ghost"} className={navButtonClass("/ai-chat")}>
                  <Sparkles className={navIconClass("/ai-chat")} />
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
              <Button variant="ghost" size="icon" onClick={logout} title="Sign Out">
                <LogOut className="h-4 w-4 text-foreground" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 md:px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="md:hidden">
            <Menu className="h-5 w-5 text-foreground" />
          </Button>
          {/* Greeting Section */}
          <div className="hidden md:block">
            <p className="text-xs text-muted-foreground">{formatDate()}</p>
            <h1 className="text-lg font-semibold text-foreground">
              {getGreeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="relative hidden lg:block">
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
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
