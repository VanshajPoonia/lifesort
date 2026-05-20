"use client"

import React from "react"
import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import {
  Shield,
  Settings,
  LayoutGrid,
  CalendarCheck,
  Coffee,
  Wallet,
  LogOut,
  Plus,
  Activity,
  Archive,
  MoreHorizontal,
  Search,
  User,
  HelpCircle,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpenText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { QuickAddModal, type QuickAddType } from "@/components/quick-add-modal"
import { GlobalCommandPalette } from "@/components/global-command-palette"
import { NotificationBell } from "@/components/notification-bell"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { motionPresets } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
  subtitle?: string
  showGreeting?: boolean
}

const DEFAULT_SIDEBAR_PREFS = {
  home: true,
  workspace: true,
  organize: true,
  reflect: true,
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
  journal: true,
  whiteboard: true,
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
  { id: "journal", label: "Journal", href: "/journal", icon: BookOpenText },
  {
    id: "workspace",
    label: "Workspace",
    href: "/workspace",
    icon: Archive,
    aliases: [
      "/organize",
      "/plan",
      "/capture",
      "/life-admin",
      "/tasks",
      "/goals",
      "/projects",
      "/habits",
      "/calendar",
      "/waiting",
      "/commitments",
      "/someday",
      "/nuke",
      "/pomodoro",
      "/inbox",
      "/notes",
      "/links",
      "/custom-sections",
      "/templates",
      "/daily-content",
      "/people",
      "/vault",
      "/maintenance",
      "/notifications",
      "/whiteboard",
    ],
    legacyFallback: "organize",
  },
  {
    id: "money",
    label: "Money",
    href: "/money",
    icon: Wallet,
    aliases: ["/budget", "/income", "/investments", "/wishlist"],
  },
  {
    id: "reflect",
    label: "Reflect",
    href: "/reflect",
    icon: Activity,
    aliases: ["/insights", "/review", "/timeline", "/reset", "/ai-chat", "/life-areas"],
  },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings, aliases: ["/rules"] },
  { id: "admin", label: "Admin", href: "/admin", icon: Shield, adminOnly: true },
]

const MOBILE_PRIMARY_ITEMS = HUB_NAV_ITEMS.filter((item) =>
  ["home", "today", "workspace", "money"].includes(item.id),
)

// Module-level cache — persists across client-side navigations so the
// sidebar never re-fetches after the first successful load.
let _sidebarPrefsCache: Record<string, boolean> | null = null

