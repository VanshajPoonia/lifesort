"use client"

import React from "react"
import { useState, useEffect, useCallback, useLayoutEffect, useRef, useSyncExternalStore } from "react"
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
  Paintbrush,
  Sparkles,
  Target,
  Compass,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { QuickAddModal, type QuickAddType } from "@/components/quick-add-modal"
import { GlobalCommandPalette } from "@/components/global-command-palette"
import { NotificationBell } from "@/components/notification-bell"
import { useDomainFocus } from "@/components/domain-focus-provider"
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
  domains: true,
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
  spaces: true,
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

// Sidebar groups follow the spirit of the full-product spec's §4 grouped nav
// (TODAY / PLAN / LIFE DOMAINS / WORKSPACE / UTILITIES), reconciled onto
// LifeSort's actual hub set rather than copied literally -- our hubs already
// consolidate many spec-level features (e.g. Workspace bundles Tasks/Goals/
// Calendar/Inbox/...), so grouping applies one level up. See AI_BUILD_PLAN.md
// Phase 0 "Nav restructure" and AI_TASK_LOG.md for the reasoning.
type SidebarGroup = "today" | "domains" | "workspace" | "reflect" | "utilities"

const GROUP_ORDER: SidebarGroup[] = ["today", "domains", "workspace", "reflect", "utilities"]
const GROUP_LABELS: Record<SidebarGroup, string> = {
  today: "Today",
  domains: "Life Domains",
  workspace: "Workspace",
  reflect: "Reflect",
  utilities: "Utilities",
}

type SidebarItem = {
  id: keyof typeof DEFAULT_SIDEBAR_PREFS
  label: string
  href: string
  icon: React.ElementType
  group: SidebarGroup
  aliases?: string[]
  adminOnly?: boolean
  legacyFallback?: keyof typeof DEFAULT_SIDEBAR_PREFS
}

const HUB_NAV_ITEMS: SidebarItem[] = [
  { id: "home", label: "Home", href: "/", icon: LayoutGrid, group: "today", legacyFallback: "dashboard" },
  { id: "today", label: "Today", href: "/today", icon: CalendarCheck, group: "today" },
  {
    id: "domains",
    label: "Domains",
    href: "/domains",
    icon: Compass,
    group: "domains",
    aliases: ["/life-areas"],
  },
  {
    id: "workspace",
    label: "Workspace",
    href: "/workspace",
    icon: Archive,
    group: "workspace",
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
      "/spaces",
    ],
    legacyFallback: "organize",
  },
  { id: "journal", label: "Journal", href: "/journal", icon: BookOpenText, group: "workspace" },
  { id: "whiteboard", label: "Whiteboard", href: "/whiteboard", icon: Paintbrush, group: "workspace" },
  {
    id: "money",
    label: "Money",
    href: "/money",
    icon: Wallet,
    group: "workspace",
    aliases: ["/budget", "/income", "/investments", "/wishlist"],
  },
  {
    id: "reflect",
    label: "Reflect",
    href: "/reflect",
    icon: Activity,
    group: "reflect",
    aliases: ["/insights", "/review", "/timeline", "/reset"],
  },
  { id: "ai_assistant", label: "Coach", href: "/ai-chat", icon: Sparkles, group: "reflect" },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings, group: "utilities", aliases: ["/rules"] },
  { id: "admin", label: "Admin", href: "/admin", icon: Shield, group: "utilities", adminOnly: true },
]

const MOBILE_PRIMARY_ITEMS = HUB_NAV_ITEMS.filter((item) =>
  ["home", "today", "workspace", "money"].includes(item.id),
)

// Module-level cache — persists across client-side navigations so the
// sidebar never re-fetches after the first successful load.
let _sidebarPrefsCache: Record<string, boolean> | null = null
// Every page mounts its own DashboardLayout, so these survive the remount:
// the collapsed rail doesn't flash open, and the nav highlight can glide
// from where the previous page left it.
let _sidebarCollapsedCache: boolean | null = null
let _lastNavIndicator: { top: number; height: number } | null = null

// useLayoutEffect warns during SSR; this page shell only measures in the browser.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

function subscribeToNothing() {
  return () => {}
}

function useShortcutLabel() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "⌘K",
  )
}

function applyWorkspacePreferenceFallback(preferences: Record<string, boolean>) {
  if (preferences.workspace === undefined && preferences.organize !== undefined) {
    return { ...preferences, workspace: preferences.organize }
  }
  return preferences
}

