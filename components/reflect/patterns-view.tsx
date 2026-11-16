"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { BookOpenText, CheckSquare, Heart, Loader2, Repeat, Sparkles, Target, Users, Wallet, X, type LucideIcon } from "lucide-react"

import { localToday } from "@/components/kits/kit-icon"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import type { Pattern, PatternKind } from "@/lib/life-patterns"
import type { PatternFeed } from "@/lib/life-patterns-server"

const kindIcons: Record<PatternKind, LucideIcon> = {
  mood: Heart,
  habits: Repeat,
  tasks: CheckSquare,
  money: Wallet,
  journal: BookOpenText,
  domains: Target,
  people: Users,
}

type Explanation = { summary: string; suggestions: string[] }

function weekLabel(monday: string) {
  return new Date(`${monday}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

function PatternRow({ pattern, onDismiss }: { pattern: Pattern; onDismiss: (key: string) => void }) {
  const Icon = kindIcons[pattern.kind]
  return (
    <li className="flex items-start gap-3 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <Link href={pattern.href} className="text-sm font-medium text-foreground hover:underline">
          {pattern.title}
        </Link>
        <p className="mt-0.5 text-sm text-muted-foreground">{pattern.detail}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground"
        aria-label={`Hide "${pattern.title}" for four weeks`}
        onClick={() => onDismiss(pattern.key)}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </li>
  )
}

// Reflect's "What I noticed" feed (AI_BUILD_PLAN.md Part 0, Stage 5).
export function PatternsView() {
  const { toast } = useToast()
  const [feed, setFeed] = useState<PatternFeed | null>(null)
  const [error, setError] = useState("")
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [explaining, setExplaining] = useState(false)
  const [explainError, setExplainError] = useState("")

  useEffect(() => {
    let cancelled = false
    fetch(`/api/patterns?today=${localToday()}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || "Couldn't look for patterns right now.")
        if (!cancelled) setFeed(data as PatternFeed)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Couldn't look for patterns right now.")
      })
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = useCallback(
    async (key: string) => {
      setFeed((current) =>
        current
          ? {
              ...current,
              patterns: current.patterns.filter((pattern) => pattern.key !== key),
              worth_a_look: current.worth_a_look.filter((pattern) => pattern.key !== key),
            }
          : current,
      )
      try {
        const response = await fetch("/api/patterns/dismiss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, today: localToday() }),
        })
        if (!response.ok) throw new Error("Couldn't hide that.")
        toast({ title: "Hidden for four weeks" })
      } catch {
        toast({ title: "Couldn't hide that", description: "It may show up again next time.", variant: "destructive" })
      }
    },
    [toast],
  )

  const explain = async () => {
    setExplaining(true)
    setExplainError("")
    try {
      const response = await fetch("/api/ai/patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today: localToday() }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Couldn't explain these right now.")
      setExplanation(data.explanation)
    } catch (explainFailure) {
      setExplainError(explainFailure instanceof Error ? explainFailure.message : "Couldn't explain these right now.")
    } finally {
      setExplaining(false)
    }
  }

  if (error) return <p className="text-sm text-muted-foreground">{error}</p>
  if (!feed) return <Skeleton className="h-48 w-full rounded-xl" />

  const hasAnything = feed.patterns.length > 0 || feed.worth_a_look.length > 0

  return (
    <div className="section-enter space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">What I noticed</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            From the 12 weeks up to the week of {weekLabel(feed.last_week)}. These things happened together. That doesn&apos;t mean one caused the other.
          </p>
        </div>
        {hasAnything && (
          <Button size="sm" variant="outline" className="w-fit shrink-0 gap-2" onClick={() => void explain()} disabled={explaining}>
            {explaining ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            What might this mean?
          </Button>
        )}
      </div>

      {(explaining || explanation || explainError) && (
        <section aria-live="polite" className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
          {explaining ? (
            <p className="text-muted-foreground">Reading your week. This can take up to a minute.</p>
          ) : explainError ? (
            <p className="text-muted-foreground">{explainError}</p>
          ) : explanation ? (
            <>
              <p className="text-foreground">{explanation.summary}</p>
              {explanation.suggestions.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                  {explanation.suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              )}
            </>
          ) : null}
        </section>
      )}

      {!hasAnything ? (
        <p className="rounded-xl border border-dashed bg-card/60 p-4 text-sm text-muted-foreground">
          Nothing stands out yet. Patterns show up after a few weeks of journaling, habits and tasks.
        </p>
      ) : (
        <>
          {feed.patterns.length > 0 && (
            <section aria-label="Patterns" className="rounded-xl border bg-card px-4">
              <ul className="divide-y">
                {feed.patterns.map((pattern) => (
                  <PatternRow key={pattern.key} pattern={pattern} onDismiss={(key) => void dismiss(key)} />
                ))}
              </ul>
            </section>
          )}
          {feed.worth_a_look.length > 0 && (
            <section aria-labelledby="worth-a-look" className="space-y-2">
              <h3 id="worth-a-look" className="text-sm font-semibold text-foreground">
                Worth a look
              </h3>
              <ul className="divide-y rounded-xl border bg-card px-4">
                {feed.worth_a_look.map((pattern) => (
                  <PatternRow key={pattern.key} pattern={pattern} onDismiss={(key) => void dismiss(key)} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
