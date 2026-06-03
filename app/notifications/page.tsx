"use client"

import { useCallback, useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Bell,
  CheckCheck,
  CheckSquare,
  Target,
  FolderOpen,
  Flame,
  Shield,
  Users,
  ClipboardList,
  Wallet,
  Trash2,
  X,
} from "lucide-react"
import type { Notification, NotificationType } from "@/app/api/notifications/route"

const TYPE_CONFIG: Record<
  NotificationType,
  { label: string; Icon: React.ComponentType<{ className?: string }>; badge: string; dot: string }
> = {
  task_due: {
    label: "Task Due",
    Icon: CheckSquare,
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  goal_deadline: {
    label: "Goal Deadline",
    Icon: Target,
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  habit_missed: {
    label: "Habit",
    Icon: Flame,
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  project_deadline: {
    label: "Project",
    Icon: FolderOpen,
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    dot: "bg-indigo-500",
  },
  vault_expiring: {
    label: "Vault",
    Icon: Shield,
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  people_followup: {
    label: "Follow-up",
    Icon: Users,
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    dot: "bg-pink-500",
  },
  weekly_review: {
    label: "Weekly Review",
    Icon: ClipboardList,
    badge: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    dot: "bg-green-500",
  },
  budget_warning: {
    label: "Budget",
    Icon: Wallet,
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  journal_streak_milestone: {
    label: "Journal Win",
    Icon: CheckCheck,
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  habit_streak_milestone: {
    label: "Habit Win",
    Icon: Flame,
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  weekly_task_record: {
    label: "Task Record",
    Icon: CheckSquare,
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  goal_completed: {
    label: "Goal Win",
    Icon: Target,
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  budget_success: {
    label: "Budget Win",
    Icon: Wallet,
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
}

const ALL_TYPES = Object.entries(TYPE_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (isNaN(diff) || diff < 0) return "just now"
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function groupByDate(notifications: Notification[]): [string, Notification[]][] {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000)

  const groups = new Map<string, Notification[]>()

  for (const n of notifications) {
    const d = new Date(n.created_at)
    let key: string
    if (d >= todayStart) key = "Today"
    else if (d >= yesterdayStart) key = "Yesterday"
    else if (d >= weekStart) key = "This Week"
    else key = "Earlier"

    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(n)
  }

  const ORDER = ["Today", "Yesterday", "This Week", "Earlier"]
  return ORDER.filter((k) => groups.has(k)).map((k) => [k, groups.get(k)!])
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [typeFilter, setTypeFilter] = useState("all")
  const [readFilter, setReadFilter] = useState("all")

  const fetchNotifications = useCallback(() => {
    setLoading(true)
    setError(false)
    fetch("/api/notifications")
      .then((r) => {
        if (!r.ok) throw new Error("Failed")
        return r.json()
      })
      .then((d) => {
        setNotifications(d.notifications ?? [])
        setUnreadCount(d.unread_count ?? 0)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markRead = async (id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
  }

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mark_all_read: true }),
    })
  }

  const dismiss = async (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    if (notifications.find((n) => n.id === id && !n.is_read)) {
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
  }

  const clearRead = async () => {
    setNotifications((prev) => prev.filter((n) => !n.is_read))
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear_read: true }),
    })
  }

  const filtered = notifications.filter((n) => {
    if (typeFilter !== "all" && n.type !== typeFilter) return false
    if (readFilter === "unread" && n.is_read) return false
    if (readFilter === "read" && !n.is_read) return false
    return true
  })

  const hasFilters = typeFilter !== "all" || readFilter !== "all"
  const hasRead = notifications.some((n) => n.is_read)
  const groups = groupByDate(filtered)

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Bell className="h-6 w-6 text-primary" />
              Notifications
              {!loading && unreadCount > 0 && (
                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0.5 h-auto">
                  {unreadCount}
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Reminders and alerts from your life management.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1.5">
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </Button>
            )}
            {hasRead && (
              <Button variant="ghost" size="sm" onClick={clearRead} className="gap-1.5 text-muted-foreground">
                <Trash2 className="h-3.5 w-3.5" />
                Clear read
              </Button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[190px]">
                  <SelectValue placeholder="Notification type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {ALL_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={readFilter} onValueChange={setReadFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setTypeFilter("all"); setReadFilter("all") }}
                  className="text-muted-foreground"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 items-start">
                <Skeleton className="h-2 w-2 rounded-full mt-2 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground">
              Could not load notifications. Please try again.
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="pt-10 pb-10 text-center space-y-2">
              <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              {hasFilters ? (
                <>
                  <p className="text-sm font-medium">No notifications match your filters.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setTypeFilter("all"); setReadFilter("all") }}
                  >
                    Clear filters
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">You&apos;re all caught up!</p>
                  <p className="text-xs text-muted-foreground">
                    Notifications appear here when tasks are due, habits are missed, or reminders fire.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {groups.map(([period, periodItems]) => (
              <div key={period}>
                <p className="text-sm font-semibold text-foreground mb-3">{period}</p>
                <Card>
                  <CardContent className="pt-2 pb-2 divide-y divide-border">
                    {periodItems.map((n) => {
                      const config = TYPE_CONFIG[n.type]
                      if (!config) return null
                      return (
                        <div
                          key={n.id}
                          onClick={() => { if (!n.is_read) markRead(n.id) }}
                          className={`flex gap-3 items-start py-3 group transition-colors rounded-sm ${
                            !n.is_read ? "cursor-pointer hover:bg-muted/40" : "opacity-60"
                          }`}
                        >
                          <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.is_read ? "bg-muted" : config.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${config.badge}`}
                                >
                                  <config.Icon className="h-3 w-3" />
                                  {config.label}
                                </span>
                                <span className="text-sm font-medium truncate">{n.title}</span>
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                            </div>
                            {n.message && (
                              <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                            )}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); dismiss(n.id) }}
                            className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground hover:text-foreground"
                            aria-label="Dismiss notification"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
