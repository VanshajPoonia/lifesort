"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Check,
  ChevronDown,
  Heart,
  History,
  ListPlus,
  Loader2,
  Moon,
  Plus,
  Save,
  Search,
  Sparkles,
  Star,
  Sun,
  Tags,
  Trash2,
  X,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { RichTextEditor } from "@/components/editor/rich-text-editor"
import { AppEmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import type { JournalEntry, JournalEntryInput, JournalTodoItem } from "@/lib/journal"
import { motionPresets } from "@/lib/motion"
import { richTextToPlainText } from "@/lib/rich-text"
import { cn } from "@/lib/utils"

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error"
type JournalMode = "morning" | "evening"

type IntentionLabels = {
  work: string
  personal: string
  family: string
}

type JournalSearchResult = {
  id: number
  journal_date: string
  mood: number | null
  snippet: string
}

type PendingTask = {
  item: JournalTodoItem
  title: string
}

const moods = [
  { value: 1, label: "Rough", icon: "😟" },
  { value: 2, label: "Low", icon: "😕" },
  { value: 3, label: "Okay", icon: "😐" },
  { value: 4, label: "Good", icon: "🙂" },
  { value: 5, label: "Great", icon: "😊" },
] as const

const gratitudePlaceholders = [
  "A person, moment, or comfort",
  "Something that made today lighter",
  "One small thing I do not want to miss",
]

const energyLevels = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const

const defaultIntentionLabels: IntentionLabels = {
  work: "Work",
  personal: "Personal",
  family: "Family",
}

const affirmationSuggestions = [
  "I can move through today with steadiness.",
  "I am allowed to take one clear step at a time.",
  "My attention is enough for what matters most.",
  "I can be kind to myself while still making progress.",
  "I choose calm action over perfect action.",
  "I have handled hard days before, and I can handle this one.",
  "Small choices can make today lighter.",
  "I can pause, breathe, and begin again.",
  "My worth is not measured by my output.",
  "I can protect my energy and still show up.",
  "Today does not need to be perfect to be meaningful.",
  "I trust myself to notice what needs care.",
  "I can finish the next honest thing.",
  "My pace can be steady and sustainable.",
  "I am building a life I can actually live in.",
]

const moodColorClasses: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-muted-foreground",
  4: "bg-green-500",
  5: "bg-emerald-500",
}

function localDateString(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return localDateString(date)
}

function formatDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
}

function formatShortDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function defaultJournalMode() {
  return new Date().getHours() < 14 ? "morning" : "evening"
}

function journalModeStorageKey(date: string) {
  return `lifesort:journal-mode:${date}`
}

function shouldOpenTomorrowSetup() {
  return new Date().getHours() >= 17
}

function normalizeIntentionLabel(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 40) : fallback
}

