"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Bot,
  CalendarDays,
  BookOpenText,
  CalendarCheck,
  ChevronDown,
  CheckSquare,
  ClipboardCheck,
  Clock,
  FileText,
  Gauge,
  Inbox,
  Lightbulb,
  MoreHorizontal,
  Paintbrush,
  Plus,
  Sparkles,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { DomainTodayOverview } from "@/components/domain-today-overview"
import { AppEmptyState } from "@/components/empty-state"
import { FavoritesTodo } from "@/components/hub-page"
import { OnboardingModal } from "@/components/onboarding-modal"
import { QuickAddModal, type QuickAddType } from "@/components/quick-add-modal"
import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
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

interface DashboardNotification {
  id: number
  title: string
  message: string
  is_read: boolean
  created_at: string
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

const QUICK_ACCESS_RECENTS_KEY = "lifesort:home-quick-access-recents"

type QuickAccessAction = {
  id: string
  title: string
  description: string
  href: string
  icon: LucideIcon
  accent: string
}

const primaryQuickActions: QuickAccessAction[] = [
  {
    id: "capture",
    title: "Capture something",
    description: "Drop a thought into Universal Capture.",
    href: "/capture",
    icon: Sparkles,
    accent: "border-primary/25 bg-primary/10 text-primary",
  },
  {
    id: "task",
    title: "Add task",
    description: "Open tasks and add the next action.",
    href: "/tasks",
    icon: CheckSquare,
    accent: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    id: "today",
    title: "Open Today",
    description: "Focus items, schedule, and reflection.",
    href: "/today",
    icon: CalendarCheck,
    accent: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    id: "calendar",
    title: "Open Calendar",
    description: "See events and planned time blocks.",
    href: "/calendar",
    icon: CalendarDays,
    accent: "border-cyan-500/25 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  {
    id: "note",
    title: "Write note",
    description: "Save a useful detail or draft.",
    href: "/notes",
    icon: FileText,
    accent: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    id: "whiteboard",
    title: "Open Whiteboard",
    description: "Sketch plans and maps with others.",
    href: "/whiteboard",
    icon: Paintbrush,
    accent: "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  },
]

const moreQuickActions: QuickAccessAction[] = [
  {
    id: "journal",
    title: "Open Journal",
    description: "Reflect on the day.",
    href: "/journal",
    icon: BookOpenText,
    accent: "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  {
    id: "money",
    title: "Open Money",
    description: "Review budget, income, and investing.",
    href: "/money",
    icon: Wallet,
    accent: "border-teal-500/25 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  {
    id: "coach",
    title: "Ask LifeSort Coach",
    description: "Ask app-aware questions safely.",
    href: "/ai-chat",
    icon: Bot,
    accent: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
]

const allQuickActions = [...primaryQuickActions, ...moreQuickActions]

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

function QuickAccessSection({
  recentActions,
  onActionClick,
}: {
  recentActions: QuickAccessAction[]
  onActionClick: (action: QuickAccessAction) => void
}) {
  return (
    <Card className="surface-card section-enter overflow-hidden border-primary/15">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-primary" />
              Quick Access
            </CardTitle>
            <CardDescription>Start, capture, or jump back into the places you use most.</CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-fit gap-2 bg-background/80">
                <MoreHorizontal className="h-4 w-4" />
                More actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>More actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {moreQuickActions.map((action) => (
                <DropdownMenuItem asChild key={action.id}>
                  <Link href={action.href} className="gap-3" onClick={() => onActionClick(action)}>
                    <span className={cn("rounded-md border p-1.5", action.accent)}>
                      <action.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{action.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{action.description}</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3 xl:grid-cols-6">
          {primaryQuickActions.map((action) => (
            <Link
              key={action.id}
              href={action.href}
              onClick={() => onActionClick(action)}
              className="interactive-card group min-w-[10.75rem] rounded-lg border bg-background/80 p-3 shadow-sm transition-colors hover:bg-secondary/60 sm:min-w-0"
            >
              <div className={cn("mb-3 inline-flex rounded-lg border p-2", action.accent)}>
                <action.icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold leading-tight text-foreground">{action.title}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{action.description}</p>
            </Link>
          ))}
        </div>

        <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recently used</p>
            {recentActions.length > 0 ? (
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {recentActions.map((action) => (
                  <Button asChild key={action.id} size="sm" variant="outline" className="shrink-0 gap-2 bg-background/80">
                    <Link href={action.href} onClick={() => onActionClick(action)}>
                      <action.icon className="h-3.5 w-3.5" />
                      {action.title}
                    </Link>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Your most used shortcuts will appear here after a few clicks.</p>
            )}
          </div>
          <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Pinned favorites</span> are reserved for your saved shortcuts.
          </div>
        </div>
      </CardContent>
    </Card>
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
  const [notifications, setNotifications] = useState<DashboardNotification[]>([])
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
  const [secondaryOpen, setSecondaryOpen] = useState(false)
  const [quickAddType, setQuickAddType] = useState<QuickAddType | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [errors, setErrors] = useState<Partial<Record<DashboardErrorKey, string>>>({})
  const [recentQuickAccessIds, setRecentQuickAccessIds] = useState<string[]>([])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
      return
    }

    if (user) {
      checkOnboarding()
      fetchDashboard()
      fetchLifeScore()
    }
  }, [user, loading, router])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(QUICK_ACCESS_RECENTS_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        setRecentQuickAccessIds(parsed.filter((id): id is string => typeof id === "string").slice(0, 3))
      }
    } catch {
      setRecentQuickAccessIds([])
    }
  }, [])

  const recordQuickAccess = (action: QuickAccessAction) => {
    setRecentQuickAccessIds((current) => {
      const next = [action.id, ...current.filter((id) => id !== action.id)].slice(0, 3)
      try {
        window.localStorage.setItem(QUICK_ACCESS_RECENTS_KEY, JSON.stringify(next))
      } catch {
        // localStorage is a convenience cache; navigation should never depend on it.
      }
      return next
    })
  }

  const recentQuickActions = useMemo(
    () =>
      recentQuickAccessIds
        .map((id) => allQuickActions.find((action) => action.id === id))
        .filter((action): action is QuickAccessAction => Boolean(action)),
    [recentQuickAccessIds],
  )

  const checkOnboarding = async () => {
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
  }

  const fetchLifeScore = async () => {
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
  }

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

  const fetchDashboard = async () => {
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

    try {
      const notificationsRes = await fetch("/api/notifications")
      if (notificationsRes.ok) {
        const notificationsData = await notificationsRes.json()
        setNotifications(Array.isArray(notificationsData.notifications) ? notificationsData.notifications.slice(0, 5) : [])
      }
    } catch {
      setNotifications([])
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
  }

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
  const secondaryCount = [
    lifeScore?.ready ? 1 : 0,
    recentActivity.length,
    notifications.length,
    pendingAllCount ?? 0,
  ].reduce((total, count) => total + count, 0)

  const hasAnyErrors = Object.keys(errors).length > 0

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

      <div className="space-y-5 md:space-y-6">
        <section className="surface-card section-enter rounded-lg border border-primary/20 bg-primary/5 p-4 md:p-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div>
              <p className="text-sm text-muted-foreground">Today at a glance</p>
              <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">Welcome back, {firstName}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Start with the few things that matter today. Everything else can stay below the fold until you need it.
              </p>
            </div>
            <Button asChild className="w-fit gap-2">
              <Link href="/today">
                <Sparkles className="h-4 w-4" />
                Plan my day with AI
              </Link>
            </Button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {dashboardLoading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : errors.today ? (
              <div className="lg:col-span-3">
                <SectionUnavailable label="Today focus" />
              </div>
            ) : focusItems.length > 0 ? (
              focusItems.slice(0, 3).map((item, index) => (
                <Link key={item.id || index} href={item.href || "/today"} className="interactive-card rounded-md border bg-background/85 p-3 hover:bg-secondary">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {item.subtitle || item.source_type || "Focus item"}
                      </span>
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-md border border-dashed bg-background/70 p-4 lg:col-span-3">
                <p className="text-sm font-medium text-foreground">No focus items selected yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">Open Today to choose up to three priorities for this day.</p>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="surface-card">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overdue tasks</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{dashboardLoading ? "—" : overdueTaskCount}</p>
            </CardContent>
          </Card>
          <Card className="surface-card">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Habits due today</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{dashboardLoading ? "—" : habitsDueToday}</p>
            </CardContent>
          </Card>
          <Card className="surface-card">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Budget used</p>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {dashboardLoading ? "—" : budgetUsedPercent === null ? "No data" : `${budgetUsedPercent}%`}
              </p>
            </CardContent>
          </Card>
          <Card className="surface-card">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Next event</p>
              <p className="mt-2 truncate text-lg font-semibold text-foreground">
                {dashboardLoading ? "—" : nextCalendarEvent?.title || "No event today"}
              </p>
              {nextCalendarEvent?.subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{nextCalendarEvent.subtitle}</p>}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button type="button" size="lg" className="gap-2" onClick={() => setQuickAddType("task")}>
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
          <Button type="button" size="lg" variant="outline" className="gap-2 bg-background/80" onClick={() => setQuickAddType("inbox")}>
            <Inbox className="h-4 w-4" />
            Capture Thought
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2 bg-background/80">
            <Link href={`/journal?date=${localDateString()}`}>
              <BookOpenText className="h-4 w-4" />
              Open Journal
            </Link>
          </Button>
        </div>

        <DomainTodayOverview />

        <Collapsible open={secondaryOpen} onOpenChange={setSecondaryOpen} className="space-y-5">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" className="w-full justify-between rounded-lg border border-dashed bg-muted/20 px-4">
              <span>Secondary dashboard cards{secondaryCount ? ` · ${secondaryCount} signals` : ""}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", secondaryOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-5">
            <QuickAccessSection recentActions={recentQuickActions} onActionClick={recordQuickAccess} />

        {hasAnyErrors && (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>Some dashboard sections could not load. No fallback numbers are being shown for failed data.</span>
            </div>
          </div>
        )}

        <Card className="surface-card section-enter border-primary/20">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-primary" />
                  LifeScore
                </CardTitle>
                <CardDescription>A calm daily signal for how organized your LifeSort system is.</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={explainLifeScore}
                disabled={lifeScoreAiLoading || lifeScoreLoading || Boolean(lifeScoreError) || Boolean(lifeScore && !lifeScore.ready)}
              >
                <Sparkles className="h-4 w-4" />
                {lifeScoreAiLoading ? "Explaining..." : "Explain with AI"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lifeScoreLoading ? (
              <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                <Skeleton className="h-24 w-full" />
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>
            ) : lifeScoreError ? (
              <SectionUnavailable label="LifeScore" />
            ) : lifeScore && lifeScore.ready ? (
              <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                <div className="surface-card rounded-md border bg-muted/30 p-4">
                  <div className="flex items-end gap-2">
                    <p className="text-4xl font-bold leading-none">{lifeScore.score}</p>
                    <p className="pb-1 text-sm text-muted-foreground">/100</p>
                  </div>
                  <Badge variant="secondary" className="mt-3">{lifeScore.label}</Badge>
                  <p className="mt-2 text-sm text-muted-foreground">{lifeScoreChangeText(lifeScore.change)}</p>
                </div>

                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    {compactLifeScoreComponents.map((item) => (
                      <Link key={item.key} href={item.href} className="interactive-card rounded-md border bg-background/70 p-3 hover:bg-secondary">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium">{item.label}</p>
                          <span className="text-sm font-semibold">{item.score}</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-muted">
                          <div
                            className={`h-1.5 rounded-full ${lifeScoreStatusClass(item.status)}`}
                            style={{ width: `${item.score}%` }}
                          />
                        </div>
                      </Link>
                    ))}
                  </div>
                  <div className="rounded-md border bg-background/70 p-3">
                    <p className="text-sm font-medium">Attention signal</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {lifeScore.reasons[0] || lifeScore.top_improvements[0]?.description || "Your current LifeSort signal is ready."}
                    </p>
                  </div>
                  {(lifeScoreAi || lifeScoreAiError) && (
                    <div className="rounded-md border bg-primary/5 p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="h-4 w-4 text-primary" />
                        AI explanation
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {lifeScoreAiError || lifeScoreAi?.summary}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <AppEmptyState
                icon={Gauge}
                title="LifeScore is waiting for real data"
                hint="Add a task, focus item, habit, goal, review, commitment, maintenance item, or Life Domain activity and your score will appear here."
                primaryAction={{ label: "Start Today", href: "/today" }}
                className="border-dashed bg-background/70"
              />
            )}
          </CardContent>
        </Card>

        <div className="section-enter grid gap-4 lg:grid-cols-3">
          <Card className="surface-card border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarCheck className="h-5 w-5 text-primary" />
                    Open Today
                  </CardTitle>
                  <CardDescription>Your daily focus, due items, schedule, and reflection.</CardDescription>
                </div>
                <Button asChild size="sm" className="gap-2">
                  <Link href="/today">
                    Open Today
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : errors.today ? (
                <SectionUnavailable label="Today" />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-md border bg-background/70 p-3">
                    <p className="text-2xl font-bold">{todayPreview?.summary?.focusItems || 0}/3</p>
                    <p className="text-xs text-muted-foreground">focus selected</p>
                  </div>
                  <div className="rounded-md border bg-background/70 p-3">
                    <p className="text-2xl font-bold">{todayPreview?.summary?.dueOrOverdueItems ?? todayPreview?.summary?.dueOrOverdueTasks ?? 0}</p>
                    <p className="text-xs text-muted-foreground">due items</p>
                  </div>
                  <div className="rounded-md border bg-background/70 p-3">
                    <p className="text-2xl font-bold">{todayPreview?.summary?.calendarToday || 0}</p>
                    <p className="text-xs text-muted-foreground">calendar today</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="surface-card border-amber-500/20 bg-amber-500/5">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpenText className="h-5 w-5 text-amber-600 dark:text-amber-300" />
                    Journal
                  </CardTitle>
                  <CardDescription>Gratitude, reflection, and tomorrow setup.</CardDescription>
                </div>
                <Badge variant={journalPreview ? "secondary" : "outline"}>
                  {errors.journal ? "Unavailable" : journalPreview ? "Started" : "Not started"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboardLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : errors.journal ? (
                <SectionUnavailable label="Journal" />
              ) : (
                <>
                  <p className="line-clamp-3 text-sm text-muted-foreground">{journalPreviewText}</p>
                  <Button asChild size="sm" variant="outline" className="w-full gap-2 bg-background/80">
                    <Link href={`/journal?date=${localDateString()}`}>
                      Open Journal
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 text-primary" />
                    Money
                  </CardTitle>
                  <CardDescription>Compact finance snapshot from your tracked data.</CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-2">
                  <Link href="/money">
                    Open Money
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ) : errors.budget && errors.income && errors.investments ? (
                <SectionUnavailable label="Money" />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-lg font-semibold">{errors.income ? "—" : formatCurrency(monthlyIncome)}</p>
                    <p className="text-xs text-muted-foreground">monthly income</p>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-lg font-semibold">{errors.budget ? "—" : formatCurrency(budgetBalance)}</p>
                    <p className="text-xs text-muted-foreground">budget balance</p>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-lg font-semibold">{errors.investments ? "—" : formatCurrency(investmentTotal)}</p>
                    <p className="text-xs text-muted-foreground">portfolio</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="surface-card section-enter">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-primary" />
                  Pending
                </CardTitle>
                <CardDescription>Inbox, someday reviews, follow-ups, commitments, and maintenance in one place.</CardDescription>
              </div>
              {pendingAllCount !== null && (
                <Badge variant="secondary">{pendingAllCount} pending</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button
                type="button"
                size="sm"
                variant={activePendingFilter === "all" ? "default" : "outline"}
                className="shrink-0"
                onClick={() => setActivePendingFilter("all")}
              >
                All{pendingAllCount !== null ? ` ${pendingAllCount}` : ""}
              </Button>
              {pendingSources.map((source) => (
                <Button
                  key={source.key}
                  type="button"
                  size="sm"
                  variant={activePendingFilter === source.key ? "default" : "outline"}
                  className="shrink-0 gap-1.5"
                  onClick={() => setActivePendingFilter(source.key)}
                >
                  <source.icon className="h-3.5 w-3.5" />
                  {source.label}
                  {typeof source.count === "number" ? ` ${source.count}` : ""}
                </Button>
              ))}
            </div>

            {dashboardLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : pendingItems.length === 0 ? (
              <AppEmptyState
                icon={Inbox}
                title={activePendingFilter === "all" ? "Nothing pending right now" : `${activePendingSource?.label || "This area"} is clear`}
                hint={
                  activePendingFilter === "all"
                    ? "You are clear for now. Capture anything new from the command palette."
                    : "No pending items are asking for attention here."
                }
                primaryAction={{
                  label: activePendingSource ? `Open ${activePendingSource.label}` : "Open Workspace",
                  href: activePendingSource?.href || "/workspace",
                }}
                allClear
                className="border-dashed bg-background/70"
              />
            ) : (
              <div className="space-y-2">
                {pendingItems.map((item) => (
                  <Link key={item.id} href={item.href} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-secondary">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{item.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{item.date}</span>
                  </Link>
                ))}
              </div>
            )}

            {pendingUnavailable.length > 0 && (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Pending counts unavailable for {pendingUnavailable.join(", ")}.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="surface-card section-enter">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Real updates from your LifeSort modules.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dashboardLoading ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : errors.tasks && errors.goals && errors.notes && errors.wishlist && errors.investments && errors.income ? (
                <SectionUnavailable label="Activity" />
              ) : recentActivity.length === 0 ? (
                <AppEmptyState
                  icon={Zap}
                  title="No recent activity yet"
                  hint="Updates will appear here after you add or change tasks, goals, notes, money items, or projects."
                  primaryAction={{ label: "Open Workspace", href: "/workspace" }}
                  className="border-dashed bg-background/70"
                />
              ) : (
                recentActivity.map((activity) => (
                  <Link key={activity.id} href={activity.href} className="block rounded-md border p-3 hover:bg-secondary">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium">{activity.title}</p>
                      <Badge variant="outline">{activity.type}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {activity.label} · {timeAgo(activity.at)}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="surface-card section-enter">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-primary" />
                      Notifications
                    </CardTitle>
                    <CardDescription>Recent nudges and wins from LifeSort.</CardDescription>
                  </div>
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <Link href="/notifications">
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboardLoading ? (
                  <>
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </>
                ) : notifications.length === 0 ? (
                  <AppEmptyState
                    icon={Bell}
                    title="No notifications right now"
                    hint="Warnings and encouragement will appear here when something needs attention."
                    allClear
                    className="border-dashed bg-background/70"
                  />
                ) : (
                  notifications.map((notification) => (
                    <Link key={notification.id} href="/notifications" className="block rounded-md border p-3 hover:bg-secondary">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-1 text-sm font-medium">{notification.title}</p>
                        {!notification.is_read && <Badge variant="secondary">New</Badge>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{notification.message}</p>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <FavoritesTodo />
          </div>
        </div>
          </CollapsibleContent>
        </Collapsible>

      </div>
      <QuickAddModal
        open={Boolean(quickAddType)}
        onOpenChange={(open) => {
          if (!open) setQuickAddType(null)
        }}
        initialType={quickAddType}
      />
    </DashboardLayout>
  )
}