export function clearSidebarPrefsCache() {
  _sidebarPrefsCache = null
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { focus: domainFocus, clearFocus: clearDomainFocus } = useDomainFocus()
  const { isTablet } = useBreakpoint()
  const [sidebarPrefs, setSidebarPrefs] = useState<Record<string, boolean> | null>(null)
  const [, setPrefsLoaded] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddInitialType, setQuickAddInitialType] = useState<QuickAddType | null>(null)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [commandPaletteMode, setCommandPaletteMode] = useState<"all" | "capture">("all")
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => _sidebarCollapsedCache ?? false)
  const shortcutLabel = useShortcutLabel()
  const navListRef = useRef<HTMLDivElement>(null)
  const navIndicatorRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (_sidebarCollapsedCache !== null) return
    // Flagged by react-hooks/set-state-in-effect: hydrates the collapsed
    // state from localStorage on first mount only; later page mounts read
    // the module cache synchronously so the rail never flashes open.
    try {
      _sidebarCollapsedCache = localStorage.getItem("sidebar-collapsed") === "true"
    } catch {
      _sidebarCollapsedCache = false
    }
    setSidebarCollapsed(_sidebarCollapsedCache)
  }, [])

  const fetchSidebarPrefs = useCallback(async () => {
    // 1. Module-level cache hit — instant, no network, no await.
    //    This is the common case after the first page load.
    if (_sidebarPrefsCache) {
      return _sidebarPrefsCache
    }

    // 2. sessionStorage hit — instant on first page load after a hard refresh.
    try {
      const stored = sessionStorage.getItem("sidebar_prefs")
      if (stored) {
        const parsed = JSON.parse(stored)
        const prefs = { ...DEFAULT_SIDEBAR_PREFS, ...applyWorkspacePreferenceFallback(parsed) }
        _sidebarPrefsCache = prefs
        return prefs
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
          return prefs
        }
        _sidebarPrefsCache = DEFAULT_SIDEBAR_PREFS
        return DEFAULT_SIDEBAR_PREFS
      }
      return DEFAULT_SIDEBAR_PREFS
    } catch (error) {
      console.error("Error fetching sidebar preferences:", error)
      return DEFAULT_SIDEBAR_PREFS
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchSidebarPrefs().then((prefs) => {
      if (cancelled) return
      setSidebarPrefs(prefs)
      setPrefsLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [fetchSidebarPrefs])


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
  const visibleNavItems = HUB_NAV_ITEMS.filter(isItemVisible)
  const activeNavId = visibleNavItems.find(isActiveItem)?.id ?? null
  const visibleNavKey = visibleNavItems.map((item) => item.id).join(",")
  const navLinkClass = (item: SidebarItem) =>
    cn(
      "relative flex h-9 w-full min-w-0 items-center overflow-hidden rounded-lg text-sm transition-colors duration-150 ease-out active:scale-[0.99] motion-reduce:transform-none",
      railMode ? "justify-center px-2" : "justify-start gap-3 px-3",
      isActiveItem(item) ? "font-medium text-primary" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
    )
  const navIconClass = (item: SidebarItem) => `h-4 w-4 shrink-0 ${isActiveItem(item) ? "text-primary" : "text-muted-foreground"}`
  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((current) => {
      const next = !current
      _sidebarCollapsedCache = next
      try {
        localStorage.setItem("sidebar-collapsed", String(next))
      } catch {
        // Ignore localStorage failures; collapsed state can stay session-only.
      }
      return next
    })
  }

  // Glide the shared highlight onto the active row. Written straight to the
  // DOM (no state) so it never triggers a second render of the shell.
  useIsomorphicLayoutEffect(() => {
    const list = navListRef.current
    const indicator = navIndicatorRef.current
    if (!list || !indicator) return

    const place = (animate: boolean) => {
      const activeRow = list.querySelector<HTMLElement>('[data-active="true"]')
      if (!activeRow) {
        indicator.style.opacity = "0"
        return
      }
      const next = { top: activeRow.offsetTop, height: activeRow.offsetHeight }
      if (!animate) indicator.style.transition = "none"
      indicator.style.transform = `translateY(${next.top}px)`
      indicator.style.height = `${next.height}px`
      indicator.style.opacity = "1"
      if (!animate) {
        void indicator.offsetHeight
        indicator.style.transition = ""
      }
      _lastNavIndicator = next
    }

    if (indicator.dataset.seeded !== "1") {
      // First run for this mount: start where the previous page left off.
      // Re-runs (StrictMode, rail toggle, prefs loading) skip this and glide
      // from wherever the highlight currently is.
      indicator.dataset.seeded = "1"
      const previous = _lastNavIndicator
      if (previous) {
        indicator.style.transition = "none"
        indicator.style.transform = `translateY(${previous.top}px)`
        indicator.style.height = `${previous.height}px`
        indicator.style.opacity = "1"
        void indicator.offsetHeight
        indicator.style.transition = ""
        place(true)
      } else {
        place(false)
      }
    } else {
      place(true)
    }
    list.dataset.indicator = "on"

    const onResize = () => place(false)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [activeNavId, railMode, visibleNavKey])

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
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow-lg focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
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
        aria-label="Sidebar"
        className={cn(
          "fixed bottom-0 left-0 top-[var(--subscription-banner-offset,0px)] z-50 hidden shrink-0 overflow-hidden border-r border-border bg-canvas-soft transition-[transform,width] duration-200 ease-out motion-reduce:transition-none sm:relative sm:bottom-auto sm:top-auto sm:flex sm:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          railMode ? "w-[4.5rem]" : "w-64",
        )}
      >
        <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
          {/* Logo */}
          <div className={cn("flex h-14 shrink-0 items-center justify-between px-4", railMode && "justify-center px-2")}>
            <Link href="/" className={cn("flex min-w-0 items-center gap-2.5 rounded-lg", railMode && "justify-center")}>
              <Image
                src="/lifesort-logo.png"
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg object-contain"
                priority
              />
              <span className={cn("truncate text-[17px] font-semibold tracking-tight text-foreground", railMode && "sr-only")}>
                LifeSort
              </span>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              className="sm:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </Button>
            {!railMode && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-8 w-8 text-muted-foreground lg:inline-flex"
                onClick={toggleSidebarCollapsed}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Navigation */}
          <nav aria-label="Main" className={cn("flex-1 overflow-y-auto overflow-x-hidden px-3 pb-3 pt-1", railMode && "px-2")}>
            <div ref={navListRef} className="nav-list relative space-y-4">
              <span
                ref={navIndicatorRef}
                aria-hidden="true"
                className="nav-indicator pointer-events-none absolute inset-x-0 top-0 rounded-lg bg-primary-tint opacity-0"
              >
                <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-full bg-primary" />
              </span>
              {GROUP_ORDER.map((group) => {
                const items = visibleNavItems.filter((item) => item.group === group)
                if (items.length === 0) return null
                return (
                  <div key={group} className="min-w-0 space-y-0.5">
                    <p className={cn("px-3 pb-1 text-[11px] font-medium text-muted-foreground", railMode && "sr-only")}>
                      {GROUP_LABELS[group]}
                    </p>
                    {items.map((item) => {
                      const Icon = item.icon
                      const active = isActiveItem(item)
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={navLinkClass(item)}
                          aria-current={active ? "page" : undefined}
                          data-active={active ? "true" : undefined}
                          title={railMode ? item.label : undefined}
                        >
                          <Icon className={navIconClass(item)} aria-hidden="true" />
                          <span className={cn("min-w-0 truncate", railMode && "sr-only")}>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </nav>

          {railMode && !isTablet && (
            <div className="flex justify-center pb-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={toggleSidebarCollapsed}
                aria-label="Expand sidebar"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* User Profile */}
          <div className={cn("min-w-0 overflow-hidden border-t border-border/70 p-3", railMode && "px-2")}>
            <div className={cn("flex min-w-0 items-center gap-2.5", railMode && "flex-col gap-1.5")}>
              <Avatar className="h-8 w-8" aria-hidden="true">
                <AvatarFallback className="bg-primary-tint text-sm font-semibold text-primary">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className={cn("min-w-0 flex-1", railMode && "sr-only")}>
                <p className="truncate text-sm font-medium text-foreground">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {domainFocus && (
        <div role="status" className="flex items-center justify-between gap-2 border-b border-border/70 bg-primary-tint px-3 py-1.5 text-sm md:px-6">
          <span className="flex min-w-0 items-center gap-2 text-foreground">
            <Target className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">
              Focused on <span className="font-medium text-primary">{domainFocus.name}</span>
              <span className="hidden text-muted-foreground sm:inline">. Today, Search and suggestions are filtered.</span>
            </span>
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2 text-muted-foreground" onClick={clearDomainFocus}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Exit focus
          </Button>
        </div>
      )}
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background px-3 md:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2 rounded-lg sm:hidden">
          <Image src="/lifesort-logo.png" alt="" width={28} height={28} className="h-7 w-7 rounded-md object-contain" />
          <span className="font-semibold tracking-tight text-foreground">LifeSort</span>
        </Link>
        <Button
          type="button"
          variant="outline"
          className="hidden h-9 w-full max-w-sm justify-start gap-2 border-border bg-card px-3 font-normal text-muted-foreground shadow-none hover:bg-card hover:text-foreground sm:flex"
          onClick={() => openCommandPalette("all")}
          aria-keyshortcuts="Meta+K Control+K"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1 text-left">Search or jump to...</span>
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{shortcutLabel}</kbd>
        </Button>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button type="button" variant="ghost" size="icon" className="sm:hidden" onClick={() => openCommandPalette("all")} aria-label="Search">
            <Search className="h-5 w-5 text-foreground" />
          </Button>
          <Button className="hidden h-9 gap-2 sm:inline-flex" onClick={() => openCommandPalette("capture")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Quick Add
          </Button>
          <ThemeSwitcher />
          <NotificationBell />
        </div>
      </header>

        {/* Page Content */}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto p-4 pb-28 outline-none sm:pb-6 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1400px] min-w-0 space-y-5 md:space-y-6">
            {children}
          </div>
        </main>
      </div>

      <Button
        className={cn("fixed bottom-[5.25rem] right-4 z-40 h-12 w-12 rounded-full shadow-[0_6px_20px_hsl(var(--primary)/0.35)] sm:hidden", motionPresets.pressable)}
        size="icon"
        onClick={() => openCommandPalette("capture")}
        aria-label="Quick Add"
      >
        <Plus className="h-5 w-5" />
      </Button>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur sm:hidden">
        <div className="grid grid-cols-5 gap-1">
          {MOBILE_PRIMARY_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActiveItem(item)
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors duration-150 ease-out active:scale-[0.97] motion-reduce:transform-none",
                  active ? "bg-primary-tint text-primary" : "text-muted-foreground hover:bg-muted/70",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
          <button
            type="button"
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium transition-colors duration-150 ease-out active:scale-[0.97] motion-reduce:transform-none",
              ["/journal", "/whiteboard", "/reflect", "/insights", "/review", "/timeline", "/reset", "/ai-chat", "/life-areas", "/domains", "/settings", "/rules", "/admin"].some(matchesPath)
                ? "bg-primary-tint text-primary"
                : "text-muted-foreground hover:bg-muted/70",
            )}
            onClick={() => setMobileMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={mobileMoreOpen}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={mobileMoreOpen} onOpenChange={setMobileMoreOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] rounded-t-lg p-4 sm:hidden">
          <SheetHeader className="text-left">
            <SheetTitle>More</SheetTitle>
            <SheetDescription>Everything else in LifeSort.</SheetDescription>
          </SheetHeader>
          <div className={cn("mt-3 grid divide-y divide-border/70", motionPresets.staggerContainer)}>
            {[
              { href: "/domains", label: "Domains", icon: Compass },
              { href: "/journal", label: "Journal", icon: BookOpenText },
              { href: "/whiteboard", label: "Whiteboard", icon: Paintbrush },
              { href: "/ai-chat", label: "LifeSort Coach", icon: Sparkles },
              { href: "/reflect", label: "Reflect", icon: Activity },
              { href: "/settings", label: "Settings", icon: Settings },
              { href: "/settings?tab=profile", label: "Profile", icon: User },
              { href: "/settings?tab=faqs", label: "Support / Upgrade", icon: HelpCircle },
              ...(user?.is_admin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
            ].map((item) => {
              const Icon = item.icon
              const active = matchesPath(item.href.split("?")[0]) && !item.href.includes("?")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors hover:bg-muted",
                    active && "text-primary",
                  )}
                >
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {item.label}
                </Link>
              )
            })}
            <a
              href="https://buymeacoffee.com/lifesort"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-sm font-medium text-primary transition-colors hover:bg-primary-tint"
              onClick={() => setMobileMoreOpen(false)}
            >
              <Coffee className="h-4 w-4" aria-hidden="true" />
              Go Pro
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMoreOpen(false)
                logout()
              }}
              className="flex min-h-12 items-center gap-3 rounded-lg px-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
