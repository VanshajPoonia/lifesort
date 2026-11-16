"use client"

import { useEffect, useState } from "react"
import { ArrowRight, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { addDaysToDate } from "@/lib/date-math"

type OpenTask = { id: number; title: string; due_date: string | null; scheduled_date: string | null; scheduled_time: string | null; status: string | null }

const parked = new Set(["someday", "waiting", "cancelled", "completed"])

async function putTask(body: Record<string, unknown>) {
  const response = await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  if (!response.ok) throw new Error("save")
}

// Evening shutdown: move what's still open today to tomorrow in one tap, with Undo.
export function CarryOver({ date, onMoved }: { date: string; onMoved: () => void }) {
  const { toast } = useToast()
  const [left, setLeft] = useState<OpenTask[] | null>(null)
  const [moving, setMoving] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tasks?completed=false&date_from=${date}&date_to=${date}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: OpenTask[]) => {
        if (!cancelled) setLeft(rows.filter((task) => !parked.has(task.status ?? "")))
      })
      .catch(() => {
        if (!cancelled) setLeft([])
      })
    return () => {
      cancelled = true
    }
  }, [date, version])

  if (!left || left.length === 0) return null

  const tomorrow = addDaysToDate(date, 1)

  const undo = async (moved: OpenTask[]) => {
    await Promise.allSettled(
      moved.map((task) => putTask({ id: task.id, due_date: task.due_date, scheduled_date: task.scheduled_date, scheduled_time: task.scheduled_time })),
    )
    setVersion((current) => current + 1)
    onMoved()
  }

  const moveAll = async () => {
    setMoving(true)
    const tasks = left
    const results = await Promise.allSettled(
      tasks.map((task) =>
        putTask({
          id: task.id,
          due_date: tomorrow,
          ...(task.scheduled_date === date ? { scheduled_date: null, scheduled_time: null } : {}),
        }).then(() => task),
      ),
    )
    const moved = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    setMoving(false)
    setVersion((current) => current + 1)
    onMoved()
    toast({
      title: moved.length === 1 ? "Moved 1 task to tomorrow" : `Moved ${moved.length} tasks to tomorrow`,
      description: moved.length < tasks.length ? "Some couldn't move. They're still on today." : "Today is done. Rest well.",
      action: (
        <ToastAction altText="Undo" onClick={() => void undo(moved)}>
          Undo
        </ToastAction>
      ),
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {left.length === 1 ? "1 task is still open today." : `${left.length} tasks are still open today.`} Move them to tomorrow and call it a day?
      </p>
      <Button size="sm" variant="outline" className="w-fit shrink-0 gap-1.5" disabled={moving} onClick={() => void moveAll()}>
        {moving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
        Move to tomorrow
      </Button>
    </div>
  )
}
