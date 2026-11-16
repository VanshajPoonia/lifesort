"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, MoreHorizontal, Pause, Play } from "lucide-react"

import { KitIcon, localToday } from "@/components/kits/kit-icon"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import type { KitSummary } from "@/lib/life-kits-server"

function dueText(date: string | null, today: string) {
  if (!date) return "Later"
  if (date === today) return "Today"
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function KitCard({ kit, onChanged }: { kit: KitSummary; onChanged: () => void }) {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const today = localToday()
  const paused = kit.status === "paused"

  const setStatus = async (status: "active" | "paused" | "finished") => {
    setBusy(true)
    try {
      const response = await fetch(`/api/kits/${kit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, today }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Couldn't change that kit.")
      toast({
        title: status === "paused" ? "Kit paused" : status === "active" ? "Kit back on" : "Kit finished",
        description:
          status === "paused"
            ? "Its steps moved to Later and its habits are off until you resume."
            : status === "active"
              ? "Its steps are back on their dates."
              : undefined,
      })
      onChanged()
    } catch (error) {
      toast({ title: "Nothing changed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      const response = await fetch(`/api/kits/${kit.id}`, { method: "DELETE" })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Couldn't remove that kit.")
      toast({ title: "Kit removed", description: "Anything you'd changed or done is still there." })
      onChanged()
    } catch (error) {
      toast({ title: "Kit not removed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" })
    } finally {
      setBusy(false)
      setConfirmRemove(false)
    }
  }

  return (
    <article className="flex flex-col rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <KitIcon name={kit.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{kit.title}</h3>
            {paused && <Badge variant="secondary">Paused</Badge>}
            {kit.status === "finished" && <Badge variant="secondary">Finished</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {kit.progress.line}
            {kit.progress.phase && ` · ${kit.progress.phase}`}
            {kit.domain_name && ` · ${kit.domain_name}`}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`More for ${kit.title}`} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MoreHorizontal className="h-4 w-4" aria-hidden="true" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {kit.status !== "finished" && <DropdownMenuItem onSelect={() => void setStatus("finished")}>Mark as finished</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => setConfirmRemove(true)} className="text-destructive focus:text-destructive">
              Remove kit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${kit.progress.percent}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {kit.tasks_done} of {kit.tasks_total} steps done
      </p>

      {kit.next_tasks.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {kit.next_tasks.map((task) => (
            <li key={task.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-foreground">{task.title}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{dueText(task.due_date, today)}</span>
            </li>
          ))}
        </ul>
      )}

      {kit.progress.prompt && kit.status === "active" && (
        <p className="mt-3 border-t border-border/70 pt-3 text-xs italic text-muted-foreground">{kit.progress.prompt}</p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        {kit.status !== "finished" && (
          <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={() => void setStatus(paused ? "active" : "paused")}>
            {paused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
            {paused ? "Resume" : "Pause"}
          </Button>
        )}
        {kit.life_area_id && (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/tasks?life_area_id=${kit.life_area_id}`}>All steps</Link>
          </Button>
        )}
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {kit.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Steps you haven&apos;t started move to Let go, unused habits stop, and an unused goal, budget line or Vault entry is deleted. Anything you changed or did stays.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault()
                void remove()
              }}
            >
              Remove kit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}
