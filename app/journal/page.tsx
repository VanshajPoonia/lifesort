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
  Loader2,
  Lock,
  Plus,
  Save,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { AppEmptyState } from "@/components/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { JournalEntry, JournalEntryInput, JournalTodoItem } from "@/lib/journal"
import { motionPresets } from "@/lib/motion"
import { cn } from "@/lib/utils"

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error"

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
      entry.notes_from_today ||
      entry.how_to_make_tomorrow_better ||
      entry.work_stars ||
      entry.personal_stars ||
      entry.family_stars ||
      entry.tomorrow_focus ||
      entry.tomorrow_avoid,
  )
}

function calculateStreak(entries: JournalEntry[]) {
  const dates = new Set(entries.map((entry) => entry.journal_date))
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
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState(localDateString)
  const [entry, setEntry] = useState<JournalEntryInput>(emptyJournal)
  const [loadedEntry, setLoadedEntry] = useState<JournalEntry | null>(null)
  const [recentEntries, setRecentEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [tomorrowOpen, setTomorrowOpen] = useState(false)
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
  }, [loadEntry, loadRecent, user])

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

  const streak = useMemo(() => calculateStreak(recentEntries), [recentEntries])
  const started = entryStarted(entry)
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

            <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Today&apos;s Affirmation</CardTitle>
                    <CardDescription>Keep it short enough to remember.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" disabled className="gap-2" title="AI affirmation suggestions are planned for a future pass.">
                    <Sparkles className="h-3.5 w-3.5" />
                    Suggest later
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
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

            <div className={cn("grid gap-4 lg:grid-cols-3", motionPresets.staggerContainer)}>
              <IntentionCard title="Work" items={entry.work_todo} onChange={(items) => updateEntry("work_todo", items)} />
              <IntentionCard title="Personal" items={entry.personal_todo} onChange={(items) => updateEntry("personal_todo", items)} />
              <IntentionCard title="Family" items={entry.family_todo} onChange={(items) => updateEntry("family_todo", items)} />
            </div>

            <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
              <CardHeader>
                <CardTitle>Evening Reflection</CardTitle>
                <CardDescription>Available all day. Fill it whenever the signal is fresh.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <JournalTextarea label="What went well today?" value={entry.what_went_well} onChange={(value) => updateEntry("what_went_well", value)} />
                <JournalTextarea label="What could I have done better?" value={entry.what_could_be_better} onChange={(value) => updateEntry("what_could_be_better", value)} />
                <JournalTextarea label="How could I have made today better?" value={entry.how_to_make_tomorrow_better} onChange={(value) => updateEntry("how_to_make_tomorrow_better", value)} />
                <JournalTextarea label="Notes from today" value={entry.notes_from_today} onChange={(value) => updateEntry("notes_from_today", value)} />
              </CardContent>
            </Card>

            <Card className={cn("journal-paper-card surface-card", motionPresets.fadeInUp)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  Star Method Rating
                </CardTitle>
                <CardDescription>Rate the day by area, then optionally say why.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StarRow
                  label="Work"
                  value={entry.work_stars}
                  note={entry.work_stars_note}
                  onValueChange={(value) => updateEntry("work_stars", value)}
                  onNoteChange={(value) => updateEntry("work_stars_note", value)}
                />
                <StarRow
                  label="Personal"
                  value={entry.personal_stars}
                  note={entry.personal_stars_note}
                  onValueChange={(value) => updateEntry("personal_stars", value)}
                  onNoteChange={(value) => updateEntry("personal_stars_note", value)}
                />
                <StarRow
                  label="Family"
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
                    <JournalTextarea label="One thing I want tomorrow to be about" value={entry.tomorrow_focus} onChange={(value) => updateEntry("tomorrow_focus", value)} />
                    <JournalTextarea label="One thing I want to avoid" value={entry.tomorrow_avoid} onChange={(value) => updateEntry("tomorrow_avoid", value)} />
                    <div className="rounded-md border border-dashed border-amber-900/20 bg-background/45 p-3 text-sm text-muted-foreground lg:col-span-2">
                      Creating this as tomorrow&apos;s focus is planned for a future pass so Journal does not silently write into Today.
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </main>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
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
                  recentEntries.slice(0, 10).map((recent) => (
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
                        {recent.affirmation_text || recent.gratitude.find(Boolean) || recent.notes_from_today || "Journal entry"}
                      </p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className={cn("journal-paper-card surface-card border-dashed", motionPresets.fadeIn)}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  Locking
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                The database is ready for future locking, but this version keeps entries editable to avoid accidental data loss.
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

function IntentionCard({ title, items, onChange }: { title: string; items: JournalTodoItem[]; onChange: (items: JournalTodoItem[]) => void }) {
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
