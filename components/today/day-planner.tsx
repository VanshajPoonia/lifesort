"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { CalendarDays, GripVertical, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  DEFAULT_DURATION,
  DURATIONS,
  clockLabel,
  daySlots,
  durationLabel,
  freeMinutes,
  overlapping,
  slotOf,
  toMinutes,
  toTime,
  type DayBlock,
} from "@/lib/day-plan"
import { cn } from "@/lib/utils"

type PlannerTask = {
  id: number
  title: string
  due_date: string | null
  scheduled_date: string | null
  scheduled_time: string | null
  duration_minutes: number | null
  status: string | null
  completed: boolean
}

type LocalEvent = { id: number; title: string; event_date: string; start_time: string | null; end_time: string | null }
type GoogleEvent = { id: string; title: string; start?: string; end?: string; all_day: boolean }

// Statuses that don't belong on today's plan.
const parked = new Set(["someday", "waiting", "cancelled", "completed"])

function minutesInDay(iso: string | undefined, date: string) {
  if (!iso) return null
  const value = new Date(iso)
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString()
  if (local.slice(0, 10) !== date) return null
  return value.getHours() * 60 + value.getMinutes()
}

function nowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function TaskChip({ task, placed, onUnplace }: { task: PlannerTask; placed: boolean; onUnplace?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `task-${task.id}` })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-md border bg-card px-2 py-1.5 text-sm shadow-sm",
        placed && "border-primary/30 bg-primary/5",
        isDragging && "z-10 opacity-80 shadow-md",
      )}
    >
      <button
        type="button"
        className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={`Drag ${task.title} to a time`}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <span className="min-w-0 flex-1 truncate">{task.title}</span>
      {placed && onUnplace && (
        <button type="button" onClick={onUnplace} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Take ${task.title} off the plan`}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function SlotRow({ slot, children, covered }: { slot: number; children: React.ReactNode; covered: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot}` })
  return (
    <li
      ref={setNodeRef}
      className={cn("grid min-h-9 grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-2 border-t border-border/60 py-1", isOver && "bg-primary/10")}
    >
      <span className={cn("pt-1 text-xs tabular-nums", slot % 60 === 0 ? "text-muted-foreground" : "text-muted-foreground/50")}>
        {slot % 60 === 0 ? clockLabel(slot) : ""}
      </span>
      <div className={cn("min-w-0 space-y-1 rounded-sm", covered && "bg-muted/40")}>{children}</div>
    </li>
  )
}

