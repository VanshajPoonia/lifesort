"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { DashboardLayout } from "@/components/dashboard-layout"
import { CalendarView } from "@/components/tasks/calendar-view"
import { HabitsView } from "@/components/tasks/habits-view"
import { TaskListView } from "@/components/tasks/task-list-view"
import { cn } from "@/lib/utils"

// Tasks is the one place for things to do (AI_BUILD_PLAN.md Part 0, Stage 1 step 3).
// Calendar and Habits used to be their own pages and now live here as tabs.
const tabs = [
  { value: "list", label: "List" },
  { value: "calendar", label: "Calendar" },
  { value: "habits", label: "Habits" },
] as const

type TasksTab = (typeof tabs)[number]["value"]

function normalizeTab(value: string | null): TasksTab {
  return tabs.some((tab) => tab.value === value) ? (value as TasksTab) : "list"
}

export default function TasksPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = normalizeTab(searchParams.get("tab"))

  const switchTab = (tab: TasksTab) => {
    const params = new URLSearchParams(searchParams.toString())
    // A status filter only means something on the list.
    params.delete("status")
    if (tab === "list") params.delete("tab")
    else params.set("tab", tab)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <DashboardLayout>
      <div className="section-enter mx-auto w-full max-w-6xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything you mean to do, your calendar and your habits.</p>
        </header>

        <div role="group" aria-label="Tasks view" className="inline-flex max-w-full overflow-x-auto rounded-lg border bg-card p-1">
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

        {activeTab === "list" && <TaskListView />}
        {activeTab === "calendar" && <CalendarView />}
        {activeTab === "habits" && <HabitsView />}
      </div>
    </DashboardLayout>
  )
}
