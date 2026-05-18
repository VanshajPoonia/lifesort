"use client"

import React from "react"
import { X } from "lucide-react" // Import X from lucide-react

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import {
  Target,
  Shield,
  Menu,
  Settings,
  LayoutGrid,
  CalendarCheck,
  Wrench,
  Coffee,
  Crown,
  Wallet,
  LogOut,
  Plus,
  Activity,
  Inbox,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { DailyPopup } from "@/components/daily-popup"
import { QuickAddModal } from "@/components/quick-add-modal"
import { GlobalSearch } from "@/components/global-search"
import { NotificationBell } from "@/components/notification-bell"

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  showGreeting?: boolean
}

const DEFAULT_SIDEBAR_PREFS = {
  home: true,
  plan: true,
  money: true,
  life_admin: true,
  settings: true,
  admin: true,
  dashboard: true,
  reset: true,
  rules: true,
  someday: true,
  inbox: true,
  waiting: true,
  commitments: true,
  maintenance: true,
  today: true,
  review: true,
  insights: true,
  life_areas: true,
  projects: true,
  people: true,
  vault: true,
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
  habits: true,
  capture: true,
  templates: true,
  timeline: true,
  notifications: true,
}

type SidebarItem = {
  id: keyof typeof DEFAULT_SIDEBAR_PREFS
  label: string
  href: string
  icon: React.ElementType
  aliases?: string[]
  adminOnly?: boolean
  legacyFallback?: keyof typeof DEFAULT_SIDEBAR_PREFS
}

const HUB_NAV_ITEMS: SidebarItem[] = [
  { id: "home", label: "Home", href: "/", icon: LayoutGrid, legacyFallback: "dashboard" },
  { id: "today", label: "Today", href: "/today", icon: CalendarCheck },
  {
    id: "plan",
    label: "Plan",
    href: "/plan",
    icon: Target,
    aliases: ["/tasks", "/goals", "/projects", "/habits", "/calendar", "/waiting", "/commitments", "/someday", "/nuke", "/pomodoro"],
  },
  {
    id: "capture",
    label: "Capture",
    href: "/capture",
    icon: Inbox,
    aliases: ["/inbox", "/notes", "/links", "/custom-sections", "/templates", "/daily-content"],
  },
  {
    id: "money",
    label: "Money",
    href: "/money",
    icon: Wallet,
    aliases: ["/budget", "/income", "/investments", "/wishlist"],
  },
  {
    id: "life_admin",
    label: "Life Admin",
    href: "/life-admin",
    icon: Wrench,
    aliases: ["/people", "/vault", "/maintenance", "/notifications"],
  },
  {
    id: "insights",
    label: "Insights",
    href: "/insights",
    icon: Activity,
    aliases: ["/review", "/timeline", "/reset", "/ai-chat", "/life-areas"],
  },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings, aliases: ["/rules"] },
  { id: "admin", label: "Admin", href: "/admin", icon: Shield, adminOnly: true },
]

// Module-level cache — persists across client-side navigations so the
// sidebar never re-fetches after the first successful load.
let _sidebarPrefsCache: Record<string, boolean> | null = null

export function clearSidebarPrefsCache() {
  _sidebarPrefsCache = null
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
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  useEffect(() => {
    fetchSidebarPrefs()
  }, [])
  
  const fetchSidebarPrefs = async () => {
    // 1. Module-level cache hit — instant, no network, no await.
    //    This is the common case after the first page load.
    if (_sidebarPrefsCache) {
      setSidebarPrefs(_sidebarPrefsCache)
      setPrefsLoaded(true)
      return
    }

    // 2. sessionStorage hit — instant on first page load after a hard refresh.
    try {
      const stored = sessionStorage.getItem("sidebar_prefs")
      if (stored) {
        const parsed = JSON.parse(stored)
        const prefs = { ...DEFAULT_SIDEBAR_PREFS, ...parsed }
        _sidebarPrefsCache = prefs
        setSidebarPrefs(prefs)
        setPrefsLoaded(true)
        return
      }
    } catch {
      // Corrupt cache — fall through to network.
    }

    // 3. First ever load — fetch from the API and warm both caches.
    try {
      const response = await fetch("/api/sidebar-preferences")
      if (response.ok) {
        const data = await response.json()
        if (data.preferences && typeof data.preferences === "object") {
          const prefs = { ...DEFAULT_SIDEBAR_PREFS, ...data.preferences }
          _sidebarPrefsCache = prefs
          sessionStorage.setItem("sidebar_prefs", JSON.stringify(data.preferences))
          setSidebarPrefs(prefs)
        } else {
          _sidebarPrefsCache = DEFAULT_SIDEBAR_PREFS
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
  const matchesPath = (href: string) => href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)
  const isActiveItem = (item: SidebarItem) => matchesPath(item.href) || Boolean(item.aliases?.some(matchesPath))
  const isItemVisible = (item: SidebarItem) => {
    if (item.adminOnly && !user?.is_admin) return false
    if (prefs[item.id] !== undefined) return prefs[item.id]
    if (item.legacyFallback && prefs[item.legacyFallback] !== undefined) return prefs[item.legacyFallback]
    return true
  }
  const navButtonClass = (item: SidebarItem) =>
    `w-full justify-start gap-3 ${isActiveItem(item) ? "text-secondary-foreground" : "text-foreground hover:text-foreground hover:bg-secondary"}`
  const navIconClass = (item: SidebarItem) => `h-5 w-5 ${isActiveItem(item) ? "text-secondary-foreground" : "text-foreground"}`

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
      <QuickAddModal open={quickAddOpen} onOpenChange={setQuickAddOpen} />
      
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
              <Image
                src="/lifesort-logo.png"
                alt="LifeSort"
                width={40}
                height={40}
                className="h-10 w-10 rounded-lg object-contain"
                priority
              />
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

            <div className="space-y-1">
              {HUB_NAV_ITEMS.filter(isItemVisible).map((item) => {
                const Icon = item.icon
                const active = isActiveItem(item)
                return (
                  <Link key={item.id} href={item.href} onClick={() => setSidebarOpen(false)}>
                    <Button variant={active ? "secondary" : "ghost"} className={navButtonClass(item)}>
                      <Icon className={navIconClass(item)} />
                      {item.label}
                    </Button>
                  </Link>
                )
              })}
            </div>
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
          <GlobalSearch />
          <Button className="gap-2" onClick={() => setQuickAddOpen(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Quick Add</span>
            <span className="sm:hidden">Add</span>
          </Button>
          <ThemeSwitcher />
          <NotificationBell />
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
