"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Bell, CheckCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import type { Notification } from "@/app/api/notifications/route"

const TYPE_LABELS: Record<string, string> = {
  task_due: "Task Due",
  goal_deadline: "Goal Deadline",
  habit_missed: "Habit",
  project_deadline: "Project",
  vault_expiring: "Vault",
  people_followup: "Follow-up",
  weekly_review: "Weekly Review",
  budget_warning: "Budget",
}

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

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications?limit=10")
      if (!r.ok) return
      const d = await r.json()
      setNotifications(d.notifications ?? [])
      setUnreadCount(d.unread_count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Re-fetch when dropdown opens to pick up new notifications
  useEffect(() => {
    if (open) fetchNotifications()
  }, [open, fetchNotifications])

  const markRead = async (id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative flex"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
          title="Notifications"
        >
          <Bell className="h-5 w-5 text-foreground" />
          {unreadCount > 0 && (
            <span aria-hidden="true" className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground tabular-nums ring-2 ring-background animate-in zoom-in-50 duration-200">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
          {loading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-2 w-2 rounded-full mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">You&apos;re all caught up</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                type="button"
                key={n.id}
                onClick={() => { if (!n.is_read) markRead(n.id) }}
                className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
              >
                <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full transition-colors duration-200 ${n.is_read ? "bg-transparent" : "bg-primary"}`} />
                <span className="block min-w-0 flex-1">
                  <span className={`line-clamp-1 text-xs leading-tight ${n.is_read ? "text-muted-foreground" : "font-medium text-foreground"}`}>
                    {!n.is_read && <span className="sr-only">Unread: </span>}
                    {n.title}
                  </span>
                  {n.message && (
                    <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{n.message}</span>
                  )}
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {TYPE_LABELS[n.type] ?? n.type} · {timeAgo(n.created_at)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-2">
          <Button asChild variant="ghost" size="sm" className="w-full text-xs text-muted-foreground hover:text-foreground">
            <Link href="/notifications" onClick={() => setOpen(false)}>
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
