"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import dynamic from "next/dynamic"

import { DashboardLayout } from "@/components/dashboard-layout"
import { TaskListView } from "@/components/tasks/task-list-view"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// List is the default tab, so it loads with the page. The others load when opened.
const tabLoading = () => <Skeleton className="h-64 w-full rounded-xl" />
const TaskBoardView = dynamic(() => import("@/components/tasks/task-board-view").then((m) => m.TaskBoardView), { loading: tabLoading })
const CalendarView = dynamic(() => import("@/components/tasks/calendar-view").then((m) => m.CalendarView), { loading: tabLoading })
const HabitsView = dynamic(() => import("@/components/tasks/habits-view").then((m) => m.HabitsView), { loading: tabLoading })

// Tasks is the one place for things to do (AI_BUILD_PLAN.md Part 0, Stage 1 step 3).
// Calendar and Habits used to be their own pages and now live here as tabs.
const tabs = [
  { value: "list", label: "List" },
  { value: "board", label: "Board" },
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
        {activeTab === "board" && <TaskBoardView />}
        {activeTab === "calendar" && <CalendarView />}
        {activeTab === "habits" && <HabitsView />}
      </div>
    </DashboardLayout>
  )
}
