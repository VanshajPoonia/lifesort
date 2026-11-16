"use client"

import { useState } from "react"
import { Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { durationLabel } from "@/lib/day-plan"
import { totalMinutes, type BreakdownStep } from "@/lib/task-breakdown"

// "Break it down": the AI suggests steps with minutes, the person keeps the ones they
// want, and they're added to the task's checklist. The task's length can follow.
export function TaskBreakdown({ taskId, onAdded }: { taskId: number; onAdded: () => void }) {
  const { toast } = useToast()
  const [steps, setSteps] = useState<BreakdownStep[] | null>(null)
  const [kept, setKept] = useState<Set<number>>(new Set())
  const [setLength, setSetLength] = useState(true)
  const [thinking, setThinking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const suggest = async () => {
    setThinking(true)
    setError("")
    try {
      const response = await fetch("/api/ai/task-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Couldn't break that down right now.")
      setSteps(data.steps)
      setKept(new Set(data.steps.map((_: BreakdownStep, index: number) => index)))
    } catch (suggestError) {
      setError(suggestError instanceof Error ? suggestError.message : "Couldn't break that down right now.")
    } finally {
      setThinking(false)
    }
  }

  const chosen = (steps ?? []).filter((_, index) => kept.has(index))
  const total = totalMinutes(chosen)

  const add = async () => {
    setSaving(true)
    let added = 0
    try {
      // One at a time so the checklist keeps the suggested order.
      for (const step of chosen) {
        const response = await fetch(`/api/tasks/${taskId}/checklist-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: step.title }),
        })
        if (!response.ok) throw new Error("Couldn't add every step.")
        added += 1
      }
      if (setLength && total > 0) {
        const response = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: taskId, duration_minutes: total }),
        })
        if (!response.ok) throw new Error("Steps added, but the task's length didn't save.")
      }
      toast({ title: `Added ${added} ${added === 1 ? "step" : "steps"}`, description: setLength ? `About ${durationLabel(total)} in all.` : undefined })
      setSteps(null)
    } catch (addError) {
      toast({ title: "Not everything was added", description: addError instanceof Error ? addError.message : "Try again.", variant: "destructive" })
    } finally {
      setSaving(false)
      if (added > 0) onAdded()
    }
  }

  if (!steps) {
    return (
      <div className="space-y-1">
        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={() => void suggest()} disabled={thinking}>
          {thinking ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3 w-3" aria-hidden="true" />}
          Break it down
        </Button>
        {thinking && <p className="text-xs text-muted-foreground">Thinking it through. This can take up to a minute.</p>}
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-2">
      <p className="text-xs font-medium text-foreground">Suggested steps. Untick any you don&apos;t want.</p>
      <ul className="space-y-1">
        {steps.map((step, index) => {
          const id = `breakdown-${taskId}-${index}`
          return (
            <li key={id} className="flex items-center gap-2 text-sm">
              <Checkbox
                id={id}
                checked={kept.has(index)}
                onCheckedChange={() =>
                  setKept((current) => {
                    const next = new Set(current)
                    if (next.has(index)) next.delete(index)
                    else next.add(index)
                    return next
                  })
                }
              />
              <label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">{step.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{durationLabel(step.minutes)}</span>
              </label>
            </li>
          )
        })}
      </ul>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox checked={setLength} onCheckedChange={(checked) => setSetLength(checked === true)} />
        Set this task&apos;s length to {durationLabel(total)}
      </label>
      <div className="flex gap-2">
        <Button type="button" size="sm" className="h-7 px-2 text-xs" onClick={() => void add()} disabled={saving || chosen.length === 0}>
          {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />}
          Add {chosen.length} {chosen.length === 1 ? "step" : "steps"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSteps(null)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
