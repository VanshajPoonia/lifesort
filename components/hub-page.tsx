"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight, Pin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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
}

export function HubHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
    </section>
  )
}

function useNavigationSummary(cards: HubCard[]) {
  const [summary, setSummary] = useState<NavigationSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!cards.some((card) => card.statusKey)) return

    let cancelled = false
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
  if (card.badge) return <Badge variant="secondary">{card.badge}</Badge>
  if (!card.statusKey) {
    return <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
  }

  if (loading) return <Badge variant="outline">Loading</Badge>
  if (summary?.unavailable?.includes(card.statusKey)) return <Badge variant="outline">Unavailable</Badge>

  const count = Number(summary?.counts?.[card.statusKey] || 0)
  if (count <= 0) {
    return card.zeroLabel ? <Badge variant="outline">{card.zeroLabel}</Badge> : <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
  }

  return (
    <Badge variant="secondary">
      {count} {card.statusLabel || "open"}
    </Badge>
  )
}

export function HubGrid({ cards }: { cards: HubCard[] }) {
  const { summary, loading } = useNavigationSummary(cards)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const { title, description, href, icon: Icon } = card
        return (
        <Link key={`${href}-${title}`} href={href} className="group">
          <Card className="h-full transition-colors hover:border-primary/60 hover:bg-muted/30">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <StatusBadge card={card} summary={summary} loading={loading} />
              </div>
              <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="mt-1">{description}</CardDescription>
              </div>
            </CardHeader>
          </Card>
        </Link>
      )})}
    </div>
  )
}

export function FavoritesTodo() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            <Pin className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium">Pinned favorites</p>
            <p className="text-sm text-muted-foreground">
              TODO: Add user-selected shortcut pins after the hub navigation settles.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
