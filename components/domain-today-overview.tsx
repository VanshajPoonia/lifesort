"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { LifeAreaIcon } from "@/components/life-area-controls"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { normalizeLifeArea, type LifeArea } from "@/lib/life-areas"

type DomainSummary = { tasksToday: number; tasksOverdue: number; habitsDue: number }

function summaryLine(summary: DomainSummary | undefined) {
  if (!summary) return "No planned activity"
  const parts: string[] = []
  if (summary.tasksToday > 0) parts.push(`${summary.tasksToday} task${summary.tasksToday === 1 ? "" : "s"} today`)
  if (summary.tasksOverdue > 0) parts.push(`${summary.tasksOverdue} overdue`)
  if (summary.habitsDue > 0) parts.push(`${summary.habitsDue} habit${summary.habitsDue === 1 ? "" : "s"} due`)
  return parts.length > 0 ? parts.join(" · ") : "No planned activity"
}

// Compact domain overview for the Today screen and home dashboard (AI_LIFE_DOMAINS_SPEC.md section 8).
export function DomainTodayOverview() {
  const [domains, setDomains] = useState<LifeArea[]>([])
  const [summaries, setSummaries] = useState<Record<string, DomainSummary>>({})
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [areasRes, navRes] = await Promise.all([
          fetch("/api/life-areas"),
          fetch("/api/navigation-summary"),
        ])
        const areas = areasRes.ok ? await areasRes.json() : []
        const nav = navRes.ok ? await navRes.json() : { domainSummary: {} }
        if (cancelled) return
        setDomains(Array.isArray(areas) ? areas.map(normalizeLifeArea).filter((area) => area.status === "active") : [])
        setSummaries(nav.domainSummary || {})
      } catch (error) {
        console.error("Failed to load domain overview:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && domains.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button type="button" className="flex w-full items-center justify-between gap-2 text-left">
              <CardTitle className="text-base">Life Domains</CardTitle>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-1.5 pt-0">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)
            ) : (
              domains.map((domain) => (
                <Link
                  key={domain.id}
                  href={`/domains/${domain.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/60"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white" style={{ backgroundColor: domain.color }}>
                      <LifeAreaIcon name={domain.icon} className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate font-medium text-foreground">{domain.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{summaryLine(summaries[domain.id])}</span>
                </Link>
              ))
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
