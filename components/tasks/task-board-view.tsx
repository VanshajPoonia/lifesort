"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { GripVertical, MoreHorizontal } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type TaskStatus = "inbox" | "next" | "in_progress" | "waiting" | "someday" | "completed" | "cancelled"

type BoardTask = {
  id: number | string
  title: string
  status: TaskStatus
  completed: boolean
  priority?: string | null
  due_date?: string | null
  updated_at?: string | null
}

type ColumnKey = "todo" | "doing" | "waiting" | "later" | "done"

// Dropping a card on a column sets the status in `moveTo`. Done goes through
// PUT /api/tasks like everywhere else, so a repeating task rolls to its next date.
const columns: Array<{ key: ColumnKey; label: string; statuses: TaskStatus[]; moveTo: TaskStatus; empty: string }> = [
  { key: "todo", label: "To do", statuses: ["inbox", "next"], moveTo: "next", empty: "Nothing to do." },
  { key: "doing", label: "Doing", statuses: ["in_progress"], moveTo: "in_progress", empty: "Drag a task here when you start it." },
  { key: "waiting", label: "Waiting", statuses: ["waiting"], moveTo: "waiting", empty: "Things in someone else's hands." },
  { key: "later", label: "Later", statuses: ["someday"], moveTo: "someday", empty: "Parked for another time." },
  { key: "done", label: "Done", statuses: ["completed"], moveTo: "completed", empty: "Finished tasks land here." },
]

const DONE_SHOWN = 10

function columnFor(task: BoardTask): ColumnKey | null {
  return columns.find((column) => column.statuses.includes(task.status))?.key ?? null
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function dueLabel(task: BoardTask) {
  if (!task.due_date || task.completed) return null
  const key = String(task.due_date).slice(0, 10)
  const today = localDateKey()
  const date = new Date(`${key}T00:00:00`)
  const short = date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  if (key === today) return "Due today"
  if (key < today) return `Was due ${short}`
  return `Due ${short}`
}

export function TaskBoardView() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const lifeAreaFilter = searchParams.get("life_area_id")
  const { toast } = useToast()
  const [tasks, setTasks] = useState<BoardTask[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, router, user])

  const fetchTasks = useCallback(async (): Promise<BoardTask[]> => {
    const response = await fetch(lifeAreaFilter ? `/api/tasks?life_area_id=${encodeURIComponent(lifeAreaFilter)}` : "/api/tasks")
    if (!response.ok) throw new Error("Tasks could not be loaded.")
    const data = await response.json()
    return Array.isArray(data) ? data : []
  }, [lifeAreaFilter])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchTasks()
      .then((data) => { if (!cancelled) { setTasks(data); setLoadError("") } })
      .catch(() => { if (!cancelled) setLoadError("Tasks couldn't be loaded. Refresh to try again.") })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [fetchTasks, user])

  const byColumn = useMemo(() => {
    const grouped: Record<ColumnKey, BoardTask[]> = { todo: [], doing: [], waiting: [], later: [], done: [] }
    for (const task of tasks) {
      const key = columnFor(task)
      if (key) grouped[key].push(task)
    }
    grouped.done.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
    return grouped
  }, [tasks])

  const moveTask = async (task: BoardTask, target: ColumnKey) => {
    const column = columns.find((option) => option.key === target)
    if (!column || columnFor(task) === target) return
    const previous = tasks
    const optimistic = { ...task, status: column.moveTo, completed: column.moveTo === "completed" }
    setTasks((current) => current.map((item) => (String(item.id) === String(task.id) ? optimistic : item)))
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status: column.moveTo }),
      })
      if (!response.ok) throw new Error("Move failed")
      const saved = (await response.json()) as BoardTask
      setTasks((current) => current.map((item) => (String(item.id) === String(task.id) ? saved : item)))
      if (column.moveTo === "completed" && saved.status !== "completed") {
        const next = dueLabel(saved)
        toast({ title: "Done. It repeats", description: next ? `Next one: ${next.replace("Due ", "")}.` : undefined })
      }
    } catch {
      setTasks(previous)
      toast({ title: "Couldn't move that task", description: "Nothing changed. Try again in a moment.", variant: "destructive" })
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const task = event.active.data.current?.task as BoardTask | undefined
    const target = event.over?.data.current?.column as ColumnKey | undefined
    if (task && target) void moveTask(task, target)
  }

  if (authLoading || !user || loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {columns.map((column) => (
          <Skeleton key={column.key} className="h-64 w-64 shrink-0 rounded-xl lg:w-auto lg:flex-1" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {loadError ? (
        <p role="status" className="rounded-xl border border-dashed bg-card/60 p-4 text-sm text-muted-foreground">{loadError}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Drag a card to change where it stands, or use its menu.</p>
      )}
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 lg:grid lg:grid-cols-5 lg:overflow-visible">
          {columns.map((column) => {
            const items = byColumn[column.key]
            const shown = column.key === "done" ? items.slice(0, DONE_SHOWN) : items
            return (
              <BoardColumn key={column.key} columnKey={column.key} label={column.label} count={items.length}>
                {shown.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-muted-foreground">{column.empty}</p>
                ) : (
                  shown.map((task) => <BoardCard key={task.id} task={task} column={column.key} onMove={moveTask} />)
                )}
                {column.key === "done" && items.length > DONE_SHOWN && (
                  <p className="px-1 text-xs text-muted-foreground">
                    {items.length - DONE_SHOWN} more under Done in the List tab.
                  </p>
                )}
              </BoardColumn>
            )
          })}
        </div>
      </DndContext>
    </div>
  )
}

function BoardColumn({
  columnKey,
  label,
  count,
  children,
}: {
  columnKey: ColumnKey
  label: string
  count: number
  children: React.ReactNode
}) {
  const { isOver, setNodeRef } = useDroppable({ id: `board-${columnKey}`, data: { column: columnKey } })
  return (
    <section
      ref={setNodeRef}
      aria-label={`${label}, ${count} task${count === 1 ? "" : "s"}`}
      className={cn(
        "flex min-h-[16rem] w-64 shrink-0 flex-col gap-2 rounded-xl border bg-muted/30 p-2 transition-colors lg:w-auto",
        isOver && "border-primary/40 bg-primary-tint",
      )}
    >
      <h2 className="flex items-baseline justify-between px-1 pt-1 text-sm font-semibold text-foreground">
        {label}
        <span className="text-xs font-normal tabular-nums text-muted-foreground">{count}</span>
      </h2>
      {children}
    </section>
  )
}

function BoardCard({
  task,
  column,
  onMove,
}: {
  task: BoardTask
  column: ColumnKey
  onMove: (task: BoardTask, target: ColumnKey) => Promise<void>
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, isDragging } = useDraggable({
    id: `board-task-${task.id}`,
    data: { task },
  })
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
  const due = dueLabel(task)
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card p-2 shadow-sm",
        isDragging && "relative z-20 shadow-lg ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-start gap-1">
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="mt-0.5 shrink-0 cursor-grab rounded p-0.5 text-muted-foreground active:cursor-grabbing"
          aria-label={`Drag ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium leading-snug text-foreground", task.completed && "text-muted-foreground line-through")}>
            {task.title}
          </p>
          {(due || task.priority === "high") && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[due, task.priority === "high" && !task.completed ? "High priority" : null].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label={`Move ${task.title}`}>
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {columns
              .filter((option) => option.key !== column)
              .map((option) => (
                <DropdownMenuItem key={option.key} onSelect={() => void onMove(task, option.key)}>
                  {option.label}
                </DropdownMenuItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