// Today's "Plan your hours": drag today's tasks into half-hour slots around calendar
// events. Placing saves scheduled_date, scheduled_time and duration_minutes on the task.
export function DayPlanner({ date }: { date: string }) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<PlannerTask[] | null>(null)
  const [events, setEvents] = useState<DayBlock[]>([])
  const [error, setError] = useState("")
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    let cancelled = false
    const dayStart = new Date(`${date}T00:00:00`)
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    Promise.all([
      fetch("/api/tasks?completed=false").then((response) => (response.ok ? response.json() : Promise.reject(new Error("tasks")))),
      fetch("/api/calendar-events").then((response) => (response.ok ? response.json() : [])),
      fetch(`/api/calendar/sync?timeMin=${encodeURIComponent(dayStart.toISOString())}&timeMax=${encodeURIComponent(dayEnd.toISOString())}`)
        .then((response) => (response.ok ? response.json() : { events: [] }))
        .catch(() => ({ events: [] })),
    ])
      .then(([taskRows, localRows, google]: [PlannerTask[], LocalEvent[], { events?: GoogleEvent[] }]) => {
        if (cancelled) return
        setTasks(
          taskRows.filter(
            (task) => !task.completed && !parked.has(task.status ?? "") && (task.due_date === date || task.scheduled_date === date),
          ),
        )
        const local = localRows
          .filter((event) => event.event_date === date && toMinutes(event.start_time) !== null)
          .map((event) => {
            const start = toMinutes(event.start_time) as number
            return { id: `event-${event.id}`, kind: "event" as const, title: event.title, start, end: toMinutes(event.end_time) ?? start + 60 }
          })
        const synced = (google.events ?? [])
          .filter((event) => !event.all_day)
          .flatMap((event) => {
            const start = minutesInDay(event.start, date)
            if (start === null) return []
            return [{ id: `google-${event.id}`, kind: "event" as const, title: event.title, start, end: minutesInDay(event.end, date) ?? start + 60 }]
          })
        setEvents([...local, ...synced])
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load today's tasks and calendar.")
      })
    return () => {
      cancelled = true
    }
  }, [date])

  const save = useCallback(
    async (task: PlannerTask, patch: Partial<PlannerTask>) => {
      setTasks((current) => current?.map((item) => (item.id === task.id ? { ...item, ...patch } : item)) ?? current)
      try {
        const response = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: task.id, ...patch }),
        })
        if (!response.ok) throw new Error("save")
      } catch {
        setTasks((current) => current?.map((item) => (item.id === task.id ? task : item)) ?? current)
        toast({ title: "Couldn't save that time", description: "Try again in a moment.", variant: "destructive" })
      }
    },
    [toast],
  )

  const place = useCallback(
    (task: PlannerTask, slot: number) =>
      save(task, { scheduled_date: date, scheduled_time: toTime(slot), duration_minutes: task.duration_minutes ?? DEFAULT_DURATION }),
    [date, save],
  )

  const placed = useMemo(
    () => (tasks ?? []).filter((task) => task.scheduled_date === date && toMinutes(task.scheduled_time) !== null),
    [date, tasks],
  )
  const unplaced = useMemo(() => (tasks ?? []).filter((task) => !placed.includes(task)), [placed, tasks])

  const taskBlocks: DayBlock[] = placed.map((task) => {
    const start = toMinutes(task.scheduled_time) as number
    return { id: `task-${task.id}`, kind: "task", title: task.title, start, end: start + (task.duration_minutes ?? DEFAULT_DURATION) }
  })
  const allBlocks = [...taskBlocks, ...events]
  const free = freeMinutes(allBlocks, nowMinutes())

  const onDragEnd = (event: DragEndEvent) => {
    const taskId = Number(String(event.active.id).replace("task-", ""))
    const slot = event.over ? Number(String(event.over.id).replace("slot-", "")) : null
    const task = tasks?.find((item) => item.id === taskId)
    if (task && slot !== null && Number.isFinite(slot)) void place(task, slot)
  }

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>
  if (!tasks) return <Skeleton className="h-64 w-full rounded-xl" />

  const slots = daySlots()

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby="planner-unplaced" className="space-y-3">
          <div>
            <h3 id="planner-unplaced" className="text-sm font-semibold text-foreground">
              To place
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {durationLabel(free)} free until {clockLabel(23 * 60)}. Drag a task to a time, or pick one.
            </p>
          </div>
          {unplaced.length === 0 ? (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              {tasks.length === 0 ? "No tasks due today. Add one on Today or in Tasks." : "Everything for today has a time."}
            </p>
          ) : (
            <ul className="space-y-2">
              {unplaced.map((task) => (
                <li key={task.id} className="space-y-1">
                  <TaskChip task={task} placed={false} />
                  <label className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                    <span className="shrink-0">Place at</span>
                    <select
                      className="h-7 min-w-0 flex-1 rounded-md border bg-background px-2 text-xs text-foreground"
                      value=""
                      onChange={(event) => {
                        if (event.target.value) void place(task, Number(event.target.value))
                      }}
                    >
                      <option value="">Pick a time</option>
                      {slots.map((slot) => (
                        <option key={slot} value={slot}>
                          {clockLabel(slot)}
                        </option>
                      ))}
                    </select>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Your hours">
          <ol className="rounded-xl border bg-card px-3">
            {slots.map((slot) => {
              const startingHere = allBlocks.filter((block) => slotOf(block.start) === slot)
              const covered = allBlocks.some((block) => block.start < slot && block.end > slot)
              return (
                <SlotRow key={slot} slot={slot} covered={covered}>
                  {startingHere.map((block) => {
                    const clashes = overlapping(block, allBlocks)
                    if (block.kind === "event") {
                      return (
                        <div key={block.id} className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1.5 text-sm text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="min-w-0 flex-1 truncate">{block.title}</span>
                          <span className="shrink-0 text-xs tabular-nums">{clockLabel(block.start)} to {clockLabel(block.end)}</span>
                        </div>
                      )
                    }
                    const task = placed.find((item) => `task-${item.id}` === block.id) as PlannerTask
                    return (
                      <div key={block.id} className="space-y-1">
                        <TaskChip task={task} placed onUnplace={() => void save(task, { scheduled_time: null })} />
                        <div className="flex flex-wrap items-center gap-1 pl-1">
                          {DURATIONS.map((minutes) => (
                            <Button
                              key={minutes}
                              type="button"
                              size="sm"
                              variant={(task.duration_minutes ?? DEFAULT_DURATION) === minutes ? "secondary" : "ghost"}
                              className="h-6 px-2 text-xs"
                              onClick={() => void save(task, { duration_minutes: minutes })}
                            >
                              {durationLabel(minutes)}
                            </Button>
                          ))}
                          {clashes.length > 0 && <span className="text-xs text-muted-foreground">Overlaps {clashes[0].title}</span>}
                        </div>
                      </div>
                    )
                  })}
                </SlotRow>
              )
            })}
          </ol>
        </section>
      </div>
    </DndContext>
  )
}