function applyWorkspacePreferenceFallback(preferences: Record<string, boolean>) {
  if (preferences.workspace === undefined && preferences.organize !== undefined) {
    return { ...preferences, workspace: preferences.organize }
  }
  return preferences
}

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
  const { isTablet } = useBreakpoint()
  const [sidebarPrefs, setSidebarPrefs] = useState<Record<string, boolean> | null>(null)
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddInitialType, setQuickAddInitialType] = useState<QuickAddType | null>(null)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandPaletteMode, setCommandPaletteMode] = useState<"all" | "capture">("all")
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    try {
      setSidebarCollapsed(localStorage.getItem("sidebar-collapsed") === "true")
    } catch {
      setSidebarCollapsed(false)
    }
  }, [])

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
        const prefs = { ...DEFAULT_SIDEBAR_PREFS, ...applyWorkspacePreferenceFallback(parsed) }
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
          const prefs = { ...DEFAULT_SIDEBAR_PREFS, ...applyWorkspacePreferenceFallback(data.preferences) }
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
  const railMode = isTablet || sidebarCollapsed
  const navButtonClass = (item: SidebarItem) =>
    `h-10 w-full max-w-full min-w-0 overflow-hidden rounded-lg border border-transparent text-sm transition-all duration-150 ease-out active:scale-[0.99] motion-reduce:transition-none motion-reduce:transform-none ${
      railMode ? "justify-center gap-0 px-2" : "justify-start gap-3 px-3"
    } ${
      isActiveItem(item)
        ? "border-primary/20 bg-primary/10 text-primary shadow-sm"
        : "text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground"
    }`
  const navIconClass = (item: SidebarItem) => `h-4 w-4 shrink-0 ${isActiveItem(item) ? "text-primary" : "text-muted-foreground"}`
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((current) => {
      const next = !current
      try {
        localStorage.setItem("sidebar-collapsed", String(next))
      } catch {
        // Ignore localStorage failures; collapsed state can stay session-only.
      }
      return next
    })
  }

  const openCommandPalette = (mode: "all" | "capture" = "all") => {
    setCommandPaletteMode(mode)
    setCommandPaletteOpen(true)
  }

  const openQuickAdd = (type?: QuickAddType) => {
    setQuickAddInitialType(type || null)
    setQuickAddOpen(true)
  }

  return (
    <div
      className="flex overflow-hidden bg-background transition-[height,margin-top] duration-200 motion-reduce:transition-none"
      style={{
        height: "calc(100vh - var(--subscription-banner-offset, 0px))",
        marginTop: "var(--subscription-banner-offset, 0px)",
      }}
    >
      <QuickAddModal open={quickAddOpen} onOpenChange={setQuickAddOpen} initialType={quickAddInitialType} />
      <GlobalCommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        mode={commandPaletteMode}
        onOpenQuickAdd={openQuickAdd}
      />
      
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-x-0 bottom-0 top-[var(--subscription-banner-offset,0px)] z-40 bg-black/50 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-[var(--subscription-banner-offset,0px)] z-50 hidden shrink-0 overflow-hidden border-r border-border bg-card/95 shadow-sm backdrop-blur transition-[transform,width] duration-200 ease-out supports-[backdrop-filter]:bg-card/90 motion-reduce:transition-none sm:relative sm:bottom-auto sm:top-auto sm:flex sm:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          railMode ? "w-20" : "w-64",
        )}
      >
        <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
          {/* Logo */}
          <div className={cn("flex items-center justify-between border-b border-border/70 px-4 py-3", railMode && "px-3")}>
            <div className={cn("flex min-w-0 items-center gap-3", railMode && "justify-center")}>
              <Image
                src="/lifesort-logo.png"
                alt="LifeSort"
                width={40}
                height={40}
                className={cn("rounded-lg object-contain", railMode ? "h-9 w-9" : "h-10 w-10")}
                priority
              />
              <span className={cn("truncate bg-gradient-to-r from-primary to-accent bg-clip-text text-xl font-bold text-transparent", railMode && "hidden")}>
                LifeSort
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="sm:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation */}
          <nav className={cn("flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-3", railMode && "px-2")}>
            <div className="min-w-0 space-y-1">
              {HUB_NAV_ITEMS.filter(isItemVisible).map((item) => {
                const Icon = item.icon
                const active = isActiveItem(item)
                return (
                  <Button
                    key={item.id}
                    asChild
                    variant={active ? "secondary" : "ghost"}
                    className={navButtonClass(item)}
                    aria-label={item.label}
                    title={item.label}
                  >
                    <Link href={item.href} onClick={() => setSidebarOpen(false)} title={item.label} aria-label={item.label}>
                      <Icon className={navIconClass(item)} />
                      <span className={cn("min-w-0 truncate", railMode && "hidden")}>{item.label}</span>
                    </Link>
                  </Button>
                )
              })}
            </div>
          </nav>

          {/* User Profile */}
          <div className={cn("min-w-0 overflow-hidden border-t border-border/70 p-4", railMode && "p-3")}>
            <div className={cn("flex min-w-0 items-center gap-3", railMode && "flex-col justify-center gap-2")}>
              <Avatar>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className={cn("min-w-0 flex-1", railMode && "hidden")}>
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
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <header className={cn("flex items-center justify-between border-b border-border/70 bg-card/85 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/75 md:px-6", motionPresets.fadeIn)}>
        <div className="flex items-center gap-3">
          <div className="font-semibold text-foreground sm:hidden">LifeSort</div>
          {/* Greeting Section */}
          <div className="hidden sm:block">
            <p className="text-xs text-muted-foreground">{formatDate()}</p>
            <h1 className="text-lg font-semibold text-foreground">
              {getGreeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <Button
            type="button"
            variant="outline"
            className="hidden w-48 justify-start gap-2 px-3 text-muted-foreground lg:flex lg:w-64"
            onClick={() => openCommandPalette("all")}
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search or add...</span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">⌘K</kbd>
          </Button>
          <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => openCommandPalette("all")} aria-label="Search or open command palette">
            <Search className="h-5 w-5 text-foreground" />
          </Button>
          <Button className="hidden gap-2 sm:inline-flex" onClick={() => openCommandPalette("capture")}>
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
        <main className="flex-1 overflow-auto p-3 pb-24 sm:p-4 md:p-6">
          <div className="mx-auto w-full max-w-[1400px] min-w-0 space-y-5 md:space-y-6">
            {children}
          </div>
        </main>
      </div>

      <Button
        className={cn("fixed bottom-20 right-4 z-40 h-12 w-12 rounded-full shadow-lg sm:hidden", motionPresets.scaleIn, motionPresets.pressable)}
        size="icon"
        onClick={() => openCommandPalette("capture")}
        aria-label="Quick Add"
        title="Quick Add"
      >
        <Plus className="h-5 w-5" />
      </Button>

      <nav className={cn("fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 px-2 py-2 shadow-[0_-8px_24px_hsl(var(--foreground)_/_0.06)] backdrop-blur sm:hidden", motionPresets.fadeInUp)}>
        <div className="grid grid-cols-5 gap-1">
          {MOBILE_PRIMARY_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActiveItem(item)
            return (
              <Link key={item.id} href={item.href} className="min-w-0" onClick={() => setSidebarOpen(false)}>
                <span
                  className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-all duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/70"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </span>
              </Link>
            )
          })}
          <button
            type="button"
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-all duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none ${
              ["/journal", "/reflect", "/insights", "/review", "/timeline", "/reset", "/ai-chat", "/life-areas", "/settings", "/rules", "/admin"].some(matchesPath)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/70"
            }`}
            onClick={() => setMobileMoreOpen(true)}
            aria-label="More navigation"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] rounded-t-lg p-4 sm:hidden">
          <SheetHeader className="text-left">
            <SheetTitle>More</SheetTitle>
            <SheetDescription>Review, settings, profile, and support links.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid gap-2">
            {[
              { href: "/journal", label: "Journal", icon: BookOpenText },
              { href: "/reflect", label: "Reflect", icon: Activity },
              { href: "/settings", label: "Settings", icon: Settings },
              { href: "/settings?tab=profile", label: "Profile", icon: User },
              { href: "/settings?tab=faqs", label: "Support / Upgrade", icon: HelpCircle },
            ].map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMoreOpen(false)}
                  className={cn("flex min-h-12 items-center gap-3 rounded-lg border border-border/70 px-3 text-sm font-medium transition-colors hover:bg-muted", motionPresets.listItem)}
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {item.label}
                </Link>
              )
            })}
            <a
              href="https://buymeacoffee.com/lifesort"
              target="_blank"
              rel="noopener noreferrer"
              className={cn("flex min-h-12 items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10", motionPresets.listItem)}
              onClick={() => setMobileMoreOpen(false)}
            >
              <Coffee className="h-4 w-4" />
              Go Pro
            </a>
            {user?.is_admin && (
              <Link
                href="/admin"
                onClick={() => setMobileMoreOpen(false)}
                className={cn("flex min-h-12 items-center gap-3 rounded-lg border border-border/70 px-3 text-sm font-medium transition-colors hover:bg-muted", motionPresets.listItem)}
              >
                <Shield className="h-4 w-4 text-primary" />
                Admin
              </Link>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
