"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  Clock,
  DollarSign,
  Edit,
  GripVertical,
  Heart,
  Link2,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Target,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { LifeAreaSelect } from "@/components/life-area-controls"
import { ReminderSettings } from "@/components/reminder-settings"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { normalizeLifeArea, type LifeArea } from "@/lib/life-areas"
import { cn } from "@/lib/utils"

type CalendarView = "month" | "week"
type EventCategory = "personal" | "work" | "health" | "finance"
type CalendarItemKind = "task" | "event" | "reminder"

interface LocalEvent {
  id: string
  title: string
  dateKey: string
  time: string
  endTime: string
  description: string
  category: EventCategory
  location?: string
  attendees?: string
  email_reminder?: boolean
  reminder_days?: number
  life_area_id?: string | null
}

interface SyncedEvent {
  id: string
  title: string
  start: string
  end: string
  description: string
  provider: "google"
  color: string
  location: string
  all_day: boolean
}

interface Task {
  id: number | string
  title: string
  description?: string | null
  completed: boolean
  priority: "low" | "medium" | "high"
  due_date?: string | null
  due_time?: string | null
  email_reminder?: boolean | null
  reminder_days?: number | null
  category?: string | null
}

interface CalendarIntegration {
  provider: "google"
  email: string
  connected_at: string
  last_synced: string
}

type DragData = {
  kind: "task" | "event"
  id: string
  title: string
}

type CalendarDisplayItem = {
  kind: CalendarItemKind
  id: string
  title: string
  subtitle?: string
  badge: string
  dateKey: string
  task?: Task
  event?: LocalEvent
  syncedEvent?: SyncedEvent
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const allowedCategories = ["personal", "work", "health", "finance"] as const

const categoryColors: Record<EventCategory, string> = {
  personal: "bg-primary/15 text-primary border-primary/30",
  work: "bg-secondary text-secondary-foreground border-border",
  health: "bg-success/15 text-success border-success/30",
  finance: "bg-warning/15 text-warning border-warning/30",
}

const categoryIcons: Record<EventCategory, typeof Heart> = {
  personal: Heart,
  work: Target,
  health: Zap,
  finance: DollarSign,
}

const priorityColors: Record<Task["priority"], string> = {
  high: "border-destructive/30 bg-destructive/10 text-destructive",
  medium: "border-warning/30 bg-warning/10 text-warning",
  low: "border-success/30 bg-success/10 text-success",
}

function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === "string" && (allowedCategories as readonly string[]).includes(value)
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseDateKey(value?: string | null) {
  if (!value) return null
  const key = value.slice(0, 10)
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay())
}

function buildMonthDays(date: Date) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

function buildWeekDays(date: Date) {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, index) => addDays(start, index))
}

