"use client"

import { useEffect } from "react"
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { WeeklyReviewView } from "@/components/reflect/weekly-review-view"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

const tabLoading = () => <Skeleton className="h-64 w-full rounded-xl" />
const PatternsView = dynamic(() => import("@/components/reflect/patterns-view").then((m) => m.PatternsView), { loading: tabLoading })
const LifeScoreView = dynamic(() => import("@/components/reflect/lifescore-view").then((m) => m.LifeScoreView), { loading: tabLoading })
const TimelineView = dynamic(() => import("@/components/reflect/timeline-view").then((m) => m.TimelineView), { loading: tabLoading })
const JournalInsightsView = dynamic(() => import("@/components/reflect/journal-insights-view").then((m) => m.JournalInsightsView), {
  loading: tabLoading,
})

// Weekly Review is the main page of Reflect (Stage 1 step 7). What I noticed replaced the
// Life Balance and "What you're missing" tabs on 2026-11-17 (Stage 5).
const tabs = [
  { value: "weekly-review", label: "Weekly Review" },
  { value: "noticed", label: "What I noticed" },
  { value: "lifescore", label: "LifeScore" },
  { value: "timeline", label: "Timeline" },
  { value: "journal", label: "Journal" },
] as const

type ReflectTab = (typeof tabs)[number]["value"]

// Old links to the retired tabs land on What I noticed.
const retiredTabs: Record<string, ReflectTab> = { "life-balance": "noticed", "ignored-signals": "noticed" }

// Params that belong to one tab, so switching tabs doesn't carry them along.
const tabParams = ["type"]

function normalizeTab(value: string | null): ReflectTab {
  if (value && retiredTabs[value]) return retiredTabs[value]
  return tabs.some((tab) => tab.value === value) ? (value as ReflectTab) : "weekly-review"
}

export default function ReflectPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user, loading } = useAuth()
  const activeTab = normalizeTab(searchParams.get("tab"))

  useEffect(() => {
    if (!loading && !user) router.push("/login")
  }, [loading, router, user])

  const switchTab = (tab: ReflectTab) => {
    const params = new URLSearchParams(searchParams.toString())
    tabParams.forEach((key) => params.delete(key))
    if (tab === "weekly-review") params.delete("tab")
    else params.set("tab", tab)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <DashboardLayout>
      <div className="section-enter mx-auto w-full max-w-6xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Reflect</h1>
          <p className="mt-1 text-sm text-muted-foreground">Look back at your week, what LifeSort noticed, and how things are going.</p>
        </header>

        <div role="group" aria-label="Reflect view" className="flex max-w-full overflow-x-auto rounded-lg border bg-card p-1 sm:inline-flex">
          {tabs.map((tab) => {
            const selected = activeTab === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={selected}
                onClick={() => switchTab(tab.value)}
                className={cn(
                  "h-8 shrink-0 rounded-md px-3 text-sm font-medium transition-colors duration-150",
                  selected ? "bg-primary-tint text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {activeTab === "weekly-review" && <WeeklyReviewView />}
        {activeTab === "noticed" && <PatternsView />}
        {activeTab === "lifescore" && <LifeScoreView />}
        {activeTab === "timeline" && <TimelineView />}
        {activeTab === "journal" && <JournalInsightsView />}
      </div>
    </DashboardLayout>
  )
}
