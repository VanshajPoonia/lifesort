"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ChevronRight } from "lucide-react"

import { motionPresets } from "@/lib/motion"
import { cn } from "@/lib/utils"

type NavigationSummary = {
  counts?: Record<string, number>
  unavailable?: string[]
}

export type HubCard = {
  title: string
  description: string
  href: string
  icon: LucideIcon
  badge?: string
  statusKey?: string
  statusLabel?: string
  zeroLabel?: string
  priority?: "primary" | "secondary"
  disabled?: boolean
}

export function HubHero({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <header className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", motionPresets.fadeIn)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">{title}</h1>
        {/* Keyed so the line crossfades when a tab swaps the description. */}
        <p key={description} className={cn("mt-1 max-w-2xl text-sm leading-6 text-muted-foreground", motionPresets.fadeIn)}>
          {description}
        </p>
      </div>
      {children}
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", motionPresets.fadeIn)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        {description && <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

function useNavigationSummary(cards: HubCard[]) {
  const [summary, setSummary] = useState<NavigationSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!cards.some((card) => card.statusKey)) return

    let cancelled = false
    // Flagged by react-hooks/set-state-in-effect: re-runs when cards change
    // and needs the loading indicator back on immediately.
    setLoading(true)
    fetch("/api/navigation-summary")
      .then(async (response) => {
        if (!response.ok) return null
        return response.json()
      })
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [cards])

  return { summary, loading }
}

function StatusBadge({
  card,
  summary,
  loading,
}: {
  card: HubCard
  summary: NavigationSummary | null
  loading: boolean
}) {
  const pill = "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
  if (card.badge) {
    return <span className={cn(pill, "bg-muted text-muted-foreground")}>{card.badge}</span>
  }
  if (!card.statusKey) return null
  if (loading) return <span className={cn(pill, "w-12 animate-pulse bg-muted")} aria-hidden="true">&nbsp;</span>
  if (summary?.unavailable?.includes(card.statusKey)) return null

  const count = Number(summary?.counts?.[card.statusKey] || 0)
  if (count <= 0) return null

  return (
    <span className={cn(pill, "bg-primary-tint text-primary animate-in fade-in-0 duration-200")}>
      {count} {card.statusLabel || "open"}
    </span>
  )
}

// Hub destinations as one dense, scannable launcher (DESIGN.md list-row),
// not a wall of equal cards. Order in the array is the priority order.
export function HubGrid({ cards }: { cards: HubCard[] }) {
  const { summary, loading } = useNavigationSummary(cards)

  return (
    <ul className={cn("grid gap-x-2 rounded-xl border bg-card p-1.5 sm:grid-cols-2", motionPresets.staggerContainer)}>
      {cards.map((card) => {
        const { title, description, href, icon: Icon } = card
        const content = (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150",
                card.disabled ? "bg-muted text-muted-foreground" : "bg-primary-tint text-primary",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{title}</span>
                <StatusBadge card={card} summary={summary} loading={loading} />
              </span>
              <span className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-muted-foreground sm:line-clamp-1">{description}</span>
            </span>
            {!card.disabled && (
              <ChevronRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transform-none"
              />
            )}
          </>
        )
        const rowClass = "group flex min-h-[64px] items-center gap-3 rounded-lg px-3 py-2.5"

        return (
          <li key={`${href}-${title}`} className="min-w-0">
            {card.disabled ? (
              <div className={cn(rowClass, "cursor-not-allowed opacity-70")} aria-disabled="true">
                {content}
              </div>
            ) : (
              <Link
                href={href}
                className={cn(rowClass, "transition-colors duration-150 hover:bg-muted/60 focus-visible:bg-muted/60 active:bg-muted")}
              >
                {content}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
