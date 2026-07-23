"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  BookOpenText,
  CalendarCheck,
  CheckSquare,
  ClipboardCheck,
  Command,
  DollarSign,
  FileText,
  FolderPlus,
  Gauge,
  HelpCircle,
  History,
  Home,
  Inbox,
  Link2,
  Loader2,
  Map,
  Plus,
  Paintbrush,
  Search,
  Settings,
  Shield,
  Sparkles,
  Target,
  Wallet,
} from "lucide-react"

import type { QuickAddType } from "@/components/quick-add-modal"
import { AppEmptyState } from "@/components/empty-state"
import { useDomainFocus } from "@/components/domain-focus-provider"
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type SearchType =
  | "inbox"
  | "someday"
  | "waiting"
  | "commitments"
  | "maintenance"
  | "timeline"
  | "tasks"
  | "goals"
  | "notes"
  | "projects"
  | "people"
  | "vault"
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
  life_area_id: string | null
}

type SearchGroup = {
  type: SearchType
  label: string
  results: SearchResult[]
}

type PaletteMode = "all" | "capture"

const groupIcons: Record<SearchType, typeof Search> = {
  inbox: Inbox,
  someday: Target,
  waiting: History,
  commitments: ClipboardCheck,
  maintenance: Shield,
  timeline: History,
  tasks: CheckSquare,
  goals: Target,
  notes: FileText,
  projects: FolderPlus,
  people: Shield,
  vault: Shield,
  links: Link2,
  wishlist: Wallet,
  investments: DollarSign,
  income: DollarSign,
  budget: Wallet,
}

const captureActions: Array<{
  label: string
  description: string
  icon: typeof Plus
  type?: QuickAddType
  href?: string
}> = [
  { label: "Add Task", description: "Capture a to-do", icon: CheckSquare, type: "task" },
  { label: "Add Goal", description: "Start a goal", icon: Target, type: "goal" },
  { label: "Add Note", description: "Save a thought", icon: FileText, type: "note" },
  { label: "Add Inbox Item", description: "Capture something messy", icon: Inbox, type: "inbox" },
  { label: "Journal Today", description: "Open today's journal", icon: BookOpenText, href: "/journal" },
  { label: "Universal Capture", description: "Parse text or open the full add form", icon: Plus, href: "/capture" },
]

const navigationActions = [
  { label: "Home", description: "Dashboard", href: "/", icon: Home },
  { label: "Today", description: "Daily planner", href: "/today", icon: CalendarCheck },
  { label: "Journal", description: "Daily reflection", href: "/journal", icon: BookOpenText },
  { label: "Workspace", description: "Plan, capture, visual tools, systems, and follow-ups", href: "/workspace", icon: FolderPlus },
  { label: "Spaces", description: "Group related LifeSort records", href: "/spaces", icon: Map },
  { label: "Whiteboard", description: "Sketch and collaborate", href: "/whiteboard", icon: Paintbrush },
  { label: "Money", description: "Finance hub", href: "/money", icon: Wallet },
  { label: "Reflect", description: "Review and insight", href: "/reflect", icon: Activity },
  { label: "Settings", description: "Profile and preferences", href: "/settings", icon: Settings },
  { label: "Tasks", description: "To-do list", href: "/tasks", icon: CheckSquare },
  { label: "Notes", description: "Notes and folders", href: "/notes", icon: FileText },
  { label: "Budget", description: "Budget categories", href: "/money?tab=budget", icon: Wallet },
  { label: "Weekly Review", description: "Review this week", href: "/review", icon: Gauge },
]

const aiActions = [
  { label: "LifeSort Coach", description: "Ask app-aware questions", href: "/ai-chat", icon: Sparkles },
  { label: "Capture with AI", description: "Parse messy text into drafts", href: "/capture", icon: Sparkles },
]

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName.toLowerCase()
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable
}

