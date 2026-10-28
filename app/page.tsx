"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  BookOpenText,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Flame,
  Inbox,
  Lightbulb,
  Sparkles,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DomainTodayOverview } from "@/components/domain-today-overview"
import { OnboardingModal } from "@/components/onboarding-modal"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { motionPresets } from "@/lib/motion"
import { cn } from "@/lib/utils"

type DashboardApiKey = "tasks" | "goals" | "notes" | "budget" | "investments" | "wishlist" | "income" | "projects"
type DashboardErrorKey = DashboardApiKey | "today" | "journal"
interface Task {
  id: number | string
  title: string
  description?: string | null
  completed?: boolean
  priority?: string | null
  due_date?: string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface Goal {
  id: number | string
  title: string
  description?: string | null
  category?: string | null
  progress?: number | string | null
  status?: string | null
  target_date?: string | null
  deadline?: string | null
  target_value?: number | string | null
  current_value?: number | string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface Note {
  id: number | string
  title?: string | null
  content?: string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface BudgetCategory {
  id: number | string
  name?: string | null
  life_area_id?: string | number | null
}

interface BudgetTransaction {
  id: number | string
  type?: string | null
  amount?: number | string | null
  description?: string | null
  date?: string | null
  updated_at?: string | null
  created_at?: string | null
}

interface BudgetData {
  categories?: BudgetCategory[]
  transactions?: BudgetTransaction[]
  goals?: unknown[]
  summary?: {
    income?: number | string | null
    expenses?: number | string | null
    balance?: number | string | null
  }
}

interface Investment {
  id: number | string
  name: string
  type?: string | null
  symbol?: string | null
  amount?: number | string | null
  current_value?: number | string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface WishlistItem {
  id: number | string
  title: string
  price?: number | string | null
  purchased?: boolean | null
  priority?: string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface IncomeSource {
  id: number | string
  name?: string | null
  source_name?: string | null
  type?: string | null
  category?: string | null
  amount?: number | string | null
  frequency?: string | null
  active?: boolean | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface Project {
  id: number | string
  title: string
  description?: string | null
  status?: string | null
  priority?: string | null
  progress?: number | string | null
  due_date?: string | null
  item_count?: number | string | null
  next_action_count?: number | string | null
  updated_at?: string | null
  created_at?: string | null
  life_area_id?: string | number | null
}

interface InboxItem {
  id: number | string
  title: string
  raw_text?: string | null
  status?: string | null
  updated_at?: string | null
  created_at?: string | null
}

interface SomedayItem {
  id: number | string
  title: string
  description?: string | null
  category?: string | null
  status?: string | null
  review_date?: string | null
  updated_at?: string | null
  created_at?: string | null
}

interface WaitingItem {
  id: number | string
  title: string
  waiting_on_name?: string | null
  status?: string | null
  expected_date?: string | null
  follow_up_date?: string | null
  updated_at?: string | null
  created_at?: string | null
}

interface CommitmentItem {
  id: number | string
  title: string
  committed_to?: string | null
  status?: string | null
  due_date?: string | null
  updated_at?: string | null
  created_at?: string | null
}

interface MaintenanceItem {
  id: number | string
  title: string
  status?: string | null
  next_due_date?: string | null
  category?: string | null
  updated_at?: string | null
  created_at?: string | null
}

interface DashboardSources {
  tasks: Task[]
  goals: Goal[]
  notes: Note[]
  budget: BudgetData | null
  investments: Investment[]
  wishlist: WishlistItem[]
  income: IncomeSource[]
  projects: Project[]
}

interface ActivityItem {
  id: string
  title: string
  label: string
  href: string
  type: string
  at: string
  life_area_id?: string | number | null
}

interface TodayPlanPreview {
  plan?: {
    focus_items?: TodayPlanItem[]
  }
  candidates?: {
    calendarToday?: TodayPlanItem[]
  }
  summary?: {
    focusItems?: number
    dueOrOverdueTasks?: number
    dueOrOverdueItems?: number
    calendarToday?: number
  }
}

interface TodayPlanItem {
  id: string
  title: string
  subtitle?: string | null
  href?: string
  source_type?: string
}

interface NavigationSummary {
  counts?: {
    overdueTasks?: number
    habitsDueToday?: number
    calendarToday?: number
    unreadNotifications?: number
  }
}

interface LifeScoreComponent {
  key: string
  label: string
  score: number
  weight: number
  status: "supportive" | "steady" | "attention"
  explanation: string
  href: string
}

interface LifeScoreData {
  ready: boolean
  score: number
  label: string
  previous_score: number | null
  change: number | null
  components: LifeScoreComponent[]
  reasons: string[]
  top_improvements: Array<{
    title: string
    description: string
    href: string
    component_key: string
  }>
  history: Array<{
    score_date: string
    score: number
    label: string
  }>
  unavailable: string[]
}

interface LifeScoreAiExplanation {
  summary: string
  what_helped: string[]
  gentle_watchouts: string[]
  next_small_steps: string[]
}

interface JournalPreviewResponse {
  entry: {
    id: number
    journal_date: string
    mood: number | null
    gratitude: string[]
    affirmation_text: string | null
    notes_from_today: string | null
    updated_at: string | null
  } | null
}

const emptySources: DashboardSources = {
  tasks: [],
  goals: [],
  notes: [],
  budget: null,
  investments: [],
  wishlist: [],
  income: [],
  projects: [],
}

const apiEndpoints: Record<DashboardApiKey, string> = {
  tasks: "/api/tasks",
  goals: "/api/goals",
  notes: "/api/notes",
  budget: "/api/budget",
  investments: "/api/investments",
  wishlist: "/api/wishlist",
  income: "/api/income",
  projects: "/api/projects",
}

// Survives the remount when you navigate away and back within a session.
let _homeMoreOpen = false

type PendingFilter = "all" | "inbox" | "someday" | "waiting" | "commitments" | "maintenance"

type PendingItem = {
  id: string
  title: string
  subtitle: string
  date: string
  href: string
  source: Exclude<PendingFilter, "all">
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function formatDate(value?: string | null) {
  if (!value) return "No date"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "No date"
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff)) return "Recently"
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function startOfToday() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function localDateString() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

function waitingItemIsActive(item: WaitingItem) {
  return item.status === "waiting" || item.status === "follow_up_needed"
}

function waitingFollowUpDue(item: WaitingItem) {
  const date = parseDate(item.follow_up_date)
  return waitingItemIsActive(item) && Boolean(date && date <= startOfToday())
}

function waitingOverdue(item: WaitingItem) {
  const date = parseDate(item.expected_date)
  return waitingItemIsActive(item) && Boolean(date && date < startOfToday())
}

function commitmentIsActive(item: CommitmentItem) {
  return item.status === "open" || item.status === "at_risk"
}

function commitmentDueSoon(item: CommitmentItem) {
  const date = parseDate(item.due_date)
  if (!commitmentIsActive(item) || !date) return false
  const today = startOfToday()
  const limit = new Date(today)
  limit.setDate(limit.getDate() + 7)
  return date >= today && date <= limit
}

function maintenanceIsActive(item: MaintenanceItem) {
  return item.status === "active"
}

function maintenanceUpcoming(item: MaintenanceItem) {
  const date = parseDate(item.next_due_date)
  if (!maintenanceIsActive(item) || !date) return false
  const today = startOfToday()
  const limit = new Date(today)
  limit.setDate(limit.getDate() + 30)
  return date >= today && date <= limit
}

function maintenanceOverdue(item: MaintenanceItem) {
  const date = parseDate(item.next_due_date)
  return maintenanceIsActive(item) && Boolean(date && date < startOfToday())
}

function monthlyIncomeForSource(source: IncomeSource) {
  if (source.active === false) return 0
  const amount = toNumber(source.amount)
  switch (source.frequency) {
    case "weekly":
      return amount * 4
    case "bi-weekly":
      return amount * 2
    case "quarterly":
      return amount / 3
    case "yearly":
      return amount / 12
    case "monthly":
    default:
      return amount
  }
}

function getTimestamp(item: { updated_at?: string | null; created_at?: string | null }) {
  return item.updated_at || item.created_at || ""
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

async function fetchJson<T>(url: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return { data: null, error: `Could not load ${url.replace("/api/", "")}` }
    }
    return { data: (await response.json()) as T, error: null }
  } catch (error) {
    console.error(`Dashboard fetch failed for ${url}:`, error)
    return { data: null, error: `Could not load ${url.replace("/api/", "")}` }
  }
}

function SectionUnavailable({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span>{label} could not be loaded.</span>
      </div>
    </div>
  )
}

function lifeScoreStatusClass(status: LifeScoreComponent["status"]) {
  if (status === "supportive") return "bg-emerald-500"
  if (status === "steady") return "bg-primary"
  return "bg-amber-500"
}

function lifeScoreChangeText(change: number | null) {
  if (change === null) return "First snapshot"
  if (change > 0) return `+${change} since last snapshot`
  if (change < 0) return `${change} since last snapshot`
  return "Steady since last snapshot"
}

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [sources, setSources] = useState<DashboardSources>(emptySources)
  const [todayPreview, setTodayPreview] = useState<TodayPlanPreview | null>(null)
  const [navigationSummary, setNavigationSummary] = useState<NavigationSummary | null>(null)
  const [journalPreview, setJournalPreview] = useState<JournalPreviewResponse["entry"]>(null)
  const [inboxWidget, setInboxWidget] = useState<{ total: number; recent: InboxItem[] } | null>(null)
  const [somedayWidget, setSomedayWidget] = useState<{ due: number; recent: SomedayItem[] } | null>(null)
  const [waitingWidget, setWaitingWidget] = useState<{ followUpsDue: number; overdue: number; recent: WaitingItem[] } | null>(null)
  const [commitmentsWidget, setCommitmentsWidget] = useState<{ dueSoon: number; atRisk: number; recent: CommitmentItem[] } | null>(null)
  const [maintenanceWidget, setMaintenanceWidget] = useState<{ upcoming: number; overdue: number; recent: MaintenanceItem[] } | null>(null)
  const [lifeScore, setLifeScore] = useState<LifeScoreData | null>(null)
  const [lifeScoreLoading, setLifeScoreLoading] = useState(true)
  const [lifeScoreError, setLifeScoreError] = useState<string | null>(null)
  const [lifeScoreAi, setLifeScoreAi] = useState<LifeScoreAiExplanation | null>(null)
  const [lifeScoreAiLoading, setLifeScoreAiLoading] = useState(false)
  const [lifeScoreAiError, setLifeScoreAiError] = useState<string | null>(null)
  const [activePendingFilter, setActivePendingFilter] = useState<PendingFilter>("all")
  const [secondaryOpen, setSecondaryOpenState] = useState(() => _homeMoreOpen)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [errors, setErrors] = useState<Partial<Record<DashboardErrorKey, string>>>({})

  const setSecondaryOpen = (open: boolean) => {
    _homeMoreOpen = open
    setSecondaryOpenState(open)
  }

  const checkOnboarding = useCallback(async () => {
    try {
      if (sessionStorage.getItem("onboarding_completed") === "true") return

      const response = await fetch("/api/onboarding")
      if (!response.ok) return

      const data = await response.json()
      if (data.onboarding_completed === false) {
        setShowOnboarding(true)
      } else {
        sessionStorage.setItem("onboarding_completed", "true")
      }
    } catch (error) {
      console.error("Error checking onboarding:", error)
    }
  }, [])

  const fetchLifeScore = useCallback(async () => {
    setLifeScoreLoading(true)
    setLifeScoreError(null)
    try {
      const response = await fetch("/api/life-score")
      if (!response.ok) {
        throw new Error(response.status === 401 ? "Sign in again to load LifeScore." : "LifeScore is unavailable right now.")
      }
      const data = await response.json()
      setLifeScore(data.life_score ?? null)
    } catch (error) {
      setLifeScore(null)
      setLifeScoreError(error instanceof Error ? error.message : "LifeScore is unavailable right now.")
    } finally {
      setLifeScoreLoading(false)
    }
  }, [])

  const explainLifeScore = async () => {
    setLifeScoreAiLoading(true)
    setLifeScoreAiError(null)
    try {
      const response = await fetch("/api/ai/life-score", { method: "POST" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "LifeScore explanation is unavailable right now.")
      }
      setLifeScoreAi(data.explanation ?? null)
      if (data.life_score) setLifeScore(data.life_score)
    } catch (error) {
      setLifeScoreAiError(error instanceof Error ? error.message : "LifeScore explanation is unavailable right now.")
    } finally {
      setLifeScoreAiLoading(false)
    }
  }

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true)
    const planDate = localDateString()
    const [tasks, goals, notes, budget, investments, wishlist, income, projects, todayPlan, journal, navSummary] = await Promise.all([
      fetchJson<Task[]>(apiEndpoints.tasks),
      fetchJson<Goal[]>(apiEndpoints.goals),
      fetchJson<Note[]>(apiEndpoints.notes),
      fetchJson<BudgetData>(apiEndpoints.budget),
      fetchJson<Investment[]>(apiEndpoints.investments),
      fetchJson<WishlistItem[]>(apiEndpoints.wishlist),
      fetchJson<IncomeSource[]>(apiEndpoints.income),
      fetchJson<Project[]>(apiEndpoints.projects),
      fetchJson<TodayPlanPreview>(`/api/today-plan?date=${planDate}`),
      fetchJson<JournalPreviewResponse>(`/api/journal/${planDate}`),
      fetchJson<NavigationSummary>("/api/navigation-summary"),
    ])

    // Inbox widget — fetch independently, fails silently
    try {
      const inboxRes = await fetch("/api/inbox?status=unsorted&limit=100")
      if (inboxRes.ok) {
        const inboxData: InboxItem[] = await inboxRes.json()
        setInboxWidget({ total: inboxData.length, recent: inboxData.slice(0, 3) })
      }
    } catch {
      // Inbox widget failure is non-fatal
    }

    // Someday widget — fetch independently, fails silently
    try {
      const somedayRes = await fetch("/api/someday?view=review_due&limit=100")
      if (somedayRes.ok) {
        const somedayData: SomedayItem[] = await somedayRes.json()
        setSomedayWidget({ due: somedayData.length, recent: somedayData.slice(0, 3) })
      }
    } catch {
      // Someday widget failure is non-fatal
    }

    // Waiting For widget — fetch independently, fails silently
    try {
      const waitingRes = await fetch("/api/waiting?view=all&limit=100")
      if (waitingRes.ok) {
        const waitingData: WaitingItem[] = await waitingRes.json()
        const activeWaiting = waitingData.filter(waitingItemIsActive)
        setWaitingWidget({
          followUpsDue: waitingData.filter(waitingFollowUpDue).length,
          overdue: waitingData.filter(waitingOverdue).length,
          recent: activeWaiting.slice(0, 3),
        })
      }
    } catch {
      // Waiting For widget failure is non-fatal
    }

    // Commitments widget — fetch independently, fails silently
    try {
      const commitmentsRes = await fetch("/api/commitments?view=all&limit=100")
      if (commitmentsRes.ok) {
        const commitmentsData: CommitmentItem[] = await commitmentsRes.json()
        const activeCommitments = commitmentsData.filter(commitmentIsActive)
        setCommitmentsWidget({
          dueSoon: commitmentsData.filter(commitmentDueSoon).length,
          atRisk: commitmentsData.filter((item) => item.status === "at_risk").length,
          recent: activeCommitments.slice(0, 3),
        })
      }
    } catch {
      // Commitments widget failure is non-fatal
    }

    // Maintenance widget — fetch independently, fails silently
    try {
      const maintenanceRes = await fetch("/api/maintenance?view=all&limit=100")
      if (maintenanceRes.ok) {
        const maintenanceData: MaintenanceItem[] = await maintenanceRes.json()
        const activeMaintenance = maintenanceData.filter(maintenanceIsActive)
        setMaintenanceWidget({
          upcoming: maintenanceData.filter(maintenanceUpcoming).length,
          overdue: maintenanceData.filter(maintenanceOverdue).length,
          recent: activeMaintenance.slice(0, 3),
        })
      }
    } catch {
      // Maintenance widget failure is non-fatal
    }

    setSources({
      tasks: normalizeArray<Task>(tasks.data),
      goals: normalizeArray<Goal>(goals.data),
      notes: normalizeArray<Note>(notes.data),
      budget: budget.data,
      investments: normalizeArray<Investment>(investments.data),
      wishlist: normalizeArray<WishlistItem>(wishlist.data),
      income: normalizeArray<IncomeSource>(income.data),
      projects: normalizeArray<Project>(projects.data),
    })
    setTodayPreview(todayPlan.data)
    setNavigationSummary(navSummary.data)
    setJournalPreview(journal.data?.entry ?? null)
    setErrors({
      ...(tasks.error ? { tasks: tasks.error } : {}),
      ...(goals.error ? { goals: goals.error } : {}),
      ...(notes.error ? { notes: notes.error } : {}),
      ...(budget.error ? { budget: budget.error } : {}),
      ...(investments.error ? { investments: investments.error } : {}),
      ...(wishlist.error ? { wishlist: wishlist.error } : {}),
      ...(income.error ? { income: income.error } : {}),
      ...(projects.error ? { projects: projects.error } : {}),
      ...(todayPlan.error ? { today: todayPlan.error } : {}),
      ...(journal.error ? { journal: journal.error } : {}),
    })
    setDashboardLoading(false)
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }

    if (user) {
      // Flagged by react-hooks/set-state-in-effect: fetchDashboard is also
      // shared with a manual refresh handler below that needs the reload
      // afterward too.
      checkOnboarding()
      fetchDashboard()
      fetchLifeScore()
    }
  }, [checkOnboarding, fetchDashboard, fetchLifeScore, user, loading, router])

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  const firstName = user.name?.split(" ")[0] || "there"
  const investmentTotal = sources.investments.reduce(
    (total, investment) => total + (toNumber(investment.current_value) || toNumber(investment.amount)),
    0,
  )
  const monthlyIncome = sources.income.reduce((total, source) => total + monthlyIncomeForSource(source), 0)
  const budgetSummary = sources.budget?.summary
  const budgetIncome = toNumber(budgetSummary?.income)
  const budgetExpenses = toNumber(budgetSummary?.expenses)
  const budgetBalance = toNumber(budgetSummary?.balance)

