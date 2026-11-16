"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { LifeScoreComponent, LifeScoreData } from "@/lib/life-score"
import { cn } from "@/lib/utils"

type LifeScoreExplanation = {
  summary: string
  what_helped: string[]
  gentle_watchouts: string[]
  next_small_steps: string[]
}

function statusClass(status: LifeScoreComponent["status"]) {
  if (status === "supportive") return "bg-emerald-500"
  if (status === "steady") return "bg-primary"
  return "bg-amber-500"
}

function changeText(change: number | null) {
  if (change === null) return "First snapshot"
  if (change > 0) return `+${change} since last snapshot`
  if (change < 0) return `${change} since last snapshot`
  return "Steady since last snapshot"
}

// LifeScore was a card on Home until the Today merge. It lives in Reflect since 2026-11-16.
export function LifeScoreView() {
  const [lifeScore, setLifeScore] = useState<LifeScoreData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<LifeScoreExplanation | null>(null)
  const [explaining, setExplaining] = useState(false)
  const [explainError, setExplainError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/life-score")
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.status === 401 ? "Sign in again to load LifeScore." : "LifeScore is unavailable right now.")
        }
        return response.json()
      })
      .then((data) => {
        if (!cancelled) setLifeScore(data.life_score ?? null)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "LifeScore is unavailable right now.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const explain = async () => {
    setExplaining(true)
    setExplainError(null)
    try {
      const response = await fetch("/api/ai/life-score", { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "LifeScore explanation is unavailable right now.")
      setExplanation(data.explanation ?? null)
      if (data.life_score) setLifeScore(data.life_score)
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : "LifeScore explanation is unavailable right now.")
    } finally {
      setExplaining(false)
    }
  }

  return (
    <section aria-labelledby="reflect-lifescore" className="section-enter rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="reflect-lifescore" className="text-lg font-semibold tracking-tight text-foreground">LifeScore</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">A calm daily signal for how organized your system is.</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit gap-2"
          onClick={() => void explain()}
          disabled={explaining || loading || Boolean(error) || !lifeScore?.ready}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {explaining ? "Explaining..." : "Explain with AI"}
        </Button>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">{error}</p>
        ) : lifeScore?.ready ? (
          <>
            <div className="grid gap-6 md:grid-cols-[160px_minmax(0,1fr)]">
              <div>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold leading-none tracking-tight tabular-nums text-foreground">{lifeScore.score}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium text-foreground">{lifeScore.label}</span>
                  <span className="text-muted-foreground"> · {changeText(lifeScore.change)}</span>
                </p>
              </div>
              <ul className="space-y-4">
                {lifeScore.components.map((item) => (
                  <li key={item.key}>
                    <Link href={item.href} className="group block rounded-md">
                      <span className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-foreground">{item.label}</span>
                        <span className="tabular-nums text-muted-foreground">{item.score}</span>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span className={cn("bar-grow block h-full rounded-full", statusClass(item.status))} style={{ width: `${item.score}%` }} />
                      </span>
                      <span className="mt-1.5 block text-xs text-muted-foreground transition-colors group-hover:text-foreground">{item.explanation}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {lifeScore.top_improvements.length > 0 && (
              <div className="mt-6 border-t border-border/70 pt-4">
                <h3 className="text-sm font-medium text-foreground">Small things that would help</h3>
                <ul className="mt-2 space-y-2">
                  {lifeScore.top_improvements.map((item) => (
                    <li key={item.component_key}>
                      <Link href={item.href} className="group flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          <span className="font-medium text-foreground">{item.title}.</span> {item.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(explanation || explainError) && (
              <div aria-live="polite" className="mt-6 border-t border-border/70 pt-4">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                  {explainError ? "Couldn't explain right now" : "What's behind it"}
                </p>
                <p className="mt-1.5 text-sm text-muted-foreground">{explainError || explanation?.summary}</p>
                {explanation && explanation.next_small_steps.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {explanation.next_small_steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Your score appears once there&apos;s something to measure: a task, focus item, habit, goal or review.
            </p>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/">Open Today</Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
