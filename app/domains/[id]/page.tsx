"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowLeft, CheckCircle2, ExternalLink, Loader2, Lock, Plus, Settings2, Sparkles, Target, Trash2 } from "lucide-react"

import { useAuth } from "@/components/auth-provider"
import { DashboardLayout } from "@/components/dashboard-layout"
import { useDomainFocus } from "@/components/domain-focus-provider"
import { LifeAreaIcon } from "@/components/life-area-controls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  DOMAIN_ATTENTION_OPTIONS,
  DOMAIN_HEALTH_STATUS_OPTIONS,
  DOMAIN_IMPORTANCE_OPTIONS,
  DOMAIN_REVIEW_FREQUENCY_OPTIONS,
  DOMAIN_STATUS_OPTIONS,
  type DomainAttention,
  type DomainHealthStatus,
  type DomainImportance,
  type DomainReviewFrequency,
  type DomainStatus,
  type LifeArea,
  normalizeLifeArea,
} from "@/lib/life-areas"

type RecordItem = Record<string, string | number | boolean | null | undefined>
type DataState = {
  tasks: RecordItem[]
  goals: RecordItem[]
  habits: RecordItem[]
  projects: RecordItem[]
  notes: RecordItem[]
  categories: RecordItem[]
  wishlist: RecordItem[]
  events: RecordItem[]
  journal: RecordItem[]
}

