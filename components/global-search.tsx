"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CheckSquare,
  DollarSign,
  FileText,
  Heart,
  Link2,
  Loader2,
  Search,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"

type SearchType =
  | "tasks"
  | "goals"
  | "notes"
  | "links"
  | "wishlist"
  | "investments"
  | "income"
  | "budget"

type SearchResult = {
  type: SearchType
  id: string
  title: string
  subtitle: string
  href: string
  updated_at: string | null
}

type SearchGroup = {
  type: SearchType
  label: string
  results: SearchResult[]
}

type SearchResponse = {
  query: string
  groups: SearchGroup[]
}

const groupIcons = {
  tasks: CheckSquare,
  goals: Target,
  notes: FileText,
  links: Link2,
  wishlist: Heart,
  investments: TrendingUp,
  income: DollarSign,
  budget: Wallet,
}

function formatDate(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [groups, setGroups] = useState<SearchGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    if (!open) return

    if (debouncedQuery.length < 2) {
      setGroups([])
      setError("")
      setLoading(false)
      return
    }

    const controller = new AbortController()

    async function search() {
      setLoading(true)
      setError("")

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(response.status === 401 ? "Sign in to search LifeSort." : "Search is unavailable right now.")
        }

        const data = (await response.json()) as SearchResponse
        setGroups(Array.isArray(data.groups) ? data.groups : [])
      } catch (searchError) {
        if ((searchError as Error).name === "AbortError") return
        setError(searchError instanceof Error ? searchError.message : "Search is unavailable right now.")
        setGroups([])
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    search()

    return () => controller.abort()
  }, [debouncedQuery, open])

  const populatedGroups = useMemo(() => groups.filter((group) => group.results.length > 0), [groups])
  const hasQuery = query.trim().length >= 2

  const handleSelect = (result: SearchResult) => {
    setOpen(false)
    setQuery("")
    setDebouncedQuery("")
    router.push(result.href)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="hidden w-48 justify-start gap-2 px-3 text-muted-foreground lg:flex lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">⌘K</kbd>
      </Button>
      <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Search">
        <Search className="h-5 w-5 text-foreground" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search tasks, goals, notes, links..." value={query} onValueChange={setQuery} />
        <CommandList className="max-h-[420px]">
          {!hasQuery ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search LifeSort.
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching...
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center text-sm text-destructive">{error}</div>
          ) : populatedGroups.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No results found.</div>
          ) : (
            populatedGroups.map((group) => {
              const Icon = groupIcons[group.type]

              return (
                <CommandGroup key={group.type} heading={group.label}>
                  {group.results.map((result) => (
                    <CommandItem
                      key={`${result.type}-${result.id}`}
                      value={`${result.title} ${result.subtitle} ${group.label}`}
                      onSelect={() => handleSelect(result)}
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{result.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>
                      </span>
                      {result.updated_at && <CommandShortcut>{formatDate(result.updated_at)}</CommandShortcut>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )
            })
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