function formatDate(value: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function GlobalCommandPalette({
  open,
  onOpenChange,
  mode = "all",
  onOpenQuickAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: PaletteMode
  onOpenQuickAdd: (type?: QuickAddType) => void
}) {
  const router = useRouter()
  const { focus: domainFocus } = useDomainFocus()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [groups, setGroups] = useState<SearchGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpenChange(true)
        return
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "?") {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onOpenChange])

  useEffect(() => {
    if (open) setQuery("")
  }, [mode, open])

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

        const data = await response.json()
        setGroups(Array.isArray(data.groups) ? data.groups : [])
      } catch (searchError) {
        if ((searchError as Error).name === "AbortError") return
        setError(searchError instanceof Error ? searchError.message : "Search is unavailable right now.")
        setGroups([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    search()
    return () => controller.abort()
  }, [debouncedQuery, open])

  const populatedGroups = useMemo(() => {
    const domainFiltered = domainFocus
      ? groups.map((group) => ({
          ...group,
          results: group.results.filter((result) => !result.life_area_id || result.life_area_id === domainFocus.id),
        }))
      : groups
    return domainFiltered.filter((group) => group.results.length > 0)
  }, [groups, domainFocus])
  const hasQuery = query.trim().length >= 2

  const navigate = (href: string) => {
    onOpenChange(false)
    setQuery("")
    setDebouncedQuery("")
    router.push(href)
  }

  const openQuickAdd = (type?: QuickAddType) => {
    onOpenChange(false)
    setQuery("")
    setDebouncedQuery("")
    onOpenQuickAdd(type)
  }

  return (
    <>
      <CommandDialog open={open} onOpenChange={onOpenChange}>
        <CommandInput
          placeholder={mode === "capture" ? "Capture, search, or jump somewhere..." : "Search, capture, or jump somewhere..."}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[460px]">
          {(!hasQuery || mode === "capture") && (
            <CommandGroup heading="Capture">
              {captureActions.map((action) => {
                const Icon = action.icon
                return (
                  <CommandItem
                    key={action.label}
                    value={`${action.label} ${action.description}`}
                    onSelect={() => action.href ? navigate(action.href) : openQuickAdd(action.type)}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{action.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{action.description}</span>
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          )}

          {!hasQuery && (
            <>
              <CommandGroup heading="Navigate">
                {navigationActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <CommandItem key={action.href} value={`${action.label} ${action.description}`} onSelect={() => navigate(action.href)}>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{action.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{action.description}</span>
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>

              <CommandGroup heading="Ask AI">
                {aiActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <CommandItem key={action.href} value={`${action.label} ${action.description}`} onSelect={() => navigate(action.href)}>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{action.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{action.description}</span>
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </>
          )}

          {hasQuery && (
            loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            ) : error ? (
              <div className="px-4 py-8 text-center text-sm text-destructive">{error}</div>
            ) : populatedGroups.length === 0 ? (
              <AppEmptyState
                icon={Search}
                title="No results found"
                hint="Try a task, note, project, person, budget item, or another LifeSort keyword."
                className="m-3"
              />
            ) : (
              populatedGroups.map((group) => {
                const Icon = groupIcons[group.type] || Search
                return (
                  <CommandGroup key={group.type} heading={group.label}>
                    {group.results.map((result) => (
                      <CommandItem
                        key={`${result.type}-${result.id}`}
                        value={`${result.title} ${result.subtitle} ${group.label}`}
                        onSelect={() => navigate(result.href)}
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
            )
          )}
        </CommandList>
      </CommandDialog>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Command className="h-5 w-5 text-primary" />
              Keyboard shortcuts
            </DialogTitle>
            <DialogDescription>Safe global shortcuts. They pause while you are typing in a field.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <ShortcutRow label="Open command palette" shortcut="⌘/Ctrl K" />
            <ShortcutRow label="Show shortcuts" shortcut="?" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ShortcutRow({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <span>{label}</span>
      <kbd className="rounded border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{shortcut}</kbd>
    </div>
  )
}