function normalizeTag(value: string) {
  return value.trim().replace(/^#/, "").replace(/\s+/g, "-").slice(0, 40)
}

function entrySnippet(entry: JournalEntry) {
  return (
    entry.affirmation_text ||
    entry.gratitude.find(Boolean) ||
    entry.what_went_well ||
    entry.what_could_be_better ||
    richTextToPlainText(entry.notes_from_today) ||
    "Journal entry"
  )
}

function getMonthDays(dateString: string) {
  const [year, month] = dateString.split("-").map(Number)
  if (!year || !month) return []
  const days = new Date(year, month, 0).getDate()
  return Array.from({ length: days }, (_, index) => `${year}-${String(month).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`)
}

function searchRecentEntries(entries: JournalEntry[], query: string): JournalSearchResult[] {
  const needle = query.trim().toLowerCase()
  if (needle.length < 2) return []

  return entries
    .filter((entry) => {
      const haystack = [
        entry.affirmation_text,
        ...entry.gratitude,
        ...entry.work_todo.map((item) => item.text),
        ...entry.personal_todo.map((item) => item.text),
        ...entry.family_todo.map((item) => item.text),
        entry.what_went_well,
        entry.what_could_be_better,
        richTextToPlainText(entry.notes_from_today),
        entry.how_to_make_tomorrow_better,
        entry.work_stars_note,
        entry.personal_stars_note,
        entry.family_stars_note,
        entry.tomorrow_focus,
        entry.tomorrow_avoid,
        ...entry.tags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(needle)
    })
    .slice(0, 8)
    .map((entry) => ({
      id: entry.id,
      journal_date: entry.journal_date,
      mood: entry.mood ?? null,
      snippet: entrySnippet(entry),
    }))
}

function emptyTodo(): JournalTodoItem {
  return { id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text: "", done: false }
}

function emptyJournal(): JournalEntryInput {
  return {
    mood: null,
    gratitude: ["", "", ""],
    affirmation_text: null,
    affirmation_pinned_until: null,
    work_todo: [],
    personal_todo: [],
    family_todo: [],
    what_went_well: null,
    what_could_be_better: null,
    notes_from_today: null,
    how_to_make_tomorrow_better: null,
    work_stars: null,
    work_stars_note: null,
    personal_stars: null,
    personal_stars_note: null,
    family_stars: null,
    family_stars_note: null,
    tomorrow_focus: null,
    tomorrow_avoid: null,
    energy_level: null,
    tags: [],
  }
}

function entryStarted(entry: JournalEntryInput) {
  return Boolean(
    entry.mood ||
      entry.gratitude.some(Boolean) ||
      entry.affirmation_text ||
      entry.work_todo.some((item) => item.text.trim()) ||
      entry.personal_todo.some((item) => item.text.trim()) ||
      entry.family_todo.some((item) => item.text.trim()) ||
      entry.what_went_well ||
      entry.what_could_be_better ||
      richTextToPlainText(entry.notes_from_today).trim() ||
      entry.how_to_make_tomorrow_better ||
      entry.work_stars ||
      entry.personal_stars ||
      entry.family_stars ||
      entry.tomorrow_focus ||
      entry.tomorrow_avoid ||
      entry.energy_level ||
      entry.tags.length > 0,
  )
}

function calculateStreak(entries: JournalEntry[]) {
  const dates = new Set(entries.filter(entryStarted).map((entry) => entry.journal_date))
  let cursor = localDateString()
  let count = 0
  while (dates.has(cursor)) {
    count += 1
    cursor = addDays(cursor, -1)
  }
  return count
}

export default function JournalPage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(localDateString)
  const [entry, setEntry] = useState<JournalEntryInput>(emptyJournal)
  const [loadedEntry, setLoadedEntry] = useState<JournalEntry | null>(null)
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([])
  const [intentionLabels, setIntentionLabels] = useState<IntentionLabels>(defaultIntentionLabels)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [tomorrowOpen, setTomorrowOpen] = useState(false)
  const [journalMode, setJournalMode] = useState<JournalMode>(defaultJournalMode)
  const [affirmationPickerOpen, setAffirmationPickerOpen] = useState(false)
  const [tagInput, setTagInput] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<JournalSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState("")
  const [pendingTask, setPendingTask] = useState<PendingTask | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveSequence = useRef(0)
  const hydrated = useRef(false)

  useEffect(() => {
    if (!authLoading && !user) router.push("/login")
  }, [authLoading, router, user])

  useEffect(() => {
    if (typeof window === "undefined") return
    const queryDate = new URL(window.location.href).searchParams.get("date")
    if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) setSelectedDate(queryDate)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.sessionStorage.getItem(journalModeStorageKey(selectedDate))
    setJournalMode(stored === "morning" || stored === "evening" ? stored : defaultJournalMode())
    setTomorrowOpen(shouldOpenTomorrowSetup())
  }, [selectedDate])

  const loadIntentionLabels = useCallback(async () => {
    try {
      const response = await fetch("/api/profile")
      if (!response.ok) return
      const data = await response.json()
      setIntentionLabels({
        work: normalizeIntentionLabel(data.journal_intention_1, defaultIntentionLabels.work),
        personal: normalizeIntentionLabel(data.journal_intention_2, defaultIntentionLabels.personal),
        family: normalizeIntentionLabel(data.journal_intention_3, defaultIntentionLabels.family),
      })
    } catch {
      // Profile labels are a convenience; Journal can use defaults.
    }
  }, [])

  const loadRecent = useCallback(async () => {
    try {
      const response = await fetch("/api/journal/recent?limit=30")
      if (!response.ok) return
      const data = await response.json()
      setRecentEntries(data.entries || [])
    } catch {
      // non-fatal
    }
  }, [])

  const loadEntry = useCallback(async () => {
    setLoading(true)
    setLoadError("")
    hydrated.current = false
    try {
      const response = await fetch(`/api/journal/${selectedDate}`)
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not load journal")
      const nextEntry = data.entry || null
      setLoadedEntry(nextEntry)
      setEntry(nextEntry || emptyJournal())
      setSaveState("idle")
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `/journal?date=${selectedDate}`)
      }
      window.setTimeout(() => {
        hydrated.current = true
      }, 0)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load journal")
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => {
    if (!user) return
    loadEntry()
    loadRecent()
    loadIntentionLabels()
  }, [loadEntry, loadIntentionLabels, loadRecent, user])

  useEffect(() => {
    const query = searchQuery.trim()
    if (!searchOpen || query.length < 2) {
      setSearchResults([])
      setSearchError("")
      return
    }

    const localResults = searchRecentEntries(recentEntries, query)
    if (localResults.length > 0) {
      setSearchResults(localResults)
      setSearchError("")
    }

    const timer = window.setTimeout(async () => {
      setSearchLoading(true)
      setSearchError("")
      try {
        const response = await fetch(`/api/journal/search?q=${encodeURIComponent(query)}`)
        const data = await response.json().catch(() => null)
        if (!response.ok) throw new Error(data?.error || "Could not search journal")
        setSearchResults(data.results || localResults)
      } catch (error) {
        setSearchError(error instanceof Error ? error.message : "Could not search journal")
        setSearchResults(localResults)
      } finally {
        setSearchLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [recentEntries, searchOpen, searchQuery])

  const saveEntry = useCallback(async (nextEntry = entry) => {
    const currentSequence = saveSequence.current + 1
    saveSequence.current = currentSequence
    setSaveState("saving")
    try {
      const response = await fetch(`/api/journal/${selectedDate}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextEntry),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not save journal")
      if (saveSequence.current === currentSequence) {
        setLoadedEntry(data.entry)
        setSaveState("saved")
        loadRecent()
      }
    } catch (error) {
      console.error("Could not save journal:", error)
      if (saveSequence.current === currentSequence) setSaveState("error")
    }
  }, [entry, loadRecent, selectedDate])

  useEffect(() => {
    if (!hydrated.current || loading) return
    setSaveState("dirty")
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => saveEntry(entry), 2000)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [entry, loading, saveEntry])

  const updateEntry = <K extends keyof JournalEntryInput>(key: K, value: JournalEntryInput[K]) => {
    setEntry((current) => ({ ...current, [key]: value }))
  }

  const changeJournalMode = (mode: JournalMode) => {
    setJournalMode(mode)
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(journalModeStorageKey(selectedDate), mode)
    }
  }

  const addTag = (value = tagInput) => {
    const tag = normalizeTag(value)
    if (!tag || entry.tags.includes(tag) || entry.tags.length >= 20) {
      setTagInput("")
      return
    }
    updateEntry("tags", [...entry.tags, tag])
    setTagInput("")
  }

  const removeTag = (tag: string) => {
    updateEntry("tags", entry.tags.filter((current) => current !== tag))
  }

  const createTaskFromIntention = async () => {
    if (!pendingTask) return
    const title = pendingTask.item.text.trim()
    if (!title) return

    setCreatingTask(true)
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category: "Journal" }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || "Could not create task")
      toast({ title: "Task created", description: title })
      setPendingTask(null)
    } catch (error) {
      toast({
        title: "Could not create task",
        description: error instanceof Error ? error.message : "Try again from Journal.",
        variant: "destructive",
      })
    } finally {
      setCreatingTask(false)
    }
  }

  const streak = useMemo(() => calculateStreak(recentEntries), [recentEntries])
  const started = entryStarted(entry)
  const recentByDate = useMemo(() => new Map(recentEntries.map((recent) => [recent.journal_date, recent])), [recentEntries])
  const moodTrendDays = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(localDateString(), index - 13)), [])
  const monthDays = useMemo(() => getMonthDays(selectedDate), [selectedDate])
  const isMorningMode = journalMode === "morning"
  const isEveningMode = journalMode === "evening"
  const completedIntentions =
    entry.work_todo.filter((item) => item.done).length +
    entry.personal_todo.filter((item) => item.done).length +
    entry.family_todo.filter((item) => item.done).length

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Journal" subtitle="Daily reflection and tomorrow setup">
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <>
    <DashboardLayout title="Journal" subtitle={formatDateLabel(selectedDate)}>
      <div className={cn("journal-page rounded-lg border border-amber-900/10 p-3 sm:p-4 lg:p-6", motionPresets.journalEntrance)}>
        {loadError && (
          <Card className="journal-paper-card border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <BookOpenText className="h-10 w-10 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">{loadError}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Refresh the page or try another date.</p>
              <Button className="mt-4" onClick={loadEntry}>Try again</Button>
            </CardContent>
          </Card>
        )}

        <div className="mx-auto grid max-w-[1180px] gap-5 lg:grid-cols-[minmax(0,760px)_320px] xl:grid-cols-[minmax(0,800px)_340px]">
          <main className="min-w-0 space-y-5">
            <Card className={cn("journal-paper-card journal-cover surface-card relative border-amber-500/20", motionPresets.journalEntrance)}>
              <CardHeader className="relative">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-amber-700/80 dark:text-amber-200/80">
                      {formatDateLabel(selectedDate)}
                    </p>
                    <CardTitle className="flex items-center gap-2 text-2xl sm:text-3xl">
                      <BookOpenText className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                      Daily Journal
                    </CardTitle>
                    <CardDescription className="mt-2 max-w-xl text-base leading-7">
                      A quiet place to notice the day, set intentions, and leave tomorrow a clue.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-900/10 bg-background/45 p-2 backdrop-blur-sm">
                    <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, -1))} aria-label="Previous day">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(event) => setSelectedDate(event.target.value || localDateString())}
                      className="journal-date-input w-full sm:w-[11rem]"
                      aria-label="Journal date"
                    />
                    <Button variant="outline" size="icon" onClick={() => setSelectedDate(addDays(selectedDate, 1))} aria-label="Next day">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSearchOpen(true)} className="gap-2">
                      <Search className="h-4 w-4" />
                      Search
                    </Button>
                    <SaveStatus state={saveState} />
                    <Button onClick={() => saveEntry()} disabled={saveState === "saving"} className="gap-2">
                      {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="relative grid gap-3 sm:grid-cols-3">
                <div className="journal-stat rounded-md border p-3">
                  <p className="text-2xl font-semibold">{started ? "Started" : "Fresh"}</p>
                  <p className="text-xs text-muted-foreground">journal status</p>
                </div>
                <div className="journal-stat rounded-md border p-3">
                  <p className="text-2xl font-semibold">{streak}</p>
                  <p className="text-xs text-muted-foreground">day streak</p>
                </div>
                <div className="journal-stat rounded-md border p-3">
                  <p className="text-2xl font-semibold">{completedIntentions}</p>
                  <p className="text-xs text-muted-foreground">intentions checked</p>
                </div>
              </CardContent>
            </Card>

            <div className="flex rounded-lg border border-amber-900/10 bg-background/45 p-1">
              {([
                ["morning", "Morning", Sun],
                ["evening", "Evening", Moon],
              ] as const).map(([mode, label, Icon]) => (
                <Button
                  key={mode}
                  type="button"
                  variant={journalMode === mode ? "default" : "ghost"}
                  className="flex-1 gap-2"
                  onClick={() => changeJournalMode(mode)}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>

            {isMorningMode && (
              <div className="grid gap-4 xl:grid-cols-[1fr_260px]">
                <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5 text-rose-500" />
                      Mood
                    </CardTitle>
                    <CardDescription>Pick the closest signal. It is a check-in, not a judgement.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div role="radiogroup" aria-label="Mood" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      {moods.map((mood) => (
                        <button
                          key={mood.value}
                          type="button"
                          role="radio"
                          aria-checked={entry.mood === mood.value}
                          onClick={() => updateEntry("mood", entry.mood === mood.value ? null : mood.value)}
                          className={cn(
                            "journal-mood-button rounded-lg border bg-background/70 p-3 text-center shadow-sm",
                            entry.mood === mood.value && "border-amber-500 bg-amber-500/10 shadow-amber-900/10",
                          )}
                        >
                          <span className="block text-2xl" aria-hidden="true">{mood.icon}</span>
                          <span className="mt-1 block text-xs font-medium">{mood.label}</span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
                  <CardHeader>
                    <CardTitle className="text-base">Energy Level</CardTitle>
                    <CardDescription>Set a lightweight capacity signal.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div role="radiogroup" aria-label="Energy level" className="grid gap-2">
                      {energyLevels.map((level) => (
                        <Button
                          key={level.value}
                          type="button"
                          variant={entry.energy_level === level.value ? "default" : "outline"}
                          onClick={() => updateEntry("energy_level", entry.energy_level === level.value ? null : level.value)}
                        >
                          {level.label}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
              <CardHeader>
                <CardTitle>I am thankful for...</CardTitle>
                <CardDescription>Three small anchors from today.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {entry.gratitude.map((value, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-sm font-semibold text-amber-700 dark:text-amber-300">
                      {index + 1}
                    </span>
                    <Input
                      value={value}
                      onChange={(event) => {
                        const next = [...entry.gratitude]
                        next[index] = event.target.value
                        updateEntry("gratitude", next)
                      }}
                      placeholder={gratitudePlaceholders[index]}
                      maxLength={240}
                      className="journal-input"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            {isMorningMode && (
              <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle>Today&apos;s Affirmation</CardTitle>
                      <CardDescription>Keep it short enough to remember.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setAffirmationPickerOpen((open) => !open)} className="gap-2">
                      <Sparkles className="h-3.5 w-3.5" />
                      Suggestions
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {affirmationPickerOpen && (
                    <div className="grid gap-2 rounded-md border border-amber-900/15 bg-background/45 p-3 sm:grid-cols-2">
                      {affirmationSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => {
                            updateEntry("affirmation_text", suggestion)
                            setAffirmationPickerOpen(false)
                          }}
                          className="rounded-md border bg-background/70 p-2 text-left text-sm transition-colors hover:bg-amber-500/10"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  <Input
                    value={entry.affirmation_text || ""}
                    onChange={(event) => updateEntry("affirmation_text", event.target.value.slice(0, 140) || null)}
                    placeholder="I can move through today with steadiness."
                    maxLength={140}
                    className="journal-input"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                    <span>{(entry.affirmation_text || "").length}/140</span>
                    <Button
                      type="button"
                      variant={entry.affirmation_pinned_until ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => updateEntry("affirmation_pinned_until", entry.affirmation_pinned_until ? null : addDays(selectedDate, 7))}
                    >
                      {entry.affirmation_pinned_until ? "Pinned for week" : "Pin for week"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {isMorningMode && (
              <div className={cn("grid gap-4 lg:grid-cols-3", motionPresets.staggerContainer)}>
                <IntentionCard title={intentionLabels.work} items={entry.work_todo} onChange={(items) => updateEntry("work_todo", items)} onCreateTask={(item) => setPendingTask({ item, title: intentionLabels.work })} />
                <IntentionCard title={intentionLabels.personal} items={entry.personal_todo} onChange={(items) => updateEntry("personal_todo", items)} onCreateTask={(item) => setPendingTask({ item, title: intentionLabels.personal })} />
                <IntentionCard title={intentionLabels.family} items={entry.family_todo} onChange={(items) => updateEntry("family_todo", items)} onCreateTask={(item) => setPendingTask({ item, title: intentionLabels.family })} />
              </div>
            )}

            {isEveningMode && (
              <>
                <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
                  <CardHeader>
                    <CardTitle>Evening Reflection</CardTitle>
                    <CardDescription>Close the loop on what happened and what you learned.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 lg:grid-cols-2">
                    <JournalTextarea label="What went well today?" value={entry.what_went_well} onChange={(value) => updateEntry("what_went_well", value)} />
                    <JournalTextarea label="What could I have done better?" value={entry.what_could_be_better} onChange={(value) => updateEntry("what_could_be_better", value)} />
                    <JournalTextarea label="How could I have made today better?" value={entry.how_to_make_tomorrow_better} onChange={(value) => updateEntry("how_to_make_tomorrow_better", value)} />
                  </CardContent>
                </Card>

                <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="h-5 w-5 text-amber-500" />
                      Day Rating
                    </CardTitle>
                    <CardDescription>Rate how each area felt today, then optionally add a short note.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <StarRow
                      label={intentionLabels.work}
                      value={entry.work_stars}
                      note={entry.work_stars_note}
                      onValueChange={(value) => updateEntry("work_stars", value)}
                      onNoteChange={(value) => updateEntry("work_stars_note", value)}
                    />
                    <StarRow
                      label={intentionLabels.personal}
                      value={entry.personal_stars}
                      note={entry.personal_stars_note}
                      onValueChange={(value) => updateEntry("personal_stars", value)}
                      onNoteChange={(value) => updateEntry("personal_stars_note", value)}
                    />
                    <StarRow
                      label={intentionLabels.family}
                      value={entry.family_stars}
                      note={entry.family_stars_note}
                      onValueChange={(value) => updateEntry("family_stars", value)}
                      onNoteChange={(value) => updateEntry("family_stars_note", value)}
                    />
                  </CardContent>
                </Card>

                <Collapsible open={tomorrowOpen} onOpenChange={setTomorrowOpen}>
                  <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
                    <CardHeader>
                      <CollapsibleTrigger asChild>
                        <button type="button" className="flex w-full items-center justify-between gap-3 text-left">
                          <div>
                            <CardTitle>Tomorrow&apos;s Setup</CardTitle>
                            <CardDescription>Leave a small instruction for your next self.</CardDescription>
                          </div>
                          <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", tomorrowOpen && "rotate-180")} />
                        </button>
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent className="journal-collapsible-content">
                      <CardContent className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <JournalTextarea label="One thing I want tomorrow to be about" value={entry.tomorrow_focus} onChange={(value) => updateEntry("tomorrow_focus", value)} />
                          <p className="text-xs text-muted-foreground">This will be added to tomorrow&apos;s Today plan as a focus item.</p>
                        </div>
                        <JournalTextarea label="One thing I want to avoid" value={entry.tomorrow_avoid} onChange={(value) => updateEntry("tomorrow_avoid", value)} />
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </>
            )}

            <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
              <CardHeader>
                <CardTitle>Notes from Today</CardTitle>
                <CardDescription>Always available in Morning and Evening mode.</CardDescription>
              </CardHeader>
              <CardContent>
                <JournalRichTextField
                  label="Notes from today"
                  value={entry.notes_from_today}
                  onChange={(value) => updateEntry("notes_from_today", value)}
                />
              </CardContent>
            </Card>

            <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                  Tags
                </CardTitle>
                <CardDescription>Add a tag and press Enter or comma.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault()
                      addTag()
                    }
                  }}
                  onBlur={() => tagInput.trim() && addTag()}
                  placeholder="health, work, idea..."
                  className="journal-input"
                  disabled={entry.tags.length >= 20}
                />
                <div className="flex flex-wrap gap-2">
                  {entry.tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tags yet.</p>
                  ) : (
                    entry.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        #{tag}
                        <button type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag} tag`} className="rounded-full p-0.5 hover:bg-background/60">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </main>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card className={cn("journal-paper-card journal-side-panel surface-card", motionPresets.fadeInUp)}>
              <CardHeader>
                <CardTitle className="text-base">Mood Trend</CardTitle>
                <CardDescription>Last 14 days.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-1.5">
                  {moodTrendDays.map((day) => {
                    const recent = recentByDate.get(day)
                    return (
                      <span
                        key={day}
                        title={`${formatShortDate(day)}${recent?.mood ? ` · ${moods.find((mood) => mood.value === recent.mood)?.label}` : " · no entry"}`}
                        className={cn(
                          "h-3.5 w-3.5 rounded-full border border-amber-900/10",
                          recent?.mood ? moodColorClasses[recent.mood] : "bg-muted/40",
                        )}
                      />
                    )
                  })}
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">This Month</p>
                  <div className="grid grid-cols-7 gap-1">
                    {monthDays.map((day) => {
                      const hasEntry = recentByDate.has(day)
                      return (
                        <span
                          key={day}
                          title={`${formatShortDate(day)}${hasEntry ? " · journal entry" : " · no entry"}`}
                          className={cn("aspect-square rounded-[3px] border border-amber-900/10", hasEntry ? "bg-amber-500" : "bg-muted/35")}
                        />
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={cn("journal-paper-card journal-side-panel surface-card", motionPresets.fadeInUp)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Recent Entries
                </CardTitle>
                <CardDescription>Jump back without losing the current day.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {recentEntries.length === 0 ? (
                  <AppEmptyState
                    icon={History}
                    title="No journal history yet"
                    hint="Saved entries will appear here so you can jump back to past days."
                    className="border-dashed bg-background/70 p-4 md:p-6"
                  />
                ) : (
                  recentEntries.slice(0, 7).map((recent) => (
                    <button
                      key={recent.id}
                      type="button"
                      onClick={() => setSelectedDate(recent.journal_date)}
                      className={cn(
                        "w-full rounded-md border border-amber-900/10 bg-background/45 p-3 text-left text-sm transition-colors hover:bg-amber-500/10",
                        motionPresets.listItem,
                        selectedDate === recent.journal_date && "border-amber-500 bg-amber-500/10",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{formatDateLabel(recent.journal_date)}</span>
                        {recent.mood && <span aria-label={`Mood ${recent.mood}`}>{moods.find((mood) => mood.value === recent.mood)?.icon}</span>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {entrySnippet(recent)}
                      </p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            {loadedEntry?.updated_at && (
              <p className="text-xs text-muted-foreground">
                Last saved {new Date(loadedEntry.updated_at).toLocaleString()}
              </p>
            )}
          </aside>
        </div>
      </div>
    </DashboardLayout>

    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search Journal
          </DialogTitle>
          <DialogDescription>Search recent entries instantly, with older entries pulled from your journal history.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search reflections, gratitude, notes, tags..."
            autoFocus
          />
          {searchError && <p className="text-sm text-destructive">{searchError}</p>}
          {searchLoading && <p className="text-sm text-muted-foreground">Searching...</p>}
          <div className="space-y-2">
            {searchQuery.trim().length < 2 ? (
              <p className="text-sm text-muted-foreground">Type at least two characters.</p>
            ) : searchResults.length === 0 && !searchLoading ? (
              <p className="text-sm text-muted-foreground">No matching journal entries found.</p>
            ) : (
              searchResults.map((result) => (
                <button
                  key={`${result.id}-${result.journal_date}`}
                  type="button"
                  onClick={() => {
                    setSelectedDate(result.journal_date)
                    setSearchOpen(false)
                  }}
                  className="w-full rounded-md border bg-muted/20 p-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{formatDateLabel(result.journal_date)}</span>
                    {result.mood && <span aria-label={`Mood ${result.mood}`}>{moods.find((mood) => mood.value === result.mood)?.icon}</span>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{result.snippet}</p>
                </button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={Boolean(pendingTask)} onOpenChange={(open) => !open && setPendingTask(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Create a task?</AlertDialogTitle>
          <AlertDialogDescription>
            Create a task: {pendingTask?.item.text.trim() || "Untitled intention"}?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={creatingTask}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(event) => {
            event.preventDefault()
            createTaskFromIntention()
          }} disabled={creatingTask}>
            {creatingTask ? "Creating..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

function SaveStatus({ state }: { state: SaveState }) {
  const labels: Record<SaveState, string> = {
    idle: "Ready",
    dirty: "Unsaved changes",
    saving: "Saving...",
    saved: "Saved just now",
    error: "Error saving",
  }
  return (
    <Badge
      variant="outline"
      aria-live="polite"
      className={cn(
        "journal-save-status bg-background/70",
        state === "saved" && "save-feedback",
        state === "dirty" && "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        state === "saving" && "border-primary/30 bg-primary/10 text-primary",
        state === "saved" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        state === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
      )}
    >
      {state === "saving" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
      {state === "saved" && <Check className="mr-1 h-3 w-3" />}
      {labels[state]}
    </Badge>
  )
}

function JournalTextarea({ label, value, onChange }: { label: string; value?: string | null; onChange: (value: string | null) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value || ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="journal-textarea resize-y"
      />
    </div>
  )
}

function JournalRichTextField({ label, value, onChange }: { label: string; value?: string | null; onChange: (value: string | null) => void }) {
  return (
    <div className="space-y-2 lg:col-span-2">
      <Label>{label}</Label>
      <RichTextEditor
        value={value || ""}
        onChange={(html) => onChange(html || null)}
        placeholder="Capture anything else worth remembering from today..."
        mode="journal"
        ariaLabel={label}
        className="journal-rich-text min-h-[18rem]"
        editorClassName="min-h-[13rem]"
        debounceMs={350}
        aiRefineEnabled
        dictationEnabled
        dictationLabel="Speak to Journal"
      />
    </div>
  )
}

function IntentionCard({
  title,
  items,
  onChange,
  onCreateTask,
}: {
  title: string
  items: JournalTodoItem[]
  onChange: (items: JournalTodoItem[]) => void
  onCreateTask: (item: JournalTodoItem) => void
}) {
  const updateItem = (id: string, patch: Partial<JournalTodoItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }
  return (
    <Card className="journal-paper-card interactive-card">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Up to three intentions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <p className="rounded-md border border-dashed border-amber-900/20 bg-background/35 p-3 text-sm text-muted-foreground">No intentions yet.</p>
        )}
        {items.map((item, index) => (
          <div key={item.id} className={cn("journal-intention-row flex items-center gap-2 rounded-md border border-transparent p-1", motionPresets.listItem)}>
            <Checkbox
              checked={item.done}
              onCheckedChange={(checked) => updateItem(item.id, { done: Boolean(checked) })}
              aria-label={`${title} intention ${index + 1} complete`}
              className="h-5 w-5 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
            />
            <Input
              value={item.text}
              onChange={(event) => updateItem(item.id, { text: event.target.value })}
              placeholder={`${title} intention`}
              maxLength={240}
              className={cn("journal-input", item.done && "text-muted-foreground line-through")}
            />
            {item.text.trim() && !item.done && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onCreateTask(item)}
                aria-label={`Create task from ${title} intention ${index + 1}`}
              >
                <ListPlus className="h-4 w-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(items.filter((current) => current.id !== item.id))}
              aria-label={`Delete ${title} intention ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" disabled={items.length >= 3} onClick={() => onChange([...items, emptyTodo()])} className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          Add intention
        </Button>
      </CardContent>
    </Card>
  )
}

function StarRow({
  label,
  value,
  note,
  onValueChange,
  onNoteChange,
}: {
  label: string
  value?: number | null
  note?: string | null
  onValueChange: (value: number | null) => void
  onNoteChange: (value: string | null) => void
}) {
  return (
    <div className="rounded-md border border-amber-900/15 bg-background/35 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Label className="font-medium">{label}</Label>
        <div role="radiogroup" aria-label={`${label} star rating`} className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${label} ${star} star${star === 1 ? "" : "s"}`}
              onClick={() => onValueChange(value === star ? null : star)}
              data-selected={Boolean(value && star <= value)}
              className={cn(
                "journal-star-button rounded-md p-1.5 text-muted-foreground hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                motionPresets.pressable,
                value && star <= value && "text-amber-500",
              )}
            >
              <Star className="h-5 w-5 fill-current" />
            </button>
          ))}
        </div>
      </div>
      <Input
        value={note || ""}
        onChange={(event) => onNoteChange(event.target.value || null)}
        placeholder="Why?"
        className="journal-input mt-3"
        maxLength={1000}
      />
    </div>
  )
}