const emptyData: DataState = {
  tasks: [],
  goals: [],
  habits: [],
  projects: [],
  notes: [],
  categories: [],
  wishlist: [],
  events: [],
  journal: [],
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

function itemDate(value: unknown) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

function hrefFor(section: keyof DataState, domainId: string) {
  const encoded = encodeURIComponent(domainId)
  const routes: Record<keyof DataState, string> = {
    tasks: `/tasks?life_area_id=${encoded}`,
    goals: `/goals?life_area_id=${encoded}`,
    habits: `/habits?life_area_id=${encoded}`,
    projects: `/projects?life_area_id=${encoded}`,
    notes: `/notes?life_area_id=${encoded}`,
    categories: `/money?tab=budget&life_area_id=${encoded}`,
    wishlist: `/money?tab=wishlist&life_area_id=${encoded}`,
    events: `/calendar`,
    journal: `/journal`,
  }
  return routes[section]
}

function openHref(section: keyof DataState, item: RecordItem, domainId: string) {
  const base = hrefFor(section, domainId)
  if (section === "notes" && item.id) return `${base}&note=${item.id}`
  if (section === "tasks" && item.id) return `${base}&task=${item.id}`
  if (section === "goals" && item.id) return `${base}&goal=${item.id}`
  if (section === "projects" && item.id) return `${base}&project=${item.id}`
  if (section === "journal" && item.journal_date) return `/journal?date=${item.journal_date}`
  return base
}

function itemSubtitle(section: keyof DataState, item: RecordItem) {
  if (section === "tasks") return item.due_date ? `Due ${itemDate(item.due_date)}` : item.priority || "No due date"
  if (section === "goals") return item.target_date ? `Target ${itemDate(item.target_date)}` : item.status || "Active"
  if (section === "habits") return item.frequency || "Habit"
  if (section === "projects") return item.due_date ? `Due ${itemDate(item.due_date)}` : item.status || "Active"
  if (section === "notes") return item.updated_at ? `Updated ${itemDate(item.updated_at)}` : "Recent note"
  if (section === "categories") return item.budget_limit ? `Limit $${Number(item.budget_limit).toLocaleString()}` : "Budget category"
  if (section === "wishlist") return item.price ? `$${Number(item.price).toLocaleString()}` : item.priority || "Wishlist item"
  if (section === "events") return item.event_date ? `${itemDate(item.event_date)}${item.start_time ? ` · ${String(item.start_time).slice(0, 5)}` : ""}` : "Event"
  if (section === "journal") return item.journal_date ? itemDate(item.journal_date) : "Journal entry"
  return ""
}

function titleFor(section: keyof DataState, item: RecordItem) {
  if (section === "journal") return item.journal_date ? `Entry — ${itemDate(item.journal_date)}` : "Journal entry"
  return item.title || item.name || item.category || item.description || section
}

function ItemRow({
  section,
  item,
  domainId,
  actionId,
  onDone,
  doneLabel,
}: {
  section: keyof DataState
  item: RecordItem
  domainId: string
  actionId: string | null
  onDone?: (section: keyof DataState, item: RecordItem) => void
  doneLabel?: string
}) {
  const scopedId = `${section}-${item.id}`
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border bg-background/60 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{titleFor(section, item)}</p>
        <p className="truncate text-xs text-muted-foreground">{itemSubtitle(section, item)}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {doneLabel && onDone && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={actionId === scopedId}
            onClick={() => onDone(section, item)}
          >
            {actionId === scopedId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{doneLabel}</span>
          </Button>
        )}
        <Button asChild size="icon" variant="outline" title="Open full item">
          <Link href={openHref(section, item, domainId)}>
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

type ReviewPeriodType = "weekly" | "monthly" | "quarterly" | "custom"

type ReviewForm = {
  period_type: ReviewPeriodType
  feeling: string
  improved: string
  needs_attention: string
  stress: string
  stop_doing: string
  continue_doing: string
  next_action: string
  attention_adjustment: "increase" | "decrease" | "keep_same" | "none"
}

const emptyReviewForm: ReviewForm = {
  period_type: "custom",
  feeling: "",
  improved: "",
  needs_attention: "",
  stress: "",
  stop_doing: "",
  continue_doing: "",
  next_action: "",
  attention_adjustment: "none",
}

const REVIEW_PROMPTS: { key: keyof ReviewForm; label: string; placeholder: string }[] = [
  { key: "feeling", label: "How does this area feel right now?", placeholder: "Optional" },
  { key: "improved", label: "What has improved?", placeholder: "Optional" },
  { key: "needs_attention", label: "What needs attention?", placeholder: "Optional" },
  { key: "stress", label: "What is creating stress?", placeholder: "Optional" },
  { key: "stop_doing", label: "What should I stop doing?", placeholder: "Optional" },
  { key: "continue_doing", label: "What should I continue doing?", placeholder: "Optional" },
  { key: "next_action", label: "What is the next meaningful action?", placeholder: "Optional" },
]

type SettingsForm = {
  status: DomainStatus
  importance: DomainImportance | "none"
  desired_attention: DomainAttention | "none"
  review_frequency: DomainReviewFrequency
  health_status: DomainHealthStatus
  definition_of_success: string
  current_focus: string
  current_concerns: string
  long_term_vision: string
  boundaries: string
  is_ai_excluded: boolean
  requires_reauth: boolean
  parent_domain_id: string | null
}

function toSettingsForm(domain: LifeArea): SettingsForm {
  return {
    status: domain.status,
    importance: domain.importance || "none",
    desired_attention: domain.desired_attention || "none",
    review_frequency: domain.review_frequency,
    health_status: domain.health_status,
    definition_of_success: domain.definition_of_success || "",
    current_focus: domain.current_focus || "",
    current_concerns: domain.current_concerns || "",
    long_term_vision: domain.long_term_vision || "",
    boundaries: domain.boundaries || "",
    is_ai_excluded: domain.is_ai_excluded,
    requires_reauth: domain.requires_reauth,
    parent_domain_id: domain.parent_domain_id,
  }
}

export default function DomainDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading } = useAuth()
  const { toast } = useToast()
  const { focus: domainFocus, setFocus: setDomainFocus, clearFocus: clearDomainFocus } = useDomainFocus()
  const [domain, setDomain] = useState<LifeArea | null>(null)
  const [allDomains, setAllDomains] = useState<LifeArea[]>([])
  const [data, setData] = useState<DataState>(emptyData)
  const [loadingData, setLoadingData] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState<SettingsForm | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [reviews, setReviews] = useState<RecordItem[]>([])
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewForm, setReviewForm] = useState<ReviewForm>(emptyReviewForm)
  const [savingReview, setSavingReview] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [reauthPassword, setReauthPassword] = useState("")
  const [reauthError, setReauthError] = useState("")
  const [verifyingReauth, setVerifyingReauth] = useState(false)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoadingData(true)
    try {
      const query = `life_area_id=${encodeURIComponent(id)}`
      const [domainsRes, tasksRes, goalsRes, habitsRes, projectsRes, notesRes, budgetRes, wishlistRes, eventsRes, journalRes] = await Promise.all([
        fetch("/api/life-areas"),
        fetch(`/api/tasks?${query}`),
        fetch(`/api/goals?${query}`),
        fetch(`/api/habits?${query}`),
        fetch(`/api/projects?${query}`),
        fetch(`/api/notes?${query}`),
        fetch(`/api/budget?type=categories&${query}`),
        fetch(`/api/wishlist?${query}`),
        fetch(`/api/calendar-events?${query}`),
        fetch(`/api/journal/recent?limit=12&${query}`),
      ])

      if (!domainsRes.ok) throw new Error("Could not load life domains")
      const domains = await domainsRes.json()
      const normalizedDomains = Array.isArray(domains) ? domains.map(normalizeLifeArea) : []
      const found = normalizedDomains.find((item) => item.id === id) || null
      setAllDomains(normalizedDomains)
      if (!found) {
        setDomain(null)
        setData(emptyData)
        return
      }

      const [tasks, goals, habits, projects, notes, budget, wishlist, events, journalResult] = await Promise.all([
        tasksRes.ok ? tasksRes.json() : [],
        goalsRes.ok ? goalsRes.json() : [],
        habitsRes.ok ? habitsRes.json() : [],
        projectsRes.ok ? projectsRes.json() : [],
        notesRes.ok ? notesRes.json() : [],
        budgetRes.ok ? budgetRes.json() : { categories: [] },
        wishlistRes.ok ? wishlistRes.json() : [],
        eventsRes.ok ? eventsRes.json() : [],
        journalRes.ok ? journalRes.json() : { entries: [] },
      ])

      const todayKey = todayString()
      setDomain(found)
      setData({
        tasks: Array.isArray(tasks) ? tasks.filter((task) => !task.completed) : [],
        goals: Array.isArray(goals) ? goals.filter((goal) => goal.status !== "completed") : [],
        habits: Array.isArray(habits) ? habits.filter((habit) => habit.is_active !== false) : [],
        projects: Array.isArray(projects) ? projects.filter((project) => !["completed", "archived"].includes(project.status)) : [],
        notes: Array.isArray(notes) ? notes.slice(0, 12) : [],
        categories: Array.isArray(budget.categories) ? budget.categories : [],
        wishlist: Array.isArray(wishlist) ? wishlist.filter((item) => !item.purchased) : [],
        events: Array.isArray(events) ? events.filter((event) => event.event_date >= todayKey).slice(0, 12) : [],
        journal: Array.isArray(journalResult.entries) ? journalResult.entries : [],
      })
    } catch (error) {
      console.error("[domains] detail load failed:", error)
      toast({ title: "Could not load this domain", description: "Try refreshing the page.", variant: "destructive" })
    } finally {
      setLoadingData(false)
    }
  }, [id, toast])

  const fetchReviews = useCallback(async () => {
    if (!id) return
    try {
      const response = await fetch(`/api/life-area-reviews?life_area_id=${encodeURIComponent(id)}`)
      if (!response.ok) throw new Error("Could not load reviews")
      const data = await response.json()
      setReviews(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("[domains] reviews load failed:", error)
    }
  }, [id])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }
    if (user) {
      // Flagged by react-hooks/set-state-in-effect: fetchData/fetchReviews
      // are shared with other call sites (retry, save review) that need the
      // loading indicators reset too, so the reset can't be dropped.
      fetchData()
      fetchReviews()
    }
  }, [fetchData, fetchReviews, loading, router, user])

  useEffect(() => {
    if (!id) return
    // Flagged by react-hooks/set-state-in-effect: re-syncs the unlock flag
    // from sessionStorage whenever the route's domain id changes.
    setUnlocked(sessionStorage.getItem(`domain-unlock-${id}`) === "1")
  }, [id])

  const verifyReauth = async () => {
    if (!reauthPassword) return
    setVerifyingReauth(true)
    setReauthError("")
    try {
      const response = await fetch("/api/auth/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: reauthPassword }),
      })
      if (!response.ok) {
        setReauthError("Incorrect password.")
        return
      }
      sessionStorage.setItem(`domain-unlock-${id}`, "1")
      setUnlocked(true)
      setReauthPassword("")
    } catch (error) {
      console.error("[domains] reauth failed:", error)
      setReauthError("Could not verify. Try again.")
    } finally {
      setVerifyingReauth(false)
    }
  }

  const openReviewDialog = () => {
    setReviewForm({ ...emptyReviewForm, period_type: (domain?.review_frequency === "none" ? "custom" : domain?.review_frequency) as ReviewPeriodType || "custom" })
    setReviewDialogOpen(true)
  }

  const saveReview = async () => {
    if (!domain) return
    setSavingReview(true)
    try {
      const response = await fetch("/api/life-area-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          life_area_id: domain.id,
          period_type: reviewForm.period_type,
          feeling: reviewForm.feeling,
          improved: reviewForm.improved,
          needs_attention: reviewForm.needs_attention,
          stress: reviewForm.stress,
          stop_doing: reviewForm.stop_doing,
          continue_doing: reviewForm.continue_doing,
          next_action: reviewForm.next_action,
          attention_adjustment: reviewForm.attention_adjustment === "none" ? null : reviewForm.attention_adjustment,
        }),
      })
      if (!response.ok) throw new Error("Failed to save review")
      setReviewDialogOpen(false)
      toast({ title: "Review saved" })
      fetchReviews()
    } catch (error) {
      console.error("[domains] review save failed:", error)
      toast({ title: "Could not save review", description: "Try again.", variant: "destructive" })
    } finally {
      setSavingReview(false)
    }
  }

  const deleteReview = async (reviewId: number | string) => {
    if (!confirm("Delete this review?")) return
    try {
      const response = await fetch("/api/life-area-reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reviewId }),
      })
      if (!response.ok) throw new Error("Failed to delete review")
      setReviews((prev) => prev.filter((review) => String(review.id) !== String(reviewId)))
    } catch (error) {
      console.error("[domains] review delete failed:", error)
      toast({ title: "Could not delete review", variant: "destructive" })
    }
  }

  const tabSections = useMemo(
    () => [
      { key: "goals" as const, tab: "goals", title: "Goals", items: data.goals, done: "Complete" },
      { key: "projects" as const, tab: "projects", title: "Projects", items: data.projects, done: "Complete" },
      { key: "tasks" as const, tab: "tasks", title: "Tasks", items: data.tasks, done: "Mark done" },
      { key: "habits" as const, tab: "habits", title: "Habits and Routines", items: data.habits, done: "Check in" },
      { key: "notes" as const, tab: "knowledge", title: "Knowledge", items: data.notes, done: undefined },
      { key: "events" as const, tab: "calendar", title: "Calendar", items: data.events, done: undefined },
      { key: "journal" as const, tab: "journal", title: "Journal", items: data.journal, done: undefined },
    ],
    [data]
  )

  const visibleTabs = useMemo(() => tabSections.filter((section) => section.items.length > 0), [tabSections])

  useEffect(() => {
    // Flagged by react-hooks/set-state-in-effect: re-runs when visibleTabs
    // changes and the current tab may no longer be valid.
    if (activeTab !== "overview" && activeTab !== "review" && !visibleTabs.some((section) => section.tab === activeTab)) {
      setActiveTab("overview")
    }
  }, [activeTab, visibleTabs])

  const quickDone = async (section: keyof DataState, item: RecordItem) => {
    if (!item.id) return
    const scopedId = `${section}-${item.id}`
    setActionId(scopedId)
    try {
      if (section === "tasks") {
        await fetch("/api/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, completed: true }) })
      } else if (section === "goals") {
        await fetch("/api/goals", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, status: "completed", progress: 100 }) })
      } else if (section === "habits") {
        await fetch("/api/habits/checkins", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ habit_id: item.id, checkin_date: todayString(), count: item.target_count || 1 }) })
      } else if (section === "projects") {
        await fetch("/api/projects", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, status: "completed", progress: 100 }) })
      }
      toast({ title: "Updated", description: `${titleFor(section, item)} was updated.` })
      fetchData()
    } catch (error) {
      console.error("[domains] quick action failed:", error)
      toast({ title: "Update failed", description: "The item was not changed.", variant: "destructive" })
    } finally {
      setActionId(null)
    }
  }

  const openSettings = () => {
    if (!domain) return
    setSettingsForm(toSettingsForm(domain))
    setSettingsOpen(true)
  }

  const saveSettings = async () => {
    if (!domain || !settingsForm) return
    setSavingSettings(true)
    try {
      const response = await fetch("/api/life-areas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...domain,
          ...settingsForm,
          importance: settingsForm.importance === "none" ? null : settingsForm.importance,
          desired_attention: settingsForm.desired_attention === "none" ? null : settingsForm.desired_attention,
        }),
      })
      if (!response.ok) throw new Error("Failed to save domain settings")
      const saved = normalizeLifeArea(await response.json())
      setDomain(saved)
      setSettingsOpen(false)
      toast({ title: "Domain settings saved" })
    } catch (error) {
      console.error("[domains] settings save failed:", error)
      toast({ title: "Could not save settings", description: "Try again.", variant: "destructive" })
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <DashboardLayout title={domain?.name || "Life Domain"} subtitle="Everything connected to this part of your life">
      <div className="space-y-6">
        <Button variant="ghost" className="gap-2" onClick={() => router.push("/domains")}>
          <ArrowLeft className="h-4 w-4" />
          Life Domains
        </Button>

        {loadingData ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-52" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)}
            </CardContent>
          </Card>
        ) : !domain ? (
          <Card>
            <CardHeader>
              <CardTitle>Life domain not found</CardTitle>
              <CardDescription>This domain may have been deleted or belongs to another account.</CardDescription>
            </CardHeader>
          </Card>
        ) : domain.requires_reauth && !unlocked ? (
          <Card className="mx-auto max-w-md">
            <CardHeader className="items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <CardTitle>{domain.name} is protected</CardTitle>
              <CardDescription>Enter your password to open this domain.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                type="password"
                value={reauthPassword}
                onChange={(event) => setReauthPassword(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && verifyReauth()}
                placeholder="Password"
                autoFocus
              />
              {reauthError && <p className="text-sm text-destructive">{reauthError}</p>}
              <Button className="w-full" onClick={verifyReauth} disabled={verifyingReauth || !reauthPassword}>
                {verifyingReauth ? "Checking..." : "Unlock"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="rounded-lg border bg-card p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: domain.color }}>
                    <LifeAreaIcon name={domain.icon} className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-foreground">{domain.name}</h1>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{domain.description || "No description yet."}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="capitalize">{domain.status}</Badge>
                      {domain.importance && <Badge variant="outline" className="capitalize">{domain.importance} importance</Badge>}
                      {domain.desired_attention && <Badge variant="outline" className="capitalize">Wants {domain.desired_attention} attention</Badge>}
                      {domain.health_status !== "not_assessed" && <Badge variant="outline" className="capitalize">{domain.health_status.replace("_", " ")}</Badge>}
                      {domain.review_frequency !== "none" && <Badge variant="outline" className="capitalize">{domain.review_frequency} review</Badge>}
                      {domain.is_ai_excluded && <Badge variant="outline">Excluded from AI</Badge>}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <Badge variant="outline" className="w-fit gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: domain.color }} />
                    {tabSections.reduce((sum, section) => sum + section.items.length, 0)} linked items
                  </Badge>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant={domainFocus?.id === String(domain.id) ? "default" : "outline"}
                      className="gap-2"
                      onClick={() =>
                        domainFocus?.id === String(domain.id)
                          ? clearDomainFocus()
                          : setDomainFocus({ id: String(domain.id), name: domain.name, color: domain.color, icon: domain.icon })
                      }
                    >
                      <Target className="h-4 w-4" />
                      {domainFocus?.id === String(domain.id) ? "Exit focus" : "Focus on this domain"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() =>
                        router.push(`/templates?domain_id=${domain.id}&domain_name=${encodeURIComponent(domain.name)}`)
                      }
                    >
                      <Sparkles className="h-4 w-4" />
                      Apply a template
                    </Button>
                    <Button size="sm" variant="outline" className="gap-2" onClick={openSettings}>
                      <Settings2 className="h-4 w-4" />
                      Domain Settings
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex w-full justify-start overflow-x-auto rounded-lg bg-muted/70 p-1 sm:inline-flex sm:w-auto">
                <TabsTrigger value="overview" className="min-w-24 flex-1 sm:flex-none">Overview</TabsTrigger>
                {visibleTabs.map((section) => (
                  <TabsTrigger key={section.tab} value={section.tab} className="min-w-24 flex-1 gap-1.5 sm:flex-none">
                    {section.title}
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{section.items.length}</Badge>
                  </TabsTrigger>
                ))}
                <TabsTrigger value="review" className="min-w-24 flex-1 gap-1.5 sm:flex-none">
                  Review
                  {reviews.length > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{reviews.length}</Badge>}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {tabSections.map((section) => (
                    <Card key={section.key}>
                      <CardHeader className="pb-2">
                        <CardDescription>{section.title}</CardDescription>
                        <CardTitle className="text-2xl">{section.items.length}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Button asChild variant="link" size="sm" className="h-auto gap-1 px-0">
                          <Link href={hrefFor(section.key, domain.id)}>
                            View all <ExternalLink className="h-3 w-3" />
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {(data.categories.length > 0 || data.wishlist.length > 0) && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {data.categories.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Budget Categories</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {data.categories.slice(0, 5).map((item) => (
                            <ItemRow key={`categories-${item.id}`} section="categories" item={item} domainId={domain.id} actionId={actionId} />
                          ))}
                        </CardContent>
                      </Card>
                    )}
                    {data.wishlist.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Wishlist</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {data.wishlist.slice(0, 5).map((item) => (
                            <ItemRow key={`wishlist-${item.id}`} section="wishlist" item={item} domainId={domain.id} actionId={actionId} />
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {(domain.current_focus || domain.definition_of_success || domain.current_concerns || domain.long_term_vision || domain.boundaries) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Notes on this domain</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {domain.current_focus && <p><span className="font-medium text-foreground">Current focus: </span><span className="text-muted-foreground">{domain.current_focus}</span></p>}
                      {domain.definition_of_success && <p><span className="font-medium text-foreground">Success looks like: </span><span className="text-muted-foreground">{domain.definition_of_success}</span></p>}
                      {domain.current_concerns && <p><span className="font-medium text-foreground">Current concerns: </span><span className="text-muted-foreground">{domain.current_concerns}</span></p>}
                      {domain.long_term_vision && <p><span className="font-medium text-foreground">Long-term vision: </span><span className="text-muted-foreground">{domain.long_term_vision}</span></p>}
                      {domain.boundaries && <p><span className="font-medium text-foreground">Boundaries: </span><span className="text-muted-foreground">{domain.boundaries}</span></p>}
                    </CardContent>
                  </Card>
                )}

                {tabSections.every((section) => section.items.length === 0) && data.categories.length === 0 && data.wishlist.length === 0 && (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      Nothing is connected to this domain yet. Assign a task, goal, project, habit, or note to {domain.name} to see it here.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {visibleTabs.map((section) => (
                <TabsContent key={section.tab} value={section.tab} className="mt-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      <Button asChild variant="outline" size="sm" className="gap-2">
                        <Link href={hrefFor(section.key, domain.id)}>
                          Open full view <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {section.items.slice(0, 12).map((item) => (
                        <ItemRow
                          key={`${section.key}-${item.id}`}
                          section={section.key}
                          item={item}
                          domainId={domain.id}
                          actionId={actionId}
                          onDone={section.done ? quickDone : undefined}
                          doneLabel={section.done}
                        />
                      ))}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}

              <TabsContent value="review" className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                    <div>
                      <CardTitle className="text-base">Domain Review</CardTitle>
                      <CardDescription>
                        {domain.review_frequency === "none" ? "No review cadence set." : `Review cadence: ${domain.review_frequency}.`} All prompts are optional.
                      </CardDescription>
                    </div>
                    <Button size="sm" className="gap-2" onClick={openReviewDialog}>
                      <Plus className="h-4 w-4" />
                      Start Review
                    </Button>
                  </CardHeader>
                </Card>

                {reviews.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      No reviews yet for {domain.name}.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((review) => (
                      <Card key={review.id as string | number}>
                        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                          <div>
                            <CardTitle className="text-sm capitalize">{review.period_type} review</CardTitle>
                            <CardDescription>{review.created_at ? new Date(review.created_at as string | number | Date).toLocaleDateString() : ""}</CardDescription>
                          </div>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteReview(review.id as string | number)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {review.feeling && <p><span className="font-medium">Feeling: </span><span className="text-muted-foreground">{review.feeling}</span></p>}
                          {review.improved && <p><span className="font-medium">Improved: </span><span className="text-muted-foreground">{review.improved}</span></p>}
                          {review.needs_attention && <p><span className="font-medium">Needs attention: </span><span className="text-muted-foreground">{review.needs_attention}</span></p>}
                          {review.stress && <p><span className="font-medium">Stress: </span><span className="text-muted-foreground">{review.stress}</span></p>}
                          {review.stop_doing && <p><span className="font-medium">Stop doing: </span><span className="text-muted-foreground">{review.stop_doing}</span></p>}
                          {review.continue_doing && <p><span className="font-medium">Continue doing: </span><span className="text-muted-foreground">{review.continue_doing}</span></p>}
                          {review.next_action && <p><span className="font-medium">Next action: </span><span className="text-muted-foreground">{review.next_action}</span></p>}
                          {review.attention_adjustment && <Badge variant="outline" className="capitalize">{String(review.attention_adjustment).replace("_", " ")} attention</Badge>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}

        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Domain Settings</DialogTitle>
              <DialogDescription>Set lifecycle, attention, and privacy for this domain.</DialogDescription>
            </DialogHeader>
            {settingsForm && (
              <div className="grid gap-4 py-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={settingsForm.status} onValueChange={(value) => setSettingsForm((prev) => prev && { ...prev, status: value as DomainStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOMAIN_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Importance</Label>
                    <Select value={settingsForm.importance} onValueChange={(value) => setSettingsForm((prev) => prev && { ...prev, importance: value as DomainImportance | "none" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not set</SelectItem>
                        {DOMAIN_IMPORTANCE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Desired attention</Label>
                    <Select value={settingsForm.desired_attention} onValueChange={(value) => setSettingsForm((prev) => prev && { ...prev, desired_attention: value as DomainAttention | "none" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not set</SelectItem>
                        {DOMAIN_ATTENTION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Review frequency</Label>
                    <Select value={settingsForm.review_frequency} onValueChange={(value) => setSettingsForm((prev) => prev && { ...prev, review_frequency: value as DomainReviewFrequency })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOMAIN_REVIEW_FREQUENCY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Health status</Label>
                    <Select value={settingsForm.health_status} onValueChange={(value) => setSettingsForm((prev) => prev && { ...prev, health_status: value as DomainHealthStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DOMAIN_HEALTH_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {(() => {
                    if (!domain) return null
                    const currentDomain = domain
                    const eligibleParents = allDomains.filter((candidate) => candidate.id !== currentDomain.id && !candidate.parent_domain_id)
                    const hasChildren = allDomains.some((candidate) => candidate.parent_domain_id === currentDomain.id)
                    if (eligibleParents.length === 0 || hasChildren) return null
                    return (
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Parent domain</Label>
                        <Select
                          value={settingsForm.parent_domain_id || "none"}
                          onValueChange={(value) => setSettingsForm((prev) => prev && { ...prev, parent_domain_id: value === "none" ? null : value })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No parent (top-level domain)</SelectItem>
                            {eligibleParents.map((parent) => (
                              <SelectItem key={parent.id} value={parent.id}>{parent.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Make {currentDomain.name} a subdomain of another domain. Subdomains go one level deep.</p>
                      </div>
                    )
                  })()}
                </div>

                <div className="space-y-2">
                  <Label>Current focus</Label>
                  <Textarea value={settingsForm.current_focus} onChange={(event) => setSettingsForm((prev) => prev && { ...prev, current_focus: event.target.value })} placeholder="What are you focused on in this domain right now?" />
                </div>
                <div className="space-y-2">
                  <Label>Definition of success</Label>
                  <Textarea value={settingsForm.definition_of_success} onChange={(event) => setSettingsForm((prev) => prev && { ...prev, definition_of_success: event.target.value })} placeholder="What does doing well here look like?" />
                </div>
                <div className="space-y-2">
                  <Label>Current concerns</Label>
                  <Textarea value={settingsForm.current_concerns} onChange={(event) => setSettingsForm((prev) => prev && { ...prev, current_concerns: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Long-term vision</Label>
                  <Textarea value={settingsForm.long_term_vision} onChange={(event) => setSettingsForm((prev) => prev && { ...prev, long_term_vision: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Boundaries</Label>
                  <Textarea value={settingsForm.boundaries} onChange={(event) => setSettingsForm((prev) => prev && { ...prev, boundaries: event.target.value })} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Exclude from AI</p>
                    <p className="text-xs text-muted-foreground">Coach, Capture, and Life Balance will never read this domain&apos;s data.</p>
                  </div>
                  <Switch checked={settingsForm.is_ai_excluded} onCheckedChange={(checked) => setSettingsForm((prev) => prev && { ...prev, is_ai_excluded: checked })} />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Require re-authentication</p>
                    <p className="text-xs text-muted-foreground">Prompt for your password again before opening this domain.</p>
                  </div>
                  <Switch checked={settingsForm.requires_reauth} onCheckedChange={(checked) => setSettingsForm((prev) => prev && { ...prev, requires_reauth: checked })} />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
              <Button onClick={saveSettings} disabled={savingSettings}>{savingSettings ? "Saving..." : "Save Settings"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Start a Review</DialogTitle>
              <DialogDescription>Every prompt is optional — skip anything that doesn&apos;t apply.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Period</Label>
                <Select value={reviewForm.period_type} onValueChange={(value) => setReviewForm((prev) => ({ ...prev, period_type: value as ReviewPeriodType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {REVIEW_PROMPTS.map((prompt) => (
                <div key={prompt.key} className="space-y-2">
                  <Label>{prompt.label}</Label>
                  <Textarea
                    value={reviewForm[prompt.key] as string}
                    onChange={(event) => setReviewForm((prev) => ({ ...prev, [prompt.key]: event.target.value }))}
                    placeholder={prompt.placeholder}
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label>Does this domain need more or less attention?</Label>
                <Select value={reviewForm.attention_adjustment} onValueChange={(value) => setReviewForm((prev) => ({ ...prev, attention_adjustment: value as ReviewForm["attention_adjustment"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not sure / skip</SelectItem>
                    <SelectItem value="increase">More attention</SelectItem>
                    <SelectItem value="decrease">Less attention</SelectItem>
                    <SelectItem value="keep_same">About the same</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveReview} disabled={savingReview}>{savingReview ? "Saving..." : "Save Review"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