function formatTime12Hour(time24?: string | null) {
  if (!time24) return ""
  const [hours, minutes] = time24.slice(0, 5).split(":")
  const hour = Number.parseInt(hours, 10)
  if (!Number.isFinite(hour)) return time24
  const ampm = hour >= 12 ? "PM" : "AM"
  const hour12 = hour % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

function formatHeaderDate(date: Date, view: CalendarView) {
  if (view === "month") {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }

  const start = startOfWeek(date)
  const end = addDays(start, 6)
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`
}

function isSameCalendarDay(date: Date, other: Date) {
  return toDateKey(date) === toDateKey(other)
}

function normalizeTask(raw: Record<string, unknown>): Task {
  const priority = raw.priority === "high" || raw.priority === "low" || raw.priority === "medium" ? raw.priority : "medium"
  return {
    id: String(raw.id),
    title: typeof raw.title === "string" ? raw.title : "Untitled task",
    description: typeof raw.description === "string" ? raw.description : null,
    completed: Boolean(raw.completed),
    priority,
    due_date: typeof raw.due_date === "string" ? raw.due_date.slice(0, 10) : null,
    due_time: typeof raw.due_time === "string" ? raw.due_time.slice(0, 5) : null,
    email_reminder: Boolean(raw.email_reminder),
    reminder_days: typeof raw.reminder_days === "number" ? raw.reminder_days : null,
    category: typeof raw.category === "string" ? raw.category : null,
  }
}

function normalizeEvent(raw: Record<string, unknown>): LocalEvent {
  const eventDate = typeof raw.event_date === "string" ? raw.event_date : new Date().toISOString()
  return {
    id: String(raw.id),
    title: typeof raw.title === "string" ? raw.title : "Untitled event",
    dateKey: eventDate.slice(0, 10),
    time: typeof raw.start_time === "string" ? raw.start_time.slice(0, 5) : "",
    endTime: typeof raw.end_time === "string" ? raw.end_time.slice(0, 5) : "",
    description: typeof raw.description === "string" ? raw.description : "",
    category: isEventCategory(raw.category) ? raw.category : "personal",
    location: typeof raw.location === "string" ? raw.location : "",
    attendees: typeof raw.attendees === "string" ? raw.attendees : "",
    email_reminder: Boolean(raw.email_reminder),
    reminder_days: typeof raw.reminder_days === "number" ? raw.reminder_days : 1,
    life_area_id: raw.life_area_id === null || raw.life_area_id === undefined ? null : String(raw.life_area_id),
  }
}

export default function CalendarPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [view, setView] = useState<CalendarView>("month")
  const [cursorDate, setCursorDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [events, setEvents] = useState<LocalEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<LocalEvent | null>(null)
  const [eventDraft, setEventDraft] = useState<Partial<LocalEvent>>({
    title: "",
    time: "",
    endTime: "",
    description: "",
    category: "personal",
    location: "",
    attendees: "",
    email_reminder: true,
    reminder_days: 1,
    life_area_id: null,
  })
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([])
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([])
  const [syncedEvents, setSyncedEvents] = useState<SyncedEvent[]>([])
  const [showIntegrationsDialog, setShowIntegrationsDialog] = useState(false)
  const [syncingCalendar, setSyncingCalendar] = useState(false)
  const [googleConfigured, setGoogleConfigured] = useState(false)
  const [draftTitle, setDraftTitle] = useState("")
  const [creatingDraft, setCreatingDraft] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null)
  const [scheduleTarget, setScheduleTarget] = useState<DragData | null>(null)
  const [scheduleDate, setScheduleDate] = useState(toDateKey(new Date()))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, router, user])

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true)
    setLoadError("")
    try {
      const response = await fetch("/api/calendar-events")
      if (!response.ok) throw new Error("Failed to load calendar events")
      const data = await response.json()
      setEvents(Array.isArray(data) ? data.map(normalizeEvent) : [])
    } catch (error) {
      console.error("[v0] Error fetching events:", error)
      setLoadError("Calendar events could not be loaded.")
    } finally {
      setEventsLoading(false)
    }
  }, [])

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true)
    setLoadError("")
    try {
      const response = await fetch("/api/tasks")
      if (!response.ok) throw new Error("Failed to load tasks")
      const data = await response.json()
      setTasks(Array.isArray(data) ? data.map(normalizeTask) : [])
    } catch (error) {
      console.error("[v0] Error fetching tasks:", error)
      setLoadError("Tasks could not be loaded.")
    } finally {
      setTasksLoading(false)
    }
  }, [])

  const syncCalendarEvents = useCallback(async () => {
    setSyncingCalendar(true)
    try {
      const response = await fetch("/api/calendar/sync")
      if (response.ok) {
        const data = await response.json()
        setSyncedEvents(data.events || [])
      }
    } catch (error) {
      console.error("Error syncing calendar:", error)
    } finally {
      setSyncingCalendar(false)
    }
  }, [])

  const fetchIntegrations = useCallback(async () => {
    try {
      const response = await fetch("/api/calendar/integrations")
      if (response.ok) {
        const data = await response.json()
        setIntegrations(data.integrations || [])
        setGoogleConfigured(data.google_configured === true)
        if (data.integrations?.length > 0) syncCalendarEvents()
      }
    } catch (error) {
      console.error("Error fetching integrations:", error)
    }
  }, [syncCalendarEvents])

  useEffect(() => {
    if (!user) return
    fetchEvents()
    fetchTasks()
    fetchIntegrations()
  }, [fetchEvents, fetchIntegrations, fetchTasks, user])

  useEffect(() => {
    if (!user) return
    fetch("/api/life-areas")
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => setLifeAreas(Array.isArray(data) ? data.map(normalizeLifeArea) : []))
      .catch((error) => console.error("Failed to load life domains:", error))
  }, [user])

  useEffect(() => {
    if (!user) return

    const handleQuickAdd: EventListener = (event) => {
      if ((event as CustomEvent).detail?.type === "calendar-event") fetchEvents()
      if ((event as CustomEvent).detail?.type === "task") fetchTasks()
    }

    window.addEventListener("lifesort:quick-add-created", handleQuickAdd)
    return () => window.removeEventListener("lifesort:quick-add-created", handleQuickAdd)
  }, [fetchEvents, fetchTasks, user])

  const calendarDays = useMemo(() => (view === "month" ? buildMonthDays(cursorDate) : buildWeekDays(cursorDate)), [cursorDate, view])
  const todayKey = toDateKey(new Date())
  const selectedDateKey = toDateKey(selectedDate)

  const draftTasks = useMemo(() => tasks.filter((task) => !task.completed && !task.due_date), [tasks])
  const scheduledTasks = useMemo(() => tasks.filter((task) => !task.completed && task.due_date), [tasks])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarDisplayItem[]>()

    const add = (dateKey: string, item: CalendarDisplayItem) => {
      const current = map.get(dateKey) || []
      current.push(item)
      map.set(dateKey, current)
    }

    scheduledTasks.forEach((task) => {
      const dateKey = String(task.due_date).slice(0, 10)
      add(dateKey, {
        kind: "task",
        id: String(task.id),
        title: task.title,
        subtitle: task.due_time ? formatTime12Hour(task.due_time) : "Anytime",
        badge: "Task",
        dateKey,
        task,
      })
    })

    events.forEach((event) => {
      add(event.dateKey, {
        kind: "event",
        id: event.id,
        title: event.title,
        subtitle: event.time ? formatTime12Hour(event.time) : "Event",
        badge: "Event",
        dateKey: event.dateKey,
        event,
      })
    })

    syncedEvents.forEach((event) => {
      const eventDate = new Date(event.start)
      if (Number.isNaN(eventDate.getTime())) return
      const dateKey = toDateKey(eventDate)
      add(dateKey, {
        kind: "reminder",
        id: event.id,
        title: event.title,
        subtitle: event.all_day ? "All day" : eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        badge: "Reminder",
        dateKey,
        syncedEvent: event,
      })
    })

    map.forEach((items, dateKey) => {
      map.set(dateKey, items.sort((a, b) => (a.subtitle || "").localeCompare(b.subtitle || "") || a.title.localeCompare(b.title)))
    })

    return map
  }, [events, scheduledTasks, syncedEvents])

  const selectedItems = itemsByDate.get(selectedDateKey) || []
  const selectedTasks = selectedItems.filter((item) => item.kind === "task")
  const selectedEvents = selectedItems.filter((item) => item.kind === "event")
  const selectedReminders = selectedItems.filter((item) => item.kind === "reminder")
  const pageLoading = authLoading || (user && (eventsLoading || tasksLoading))

  const connectGoogle = async () => {
    try {
      const response = await fetch("/api/calendar/google/auth")
      const data = await response.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      } else if (data.setup_required) {
        alert(data.message)
      }
    } catch (error) {
      console.error("Error connecting Google:", error)
    }
  }

  const disconnectCalendar = async (provider: string) => {
    try {
      await fetch("/api/calendar/integrations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      })
      setIntegrations((current) => current.filter((item) => item.provider !== provider))
      setSyncedEvents((current) => current.filter((item) => item.provider !== provider))
    } catch (error) {
      console.error("Error disconnecting:", error)
    }
  }

  const openAddEvent = (date = selectedDate) => {
    setEditingEvent(null)
    setSelectedDate(date)
    setEventDraft({
      title: "",
      time: "09:00",
      endTime: "10:00",
      description: "",
      category: "personal",
      location: "",
      attendees: "",
      email_reminder: true,
      reminder_days: 1,
      life_area_id: null,
    })
    setIsDialogOpen(true)
  }

  const handleEditEvent = (event: LocalEvent) => {
    setEditingEvent(event)
    setSelectedDate(parseDateKey(event.dateKey) || new Date())
    setEventDraft({
      title: event.title,
      time: event.time,
      endTime: event.endTime || event.time,
      description: event.description,
      category: event.category,
      location: event.location,
      attendees: event.attendees,
      email_reminder: event.email_reminder ?? true,
      reminder_days: event.reminder_days ?? 1,
      life_area_id: event.life_area_id ?? null,
    })
    setIsDialogOpen(true)
  }

  const saveEvent = async () => {
    const title = eventDraft.title?.trim()
    const time = eventDraft.time || "09:00"
    const dateKey = toDateKey(selectedDate)
    if (!title || !dateKey) return

    const eventData = {
      title,
      event_date: dateKey,
      start_time: time,
      end_time: eventDraft.endTime || time,
      description: eventDraft.description || "",
      category: eventDraft.category || "personal",
      location: eventDraft.location || "",
      attendees: eventDraft.attendees || "",
      email_reminder: eventDraft.email_reminder ?? true,
      reminder_days: eventDraft.reminder_days ?? 1,
      life_area_id: eventDraft.life_area_id ?? null,
    }

    try {
      const response = await fetch("/api/calendar-events", {
        method: editingEvent ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingEvent ? { ...eventData, id: Number(editingEvent.id) } : eventData),
      })
      if (!response.ok) throw new Error("Could not save event")
      await fetchEvents()
      setIsDialogOpen(false)
      setEditingEvent(null)
    } catch (error) {
      console.error("[v0] Error saving event:", error)
      setLoadError("Event could not be saved.")
    }
  }

  const deleteEvent = async (id: string) => {
    try {
      const response = await fetch("/api/calendar-events", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: Number(id) }),
      })
      if (!response.ok) throw new Error("Could not delete event")
      await fetchEvents()
    } catch (error) {
      console.error("[v0] Error deleting event:", error)
      setLoadError("Event could not be deleted.")
    }
  }

  const updateTaskDate = async (taskId: string, dateKey: string | null) => {
    setSavingId(`task:${taskId}`)
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dateKey ? { id: taskId, due_date: dateKey } : { id: taskId, due_date: null, due_time: null, email_reminder: false }),
      })
      if (!response.ok) throw new Error("Could not update task")
      const updated = normalizeTask(await response.json())
      setTasks((current) => current.map((task) => (String(task.id) === String(updated.id) ? updated : task)))
    } catch (error) {
      console.error("[v0] Error scheduling task:", error)
      setLoadError("Task could not be scheduled.")
    } finally {
      setSavingId(null)
    }
  }

  const updateEventDate = async (eventId: string, dateKey: string) => {
    const event = events.find((item) => item.id === eventId)
    if (!event) return

    setSavingId(`event:${eventId}`)
    try {
      const response = await fetch("/api/calendar-events", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: Number(event.id),
          title: event.title,
          description: event.description || "",
          event_date: dateKey,
          start_time: event.time || "09:00",
          end_time: event.endTime || event.time || "09:00",
          category: event.category,
          location: event.location || "",
          attendees: event.attendees || "",
          email_reminder: event.email_reminder ?? true,
          reminder_days: event.reminder_days ?? 1,
          life_area_id: event.life_area_id ?? null,
        }),
      })
      if (!response.ok) throw new Error("Could not update event")
      const updated = normalizeEvent(await response.json())
      setEvents((current) => current.map((item) => (item.id === eventId ? updated : item)))
    } catch (error) {
      console.error("[v0] Error moving event:", error)
      setLoadError("Event could not be moved.")
    } finally {
      setSavingId(null)
    }
  }

  const createDraftTask = async () => {
    const title = draftTitle.trim()
    if (!title) return

    setCreatingDraft(true)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, priority: "medium", completed: false }),
      })
      if (!response.ok) throw new Error("Could not create draft task")
      const task = normalizeTask(await response.json())
      setTasks((current) => [task, ...current])
      setDraftTitle("")
    } catch (error) {
      console.error("[v0] Error creating draft task:", error)
      setLoadError("Draft task could not be created.")
    } finally {
      setCreatingDraft(false)
    }
  }

  const openScheduleDialog = (target: DragData, initialDate = selectedDateKey) => {
    setScheduleTarget(target)
    setScheduleDate(initialDate)
  }

  const applyScheduleDialog = async () => {
    if (!scheduleTarget || !scheduleDate) return
    if (scheduleTarget.kind === "task") await updateTaskDate(scheduleTarget.id, scheduleDate)
    if (scheduleTarget.kind === "event") await updateEventDate(scheduleTarget.id, scheduleDate)
    setScheduleTarget(null)
  }

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined
    setActiveDrag(data || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const data = event.active.data.current as DragData | undefined
    const overId = event.over?.id ? String(event.over.id) : ""
    setActiveDrag(null)
    if (!data || !overId) return

    if (overId.startsWith("date:")) {
      const dateKey = overId.replace("date:", "")
      if (data.kind === "task") await updateTaskDate(data.id, dateKey)
      if (data.kind === "event") await updateEventDate(data.id, dateKey)
      return
    }

    if (overId === "drafts" && data.kind === "task") {
      await updateTaskDate(data.id, null)
    }
  }

  const moveCalendar = (direction: number) => {
    setCursorDate((current) => (view === "month" ? addMonths(current, direction) : addDays(current, direction * 7)))
  }

  const goToToday = () => {
    const today = new Date()
    setCursorDate(today)
    setSelectedDate(today)
  }

  const firstName = user?.name?.split(" ")[0] || "Your"

  if (pageLoading || !user) {
    return (
      <DashboardLayout title="Calendar" subtitle="Plan your tasks and events">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout title={`${firstName}'s Calendar`} subtitle="Schedule tasks, events, and reminders without losing the original record">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDrag(null)}>
        <div className="space-y-5">
          {loadError && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-destructive">{loadError}</p>
                <Button variant="outline" size="sm" onClick={() => { fetchEvents(); fetchTasks() }}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          )}

          <CalendarToolbar
            view={view}
            cursorDate={cursorDate}
            integrations={integrations}
            googleConfigured={googleConfigured}
            syncingCalendar={syncingCalendar}
            showIntegrationsDialog={showIntegrationsDialog}
            setShowIntegrationsDialog={setShowIntegrationsDialog}
            onViewChange={setView}
            onPrevious={() => moveCalendar(-1)}
            onNext={() => moveCalendar(1)}
            onToday={goToToday}
            onAddEvent={() => openAddEvent(selectedDate)}
            onSync={syncCalendarEvents}
            onConnectGoogle={connectGoogle}
            onDisconnectCalendar={disconnectCalendar}
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0 space-y-5">
              <Card className="surface-card overflow-hidden">
                <CardHeader className="border-b">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>{formatHeaderDate(cursorDate, view)}</CardTitle>
                      <CardDescription>Drag tasks or local events onto a date to reschedule them.</CardDescription>
                    </div>
                    <Badge variant="outline">{view === "month" ? "Month view" : "Week view"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                      <div className="grid grid-cols-7 border-b bg-muted/30">
                        {WEEKDAYS.map((day) => (
                          <div key={day} className="border-r px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground last:border-r-0">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7">
                        {calendarDays.map((day) => {
                          const key = toDateKey(day)
                          return (
                            <CalendarDayCell
                              key={key}
                              date={day}
                              dateKey={key}
                              cursorDate={cursorDate}
                              selected={key === selectedDateKey}
                              today={key === todayKey}
                              outsideMonth={view === "month" && day.getMonth() !== cursorDate.getMonth()}
                              items={itemsByDate.get(key) || []}
                              onSelect={() => setSelectedDate(day)}
                              onAddEvent={() => openAddEvent(day)}
                              onSchedule={openScheduleDialog}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <SelectedDayPanel
                date={selectedDate}
                tasks={selectedTasks}
                events={selectedEvents}
                reminders={selectedReminders}
                savingId={savingId}
                onAddEvent={() => openAddEvent(selectedDate)}
                onEditEvent={handleEditEvent}
                onDeleteEvent={deleteEvent}
                onUnscheduleTask={(taskId) => updateTaskDate(taskId, null)}
                onSchedule={openScheduleDialog}
              />
            </div>

            <DraftTaskPanel
              tasks={draftTasks}
              draftTitle={draftTitle}
              loading={tasksLoading}
              creating={creatingDraft}
              savingId={savingId}
              onDraftTitleChange={setDraftTitle}
              onCreateDraft={createDraftTask}
              onSchedule={openScheduleDialog}
            />
          </div>
        </div>

        <DragOverlay>
          {activeDrag ? <DragPreview title={activeDrag.title} kind={activeDrag.kind} /> : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit Event" : "Add New Event"}</DialogTitle>
            <DialogDescription>
              {editingEvent ? "Update this calendar event." : `Create an event for ${selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title</Label>
              <Input id="title" value={eventDraft.title || ""} onChange={(event) => setEventDraft({ ...eventDraft, title: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={toDateKey(selectedDate)}
                  onChange={(event) => {
                    const next = parseDateKey(event.target.value)
                    if (next) setSelectedDate(next)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Start</Label>
                <Input id="time" type="time" value={eventDraft.time || ""} onChange={(event) => setEventDraft({ ...eventDraft, time: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">End</Label>
                <Input id="end-time" type="time" value={eventDraft.endTime || ""} onChange={(event) => setEventDraft({ ...eventDraft, endTime: event.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={eventDraft.category || "personal"} onValueChange={(value) => setEventDraft({ ...eventDraft, category: value as EventCategory })}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="work">Work</SelectItem>
                  <SelectItem value="health">Health</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {lifeAreas.length > 0 && (
              <div className="space-y-2">
                <Label>Life Domain</Label>
                <LifeAreaSelect
                  areas={lifeAreas}
                  value={eventDraft.life_area_id}
                  onChange={(value) => setEventDraft({ ...eventDraft, life_area_id: value })}
                  placeholder="No domain"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" value={eventDraft.description || ""} onChange={(event) => setEventDraft({ ...eventDraft, description: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={eventDraft.location || ""} onChange={(event) => setEventDraft({ ...eventDraft, location: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="attendees">Attendees</Label>
                <Input id="attendees" value={eventDraft.attendees || ""} onChange={(event) => setEventDraft({ ...eventDraft, attendees: event.target.value })} />
              </div>
            </div>
            <ReminderSettings
              enabled={eventDraft.email_reminder ?? true}
              reminderDays={eventDraft.reminder_days ?? 1}
              onEnabledChange={(enabled) => setEventDraft({ ...eventDraft, email_reminder: enabled })}
              onReminderDaysChange={(days) => setEventDraft({ ...eventDraft, reminder_days: days })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveEvent}>{editingEvent ? "Update Event" : "Add Event"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(scheduleTarget)} onOpenChange={(open) => !open && setScheduleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{scheduleTarget?.kind === "event" ? "Reschedule event" : "Schedule task"}</DialogTitle>
            <DialogDescription>Choose a date for {scheduleTarget?.title || "this item"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="schedule-date">Date</Label>
            <Input id="schedule-date" type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleTarget(null)}>Cancel</Button>
            <Button onClick={applyScheduleDialog}>Save date</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

function CalendarToolbar({
  view,
  cursorDate,
  integrations,
  googleConfigured,
  syncingCalendar,
  showIntegrationsDialog,
  setShowIntegrationsDialog,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onAddEvent,
  onSync,
  onConnectGoogle,
  onDisconnectCalendar,
}: {
  view: CalendarView
  cursorDate: Date
  integrations: CalendarIntegration[]
  googleConfigured: boolean
  syncingCalendar: boolean
  showIntegrationsDialog: boolean
  setShowIntegrationsDialog: (value: boolean) => void
  onViewChange: (view: CalendarView) => void
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  onAddEvent: () => void
  onSync: () => void
  onConnectGoogle: () => void
  onDisconnectCalendar: (provider: string) => void
}) {
  return (
    <Card className="surface-card">
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrevious} aria-label="Previous period">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={onToday}>Today</Button>
          <Button variant="outline" size="icon" onClick={onNext} aria-label="Next period">
            <ArrowRight className="h-4 w-4" />
          </Button>
          <div className="ml-0 text-sm font-medium sm:ml-2">{formatHeaderDate(cursorDate, view)}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border bg-background p-1">
            <Button size="sm" variant={view === "month" ? "secondary" : "ghost"} onClick={() => onViewChange("month")}>Month</Button>
            <Button size="sm" variant={view === "week" ? "secondary" : "ghost"} onClick={() => onViewChange("week")}>Week</Button>
          </div>
          {integrations.length > 0 && (
            <Button variant="ghost" size="icon" onClick={onSync} disabled={syncingCalendar} aria-label="Sync calendar">
              <RefreshCw className={cn("h-4 w-4", syncingCalendar && "animate-spin")} />
            </Button>
          )}
          <Dialog open={showIntegrationsDialog} onOpenChange={setShowIntegrationsDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Link2 className="h-4 w-4" />
                Connect Calendar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Calendar Integrations</DialogTitle>
                <DialogDescription>Connect Google Calendar to show read-only reminders inside LifeSort.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Google Calendar</p>
                    {integrations.find((item) => item.provider === "google") ? (
                      <p className="mt-1 flex items-center gap-1 text-sm text-success">
                        <Check className="h-3.5 w-3.5" />
                        Connected as {integrations.find((item) => item.provider === "google")?.email}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">Not connected</p>
                    )}
                  </div>
                  {integrations.find((item) => item.provider === "google") ? (
                    <Button variant="outline" size="sm" onClick={() => onDisconnectCalendar("google")}>Disconnect</Button>
                  ) : (
                    <Button size="sm" onClick={onConnectGoogle} disabled={!googleConfigured}>
                      {googleConfigured ? "Connect" : "Not configured"}
                    </Button>
                  )}
                </div>
                {!googleConfigured && (
                  <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                    Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to enable Google Calendar integration.
                  </p>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={onAddEvent} className="gap-2">
            <Plus className="h-4 w-4" />
            New Event
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CalendarDayCell({
  date,
  dateKey,
  cursorDate,
  selected,
  today,
  outsideMonth,
  items,
  onSelect,
  onAddEvent,
  onSchedule,
}: {
  date: Date
  dateKey: string
  cursorDate: Date
  selected: boolean
  today: boolean
  outsideMonth: boolean
  items: CalendarDisplayItem[]
  onSelect: () => void
  onAddEvent: () => void
  onSchedule: (target: DragData, initialDate?: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `date:${dateKey}` })
  const visibleItems = items.slice(0, 4)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[10.5rem] border-b border-r bg-background p-2 transition-colors last:border-r-0",
        outsideMonth && "bg-muted/20 text-muted-foreground",
        selected && "bg-primary/5 ring-1 ring-inset ring-primary/30",
        isOver && "bg-primary/10 ring-2 ring-inset ring-primary/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors hover:bg-muted",
            today && "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          aria-label={`Select ${date.toLocaleDateString()}`}
        >
          {date.getDate()}
        </button>
        {!outsideMonth && date.getMonth() === cursorDate.getMonth() && (
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-70 hover:opacity-100" onClick={onAddEvent} aria-label="Add event">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        {visibleItems.map((item) => (
          <CalendarChip key={`${item.kind}-${item.id}`} item={item} onSchedule={onSchedule} />
        ))}
        {items.length > visibleItems.length && (
          <div className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            +{items.length - visibleItems.length} more
          </div>
        )}
      </div>
    </div>
  )
}

function CalendarChip({ item, onSchedule }: { item: CalendarDisplayItem; onSchedule: (target: DragData, initialDate?: string) => void }) {
  const draggable = item.kind === "task" || item.kind === "event"
  const dragData: DragData | undefined = draggable
    ? { kind: item.kind === "task" ? "task" : "event", id: item.id, title: item.title }
    : undefined
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } = useDraggable({
    id: `${item.kind}:${item.id}`,
    disabled: !draggable,
    data: dragData,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group rounded-md border px-2 py-1.5 text-xs shadow-sm",
        item.kind === "task" && priorityColors[item.task?.priority || "medium"],
        item.kind === "event" && "border-primary/20 bg-primary/10 text-primary",
        item.kind === "reminder" && "border-border bg-muted/70 text-muted-foreground",
        isDragging && "opacity-40",
      )}
    >
      <div className="flex items-start gap-1.5">
        {draggable ? (
          <button
            ref={setActivatorNodeRef}
            type="button"
            className="mt-0.5 cursor-grab text-current/60 active:cursor-grabbing"
            aria-label={`Drag ${item.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3 w-3" />
          </button>
        ) : (
          <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="rounded bg-background/60 px-1 text-[10px] font-medium">{item.badge}</span>
            {item.subtitle && <span className="truncate text-[10px] opacity-75">{item.subtitle}</span>}
          </div>
          <p className="mt-0.5 truncate font-medium">{item.title}</p>
        </div>
        {draggable && (
          <button
            type="button"
            className="hidden text-current/70 hover:text-current group-hover:block"
            onClick={() => onSchedule({ kind: item.kind as "task" | "event", id: item.id, title: item.title }, item.dateKey)}
            aria-label={`Reschedule ${item.title}`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function DraftTaskPanel({
  tasks,
  draftTitle,
  loading,
  creating,
  savingId,
  onDraftTitleChange,
  onCreateDraft,
  onSchedule,
}: {
  tasks: Task[]
  draftTitle: string
  loading: boolean
  creating: boolean
  savingId: string | null
  onDraftTitleChange: (value: string) => void
  onCreateDraft: () => void
  onSchedule: (target: DragData, initialDate?: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: "drafts" })

  return (
    <Card ref={setNodeRef} className={cn("surface-card h-fit xl:sticky xl:top-6", isOver && "ring-2 ring-primary/40")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-primary" />
          Draft Tasks
        </CardTitle>
        <CardDescription>Unscheduled tasks live here until you place them on the calendar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-md border bg-muted/20 p-3">
          <Label htmlFor="draft-task-title">Create draft task</Label>
          <div className="flex gap-2">
            <Input
              id="draft-task-title"
              value={draftTitle}
              onChange={(event) => onDraftTitleChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  onCreateDraft()
                }
              }}
              placeholder="Draft a task..."
            />
            <Button onClick={onCreateDraft} disabled={creating || !draftTitle.trim()} size="icon" aria-label="Create draft task">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading drafts...
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-md border border-dashed p-5 text-center">
            <CalendarIcon className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No draft tasks</p>
            <p className="mt-1 text-xs text-muted-foreground">Create one here, or unschedule a task from the calendar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <DraftTaskCard key={String(task.id)} task={task} saving={savingId === `task:${task.id}`} onSchedule={onSchedule} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DraftTaskCard({ task, saving, onSchedule }: { task: Task; saving: boolean; onSchedule: (target: DragData, initialDate?: string) => void }) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, isDragging } = useDraggable({
    id: `task:${task.id}`,
    data: { kind: "task", id: String(task.id), title: task.title } satisfies DragData,
  })

  return (
    <div ref={setNodeRef} className={cn("rounded-md border bg-background p-3 shadow-sm", isDragging && "opacity-40")}>
      <div className="flex items-start gap-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="mt-1 cursor-grab text-muted-foreground active:cursor-grabbing"
          aria-label={`Drag ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium">{task.title}</p>
            <Badge variant="outline" className={cn("capitalize", priorityColors[task.priority])}>{task.priority}</Badge>
          </div>
          {task.description && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full justify-center gap-2"
            disabled={saving}
            onClick={() => onSchedule({ kind: "task", id: String(task.id), title: task.title }, toDateKey(new Date()))}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarIcon className="h-3.5 w-3.5" />}
            Schedule
          </Button>
        </div>
      </div>
    </div>
  )
}

function SelectedDayPanel({
  date,
  tasks,
  events,
  reminders,
  savingId,
  onAddEvent,
  onEditEvent,
  onDeleteEvent,
  onUnscheduleTask,
  onSchedule,
}: {
  date: Date
  tasks: CalendarDisplayItem[]
  events: CalendarDisplayItem[]
  reminders: CalendarDisplayItem[]
  savingId: string | null
  onAddEvent: () => void
  onEditEvent: (event: LocalEvent) => void
  onDeleteEvent: (id: string) => void
  onUnscheduleTask: (taskId: string) => void
  onSchedule: (target: DragData, initialDate?: string) => void
}) {
  const total = tasks.length + events.length + reminders.length
  const dateKey = toDateKey(date)

  return (
    <Card className="surface-card">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</CardTitle>
            <CardDescription>{total === 0 ? "Nothing scheduled yet" : `${total} scheduled item${total === 1 ? "" : "s"}`}</CardDescription>
          </div>
          <Button variant="outline" onClick={onAddEvent} className="gap-2">
            <Plus className="h-4 w-4" />
            New event
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {total === 0 && (
          <div className="rounded-md border border-dashed p-6 text-center">
            <CalendarIcon className="mx-auto h-9 w-9 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No tasks or events here</p>
            <p className="mt-1 text-sm text-muted-foreground">Drag a draft onto this date, or add a local event.</p>
          </div>
        )}

        {tasks.map((item) => item.task && (
          <DetailRow key={`task-${item.id}`} item={item}>
            <Button variant="outline" size="sm" onClick={() => onSchedule({ kind: "task", id: item.id, title: item.title }, dateKey)}>Reschedule</Button>
            <Button variant="ghost" size="sm" disabled={savingId === `task:${item.id}`} onClick={() => onUnscheduleTask(item.id)}>
              {savingId === `task:${item.id}` ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1 h-3.5 w-3.5" />}
              Unschedule
            </Button>
          </DetailRow>
        ))}

        {events.map((item) => item.event && (
          <DetailRow key={`event-${item.id}`} item={item}>
            <Button variant="outline" size="sm" onClick={() => onSchedule({ kind: "event", id: item.id, title: item.title }, dateKey)}>Move</Button>
            <Button variant="ghost" size="sm" onClick={() => item.event && onEditEvent(item.event)}>
              <Edit className="mr-1 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDeleteEvent(item.id)}>
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </DetailRow>
        ))}

        {reminders.map((item) => (
          <DetailRow key={`reminder-${item.id}`} item={item}>
            <Badge variant="outline">Read-only</Badge>
          </DetailRow>
        ))}
      </CardContent>
    </Card>
  )
}

function DetailRow({ item, children }: { item: CalendarDisplayItem; children: React.ReactNode }) {
  const Icon = item.kind === "task" ? CheckSquare : item.kind === "event" ? CalendarIcon : Link2
  return (
    <div className="flex flex-col gap-3 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium">{item.title}</p>
            <Badge variant="outline">{item.badge}</Badge>
            {item.kind === "task" && item.task && <Badge variant="outline" className={cn("capitalize", priorityColors[item.task.priority])}>{item.task.priority}</Badge>}
            {item.kind === "event" && item.event && <Badge variant="outline" className={cn("capitalize", categoryColors[item.event.category])}>{item.event.category}</Badge>}
          </div>
          {item.subtitle && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {item.subtitle}
            </p>
          )}
          {item.event?.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {item.event.location}
            </p>
          )}
          {item.event?.attendees && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              {item.event.attendees}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function DragPreview({ title, kind }: { title: string; kind: "task" | "event" }) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg">
      <Badge variant="outline" className="mb-1 capitalize">{kind}</Badge>
      <p className="max-w-56 truncate font-medium">{title}</p>
    </div>
  )
}
