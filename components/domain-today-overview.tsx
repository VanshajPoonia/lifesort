"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, ChevronDown } from "lucide-react"

import { LifeAreaIcon } from "@/components/life-area-controls"
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
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section aria-labelledby="domain-overview-heading">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <CollapsibleTrigger asChild>
            <button type="button" className="group -ml-1 flex items-center gap-1.5 rounded-md px-1 text-left">
              <h2 id="domain-overview-heading" className="text-base font-semibold tracking-tight text-foreground">
                Life domains
              </h2>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
              />
            </button>
          </CollapsibleTrigger>
          <Link href="/domains" className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary transition-colors hover:text-primary-hover">
            All domains
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        <CollapsibleContent className="collapsible-content">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-11 w-full" />)}
            </div>
          ) : (
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card">
              {domains.map((domain) => {
                return (
                  <li key={domain.id}>
                    <Link
                      href={`/domains/${domain.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: domain.color }}
                      >
                        <LifeAreaIcon name={domain.icon} className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-foreground">{domain.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{summaryLine(summaries[domain.id])}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
