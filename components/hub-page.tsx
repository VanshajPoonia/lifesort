"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, Pin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <section className={cn("surface-card rounded-lg border bg-card/95 p-4 sm:p-5", motionPresets.fadeInUp)}>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {children}
      </div>
    </section>
  )
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", motionPresets.fadeIn)}>
      <div>
        {eyebrow && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>}
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
  if (card.badge) {
    return (
      <Badge variant="secondary" className="shrink-0 bg-secondary/80 text-secondary-foreground">
        {card.badge}
      </Badge>
    )
  }
  if (!card.statusKey) {
    return <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
  }

  if (loading) return <Badge variant="outline" className="shrink-0 bg-background/70">Checking...</Badge>
  if (summary?.unavailable?.includes(card.statusKey)) {
    return <Badge variant="outline" className="shrink-0 bg-background/70">No data yet</Badge>
  }

  const count = Number(summary?.counts?.[card.statusKey] || 0)
  if (count <= 0) {
    return card.zeroLabel ? (
      <Badge variant="outline" className="shrink-0 bg-background/70 text-muted-foreground">{card.zeroLabel}</Badge>
    ) : (
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" />
    )
  }

  return (
    <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary">
      {count} {card.statusLabel || "open"}
    </Badge>
  )
}

export function HubGrid({ cards }: { cards: HubCard[] }) {
  const { summary, loading } = useNavigationSummary(cards)

  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4", motionPresets.staggerContainer)}>
      {cards.map((card) => {
        const { title, description, href, icon: Icon } = card
        const isPrimary = card.priority === "primary"
        const isSecondary = card.priority === "secondary"
        const cardContent = (
          <Card
            className={cn(
              "surface-card interactive-card h-full min-h-[150px] overflow-hidden",
              isPrimary && "min-h-[178px] border-primary/25 bg-primary/5",
              isSecondary && "min-h-[132px] bg-muted/20 shadow-none",
              card.disabled && "border-dashed bg-muted/20 opacity-80 shadow-none hover:translate-y-0 hover:shadow-sm",
            )}
          >
            <CardHeader className={cn("space-y-3 p-4", isPrimary && "sm:p-5", isSecondary && "space-y-2")}>
              <div className="flex items-start justify-between gap-3">
                <div
                  className={cn(
                    "rounded-lg p-2 text-primary transition-colors duration-150 group-hover:bg-primary/15",
                    isPrimary ? "bg-primary/15" : "bg-muted",
                    card.disabled && "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-5 w-5", isSecondary && "h-4 w-4")} />
                </div>
                <StatusBadge card={card} summary={summary} loading={loading} />
              </div>
              <div>
                <CardTitle className={cn("text-base leading-snug", isPrimary && "text-lg", isSecondary && "text-sm")}>{title}</CardTitle>
                <CardDescription className={cn("mt-1 leading-6", isSecondary && "text-xs leading-5")}>{description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        )

        if (card.disabled) {
          return (
            <div
              key={`${href}-${title}`}
              className={cn("group block min-w-0 cursor-not-allowed", motionPresets.pressable, isPrimary && "sm:col-span-1", isSecondary && "xl:col-span-1")}
              aria-disabled="true"
            >
              {cardContent}
            </div>
          )
        }

        return (
        <Link
          key={`${href}-${title}`}
          href={href}
          className={cn("group block min-w-0", motionPresets.pressable, isPrimary && "sm:col-span-1", isSecondary && "xl:col-span-1")}
        >
          {cardContent}
        </Link>
      )})}
    </div>
  )
}

export function FavoritesTodo() {
  return (
    <Card className="surface-card border-dashed bg-muted/20">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <Pin className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">Pinned favorites</p>
            <p className="text-sm text-muted-foreground">
              Reserved for the shortcuts you use most often once the hub navigation settles.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