  const recentActivityFull: ActivityItem[] = [
    ...sources.tasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      label: task.completed ? "Completed task" : "Updated task",
      href: "/tasks",
      type: "Task",
      at: getTimestamp(task),
      life_area_id: task.life_area_id,
    })),
    ...sources.goals.map((goal) => ({
      id: `goal-${goal.id}`,
      title: goal.title,
      label: goal.status === "completed" ? "Completed goal" : "Updated goal",
      href: "/goals",
      type: "Goal",
      at: getTimestamp(goal),
      life_area_id: goal.life_area_id,
    })),
    ...sources.notes.map((note) => ({
      id: `note-${note.id}`,
      title: note.title || "Untitled note",
      label: "Updated note",
      href: "/notes",
      type: "Note",
      at: getTimestamp(note),
      life_area_id: note.life_area_id,
    })),
    ...sources.wishlist.map((item) => ({
      id: `wishlist-${item.id}`,
      title: item.title,
      label: item.purchased ? "Purchased wishlist item" : "Updated wishlist item",
      href: "/money?tab=wishlist",
      type: "Wishlist",
      at: getTimestamp(item),
      life_area_id: item.life_area_id,
    })),
    ...sources.investments.map((investment) => ({
      id: `investment-${investment.id}`,
      title: investment.name,
      label: "Updated investment",
      href: "/money?tab=investments",
      type: "Investment",
      at: getTimestamp(investment),
      life_area_id: investment.life_area_id,
    })),
    ...sources.income.map((source) => ({
      id: `income-${source.id}`,
      title: source.source_name || source.name || "Income source",
      label: "Updated income source",
      href: "/money?tab=income",
      type: "Income",
      at: getTimestamp(source),
      life_area_id: source.life_area_id,
    })),
    ...sources.projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.title,
      label: project.status === "completed" ? "Completed project" : "Updated project",
      href: `/projects/${project.id}`,
      type: "Project",
      at: getTimestamp(project),
      life_area_id: project.life_area_id,
    })),
  ]
    .filter((activity) => activity.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())

  const recentActivity = recentActivityFull.slice(0, 6)
  const pendingSources = [
    {
      key: "inbox" as const,
      label: "Inbox",
      href: "/inbox",
      icon: Inbox,
      count: inboxWidget?.total,
      unavailable: !dashboardLoading && inboxWidget === null,
      items: inboxWidget?.recent.map((item): PendingItem => ({
        id: `inbox-${item.id}`,
        title: item.title,
        subtitle: "Unsorted inbox item",
        date: formatDate(item.updated_at || item.created_at),
        href: "/inbox",
        source: "inbox",
      })) ?? [],
    },
    {
      key: "someday" as const,
      label: "Someday",
      href: "/someday",
      icon: Lightbulb,
      count: somedayWidget?.due,
      unavailable: !dashboardLoading && somedayWidget === null,
      items: somedayWidget?.recent.map((item): PendingItem => ({
        id: `someday-${item.id}`,
        title: item.title,
        subtitle: item.category || "Someday / Maybe",
        date: formatDate(item.review_date || item.updated_at || item.created_at),
        href: "/someday",
        source: "someday",
      })) ?? [],
    },
    {
      key: "waiting" as const,
      label: "Waiting",
      href: "/waiting",
      icon: Clock,
      count: waitingWidget ? waitingWidget.followUpsDue + waitingWidget.overdue : undefined,
      unavailable: !dashboardLoading && waitingWidget === null,
      items: waitingWidget?.recent.map((item): PendingItem => ({
        id: `waiting-${item.id}`,
        title: item.title,
        subtitle: `Waiting on ${item.waiting_on_name || "someone"}`,
        date: formatDate(item.follow_up_date || item.expected_date || item.updated_at || item.created_at),
        href: "/waiting",
        source: "waiting",
      })) ?? [],
    },
    {
      key: "commitments" as const,
      label: "Commitments",
      href: "/commitments",
      icon: ClipboardCheck,
      count: commitmentsWidget ? commitmentsWidget.dueSoon + commitmentsWidget.atRisk : undefined,
      unavailable: !dashboardLoading && commitmentsWidget === null,
      items: commitmentsWidget?.recent.map((item): PendingItem => ({
        id: `commitment-${item.id}`,
        title: item.title,
        subtitle: `Committed to ${item.committed_to || "someone"}`,
        date: formatDate(item.due_date || item.updated_at || item.created_at),
        href: "/commitments",
        source: "commitments",
      })) ?? [],
    },
    {
      key: "maintenance" as const,
      label: "Maintenance",
      href: "/maintenance",
      icon: Wrench,
      count: maintenanceWidget ? maintenanceWidget.upcoming + maintenanceWidget.overdue : undefined,
      unavailable: !dashboardLoading && maintenanceWidget === null,
      items: maintenanceWidget?.recent.map((item): PendingItem => ({
        id: `maintenance-${item.id}`,
        title: item.title,
        subtitle: item.category || "Maintenance",
        date: formatDate(item.next_due_date || item.updated_at || item.created_at),
        href: "/maintenance",
        source: "maintenance",
      })) ?? [],
    },
  ]
  const pendingAllCount = pendingSources.every((source) => typeof source.count === "number")
    ? pendingSources.reduce((total, source) => total + (source.count ?? 0), 0)
    : null
  const activePendingSource = pendingSources.find((source) => source.key === activePendingFilter)
  const pendingItems = (activePendingFilter === "all"
    ? pendingSources.flatMap((source) => source.items)
    : activePendingSource?.items ?? []
  ).slice(0, 6)
  const pendingUnavailable = pendingSources.filter((source) => source.unavailable).map((source) => source.label)
  const compactLifeScoreComponents = lifeScore?.components.slice(0, 3) ?? []
  const journalGratitude = journalPreview?.gratitude?.find((item) => item.trim().length > 0)
  const journalPreviewText =
    journalPreview?.affirmation_text ||
    journalGratitude ||
    journalPreview?.notes_from_today ||
    "Start with one gratitude note or a quick reflection."
  const focusItems = todayPreview?.plan?.focus_items ?? []
  const nextCalendarEvent = todayPreview?.candidates?.calendarToday?.[0] ?? null
  const overdueTaskCount =
    typeof navigationSummary?.counts?.overdueTasks === "number"
      ? navigationSummary.counts.overdueTasks
      : sources.tasks.filter((task) => {
          const due = parseDate(task.due_date)
          return Boolean(!task.completed && due && due < startOfToday())
        }).length
  const habitsDueToday = navigationSummary?.counts?.habitsDueToday ?? 0
  const budgetUsedPercent = budgetIncome > 0 ? Math.round((budgetExpenses / budgetIncome) * 100) : null
  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  })()
  const longDate = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
  const glanceRows: Array<{ label: string; value: string; detail?: string | null; href: string; icon: LucideIcon; attention?: boolean }> = [
    {
      label: "Overdue tasks",
      value: String(overdueTaskCount),
      href: "/tasks",
      icon: CheckSquare,
      attention: overdueTaskCount > 0,
    },
    { label: "Habits due today", value: String(habitsDueToday), href: "/habits", icon: Flame },
    {
      label: "Budget used",
      value: budgetUsedPercent === null ? "No budget yet" : `${budgetUsedPercent}%`,
      href: "/money?tab=budget",
      icon: Wallet,
      attention: budgetUsedPercent !== null && budgetUsedPercent > 100,
    },
    {
      label: "Next event",
      value: nextCalendarEvent?.title || "Nothing today",
      detail: nextCalendarEvent?.subtitle,
      href: "/calendar",
      icon: CalendarDays,
    },
  ]

  const hasAnyErrors = Object.keys(errors).length > 0
  const sectionTitle = "text-base font-semibold tracking-tight text-foreground"
  const sectionLink =
    "inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary transition-colors hover:text-primary-hover"

  return (
    <DashboardLayout>
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false)
          sessionStorage.setItem("onboarding_completed", "true")
          sessionStorage.removeItem("sidebar_prefs")
          fetchDashboard()
        }}
      />

      <div className="section-enter mx-auto w-full max-w-6xl space-y-8" aria-busy={dashboardLoading}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px]">
              {greeting}, {firstName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{longDate}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2 bg-card">
              <Link href={`/journal?date=${localDateString()}`}>
                <BookOpenText className="h-4 w-4" aria-hidden="true" />
                Journal
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link href="/today">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Plan my day
              </Link>
            </Button>
          </div>
        </header>

        {hasAnyErrors && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Some sections couldn&apos;t load, so they&apos;re left blank rather than showing guesses. Refresh to try again.
          </p>
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-6">
          <section aria-labelledby="home-focus" className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="home-focus" className={sectionTitle}>Today&apos;s focus</h2>
              <Link href="/today" className={sectionLink}>
                Open Today
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            {dashboardLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-[60px] w-full" />
                <Skeleton className="h-[60px] w-full" />
                <Skeleton className="h-[60px] w-full" />
              </div>
            ) : errors.today ? (
              <SectionUnavailable label="Today focus" />
            ) : focusItems.length > 0 ? (
              <ol className={cn("divide-y divide-border/70 overflow-hidden rounded-xl border bg-card", motionPresets.staggerContainer)}>
                {focusItems.slice(0, 3).map((item, index) => (
                  <li key={item.id || index}>
                    <Link
                      href={item.href || "/today"}
                      className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-tint text-xs font-semibold tabular-nums text-primary"
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {item.subtitle || item.source_type || "Focus item"}
                        </span>
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transform-none"
                      />
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">No focus picked yet</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">Choose up to three things that matter today.</p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href="/today">Pick focus</Link>
                </Button>
              </div>
            )}
          </section>

          <section aria-labelledby="home-glance" className="min-w-0">
            <h2 id="home-glance" className={cn(sectionTitle, "mb-3")}>At a glance</h2>
            <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card">
              {glanceRows.map((row) => (
                <li key={row.label}>
                  <Link
                    href={row.href}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    <row.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="shrink-0 text-sm text-muted-foreground">{row.label}</span>
                    <span className="ml-auto min-w-0 text-right">
                      {dashboardLoading ? (
                        <Skeleton className="ml-auto h-4 w-10" />
                      ) : (
                        <>
                          <span
                            className={cn(
                              "block truncate text-sm font-semibold tabular-nums text-foreground",
                              row.attention && "text-destructive",
                            )}
                          >
                            {row.value}
                          </span>
                          {row.detail && <span className="block truncate text-xs text-muted-foreground">{row.detail}</span>}
                        </>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-6">
          <section aria-labelledby="home-pending" className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="home-pending" className={sectionTitle}>
                Needs attention
                {pendingAllCount !== null && pendingAllCount > 0 && (
                  <span className="ml-2 text-sm font-normal tabular-nums text-muted-foreground">{pendingAllCount}</span>
                )}
              </h2>
            </div>
            <div
              role="group"
              aria-label="Filter what needs attention"
              className="-mx-4 mb-3 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            >
              {[{ key: "all" as const, label: "All", count: pendingAllCount, icon: null }, ...pendingSources].map((source) => {
                const selected = activePendingFilter === source.key
                const Icon = source.icon
                return (
                  <button
                    key={source.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setActivePendingFilter(source.key)}
                    className={cn(
                      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
                      selected
                        ? "border-primary/30 bg-primary-tint text-primary"
                        : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                    {source.label}
                    {typeof source.count === "number" && source.count > 0 && (
                      <span className="tabular-nums opacity-80">{source.count}</span>
                    )}
                  </button>
                )
              })}
            </div>

            {dashboardLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : pendingItems.length === 0 ? (
              <div key={activePendingFilter} className="tab-enter flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {activePendingFilter === "all" ? "Nothing needs you right now" : `${activePendingSource?.label || "This area"} is clear`}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {activePendingFilter === "all" ? "New captures will show up here." : "No items are asking for attention here."}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href={activePendingSource?.href || "/workspace"}>
                    {activePendingSource ? `Open ${activePendingSource.label}` : "Open Workspace"}
                  </Link>
                </Button>
              </div>
            ) : (
              <ul key={activePendingFilter} className="tab-enter divide-y divide-border/70 overflow-hidden rounded-xl border bg-card">
                {pendingItems.map((item) => {
                  const SourceIcon = pendingSources.find((source) => source.key === item.source)?.icon ?? Inbox
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                      >
                        <SourceIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">{item.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.date}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}

            {pendingUnavailable.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Couldn&apos;t load {pendingUnavailable.join(", ")}.</p>
            )}
          </section>

          <div className="min-w-0">
            <DomainTodayOverview />
          </div>
        </div>

        <Collapsible open={secondaryOpen} onOpenChange={setSecondaryOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center gap-3 rounded-lg py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
              <span>{secondaryOpen ? "Show less" : "LifeScore, journal, money and recent activity"}</span>
              <ChevronDown
                aria-hidden="true"
                className={cn("h-4 w-4 transition-transform duration-200 motion-reduce:transition-none", secondaryOpen && "rotate-180")}
              />
              <span aria-hidden="true" className="h-px flex-1 bg-border" />
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent className="collapsible-content">
            <div className="space-y-8 pt-6">
              <section aria-labelledby="home-lifescore" className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 id="home-lifescore" className={sectionTitle}>LifeScore</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">A calm daily signal for how organized your system is.</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-fit gap-2"
                    onClick={explainLifeScore}
                    disabled={lifeScoreAiLoading || lifeScoreLoading || Boolean(lifeScoreError) || Boolean(lifeScore && !lifeScore.ready)}
                  >
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    {lifeScoreAiLoading ? "Explaining..." : "Explain with AI"}
                  </Button>
                </div>

                <div className="mt-5">
                  {lifeScoreLoading ? (
                    <div className="grid gap-4 md:grid-cols-[160px_minmax(0,1fr)]">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : lifeScoreError ? (
                    <SectionUnavailable label="LifeScore" />
                  ) : lifeScore && lifeScore.ready ? (
                    <>
                      <div className="grid gap-5 md:grid-cols-[160px_minmax(0,1fr)] md:items-center">
                        <div>
                          <p className="flex items-baseline gap-1.5">
                            <span className="text-4xl font-semibold leading-none tracking-tight tabular-nums text-foreground">{lifeScore.score}</span>
                            <span className="text-sm text-muted-foreground">/ 100</span>
                          </p>
                          <p className="mt-2 text-sm">
                            <span className="font-medium text-foreground">{lifeScore.label}</span>
                            <span className="text-muted-foreground"> · {lifeScoreChangeText(lifeScore.change)}</span>
                          </p>
                        </div>
                        <ul className="grid gap-x-5 gap-y-3 sm:grid-cols-3">
                          {compactLifeScoreComponents.map((item) => (
                            <li key={item.key}>
                              <Link href={item.href} className="group block rounded-md">
                                <span className="flex items-center justify-between gap-3 text-sm">
                                  <span className="truncate text-muted-foreground transition-colors group-hover:text-foreground">{item.label}</span>
                                  <span className="font-medium tabular-nums text-foreground">{item.score}</span>
                                </span>
                                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                                  <span
                                    className={cn("bar-grow block h-full rounded-full", lifeScoreStatusClass(item.status))}
                                    style={{ width: `${item.score}%` }}
                                  />
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="mt-5 border-t border-border/70 pt-4 text-sm text-muted-foreground">
                        {lifeScore.reasons[0] || lifeScore.top_improvements[0]?.description || "Your current LifeSort signal is ready."}
                      </p>
                      {(lifeScoreAi || lifeScoreAiError) && (
                        <div aria-live="polite" className="mt-4 border-t border-border/70 pt-4 animate-in fade-in-0 slide-in-from-top-1 duration-300">
                          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
                            {lifeScoreAiError ? "Couldn't explain right now" : "What's behind it"}
                          </p>
                          <p className="mt-1.5 text-sm text-muted-foreground">{lifeScoreAiError || lifeScoreAi?.summary}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                        Your score appears once there&apos;s something to measure: a task, focus item, habit, goal or review.
                      </p>
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <Link href="/today">Start Today</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </section>

              <div className="grid gap-8 lg:grid-cols-2 lg:gap-6">
                <section aria-labelledby="home-journal" className="rounded-xl border bg-card p-4 sm:p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 id="home-journal" className={sectionTitle}>Journal</h2>
                    <span className="text-xs text-muted-foreground">
                      {errors.journal ? "Unavailable" : journalPreview ? "Started today" : "Not started today"}
                    </span>
                  </div>
                  {dashboardLoading ? (
                    <div className="mt-3 space-y-2">
                      <Skeleton className="h-4 w-4/5" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  ) : errors.journal ? (
                    <div className="mt-3"><SectionUnavailable label="Journal" /></div>
                  ) : (
                    <>
                      <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{journalPreviewText}</p>
                      <Link href={`/journal?date=${localDateString()}`} className={cn(sectionLink, "mt-4")}>
                        {journalPreview ? "Continue writing" : "Write today's entry"}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </>
                  )}
                </section>

                <section aria-labelledby="home-money" className="rounded-xl border bg-card p-4 sm:p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 id="home-money" className={sectionTitle}>Money</h2>
                    <Link href="/money" className={sectionLink}>
                      Open Money
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                  {dashboardLoading ? (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : errors.budget && errors.income && errors.investments ? (
                    <div className="mt-3"><SectionUnavailable label="Money" /></div>
                  ) : (
                    <dl className="mt-3 grid grid-cols-3 gap-3">
                      {[
                        { label: "Monthly income", value: errors.income ? "—" : formatCurrency(monthlyIncome) },
                        { label: "Budget balance", value: errors.budget ? "—" : formatCurrency(budgetBalance) },
                        { label: "Portfolio", value: errors.investments ? "—" : formatCurrency(investmentTotal) },
                      ].map((figure) => (
                        <div key={figure.label} className="min-w-0">
                          <dt className="truncate text-xs text-muted-foreground">{figure.label}</dt>
                          <dd className="mt-1 truncate text-base font-semibold tabular-nums text-foreground sm:text-lg">{figure.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>
              </div>

              <section aria-labelledby="home-activity">
                <h2 id="home-activity" className={cn(sectionTitle, "mb-3")}>Recent activity</h2>
                {dashboardLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : errors.tasks && errors.goals && errors.notes && errors.wishlist && errors.investments && errors.income ? (
                  <SectionUnavailable label="Activity" />
                ) : recentActivity.length === 0 ? (
                  <p className="rounded-xl border border-dashed bg-card/60 p-5 text-sm text-muted-foreground">
                    Changes to tasks, goals, notes, money and projects will show up here.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border bg-card">
                    {recentActivity.map((activity) => (
                      <li key={activity.id}>
                        <Link
                          href={activity.href}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">{activity.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {activity.label} · {timeAgo(activity.at)}
                            </span>
                          </span>
                          <Badge variant="outline" className="shrink-0 font-normal text-muted-foreground">{activity.type}</Badge>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </DashboardLayout>
  )
}
