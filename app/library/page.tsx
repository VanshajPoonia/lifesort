"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import dynamic from "next/dynamic"

import { DashboardLayout } from "@/components/dashboard-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// Each tab loads on demand. Bundled together the six views were about 420 kB of
// JavaScript before anything showed, mostly the rich-text editor Notes and Journal share.
const tabLoading = () => <Skeleton className="h-64 w-full rounded-xl" />
const NotesView = dynamic(() => import("@/components/library/notes-view").then((m) => m.NotesView), { loading: tabLoading })
const JournalView = dynamic(() => import("@/components/library/journal-view").then((m) => m.JournalView), { loading: tabLoading })
const PeopleView = dynamic(() => import("@/components/library/people-view").then((m) => m.PeopleView), { loading: tabLoading })
const VaultView = dynamic(() => import("@/components/library/vault-view").then((m) => m.VaultView), { loading: tabLoading })
const LinksView = dynamic(() => import("@/components/library/links-view").then((m) => m.LinksView), { loading: tabLoading })
const WhiteboardsView = dynamic(() => import("@/components/library/whiteboards-view").then((m) => m.WhiteboardsView), { loading: tabLoading })

// Library holds what you keep rather than what you do (AI_BUILD_PLAN.md Part 0, Stage 1 step 6).
// Notes, Journal, People, Vault, Links and Whiteboards used to be separate pages.
const tabs = [
  { value: "notes", label: "Notes" },
  { value: "journal", label: "Journal" },
  { value: "people", label: "People" },
  { value: "vault", label: "Vault" },
  { value: "links", label: "Links" },
  { value: "whiteboards", label: "Whiteboards" },
] as const

type LibraryTab = (typeof tabs)[number]["value"]

// Params that belong to one tab, so switching tabs doesn't carry them along.
const tabParams = ["note", "date", "folder", "life_area_id", "template"]

function normalizeTab(value: string | null): LibraryTab {
  return tabs.some((tab) => tab.value === value) ? (value as LibraryTab) : "notes"
}

export default function LibraryPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = normalizeTab(searchParams.get("tab"))

  const switchTab = (tab: LibraryTab) => {
    const params = new URLSearchParams(searchParams.toString())
    tabParams.forEach((key) => params.delete(key))
    if (tab === "notes") params.delete("tab")
    else params.set("tab", tab)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <DashboardLayout>
      <div className="section-enter mx-auto w-full max-w-6xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">What you keep: notes, your journal, people, documents, links and boards.</p>
        </header>

        <div role="group" aria-label="Library view" className="flex max-w-full overflow-x-auto rounded-lg border bg-card p-1 sm:inline-flex">
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

        {activeTab === "notes" && <NotesView />}
        {activeTab === "journal" && <JournalView />}
        {activeTab === "people" && <PeopleView />}
        {activeTab === "vault" && <VaultView />}
        {activeTab === "links" && <LinksView />}
        {activeTab === "whiteboards" && <WhiteboardsView />}
      </div>
    </DashboardLayout>
  )
}
